// ✅ Imports
import scrapeWebsite from '../services/LinkedInScraper.js';
import Resume from '../models/Resume.js';
import ScrapedJob from '../models/ScrapedJob.js';
import ScrapeSession from '../models/ScrapeSession.js';
import { callDeepSeekAPI } from '../utils/deepseek.js';
import Job from '../models/Job.js';
import { tailorResumes } from '../services/tailorResume.js';

// Constants
const CHUNK_SIZE = 20;

// Utility: Split array into chunks
function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

// Main async scrape and filter workflow
export const asyncScrapeAndFilter = async (sessionId, url) => {
  try {
    const session = await ScrapeSession.findById(sessionId);
    if (!session) throw new Error('ScrapeSession not found');

    const { resumeId, tags } = session;
    const resume = await Resume.findById(resumeId);
    if (!resume) throw new Error('Resume not found');

    const resumeText = resume.textContent;
    const keywordsArr = tags.map(t => t.trim());

    const { allJobs, batchId } = await scrapeWebsite(url || undefined, sessionId);

    const scrapedJobs = await ScrapedJob.find(
      { batchId },
      { _id: 1, title: 1, description: 1 }
    ).lean();

    await ScrapeSession.findByIdAndUpdate(sessionId, {
      status: 'filtering',
      batchId,
      note: 'Filtering in progress...'
    });

    const allFormatted = scrapedJobs.map(j => ({
      id: j._id.toString(),
      title: j.title,
      description: j.description || ''
    }));

    const jobChunks = chunkArray(allFormatted, CHUNK_SIZE);
    let matched = [], borderline = [], rejected = [];

    for (const [index, chunk] of jobChunks.entries()) {
      try {
        let response = await callDeepSeekAPI(
          buildSystemPrompt(),
          buildUserPrompt({ scrapedJobsArr: chunk, keywordsArr, resumeText })
        );

        console.log(`\n--- DeepSeek Response (Chunk ${index + 1}) ---`);
        console.log(response);

        // Attempt to parse stringified JSON (just in case)
        if (typeof response === 'string') {
          try {
            const cleaned = response
              .replace(/^```json\s*/i, '')
              .replace(/^```/, '')
              .replace(/```$/, '')
              .trim();

            response = JSON.parse(cleaned);
          } catch (parseError) {
            console.error('❌ Failed to parse DeepSeek API response:', response);
            continue;
          }
        }

        if (response?.matched) matched.push(...response.matched);
        if (response?.borderline) borderline.push(...response.borderline);
        if (response?.rejected) rejected.push(...response.rejected);

      } catch (chunkError) {
        console.error(`❌ Error processing chunk ${index + 1}:`, chunkError.message);
        continue;
      }
    }

    const result = await processScrapedJobs({ matched, borderline, rejected });
    const jobs = await saveJobs(sessionId);

    if (jobs.length > 0) {
      await tailorResumes(jobs);  // tailor only these new jobs!
    } else {
      console.log('No new jobs to tailor.');
    }

    await ScrapeSession.findByIdAndUpdate(sessionId, {
      status: 'done',
      jobCount: allFormatted.length,
      filteredCount: matched.length,
      note: `Filtering complete. Found ${matched.length} relevant jobs.`
    });
  } catch (error) {
    await ScrapeSession.findByIdAndUpdate(sessionId, {
      status: 'failed',
      error: error.message
    });
    console.error('❌ asyncScrapeAndFilter failed:', error);
    throw error;
  }
};

// Update ScrapedJob documents after filtering
export const processScrapedJobs = async ({ matched = [], borderline = [], rejected = [] }) => {
  const updates = await Promise.allSettled([
    ...matched.map(job => ScrapedJob.findByIdAndUpdate(job.id, {
      isRelevant: true,
      is_deleted: false,
      rejectionReason: null
    }, { new: true })),

    ...borderline.map(job => ScrapedJob.findByIdAndUpdate(job.id, {
      isRelevant: false,
      is_deleted: false,
      rejectionReason: job.reason || 'Borderline match: minor mismatch'
    }, { new: true })),

    ...rejected.map(job => ScrapedJob.findByIdAndUpdate(job.id, {
      isRelevant: false,
      is_deleted: true,
      rejectionReason: job.rejectionReason || 'Not relevant'
    }, { new: true }))
  ]);

  return {
    totalProcessed: matched.length + borderline.length + rejected.length,
    updatedSuccessfully: updates.filter(u => u.status === 'fulfilled').length,
    failedUpdates: updates.filter(u => u.status === 'rejected').map(e => e.reason)
  };
};

// Save filtered jobs (matched or borderline) to Job collection
const saveJobs = async (sessionId) => {
  try {
    const session = await ScrapeSession.findById(sessionId);
    if (!session) throw new Error('ScrapeSession not found');

    const { batchId } = session;
    const scrapedJobs = await ScrapedJob.find({ batchId });
    const savedJobs = [];

    for (const job of scrapedJobs) {
      if (!job.is_deleted) {
        const existingJob = await Job.findOne({ url: job.url, createdBy: job.createdBy });
        if (existingJob) continue;

        const newJob = new Job({
          title: job.title,
          url: job.url,
          companyName: job.companyName,
          companyUrl: job.companyUrl,
          location: job.location,
          postedTime: job.postedTime,
          description: job.description,
          createdBy: job.createdBy,
          batchId: job.batchId,
          rejectionReason: job.rejectionReason,
          tailoredResumeLatex: null
        });

        await newJob.save();
        savedJobs.push(newJob); // Collect saved job
      }
    }

    return savedJobs; // Return the array of saved jobs

  } catch (error) {
    console.error('Error saving jobs:', error.message);
    return []; // Return empty array on error
  }
};


// Build DeepSeek system prompt (rules for filtering)
const buildSystemPrompt = () => `
You are an AI job-matching engine that classifies scraped jobs into three categories based on a user's resume and target skills.

You will receive:
- scrapedJobsArr: Array of job objects, each with { id, title, description }
- keywordsArr: List of technologies or roles the user is targeting
- resumeText: The user’s resume in plain text

🎯 Your Task:
Evaluate each job in scrapedJobsArr and classify it as one of:
1. "matched" – Strongly relevant
2. "borderline" – Somewhat relevant, worth showing
3. "rejected" – Not a match

🧠 Matching Rules:

✅ **Matched Jobs** (high-confidence):
- At least **2 or more matching skills/technologies/tools**
- Matches title (or reasonable equivalent)
- Passes experience requirement (or comes close for junior roles)

⚠️ **Borderline Jobs** (partial match):
- Only **1 strong skill match**
- OR missing **only 1 key requirement**
- OR good title/tech match, but resume is slightly lacking
- These jobs should include a "reason" field that explains the borderline status

❌ **Rejected Jobs** (clear mismatch):
- No strong tech/tool overlap
- OR requires very specific tools or domains (e.g., PyTorch, Guidewire, ServiceNow) that are not present
- Must include a "rejectionReason" — clear and specific (not vague)

💡 Conceptual Title Equivalents (apply flexibly):
- Full Stack ≈ Software Engineer ≈ Web Developer
- DevOps ≈ SRE ≈ Cloud Engineer
- Backend ≈ API Developer ≈ Server Engineer
- Frontend ≈ JavaScript Developer ≈ UI Engineer
- Security ≈ Application Security ≈ Cloud Security

🚫 Reject jobs requiring:
- "French", "Bilingual", or other non-English languages (unless resume mentions it)
- Niche domain tools (e.g., SAS AML, Guidewire, CNC tools) not found in resume/keywordsArr

📤 Output Format:
Return a JSON object:
{
  matched: [ { id, title } ],
  borderline: [ { id, title, reason } ],
  rejected: [ { id, title, rejectionReason } ]
}

📌 Reason Guidelines:
- Must be **specific and one-line**
- Examples:
  - "Missing Kubernetes but has Docker and CI/CD"
  - "Requires SAS AML domain tools not found in resume"
  - "Has React and Node but lacks GraphQL"

Strict Instructions:
- DO NOT fabricate or modify job data
- NO explanation or commentary outside the JSON
- BE DETERMINISTIC: same input → same output
- Return plain JSON only. Do NOT wrap in markdown like '``\`json' or '\`\`\`'.
`.trim();

// Build user prompt for DeepSeek
const buildUserPrompt = ({ scrapedJobsArr, keywordsArr, resumeText }) => {
  if (!Array.isArray(scrapedJobsArr)) throw new Error('scrapedJobsArr must be an array');
  if (!Array.isArray(keywordsArr)) throw new Error('keywordsArr must be an array');
  if (typeof resumeText !== 'string') throw new Error('resumeText must be a string');

  // Only include id, title, description
  const jobArrClean = scrapedJobsArr.map(job => ({
    id: job.id,
    title: job.title || '',
    description: job.description || ''
  }));

  return `
ScrapedJobs Array:
${JSON.stringify(jobArrClean, null, 2)}

Keywords Array:
${keywordsArr.join(', ')}

Resume Text:
${resumeText}
  `.trim();
};

// ✅ Imports
import scrapeWebsite from '../services/LinkedInScraper.js';
import Resume from '../models/Resume.js';
import ScrapedJob from '../models/ScrapedJob.js';
import ScrapeSession from '../models/ScrapeSession.js';
import { callDeepSeekAPI } from '../utils/deepseek.js';

const CHUNK_SIZE = 20;

function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export const asyncScrapeAndFilter = async (sessionId, url) => {
  try {
    const session = await ScrapeSession.findById(sessionId);
    if (!session) throw new Error('ScrapeSession not found');

    const { resumeId, tags } = session;
    const resume = await Resume.findById(resumeId);
    if (!resume) throw new Error('Resume not found');

    const resumeText = resume.textContent;
    const keywordsArr = tags.map(t => t.trim());

    // 🔥 Start scraping
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
    let allFiltered = [];

    for (const [index, chunk] of jobChunks.entries()) {
      try {
        let response = await callDeepSeekAPI(
          buildSystemPrompt(),
          buildUserPrompt({ scrapedJobsArr: chunk, keywordsArr, resumeText })
        );

        console.log(`\n--- DeepSeek Response (Chunk ${index + 1}) ---`);
        console.log(response);

        if (typeof response === 'string') {
          try {
            const jsonStart = response.indexOf('[');
            const jsonEnd = response.lastIndexOf(']') + 1;
            const rawJson = response.slice(jsonStart, jsonEnd);
            response = JSON.parse(rawJson);
          } catch (parseError) {
            console.error('❌ Failed to parse DeepSeek API response:', response);
            continue;
          }
        }

        if (Array.isArray(response)) {
          allFiltered.push(...response);
        }
      } catch (chunkError) {
        console.error(`❌ Error processing chunk ${index + 1}:`, chunkError.message);
        continue;
      }
    }

    const updatedScrapedJobs = await processScrapedJobs(allFiltered);
    console.log(updatedScrapedJobs);

    await ScrapeSession.findByIdAndUpdate(sessionId, {
      status: 'done',
      jobCount: allFormatted.length,
      filteredCount: allFiltered.length,
      note: `Filtering complete. Found ${allFiltered.length} relevant jobs.`
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


/**
 * Process DeepSeek-filtered jobs and update ScrapedJob documents.
 * @param {Array} deepSeekResultArr - Array of jobs from DeepSeek filtering
 * @returns {Object} Summary of updated jobs
 */
export const processScrapedJobs = async (deepSeekResultArr = []) => {
  if (!Array.isArray(deepSeekResultArr) || deepSeekResultArr.length === 0) {
    throw new Error('Invalid or empty input to processScrapedJobs.');
  }

  const updates = await Promise.allSettled(
    deepSeekResultArr.map(async (job) => {
      const { id, rejectionReason } = job;

      if (!id) return { status: 'rejected', reason: 'Missing job ID' };

      const updateFields = rejectionReason
        ? {
            isRelevant: false,
            is_deleted: true,
            rejectionReason,
          }
        : {
            isRelevant: true,
            is_deleted: false,
            rejectionReason: null,
          };

      return await ScrapedJob.findByIdAndUpdate(id, updateFields, {
        new: true,
      });
    })
  );

  const resultSummary = {
    totalProcessed: deepSeekResultArr.length,
    updatedSuccessfully: updates.filter(r => r.status === 'fulfilled').length,
    failedUpdates: updates.filter(r => r.status === 'rejected').map(r => r.reason),
  };

  return resultSummary;
};

const buildSystemPrompt = () => {
  return `
You are an AI job-matching engine. Your job is to evaluate a list of scraped jobs and decide whether they are relevant to the user based on their resume and skills.

You will receive:
- scrapedJobsArr: Array of jobs — each with { id, title, description }
- keywordsArr: List of technologies or roles the user is targeting
- resumeText: The user’s resume in plain text

Your task:
Return every job from scrapedJobsArr. For each job:
- If relevant: include { id, title }
- If not relevant: include { id, title, rejectionReason }

🏁 Matching Rules (be flexible but smart):

1. ✅ **Skill Match (at least 2+ relevant matches required — not 3)**:
   A job is relevant if it includes at least **2 technologies/tools** from:
   - resumeText
   - keywordsArr
   - similar equivalents (e.g., AWS ≈ Azure ≈ GCP, React ≈ Vue ≈ Angular, PostgreSQL ≈ MySQL)

   ➤ Prefer strong overlap, but allow for synonyms, related stacks, or reasonable substitutions.

2. ✅ **Experience Level (match titles, not years only)**:
   - For roles with "Senior", "Lead", "Principal", or "5+ years":
     ➤ Accept if resume shows 2+ years **and** senior-sounding roles, independent project ownership, or full lifecycle work.
   - Do **not** reject solely due to lack of exact year count.

3. ✅ **Title Relevance by Conceptual Match**:
   Accept a job if the role title aligns conceptually with resume experience.
   Examples:
   - Full Stack ≈ Software Engineer ≈ Web Developer
   - Backend ≈ API Developer ≈ Django/Node Engineer
   - DevOps ≈ Cloud Engineer ≈ Infrastructure Automation

4. ✅ **Don’t reject if the user has *partial exposure***:
   If the user shows partial experience (e.g., AWS EC2 + Docker but not Kubernetes), mark it as relevant unless the JD is extremely strict.

5. 🚫 **Reject only for clear blockers**:
   Only reject if the job **clearly and explicitly** demands something not in the resume:
   - Language requirements ("French required")
   - Niche platforms/tools (e.g., Guidewire, SAS AML, CNC CAD systems) that are not remotely mentioned
   - Hardcore ML roles with PyTorch, TensorFlow, if none of it is in resume

📝 Output Format:
Return an array of:
- { id, title }                            → if relevant
- { id, title, rejectionReason }          → if not relevant

📌 rejectionReason must be a short, **precise one-liner** naming **missing tool or reason**.

❌ Don’t use vague phrases like “not a match”  
✅ Say things like:
- "Missing Kubernetes or container orchestration experience"
- "Requires PyTorch or ML frameworks not found in resume"
- "Job requires Guidewire suite, not present in resume"

Strict Instructions:
- Never fabricate jobs
- Don't change job titles
- Never invent reasons — explain clearly based on resume or keywordsArr
- Output ONLY the required JSON structure — no additional commentary

⚠️ Be slightly **lenient and optimistic** — prioritize **possible success** over excessive filtering. Assume the user can learn and adapt quickly.

Example:
[
  { "id": "abc123", "title": "Software Developer" },
  { "id": "xyz456", "title": "ML Engineer", "rejectionReason": "Requires PyTorch and NLP, not found in resume" }
]
`.trim();
};



const buildUserPrompt = ({ scrapedJobsArr, keywordsArr, resumeText }) => {
  if (!Array.isArray(scrapedJobsArr)) throw new Error('scrapedJobsArr must be an array');
  if (!Array.isArray(keywordsArr)) throw new Error('keywordsArr must be an array');
  if (typeof resumeText !== 'string') throw new Error('resumeText must be a string');

  return `ScrapedJobs Array:
${JSON.stringify(
  scrapedJobsArr.map(job => ({
    id: job.id,
    title: job.title || '',
    description: job.description || ''
  })),
  null,
  2
)}

Keywords Array:
${keywordsArr.join(', ')}

Resume Text:
${resumeText}`;
};

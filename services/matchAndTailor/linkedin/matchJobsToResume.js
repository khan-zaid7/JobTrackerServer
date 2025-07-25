import ScrapedJob from '../../../models/ScrapedJob.js';
import PipelineSession from '../../../models/PipelineSession.js';
import { callDeepSeekAPI } from '../../../utils/deepseek.js';
const CHUNK_SIZE = 20;

function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}
export const matchJobsToResume = async (batchToken, resume, tags = []) => {
  // start a new pipeline session
  const pipelineSession = await PipelineSession.create({
    userId: '680860a5c86b10aabe3bd656',
    batchId: batchToken,
    resumeId: resume._id,
    tags: tags,
    status: 'pending',
    note: 'Starting scrape...'
  });

  try {
    if (!resume) throw new Error('Resume is required');

    const resumeText = resume.textContent;
    const keywordsArr = tags.map(t => t.trim());

    const scrapedJobs = await ScrapedJob.find(
      { batchId: batchToken },
      { _id: 1, title: 1, description: 1, companyName: 1, location: 1 }
    ).lean();

    console.warn(`SCRAPED JOBS: ${scrapedJobs}`)

    if (!scrapedJobs.length) {
      await PipelineSession.findByIdAndUpdate(pipelineSession.id, {
        status: 'done',
        jobCount: 0,
        filteredCount: 0,
        note: 'No jobs to filter.'
      });
      return;
    }

    await PipelineSession.findByIdAndUpdate(pipelineSession.id, {
      status: 'filtering',
      batchId: batchToken,
      note: 'Filtering in progress...'
    });

    const allFormattedJobs = scrapedJobs.map(j => ({
      id: j._id.toString(),
      title: j.title,
      description: j.description || '',
      companyName: j.companyName || '',
      location: j.location || ''
    }));

    const jobChunks = chunkArray(allFormattedJobs, CHUNK_SIZE);
    let matched = [], borderline = [], rejected = [];

    for (const [index, chunk] of jobChunks.entries()) {
      try {
        let response = await callDeepSeekAPI(
          buildSystemPrompt(),
          buildUserPrompt({ scrapedJobsArr: chunk, keywordsArr, resumeText })
        );

        console.log(`\n--- DeepSeek Response (Chunk ${index + 1}) ---`);
        console.log(response);

        if (response?.matched) matched.push(...response.matched);
        if (response?.borderline) borderline.push(...response.borderline);
        if (response?.rejected) rejected.push(...response.rejected);

      } catch (chunkError) {
        console.error(`❌ Error processing chunk ${index + 1}:`, chunkError.message);
        continue;
      }
    }

    const result = await processScrapedJobs({ matched, borderline, rejected });
    console.log(result);

    await PipelineSession.findByIdAndUpdate(pipelineSession.id, {
      status: 'done',
      jobCount: allFormattedJobs.length,
      filteredCount: matched.length,
      note: `Filtering complete. Found ${matched.length} relevant jobs.`
    });
  } catch (error) {
    await PipelineSession.findByIdAndUpdate(pipelineSession.id, {
      status: 'failed',
      error: error.message
    });
    console.error('❌ asyncScrapeAndFilter failed:', error);
    throw error;
  }
};

export const processScrapedJobs = async ({ matched = [], borderline = [], rejected = [] }) => {
  const updates = await Promise.allSettled([
    ...matched.map(job => ScrapedJob.findByIdAndUpdate(job.id, {
      isRelevant: true,
      is_deleted: false,
      rejectionReason: null,
      confidenceFactor: job.confidence
    }, { new: true })),

    ...borderline.map(job => ScrapedJob.findByIdAndUpdate(job.id, {
      isRelevant: false,
      is_deleted: false,
      rejectionReason: job.reason || 'Borderline match: minor mismatch',
      confidenceFactor: job.confidence
    }, { new: true })),

    ...rejected.map(job => ScrapedJob.findByIdAndUpdate(job.id, {
      isRelevant: false,
      is_deleted: true,
      rejectionReason: job.rejectionReason || 'Not relevant',
      confidenceFactor: job.confidence
    }, { new: true }))
  ]);

  return {
    totalProcessed: matched.length + borderline.length + rejected.length,
    updatedSuccessfully: updates.filter(u => u.status === 'fulfilled').length,
    failedUpdates: updates.filter(u => u.status === 'rejected').map(e => e.reason)
  };
};


const buildSystemPrompt = () => {
  return `
    You are an AI job-matching engine that classifies scraped jobs into three categories based on a user's resume and target skills.

    You will receive:
    - scrapedJobsArr: Array of job objects, each with { id, title, description, companyName, location }
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

    📊 **Required: Confidence** :
    - Add a numeric confidence score (0 to 1) for each job
    - Reflect overall match quality (e.g., skill overlap, title match, resume support)
    - Use:
      - 0.9–1.0 for strong match
      - 0.6–0.89 for borderline
      - below 0.6 for rejected

    Strict Instructions:
    - DO NOT fabricate or modify job data
    - NO explanation or commentary outside the JSON
    - BE DETERMINISTIC: same input → same output
    - Return plain JSON only. Do NOT wrap in markdown like '\`\`\`json or \`\`\`.'

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
      description: flattenDescription(job.description),
      companyName: job.companyName,
      location: job.location

    })),
    null,
    2
  )}

Keywords Array:
${keywordsArr.join(', ')}

Resume Text:
${resumeText}`;
};

function flattenDescription(desc) {
  if (!desc || typeof desc !== 'object') return '';

  const parts = [];

  if (Array.isArray(desc.responsibilities)) {
    parts.push('Responsibilities:\n' + desc.responsibilities.join('\n'));
  }

  if (Array.isArray(desc.qualifications)) {
    parts.push('Qualifications:\n' + desc.qualifications.join('\n'));
  }

  if (Array.isArray(desc.benefits)) {
    parts.push('Benefits:\n' + desc.benefits.join('\n'));
  }

  return parts.join('\n\n');
}

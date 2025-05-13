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
    const { allJobs, batchId } = await scrapeWebsite(url ? url : undefined, sessionId);
    const scrapedJobs = await ScrapedJob.find(
      { batchId, isRelevant: false, is_deleted: false },
      { _id: 1, title: 1 }
    ).lean();

    await ScrapeSession.findByIdAndUpdate(sessionId, {
      status: 'filtering',
      batchId,
      note: 'Filtering in progress...'
    });

    const allFormatted = scrapedJobs.map(j => ({ id: j._id.toString(), title: j.title }));
    const jobChunks = chunkArray(allFormatted, CHUNK_SIZE);

    let allFiltered = [];

    for (const chunk of jobChunks) {
      let response = await callDeepSeekAPI(
        buildSystemPrompt(),
        buildUserPrompt({ scrapedJobsArr: chunk, keywordsArr, resumeText })
      );

      if (typeof response === 'string') response = JSON.parse(response);
      if (Array.isArray(response)) allFiltered.push(...response);
    }

    await processScrapedJobs(allFormatted, allFiltered);

    await ScrapeSession.findByIdAndUpdate(sessionId, {
      status: 'done',
      jobCount: allFormatted.length,
      note: 'Done filtering.'
    });
  } catch (error) {
    await ScrapeSession.findByIdAndUpdate(sessionId, {
      status: 'failed',
      error: error.message
    });
    console.error('❌ asyncScrapeAndFilter failed:', error);
  }
};

export const processScrapedJobs = async (allJobs, filteredJobs) => {
    try {
        const filteredJobIds = new Set(filteredJobs.map(job => job.id));
        const allJobIds = allJobs.map(job => job.id);

        // 1. Mark filtered (relevant) jobs with isRelevant: true
        await ScrapedJob.updateMany(
            { _id: { $in: Array.from(filteredJobIds) } },
            { $set: { isRelevant: true } }
        );

        // 2. Mark the rest as is_deleted: true and isRelevant: false
        const nonRelevantJobIds = allJobIds.filter(id => !filteredJobIds.has(id));

        await ScrapedJob.updateMany(
            { _id: { $in: nonRelevantJobIds } },
            { $set: { is_deleted: true, isRelevant: false } }
        );

        console.log(`✅ Updated ${filteredJobIds.size} relevant jobs and ${nonRelevantJobIds.length} non-relevant jobs`);
    } catch (error) {
        console.error('❌ Error in processScrapedJobs:', error.message);
        throw error;
    }
};


const buildSystemPrompt = () => {
    return `
You are a job-matching assistant.

You will receive:
1. scrapedJobsArr — an array of job objects, each with { id, title }.
2. keywordsArr — a list of skills or technologies the user has or is targeting.
3. resumeText — the user's resume content in plain text.

Your task:
- Filter ONLY the provided job objects from scrapedJobsArr.
- DO NOT create or invent any job titles or job objects.
- Only return jobs that are listed in scrapedJobsArr and are relevant based on resumeText OR keywordsArr.

A job is considered relevant if:
- The job title matches a skill, role, or topic from the keywordsArr.
- OR the job title aligns with the user's education or experience in resumeText.

Strict Rules:
- DO NOT hallucinate or invent job titles not in scrapedJobsArr.
- DO NOT explain anything.
- DO NOT include any markdown formatting (no triple backticks, no "json" tag).
- DO NOT include any extra text before or after the array.
- DO NOT return an empty array unless there are truly zero matches.
- DO NOT include comments or notes.

Output Format:
Return only a raw JSON array directly, like this:
[
  { "id": "abc123", "title": "React Developer" },
  { "id": "xyz456", "title": "Node.js Engineer" }
]
`.trim();
};


const buildUserPrompt = ({ scrapedJobsArr, keywordsArr, resumeText }) => {
    return `ScrapedJobs Array:
${JSON.stringify(scrapedJobsArr, null, 2)}

keywords Array:
${keywordsArr.join(', ')}

Resume Text:
${resumeText}`;
};
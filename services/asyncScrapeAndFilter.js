import scrapeWebsite from '../services/LinkedInScraper.js';
import Resume from '../models/Resume.js';
import ScrapedJob from '../models/ScrapedJob.js';
import ScrapeSession from '../models/ScrapeSession.js';
import { callDeepSeekAPI } from '../utils/deepseek.js';

const CHUNK_SIZE = 10;

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
      { _id: 1, title: 1, description: 1 } // Added description here
    ).lean();

    await ScrapeSession.findByIdAndUpdate(sessionId, {
      status: 'filtering',
      batchId,
      note: 'Filtering in progress...'
    });

    const allFormatted = scrapedJobs.map(j => ({
      id: j._id.toString(),
      title: j.title,
      description: j.description || '' // Ensure description exists
    }));

    const jobChunks = chunkArray(allFormatted, CHUNK_SIZE);
    console.log(`Processing ${jobChunks.length} chunks with ${CHUNK_SIZE} jobs each`);

    let allFiltered = [];

    for (const [index, chunk] of jobChunks.entries()) {
      console.log(`Processing chunk ${index + 1}/${jobChunks.length}`);
      try {
        let response = await callDeepSeekAPI(
          buildSystemPrompt(),
          buildUserPrompt({ scrapedJobsArr: chunk, keywordsArr, resumeText })
        );

        // Safely parse response
        if (typeof response === 'string') {
          try {
            response = JSON.parse(response);
          } catch (parseError) {
            console.error('Failed to parse API response:', response);
            continue;
          }
        }

        if (Array.isArray(response)) {
          allFiltered.push(...response);
        }
      } catch (chunkError) {
        console.error(`Error processing chunk ${index + 1}:`, chunkError.message);
        continue;
      }
    }

    await processScrapedJobs(allFormatted, allFiltered);

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
    throw error; // Re-throw for error handling upstream
  }
};

export const processScrapedJobs = async (allJobs, filteredJobs) => {
  try {
    const filteredJobIds = new Set(filteredJobs.map(job => job.id));
    const bulkOps = [];

    // Prepare bulk operations for better performance
    allJobs.forEach(job => {
      const isRelevant = filteredJobIds.has(job.id);
      bulkOps.push({
        updateOne: {
          filter: { _id: job.id },
          update: {
            $set: {
              isRelevant,
              is_deleted: !isRelevant,
              lastFilteredAt: new Date()
            }
          }
        }
      });
    });

    if (bulkOps.length > 0) {
      const result = await ScrapedJob.bulkWrite(bulkOps);
      console.log(`✅ Updated ${result.modifiedCount} jobs (${filteredJobIds.size} relevant)`);
    } else {
      console.log('⚠️ No jobs to update');
    }
  } catch (error) {
    console.error('❌ Error in processScrapedJobs:', error.message);
    throw error;
  }
};


const buildSystemPrompt = () => {
  return `
You are an expert job-matching assistant.

You will receive:
- scrapedJobsArr: array of job objects, each with { id, title, description }
- keywordsArr: list of technologies or roles the user has or is targeting
- resumeText: full resume in plain text

Your task:
Return ONLY the jobs from scrapedJobsArr that are genuinely relevant to the resumeText or keywordsArr.

A job is relevant ONLY if ALL of these conditions are met:
1. Technical Match:
   - The job description includes tools/technologies present in resumeText or keywordsArr
   - OR the job title conceptually matches the user's experience (see equivalencies below)

2. Experience Level:
   - If job requires "Senior", "Lead", "5+ years" or "10+ years", reject unless resume shows equivalent experience
   - For entry/mid-level roles, accept if resume shows some relevant experience

3. Language Requirement:
   - Reject if job explicitly requires languages other than English (e.g., "French", "Bilingual")

4. Conceptual Role Equivalencies (case insensitive):
   • DevOps ≈ SRE ≈ Platform Engineer ≈ Cloud Engineer
   • Frontend ≈ UI Engineer ≈ Web Developer ≈ JavaScript Developer
   • Backend ≈ API Developer ≈ Server Engineer
   • Full Stack ≈ Web Developer ≈ Software Engineer
   • Security Engineer ≈ Cloud Security ≈ Application Security

5. Technical Keywords Matching:
   - Must have at least 3 matching keywords from:
     • resumeText technologies
     • keywordsArr
     • equivalent technologies (e.g., AWS ≈ GCP ≈ Azure, React ≈ Vue ≈ Angular)

Strict Rules:
- Never modify job titles or invent jobs
- No explanations - only return matching jobs in exact specified format
- Return empty array [] if no matches
- Only return "id" and "title" fields

Output format example:
[
  { "id": "abc123", "title": "React Developer" },
  { "id": "xyz456", "title": "Site Reliability Engineer" }
]
`.trim();
};

const buildUserPrompt = ({ scrapedJobsArr, keywordsArr, resumeText }) => {
  // Validate input
  if (!Array.isArray(scrapedJobsArr)) throw new Error('scrapedJobsArr must be an array');
  if (!Array.isArray(keywordsArr)) throw new Error('keywordsArr must be an array');
  if (typeof resumeText !== 'string') throw new Error('resumeText must be a string');

  return `ScrapedJobs Array:
${JSON.stringify(scrapedJobsArr.map(job => ({
  id: job.id,
  title: job.title || '',
  description: job.description || ''
})), null, 2)}

Keywords Array:
${keywordsArr.join(', ')}

Resume Text:
${resumeText}`;
};
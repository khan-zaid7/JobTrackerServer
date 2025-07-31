
import ScrapedJob from '../../../models/ScrapedJob.js';
import PipelineSession from '../../../models/PipelineSession.js';
import { callDeepSeekAPI } from '../../../utils/deepseek.js';

// ✅ FIX: Reduced chunk size to prevent AI confusion and ensure reliable responses.
const CHUNK_SIZE = 5;

function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * ✅ FIX: Added a validation function to act as a safety net.
 * Checks the AI's response for duplicate IDs across all categories.
 * @param {object} response - The AI response object with matched, borderline, and rejected arrays.
 * @returns {boolean} - True if duplicates are found, false otherwise.
 */
const hasDuplicateIds = (response) => {
  const allIds = [
    ...(response.matched || []).map(j => j.id),
    ...(response.borderline || []).map(j => j.id),
    ...(response.rejected || []).map(j => j.id)
  ];
  const uniqueIds = new Set(allIds);
  if (allIds.length !== uniqueIds.size) {
    console.error('🚨 CRITICAL: AI response contains duplicate IDs! Data corruption risk. Discarding this chunk.');
    return true;
  }
  return false;
};

/**
 * ✅ FIX: Added a function to summarize the resume ONCE.
 * This makes a single API call to analyze and structure the resume text.
 * @param {string} resumeText The raw text content of the user's resume.
 * @returns {Promise<object>} A structured JSON object with key resume details.
 */
const summarizeResume = async (resumeText) => {
  console.log('Summarizing resume...');
  const systemPrompt = `
    You are an expert technical recruiter AI. Your task is to analyze a resume and extract key information into a structured JSON format.
    Focus on:
    1. A brief professional summary.
    2. A list of core technical skills (e.g., programming languages, major frameworks, cloud platforms).
    3. A list of secondary skills (e.g., databases, tools, libraries).
    4. An estimated total years of professional experience as a number.

    CRITICAL: Respond with ONLY the JSON object, nothing else.

    Example Output Format:
    {
      "summary": "Experienced Full Stack Developer with a focus on JavaScript ecosystems and cloud deployment.",
      "coreSkills": ["JavaScript", "TypeScript", "React", "Node.js", "AWS"],
      "secondarySkills": ["PostgreSQL", "MongoDB", "Docker", "Git", "Jira"],
      "yearsOfExperience": 5
    }
  `;

  const userPrompt = `Here is the resume text:\n\n${resumeText}`;

  try {
    const summary = await callDeepSeekAPI(
      systemPrompt,
      userPrompt,
      { model: 'deepseek-chat', maxTokens: 2048 } // Small, specific task
    );
    console.log('Resume summarized successfully.');
    return summary;
  } catch (error) {
    console.error('❌ Failed to summarize the resume.', error);
    throw new Error('The resume could not be analyzed. Please check its content and try again.');
  }
};


export const matchJobsToResume = async (batchToken, resume, tags = [], user) => {
  if (!resume) throw new Error('Resume is required');
  if (!user) throw new Error('User is required');

  const pipelineSession = await PipelineSession.create({
    userId: user._id,
    batchId: batchToken,
    resumeId: resume._id,
    tags: tags,
    status: 'pending',
    note: 'Starting job matching process...'
  });

  try {
    // --- Initial Setup (No Changes Here) ---
    const resumeSummary = await summarizeResume(resume.textContent);
    const keywordsArr = tags.map(t => t.trim());
    const scrapedJobs = await ScrapedJob.find(
      { batchId: batchToken },
      { _id: 1, title: 1, description: 1, companyName: 1, location: 1 }
    ).lean();

    console.log(`Found ${scrapedJobs.length} scraped jobs to process.`);

    if (!scrapedJobs.length) {
      await PipelineSession.findByIdAndUpdate(pipelineSession.id, {
        status: 'done', jobCount: 0, filteredCount: 0, note: 'No jobs to filter.'
      });
      return;
    }

    await PipelineSession.findByIdAndUpdate(pipelineSession.id, {
      status: 'filtering',
      note: `Filtering ${scrapedJobs.length} jobs in progress...`
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

    console.log(`Processing jobs in ${jobChunks.length} chunks of up to ${CHUNK_SIZE} jobs each.`);

    // --- Start of the NEW Multi-Tiered Logic ---
    for (const [index, chunk] of jobChunks.entries()) {
      let chunkSuccess = false;

      // --- Fallback Tier 1: Retry the entire chunk once. ---
      // This loop will run a maximum of 2 times for each chunk.
      for (let attempt = 1; attempt <= 2 && !chunkSuccess; attempt++) {
        try {
          console.log(`--- Processing Chunk ${index + 1}/${jobChunks.length}, Attempt ${attempt} ---`);
          const response = await callDeepSeekAPI(
            buildSystemPrompt(),
            buildUserPrompt({ scrapedJobsArr: chunk, keywordsArr, resumeSummary }),
            { model: 'deepseek-reasoner', maxTokens: 32000 }
          );

          if (hasDuplicateIds(response)) {
            // Throw an error to be caught by this loop's catch block.
            // This uniformly handles API errors and our custom validation errors.
            throw new Error(`AI response for chunk contains duplicate IDs.`);
          }

          // If we reach here, the response is valid and the chunk is processed.
          if (response?.matched) matched.push(...response.matched);
          if (response?.borderline) borderline.push(...response.borderline);
          if (response?.rejected) rejected.push(...response.rejected);

          chunkSuccess = true; // Mark as successful to prevent retries and skip the individual fallback.
          console.log(`✅ Chunk ${index + 1} processed successfully on attempt ${attempt}.`);

        } catch (chunkError) {
          console.warn(`⚠️ Error on attempt ${attempt} for chunk ${index + 1}: ${chunkError.message}`);
          if (attempt === 2) {
            // If the second attempt also fails, we log it and prepare for the ultimate fallback.
            console.error(`🚨 Chunk ${index + 1} failed all attempts. Activating one-by-one fallback.`);
          }
        }
      }

      // --- Fallback Tier 2: Process jobs individually as a last resort. ---
      // This block only runs if `chunkSuccess` is still false after all chunked attempts.
      if (!chunkSuccess) {
        console.log(`--- Activating One-by-One Fallback for ${chunk.length} jobs in failed chunk ${index + 1} ---`);
        for (const singleJob of chunk) {
          try {
            console.log(`  -> Processing individual job: ${singleJob.id} (${singleJob.title})`);

            // We process this job in its own "chunk" of 1.
            const singleJobChunk = [singleJob];
            const response = await callDeepSeekAPI(
              buildSystemPrompt(),
              buildUserPrompt({ scrapedJobsArr: singleJobChunk, keywordsArr, resumeSummary }),
              { model: 'deepseek-chat', maxTokens: 2000 } // Can use fewer tokens for one job
            );

            // No need to check for duplicates here, as there's only one job.
            if (response?.matched) matched.push(...response.matched);
            if (response?.borderline) borderline.push(...response.borderline);
            if (response?.rejected) rejected.push(...response.rejected);

          } catch (singleJobError) {
            // This is the final point of failure. We log it and move on, wasting only this single job.
            console.error(`❌ ULTIMATE FALLBACK FAILED for single job ${singleJob.id}. Discarding this job.`, singleJobError.message);
          }
        }
      }
    }

    // --- Final Database Update (No Changes Here) ---
    const result = await processScrapedJobs({ matched, borderline, rejected });
    console.log('Database update results:', result);

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
    console.error('❌ matchJobsToResume pipeline failed:', error);
    throw error;
  }
};

// This function does not need changes. It correctly processes the data it receives.
export const processScrapedJobs = async ({ matched = [], borderline = [], rejected = [] }) => {
  const updates = await Promise.allSettled([
    ...matched.map(job => ScrapedJob.findByIdAndUpdate(job.id, {
      isRelevant: true, is_deleted: false, rejectionReason: null, confidenceFactor: job.confidence
    }, { new: true })),

    ...borderline.map(job => ScrapedJob.findByIdAndUpdate(job.id, {
      isRelevant: false, is_deleted: false, rejectionReason: job.reason || 'Borderline match: minor mismatch', confidenceFactor: job.confidence
    }, { new: true })),

    ...rejected.map(job => ScrapedJob.findByIdAndUpdate(job.id, {
      isRelevant: false, is_deleted: true, rejectionReason: job.rejectionReason || 'Not relevant', confidenceFactor: job.confidence
    }, { new: true }))
  ]);

  return {
    totalProcessed: matched.length + borderline.length + rejected.length,
    updatedSuccessfully: updates.filter(u => u.status === 'fulfilled').length,
    failedUpdates: updates.filter(u => u.status === 'rejected').length
  };
};

// ✅ FIX: System prompt is updated to expect a summary object, not raw text.
const buildSystemPrompt = () => {
  return `
    🧠 You are an AI job-matching engine that classifies scraped jobs into three categories based on a user's summarized resume and target skills.

    You will receive:
    - scrapedJobsArr: Array of job objects, each with { id, title, description, companyName, location }
    - keywordsArr: List of technologies or roles the user is targeting
    - resumeSummary: A JSON object containing the user's structured resume info: { summary, coreSkills, secondarySkills, yearsOfExperience }

    
    🎯 Your Task:
    Evaluate each job in scrapedJobsArr and classify it as one of:
    1. "matched" – Strongly relevant
    2. "borderline" – Somewhat relevant, worth showing
    3. "rejected" – Not a match

    🧠 Matching Rules:

    ✅ **Matched Jobs** (high-confidence):
    - Meets **core skill requirement** (e.g., primary language/framework).
    - AND has **2 or more total skill/tool matches** from the resume.
    - Title is a reasonable equivalent.
    - Experience level is a plausible match (see Experience Analysis).

    ⚠️ **Borderline Jobs** (partial match):
    - Has a core skill match but is missing another key requirement (e.g., a specific framework).
    - OR is a strong skills match but the experience level is a stretch (e.g., user has 3 years, job asks for 5+).
    - OR matches only on secondary skills, but multiple of them.

    ❌ **Rejected Jobs** (clear mismatch):
    - No core skill match.
    - OR requires a specific niche domain/tool not in the resume (e.g., Guidewire, SAS).
    - OR experience level is a major mismatch (e.g., user has 1 year, job requires 8+).

    💡 **Skill Weighting:**
    - **Core Skills:** Primary programming languages (Python, Java, etc.), major frameworks (React, Django, etc.), cloud platforms (AWS, Azure).
    - **Secondary Skills:** Databases (PostgreSQL, etc.), tools (Docker, Git, Jira), libraries.
    - A job CANNOT be "matched" without at least one Core Skill match.

    💡 **Experience Analysis:**
    - Extract required years of experience (e.g., "5+ years").
    - If user's experience is within 2 years of the requirement, it can be "borderline."
    - If the gap is larger, it's a strong signal for "rejection," unless the role is explicitly junior.

    💡 **Conceptual Title Equivalents (apply flexibly):**
    - Full Stack ≈ Software Engineer ≈ Web Developer
    - DevOps ≈ SRE ≈ Cloud Engineer
    - Backend ≈ API Developer ≈ Server Engineer

    🚫 **Hard Rejection Rules:**
    - Reject jobs requiring "French," "Bilingual," or other languages not in the resume.
    - Reject jobs requiring niche domain tools (e.g., SAP, ServiceNow) not found in the resume.

    📤 **Output Format:**
    Return a single JSON object.
    {
      "matched": [
        { "id": "job_id", "title": "Job Title", "companyName": "Company", "confidence": 0.95, "matchedSkills": ["Python", "AWS", "SQL"] }
      ],
      "borderline": [
        { "id": "job_id", "title": "Job Title", "companyName": "Company", "confidence": 0.75, "reason": "Strong match on Node.js/React, but lacks required GraphQL experience.", "matchedSkills": ["Node.js", "React"] }
      ],
      "rejected": [
        { "id": "job_id", "title": "Job Title", "companyName": "Company", "confidence": 0.4, "rejectionReason": "Requires 5+ years of Java experience; resume shows JavaScript/Python." }
      ]
    }

    📌 **Reason Guidelines:**
    - Be specific, concise, and one line.
    - For **borderline** jobs, state the trade-off (e.g., "Good match on X, but missing Y").
    - For **rejected** jobs, state the primary disqualifying factor clearly.

    📊 **Confidence Score (0.0 to 1.0):**
    - **0.9–1.0:** Strong match (meets core skills, title, and experience).
    - **0.6–0.89:** Borderline (a reasonable trade-off exists).
    - **< 0.6:** Rejected (clear and significant mismatch).

    Strict Instructions:
    - DO NOT fabricate or modify job data. Your primary directive is data integrity.
    - ENSURE every job from the input array is classified once and only once in your response.
    - ENSURE the 'id' field in your output JSON exactly matches the 'id' from the corresponding input job. This is critical.
    - NO explanation or commentary outside the JSON object.
    - Return plain JSON only. Do NOT wrap in markdown like \`json\`.
  `.trim();
};

// ✅ FIX: User prompt is updated to send the summary object.
const buildUserPrompt = ({ scrapedJobsArr, keywordsArr, resumeSummary }) => {
  if (!Array.isArray(scrapedJobsArr)) throw new Error('scrapedJobsArr must be an array');
  if (!Array.isArray(keywordsArr)) throw new Error('keywordsArr must be an array');
  if (typeof resumeSummary !== 'object') throw new Error('resumeSummary must be an object');

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

Resume Summary:
${JSON.stringify(resumeSummary, null, 2)}`;
};

// This function does not need changes.
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

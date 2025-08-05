
import ScrapedJob from '../../../models/ScrapedJob.js';
import { callDeepSeekAPI } from '../../../utils/deepseek.js';
import { publishToExchange} from '../../queue.js';
import MatchedPair from '../../../models/MatchedPair.js'
import Resume from '../../../models/Resume.js'
import User from '../../../models/User.js';
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


export const matchJobsToResume = async (jobsToProcess) => {
  // if (!resume) throw new Error('Resume is required');
  // if (!user) throw new Error('User is required');

  try {
    if (!jobsToProcess || jobsToProcess.length === 0) {
      console.log('[Matcher Service] Received an empty batch. Nothing to do.');
      return true;
    }

    // --- STEP 1: EXTRACT MISSION-CRITICAL DATA ---
    // We get the campaignId from the FIRST job in the batch.
    const campaignId = jobsToProcess[0].campaignId;
    if (!campaignId) {
      throw new Error("FATAL: campaignId is missing from the job payload.");
    }
    const jobIds = jobsToProcess.map(job => job.jobId);
    console.log(`[Matcher Service] Starting batch for campaign: ${campaignId}`);

    // --- STEP 2: FETCH AND VALIDATE DATA ---
    const scrapedJobs = await ScrapedJob.find({ _id: { $in: jobIds } }).populate('createdBy');

    if (!scrapedJobs || scrapedJobs.length === 0) {
      console.log('[matchJobsToResume] No valid jobs found for the provided IDs. Exiting.');
      return true; // Return success, as there's no work to do.
    }

    // Filter out any jobs that might not have a user attached. This is a safety net.
    const validJobs = scrapedJobs.filter(job => job.createdBy && job.createdBy._id);

    if (validJobs.length === 0) {
      console.log('[matchJobsToResume] No jobs with a valid user found in this batch. Exiting.');
      return true;
    }

    // ✨ THE FIX IS HERE: DECLARE userId FIRST, THEN USE IT.
    const userId = validJobs[0].createdBy._id;
    const user = validJobs[0].createdBy;

    // Verify all jobs in the batch belong to the same user.
    const allJobsBelongToSameUser = validJobs.every(job => job.createdBy._id.equals(userId));
    if (!allJobsBelongToSameUser) {
      throw new Error('CRITICAL DATA INTEGRITY ERROR: Job batch contains jobs from multiple users.');
    }

    const resume = await Resume.findOne({ createdBy: userId, isMaster: true });
    if (!resume) {
      throw new Error(`Master resume not found for user ${userId}`);
    }

    const resumeSummary = await summarizeResume(resume.textContent);

    console.log(`Found ${validJobs.length} valid jobs to process for user ${user.name}.`);

    const allFormattedJobs = validJobs.map(j => ({
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
            buildUserPrompt({ scrapedJobsArr: chunk, resumeSummary }),
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
              buildUserPrompt({ scrapedJobsArr: singleJobChunk, resumeSummary }),
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
    // Combine matched and borderline jobs into a single list to be processed.
    const allMatches = [...matched, ...borderline];

    console.log(`[matchJobsToResume] AI processing complete. Found ${allMatches.length} potential matches to be published.`);

    // Iterate through every job the AI considered a potential match.
    for (const match of allMatches) {
      try {
        // 1. Create the MatchedPair document in the database.
        // This new document is the "source of truth" that a match was found.
        const newPair = await MatchedPair.create({
          userId: userId,
          resumeId: resume._id,
          jobId: match.id,
          matchConfidence: match.confidence,
          matchReason: match.reason || null, // Also add the reason from the AI
          tailoringStatus: 'pending' // CORRECTED
        });

        console.log(`[matchJobsToResume] Created MatchedPair document: ${newPair._id}`);

        // 2. Publish the ID of the newly created pair to the next queue.
        const routingKey = `tailor.${campaignId}`;
        const message = {
          matchedPairId: newPair._id.toString(),
          campaignId: campaignId // Pass the campaign context forward
        };

        await publishToExchange(routingKey, message);
        console.log(`[Matcher Service] 🚀 Published MatchedPair ${newPair._id} with address "${routingKey}"`);

      } catch (error) {
        // This handles cases where a pair might have already been created,
        // preventing the worker from crashing on a duplicate key error.
        if (error.code === 11000) {
          console.warn(`[matchJobsToResume] A matched pair for user ${userId} and job ${match.id} already exists. Skipping.`);
        } else {
          console.error(`[matchJobsToResume] Failed to create or publish MatchedPair for job ${match.id}:`, error);
        }
      }
    }

    // The function is now complete and can return.
    return true; // Return a success indicator to the worker.

  } catch (error) {
    console.error('❌ matchJobsToResume pipeline failed:', error);
    throw error;
  }
};

// ✅ FIX: System prompt is updated to expect a summary object, not raw text.
const buildSystemPrompt = () => {
  return `
    🧠 You are a world-class executive recruiter and a ruthless career strategist. Your mission is to determine if a job opportunity is a **LOGICAL AND QUALIFIED** career move for a specific candidate. You will execute a multi-phase filtering process.

    You will receive:
    - scrapedJobsArr: An array of job objects.
    - resumeSummary: A JSON object containing the candidate's 'professionalIdentity', 'coreSkills', and 'secondarySkills'.

    ---
    🚨 **PHASE 1: THE STRATEGIC FIT (DOMAIN) FILTER** 🚨
    ---
    This is your first, most critical gate. You will analyze the fundamental nature of the job and the candidate.

    **STEP 1: IDENTIFY THE JOB'S DOMAIN.**
    Is the core function "Software Engineering," "Sales," "Teaching," "Nursing," etc.?

    **STEP 2: COMPARE DOMAINS.**
    Compare the job's domain to the candidate's \`professionalIdentity\`.

    **STEP 3: MAKE THE STRATEGIC REJECTION.**
    A job is **INSTANTLY REJECTED** if it is an **ILLOGICAL DOMAIN MISMATCH.**
    *   **Example:** Candidate is a "Process Automation Engineer." Job is an "English Teacher in China." -> REJECT. Reason: "Domain Mismatch: Non-technical teaching role is not aligned with an engineering career path."
    *   **Example:** Candidate is a "Sales Executive." Job is a "Senior C++ Developer." -> REJECT. Reason: "Domain Mismatch: Deep technical role is not aligned with a sales career path."
    
    **YOU WILL PERFORM THIS CHECK FIRST. ALL JOBS THAT FAIL THIS CHECK GO DIRECTLY INTO THE "rejected" LIST.**

    ---
    🎯 **PHASE 2: THE TACTICAL FIT (SKILLS) FILTER** 🎯
    ---
    For all jobs that **SURVIVED** the strategic domain filter, you will now perform a detailed technical qualification analysis.

    **STEP 1: IDENTIFY HARD REQUIREMENTS & KNOCK-OUT FACTORS.**
    Analyze the job description for non-negotiable requirements.
    *   **Hard Skill Requirement:** A specific, mandatory technology (e.g., "5+ years of OpenGL," "expert in SAP").
    *   **Spoken Language Requirement:** Mandatory fluency in a human language (e.g., "fluent French").

    **STEP 2: MAKE THE TACTICAL REJECTION.**
    A job that survived Phase 1 is **STILL REJECTED** if it fails this check.
    *   **Example:** Candidate is a "Software Engineer." Job is "Senior Graphics Engineer." It passed the domain filter. BUT, the job requires "OpenGL," which is absent from the resume. -> REJECT. Reason: "Hard Skill Mismatch: Mandatory requirement for OpenGL is absent."

    ---
    ⚙️ **PHASE 3: CLASSIFY THE FINAL SURVIVORS** ⚙️
    ---
    For the elite few jobs that have passed **BOTH** Phase 1 and Phase 2, you will now classify them as "matched" or "borderline."

    ✅ **MATCHED (High-Confidence Fit):**
    *   The candidate's \`coreSkills\` are a STRONG MATCH for the job's primary technical requirements.
    *   The candidate has significant overlap with secondary requirements.
    *   The experience level is a plausible fit.

    ⚠️ **BORDERLINE (Plausible "Stretch" Fit):**
    *   The candidate has strong transferable skills (e.g., has AWS for an Azure job).
    *   OR the experience level is a stretch, but the core skills are a perfect match.


    ---
    📤 **FINAL OUTPUT FORMAT (JSON ONLY)** 📤
    ---
    Return a single JSON object. DO NOT add any commentary.

    {
      "matched": [
        { "id": "job_id", "title": "Job Title", "companyName": "Company", "confidence": 0.95, "matchedSkills": ["Python", "AWS", "SQL"], "reason": "Excellent match on core Python and cloud skills." }
      ],
      "borderline": [
        { "id": "job_id", "title": "Job Title", "companyName": "Company", "confidence": 0.75, "reason": "Strong match on Node.js/React, but lacks required GraphQL experience.", "matchedSkills": ["Node.js", "React"] }
      ],
      "rejected": [
        { "id": "job_id_1", "confidence": 0.0, "rejectionReason": "Domain Mismatch: Teaching role is not aligned with an engineering career path." },
        { "id": "job_id_2", "confidence": 0.1, "rejectionReason": "Hard Skill Mismatch: Mandatory requirement for OpenGL is absent." }
      ]
    }
    `.trim();
};

// ✅ FIX: User prompt is updated to send the summary object.
const buildUserPrompt = ({ scrapedJobsArr, resumeSummary }) => {
  return `
        Resume Summary:
        ${JSON.stringify(resumeSummary, null, 2)}

        Scraped Jobs Array:
        ${JSON.stringify(scrapedJobsArr.map(job => ({
    id: job.id,
    title: job.title || '',
    description: flattenDescription(job.description),
    companyName: job.companyName,
  })), null, 2)}
    `;
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

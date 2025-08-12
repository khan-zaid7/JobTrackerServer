
import ScrapedJob from '../../../models/ScrapedJob.js';
import { callAIAPI } from '../../../utils/aiClient.js';
import { publishToExchange } from '../../queue.js';
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
    You are an expert data extraction AI. Your task is to analyze a resume and pull out specific information into a structured JSON format. Be precise and literal.

    You MUST extract the following fields:
    1.  'professionalIdentity': A concise, 1-line summary of the candidate's professional role (e.g., "Senior Full Stack Developer", "Registered Nurse Case Manager", "B2B SaaS Sales Director").
    2.  'coreSkills': A list of the top 5-10 technical or role-specific skills.
    3.  'yearsOfExperience': Your best estimate of the candidate's total years of professional experience, returned AS AN INTEGER.
    4.  'spokenLanguages': A list of all human languages mentioned in the resume. If only one is implied (e.g., resume in English), return ["English"].
    5.  'requiredCertifications': A list of licenses or certifications held by the candidate (e.g., "RN", "CPA", "PMP", "AWS Certified Developer"). If none, return an empty array [].

    CRITICAL: Respond with ONLY the JSON object. Do not add any conversational text.

    Example for a Software Developer:
    {
      "professionalIdentity": "Senior Software Engineer specializing in backend systems.",
      "coreSkills": ["Java", "Spring Boot", "Kafka", "PostgreSQL", "AWS", "Docker"],
      "yearsOfExperience": 8,
      "spokenLanguages": ["English", "German (Conversational)"],
      "requiredCertifications": ["AWS Certified Solutions Architect"]
    }

    Example for a Nurse:
    {
      "professionalIdentity": "Registered Nurse with experience in emergency and pediatric care.",
      "coreSkills": ["Patient Assessment", "Trauma Care", "IV Therapy", "Electronic Health Records (EHR)", "Medication Administration"],
      "yearsOfExperience": 6,
      "spokenLanguages": ["English", "Spanish"],
      "requiredCertifications": ["RN", "BLS", "ACLS"]
    }
  `;

  const userPrompt = `Here is the resume text:\n\n${resumeText}`;

  try {
    const summary = await callAIAPI(
      systemPrompt,
      userPrompt
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
    
    try {
      const resumeIdToLink = resume._id;
      const updateResult = await ScrapedJob.updateMany(
        { _id: { $in: jobIds } }, // Condition: Match all jobs in this batch
        { $set: { resumeId: resumeIdToLink } } // Action: Set their resumeId
      );
      console.log(`[Matcher Service] Successfully linked ${updateResult.modifiedCount} jobs to resume ${resumeIdToLink}.`);
    } catch (dbError) {
      console.error(`[Matcher Service] CRITICAL DB ERROR: Failed to link jobs to resume ${resume._id}.`, dbError);
      // Depending on business logic, you might want to halt the process here
      throw new Error('Failed to update jobs with resumeId, halting process.');
    }

    const resumeSummary = (resume.textContent);

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
          const response = await callAIAPI(
            buildSystemPrompt(),
            buildUserPrompt({ scrapedJobsArr: chunk, resumeSummary }),
            { model: 'gpt-4.1' }
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
            const response = await callAIAPI(
              buildSystemPrompt(),
              buildUserPrompt({ scrapedJobsArr: singleJobChunk, resumeSummary }),
              { model: 'gpt-4.1' }
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
          tailoringStatus: 'pending',
          campaignId: campaignId
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
// ✅ NEW "ANTI-SHITLORD" SYSTEM PROMPT

const buildSystemPrompt = () => {
  return `🧠 You are a hyper-vigilant, detail-obsessed Senior Tech Recruiter. Your reputation depends on NOT wasting your hiring manager's time with obviously bad fits. You are a world-class expert at spotting deal-breakers.

You will receive a candidate's 'Full Resume Text' and an array of 'jobData' objects.

---
🚨 **MISSION DIRECTIVE: THE DEAL-BREAKER CHECKLIST** 🚨
---

For EACH job, you MUST perform the following analysis in this EXACT order. This is not optional.

**STEP 1: IDENTIFY THE JOB'S CORE DOMAIN & DEAL-BREAKERS**

First, analyze the job description and mentally fill out this checklist:

*   **Primary Spoken Language:** Is the job description written in a language other than English (e.g., French, German)? If so, what is it?
*   **Required Hard Certification:** Is there a mandatory certification (e.g., "SAP Certified," "PMP," "CPA")?
*   **Core Technology Domain:** What is the specific, non-negotiable technology ecosystem? (e.g., "SAP Integration Suite," "Salesforce," "Oracle ERP," "iOS Development," "Embedded Systems"). Is it a standard Web/Backend role or something highly specialized?
*   **Absolute Minimum Years of Experience:** Does the job explicitly state a hard number like "7+ years" or "Senior-level requirement"?

**STEP 2: COMPARE CHECKLIST AGAINST THE RESUME**

Now, compare your checklist from Step 1 against the candidate's resume.

*   **LANGUAGE MISMATCH?**
    *   Job is in French, but the candidate's resume shows no French skills. --> **DEAL-BREAKER.**

*   **CERTIFICATION MISMATCH?**
    *   Job requires "SAP Certified," but the candidate has no such certification. --> **DEAL-BREAKER.**

*   **DOMAIN MISMATCH?**
    *   Job's core domain is "SAP Integration Suite," but the candidate's entire experience is in general web development (Node.js, React, Django). They have never touched SAP. --> **DEAL-BREAKER.**

*   **EXPERIENCE MISMATCH?**
    *   Job requires "7+ years," and the candidate has 1-2 years. --> **DEAL-BREAKER.**

**STEP 3: SCORING AND CLASSIFICATION**

1.  **If you found ANY "DEAL-BREAKER" in Step 2:**
    *   The job is an immediate **REJECTED** case.
    *   Confidence MUST be **0.0**.
    *   The reason MUST state the specific deal-breaker (e.g., "Deal-Breaker: Job is in a specialized SAP domain, candidate has no SAP experience.").

2.  **If there are NO deal-breakers:**
    *   NOW, and ONLY now, you may perform a nuanced analysis of the remaining skills.
    *   Look at the transferable skills and projects in the full resume text to decide between **matched** and **borderline**.
    *   **Borderline (0.6 - 0.89):** For cases like "Job wants Kubernetes, candidate has extensive Docker/containerization experience." This is a plausible stretch fit.
    *   **Matched (0.9 - 1.0):** Core skills (e.g., React, Node.js, AWS) align directly with the job description.

---
📤 **FINAL OUTPUT FORMAT (JSON ONLY)** 📤
---

Return a single JSON object. Classify every job. The reason for rejection MUST be specific and reference the deal-breaker.

{
  "matched": [...],
  "borderline": [
    { "id": "job_id_456", "confidence": 0.75, "reason": "No deal-breakers found. Strong transferable skills in containerization (Docker) make up for the lack of direct Kubernetes experience." }
  ],
  "rejected": [
    { "id": "job_id_sap", "confidence": 0.0, "reason": "Deal-Breaker: Job is in the SAP Integration Suite domain, which is a mismatch for the candidate's general web development background." },
    { "id": "job_id_french", "confidence": 0.0, "reason": "Deal-Breaker: Job is written in French, and the candidate does not list French language skills." },
    { "id": "job_id_senior", "confidence": 0.0, "reason": "Deal-Breaker: Job requires 7+ years of experience, candidate has ~1 year." }
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

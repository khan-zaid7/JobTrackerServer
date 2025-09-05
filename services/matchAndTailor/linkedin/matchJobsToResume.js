import ScrapedJob from '../../../models/ScrapedJob.js';
import { callAIAPI, callDeepSeekReasonerAPI } from '../../../utils/aiClient.js';
// Removing unused import
// import { publishToExchange } from '../../queue.js';
import MatchedPair from '../../../models/MatchedPair.js';
import Resume from '../../../models/Resume.js';
// User model is not directly used in the main function but might be needed by Mongoose .populate()
import User from '../../../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * ✅ MAJOR UPGRADE: Analyzes the resume to create a deep, narrative-rich JSON blueprint.
 * This captures the candidate's story, strengths, and professional "vibe," moving far
 * beyond simple keyword extraction.
 * @param {string} resumeText The raw text content of the user's resume.
 * @returns {Promise<object>} A comprehensive JSON blueprint of the candidate's profile.
 */
const summarizeResume = async (resumeText) => {
  console.log('Performing deep narrative analysis of resume...');

  // Using the exact system prompt you provided.
  const systemPrompt = `
 You are a world-class and elite-level resume editor and resume master who reads and extracts information-rich details from a resume to be used by another elite-level AI to compare that resume with a job description JSON blueprint. Your task is to review and carefully read the resume. Extract the relevant and most important information. Not focusing solely on the keywords or experience, but also making sure what story the resume tells. What is the vibe? How is the candidate, and all other possible important information, that the later AI can use to compare with a job description blueprint?
 `.trim();

  const userPrompt = `
    This is how exactly the expected output would work:
    \`\`\`json
    {
      "candidate": {
        "name": "Full Name (if available)",
        "contact": {
          "email": "Email address (if available)",
          "phone": "Phone number (if available)",
          "linkedin": "LinkedIn URL (if available)",
          "github": "GitHub URL (if available)"
        },
        "headline": "Headline from resume (if available)",
        "summary": "Summary section from resume (if available)",
        "core_themes": [
          "Core theme 1 (if available)",
          "Core theme 2 (if available)"
        ],
        "technical_skills": {
          "languages": ["Language 1 (if available)"],
          "backend": ["Backend skill 1 (if available)"],
          "frontend": ["Frontend skill 1 (if available)"],
          "databases": ["Database 1 (if available)"],
          "cloud_devops": ["DevOps tool 1 (if available)"],
          "ai_automation": ["AI/Automation tool 1 (if available)"]
        },
        "projects": [
          {
            "name": "Project Name (if available)",
            "problem_solved": "Problem solved by project (if available)",
            "architecture": "Project architecture (if available)",
            "ai_role": "Role of AI in project (if available)",
            "stack": ["Technology in stack (if available)"],
            "highlights": ["Project highlight 1 (if available)"]
          }
        ],
        "experience": [
          {
            "title": "Job Title (if available)",
            "company": "Company Name (if available)",
            "location": "Location (if available)",
            "dates": "Dates of employment (if available)",
            "achievements": ["Achievement or responsibility (if available)"]
          }
        ],
        "education": [
          {
            "institution": "Institution name (if available)",
            "credential": "Credential or degree (if available)",
            "dates": "Dates of attendance (if available)",
            "coursework": ["Relevant coursework (if available)"]
          }
        ],
        "soft_skills": ["Inferred soft skill (if available)"],
        "role_fit_indicators": {
          "best_suited_for": ["Type of role (if available)"],
          "likely_to_excel_in": ["Type of environment or task (if available)"]
        },
        "overall_vibe": "Overall professional vibe (if available)"
      }
    }
    \`\`\`
    Here is the resume text:
    ---
    ${resumeText}
  `.trim();

  try {
    const blueprint = await callAIAPI(systemPrompt, userPrompt, { model: 'gpt-4.1' });
    console.log('✅ Resume blueprint created successfully.');
    return blueprint;
  } catch (error) {
    console.error('❌ Failed to create the resume blueprint.', error);
    throw new Error('The resume could not be analyzed for its narrative. Please check its content and try again.');
  }
};

/**
 * Analyzes a standard job description JSON and infers the hiring manager's priorities.
 *
 * @param {object} description - The job description JSON object.
 * @returns {Promise<object>} A promise that resolves to the inferred priorities blueprint.
 * @throws {Error} If the AI API call fails or the analysis cannot be completed.
 */
const inferJobPriorities = async (description) => {
  console.log('Step 1: Analyzing Job Description to create a Hiring Blueprint...');

  // The system prompt now explains the AI's role in the larger two-step strategy.
  const systemPrompt = `
    You are an expert AI Hiring Analyst. Your specific task is to build a "Hiring Blueprint" from a job description.

    This blueprint is the crucial first step in a two-part hiring process. It will be used by a separate AI to filter and evaluate candidates. Therefore, your analysis must be precise and clearly distinguish between absolute, non-negotiable requirements and other preferences. Your output is the guide that the next AI must follow.
  `.trim();

  // The user prompt specifies the new, more precise output format.
  const userPrompt = `
    Analyze the provided structured job description. For each category, you will infer the hiring manager's true priority.

    You must classify each requirement's priority using one of these four levels:
    - "Non-Negotiable": A hard requirement. A candidate's failure to meet this is a deal-breaker (e.g., minimum years of experience).
    - "Core Requirement": A central skill for the job. The candidate must be strong here, but exceptional, transferable skills could be considered (e.g., the main programming language).
    - "Strongly Preferred": A "nice-to-have" skill that separates good candidates from great ones. Lack of this is not a blocker.
    - "Low Priority / Standard": A standard expectation (e.g., "team player") or a factor that is not a primary screening criterion.

    Produce a JSON object where each key is a category, and the value is another object containing:
    1. \`level\`: Your classification from the four levels above.
    2. \`justification\`: A brief explanation for your choice, referencing the job description.
    3. \`requirement_summary\`: A concise summary or direct quote of the specific requirement from the job description. State "Not explicitly mentioned" if absent.

    This is the exact JSON output format you must follow:
    \`\`\`json
    {
      "experience_gap": {
        "level": "Non-Negotiable",
        "requirement_summary": "5+ years of software engineering experience",
        "justification": "The JD lists '5+ years' in the required qualifications, making it a minimum bar for seniority."
      },
      "domain_alignment": {
        "level": "Strongly Preferred",
        "requirement_summary": "Experience in e-commerce or retail tech.",
        "justification": "Mentioned as a 'plus' but not in the core requirements, so it's a bonus, not a blocker."
      },
      "frontend_expectations": {
        "level": "Low Priority / Standard",
        "requirement_summary": "Not explicitly mentioned.",
        "justification": "The role is described as purely backend, so frontend skills are not a priority."
      },
      "backend_tech_match": {
        "level": "Core Requirement",
        "requirement_summary": "Expertise in Go and microservices architecture.",
        "justification": "Go is the primary language mentioned in the role title and required qualifications."
      },
      "devops_and_ci_cd": {
        "level": "Strongly Preferred",
        "requirement_summary": "Experience with AWS, Docker, and Kubernetes.",
        "justification": "Listed in the 'desired' qualifications, indicating it's highly valued but not a hard requirement for day one."
      },
      "seniority_and_autonomy": {
        "level": "Core Requirement",
        "requirement_summary": "Ability to lead projects and mentor junior engineers.",
        "justification": "The 'Senior' title and responsibilities imply leadership and independence are key expectations."
      },
      "soft_skills_culture_fit": {
        "level": "Low Priority / Standard",
        "requirement_summary": "Strong communication and collaboration skills.",
        "justification": "These are standard professional expectations best assessed in an interview, not for initial filtering."
      },
      "growth_potential": {
        "level": "Low Priority / Standard",
        "requirement_summary": "Not applicable for screening.",
        "justification": "This concerns the role's fit for the candidate, not a criterion to filter them on."
      },
      "compensation_expectations": {
        "level": "Non-Negotiable",
        "requirement_summary": "Not explicitly mentioned.",
        "justification": "Though not in the JD, compensation alignment is a non-negotiable checkpoint for any real-world hiring process."
      },
      "cultural_vibe_match": {
        "level": "Strongly Preferred",
        "requirement_summary": "Thrives in a fast-paced environment.",
        "justification": "Cultural fit is important for retention but is a preference, not a hard skill to screen for on a resume."
      }
    }
    \`\`\`

    Analyze the following job description:
    ---
    ${JSON.stringify(description, null, 2)}
  `.trim();

  try {
    // This assumes you have a 'callAIAPI' function similar to the one in your example.
    const prioritiesBlueprint = await callAIAPI(systemPrompt, userPrompt);
    console.log('✅ Hiring Blueprint created successfully.');
    return prioritiesBlueprint;
  } catch (error) {
    console.error('❌ Failed to create the Hiring Blueprint.', error);
    throw new Error('The job description could not be analyzed for its priorities. Please check its content and try again.');
  }
};

/**
 * Processes a single job against a user's master resume.
 * @param {object} jobToProcess A message object from the queue, containing jobId and campaignId.
 */
export const matchJobsToResume = async (jobToProcess, channel) => {
  try {
    if (!jobToProcess || !jobToProcess.jobId) {
      console.log('[Matcher Service] Received an invalid job payload. Nothing to do.');
      return true;
    }

    // --- STEP 1: EXTRACT MISSION-CRITICAL DATA ---
    const { jobId, campaignId, resumeId } = jobToProcess;
    if (!campaignId) {
      throw new Error(`FATAL: campaignId is missing for job ${jobId}.`);
    }
    console.log(`[Matcher Service] Starting match for Job ID: ${jobId} in Campaign: ${campaignId}`);

    // Log manual job information
    const isManualJobFlag = jobToProcess.isManualJob || false;
    const forceTailoringFlag = jobToProcess.forceTailoring || false;

    if (isManualJobFlag) {
      console.log(`[Manual Job] Processing manual job. Force tailoring: ${forceTailoringFlag}`);
    }

    // --- STEP 2: FETCH AND VALIDATE DATA ---
    const scrapedJob = await ScrapedJob.findById(jobId).populate('createdBy');

    if (!scrapedJob) {
      console.error(`[Matcher Service] Job with ID ${jobId} not found in the database. Discarding.`);
      return true;
    }

    if (!scrapedJob.createdBy || !scrapedJob.createdBy._id) {
      console.error(`[Matcher Service] Job ${jobId} is not associated with a valid user. Discarding.`);
      return true;
    }

    const user = scrapedJob.createdBy;
    const userId = user._id;

    const resume = await Resume.findOne({ _id: resumeId, createdBy: userId });

    if (!resume) {
      throw new Error(`Master resume not found for user ${user.name} (${userId})`);
    }

    // --- STEP 3: GET RESUME SUMMARY (WITH CACHING LOGIC) ---

    let resumeSummary; // Declare the variable to hold the summary

    // Check if a summary already exists and is not empty
    if (resume.summary && resume.summary.candidate) {
      console.log(`[Matcher Service] Using cached summary for resume ${resume._id}.`);
      resumeSummary = resume.summary; // Use the summary from the database
    } else {
      console.log(`[Matcher Service] No cached summary found for resume ${resume._id}. Generating a new one...`);

      // If no summary exists, call the AI function
      const newSummary = await summarizeResume(resume.textContent);

      // Save the newly generated summary back to the resume document
      resume.summary = newSummary;
      await resume.save();
      console.log(`[Matcher Service] New summary saved to the database.`);

      // Use the new summary for the current operation
      resumeSummary = newSummary;
    }

    let aiResponse;
    // Simple retry logic for the AI call
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`--- Calling AI for Job ${jobId}, Attempt ${attempt} ---`);
        const inferredPriorities = await inferJobPriorities(scrapedJob.description);

        aiResponse = await callAIAPI(
          buildSystemPrompt(),
          // Use the NEW, streamlined user prompt function
          buildUserPrompt(scrapedJob.description, resumeSummary, inferredPriorities),
          { model: 'gpt-4.1-mini' }
        );

        // Validation check for the streamlined schema structure
        // Ensure we have all required fields based on the MatchedPair schema
        if (aiResponse && aiResponse.match_analysis && aiResponse.action_plan && aiResponse.action_plan.application_strategy) {
          console.log(`✅ AI analysis successful for Job ${jobId}. Strategy: ${aiResponse.action_plan.application_strategy}`);
          break; // Exit loop on success
        } else {
          throw new Error('AI response was malformed or missing the required match_analysis or action_plan fields.');
        }
      } catch (error) {
        console.warn(`⚠️ AI call failed on attempt ${attempt} for job ${jobId}: ${error.message}`);
        if (attempt === 2) {
          throw new Error(`AI analysis failed for job ${jobId} after all retries.`);
        }
      }
    }

    console.log(`[Matcher Service] Saving AI analysis report for Job ${jobId}.`);
    console.log(JSON.stringify(aiResponse));

    const { action_plan, verdict } = aiResponse;
    const applicationStrategy = action_plan.application_strategy.toUpperCase();

    // This confidence map remains perfectly valid as the strategy options haven't changed.
    const confidenceMap = {
      'STRONG FIT - APPLY NOW': 0.95,
      'GOOD FIT - TAILOR & APPLY': 0.85,
      'REACH - REQUIRES SIGNIFICANT TAILORING': 0.65,
      'POOR FIT - RECONSIDER': 0.10
    };

    // Create the MatchedPair document with the full analysis.
    // This happens for ALL jobs, regardless of the hire decision.
    const newPair = await MatchedPair.create({
      userId: userId,
      resumeId: resume._id,
      jobId: scrapedJob._id,
      matchConfidence: confidenceMap[applicationStrategy] || 0.0,
      matchReason: verdict,
      analysisReport: aiResponse,
      tailoringStatus: 'pending',
      campaignId: campaignId
    });

    console.log(`[Matcher Service] Created MatchedPair document ${newPair._id} with strategy: '${applicationStrategy}'.`);

    // --- STEP 5: DECIDE WHETHER TO PROCEED TO TAILORING ---

    // Check if this is a manual job with forced tailoring
    const isManualJob = jobToProcess.isManualJob || false;
    const forceTailoring = jobToProcess.forceTailoring || false;

    // Define which decisions trigger the next step in the pipeline.
    const positiveStrategies = ['STRONG FIT - APPLY NOW', 'GOOD FIT - TAILOR & APPLY'];

    // Determine if we should proceed to tailoring
    let shouldTailor = false;
    let tailorReason = '';

    if (isManualJob && forceTailoring) {
      // Manual job with forced tailoring - override AI decision
      shouldTailor = true;
      tailorReason = 'Manual job with user-requested tailoring (AI decision overridden)';
      console.log(`[Manual Job] Forcing tailoring for job ${jobId} as requested by user`);
    } else if (positiveStrategies.includes(applicationStrategy)) {
      // Normal AI-driven decision
      shouldTailor = true;
      tailorReason = `AI decision: ${applicationStrategy}`;
      console.log(`[Matcher Service] AI decision is positive: ${applicationStrategy}`);
    } else {
      // AI recommends not to tailor
      tailorReason = `AI decision: ${applicationStrategy} - no tailoring needed`;
      console.log(`[Matcher Service] AI decision is negative: ${applicationStrategy}`);
    }

    // ONLY if we should tailor, publish the job for tailoring
    if (shouldTailor) {
      console.log(`[Matcher Service] Publishing for tailoring. Reason: ${tailorReason}`);

      const TAILOR_QUEUE_NAME = 'jobs.tailor';
      // The message contains the mission for the next worker, including manual job flags
      const tailorMessage = {
        jobId: jobId,
        matchedPairId: newPair._id,
        campaignId: campaignId,
        resumeId: resumeId,
        isManualJob: isManualJob,
        forceTailoring: forceTailoring,
        tailorReason: tailorReason
      };
      // Ensure the queue exists before sending to it.
      await channel.assertQueue(TAILOR_QUEUE_NAME, { durable: true });
      // Send the new job to the central tailor queue.
      channel.sendToQueue(
        TAILOR_QUEUE_NAME,
        Buffer.from(JSON.stringify(tailorMessage)),
        { persistent: true }
      );
      console.log(`[Matcher-Worker] 🚀 Sent Job ${jobId} to the central tailor queue: "${TAILOR_QUEUE_NAME}".`);

    } else {
      // Tailoring was not triggered - either by AI decision or user choice
      if (isManualJob && !forceTailoring) {
        console.log(`[Manual Job] User chose not to force tailoring for job ${jobId}. AI decision: ${applicationStrategy}`);
      } else {
        console.log(`[Matcher Service] ${tailorReason}. No further action will be taken for this job.`);
      }
    }

    return true; // Indicate successful processing of the job.

  } catch (error) {
    console.error('❌ Matcher Service pipeline failed:', error);
    // This will cause the message to be requeued or dead-lettered, which is correct.
    throw error;
  }
};

/**
 * The final, recommended system prompt that balances a strong persona with clear, directive rules.
 */
const buildSystemPrompt = () => {
  return `
    Role: You are an expert AI Career Coach and Application Strategist. Your user is the candidate, and you will act as their pragmatic and insightful advisor.

    Prime Directive: Be honest, realistic, and constructive. Giving a user false hope is a failure. Your goal is to guide them toward winnable opportunities.

    Rules of Analysis:
    - The 'Hiring Priorities' document is the employer's rulebook. Your analysis must align the candidate's resume to these rules for two audiences:
      1. Machine Screeners (ATS): Match key skills and keywords.
      2. Human Readers: Showcase high-impact results and career narrative.
    - Identify both strong alignments and critical gaps. Frame gaps as actionable prompts for the candidate (e.g., "Be sure to add any projects using Docker...").
    - Assume foundational skills from advanced ones (e.g., React implies HTML/CSS/JS).
    - Flag major, unbridgeable gaps as deal-breakers (e.g., a 3+ year experience shortfall for a senior role or a missing non-negotiable domain).
    - Your entire output must be in the required JSON format only. Do not include any introductory text, explanations, or closing remarks outside of the JSON structure.
     3.Suggestions MUST reframe or re-word experience ALREADY PRESENT in the candidate's resume. DO NOT suggest adding new responsibilities, duties, or skills the candidate has not mentioned.
    - "Suggest specific phrasing changes to better align with the job description's language."
  `.trim();
};

/**
 * Builds a more direct and streamlined user prompt.
 */
const buildUserPrompt = (description, resume_summary, hiring_priorities) => {
  return `
    Your mission: Following your Prime Directive and Rules of Analysis, produce a strategic analysis in the JSON format below. Focus on the most critical factors that determine a candidate's success. Your entire output must be in the required JSON format only.

    Input data:

    Job Description Blueprint:
    ${JSON.stringify(description, null, 2)}

    Candidate Resume Blueprint:
    ${JSON.stringify(resume_summary, null, 2)}

    Employer Hiring Priorities (The Rulebook):
    ${JSON.stringify(hiring_priorities, null, 2)}

    \`\`\`json
    {
      "candidate_name": "",
      "job_title": "",
      "company": "",
      "verdict": "A one-sentence summary of your final decision and the single most important reason.",
      "match_analysis": {
        "strengths": [
          {
            "category": "e.g., Backend Tech Stack, Seniority, Domain Alignment",
            "summary": "Describe a key area of strong alignment and why it matters for this role."
          }
        ],
        "gaps": [
          {
            "category": "e.g., Experience Gap, Missing Core Skill, DevOps Experience",
            "summary": "Describe a critical gap or misalignment and its potential impact.",
            "is_deal_breaker": "true or false"
          }
        ]
      },
      "action_plan": {
        "application_strategy": "Choose one: 'STRONG FIT - APPLY NOW', 'GOOD FIT - TAILOR & APPLY', 'REACH - REQUIRES SIGNIFICANT TAILORING', 'POOR FIT - RECONSIDER'",
        "tailoring_for_ats": {
          "required_keywords": ["List critical keywords from the job description missing from the resume."],
          "phrasing_suggestions": [
            // CRITICAL SAFETY RULE: Suggestions MUST reframe or re-word experience ALREADY PRESENT in the candidate's resume. DO NOT suggest adding new responsibilities, duties, or skills the candidate has not mentioned.
            "Suggest specific phrasing changes to better align with the job description's language."
          ]
        },
        "tailoring_for_human_reviewer": {
          "strengthen_narrative": "Advise on how to frame their experience as a compelling story for this specific role.",
          "highlight_impact": ["Identify 1-2 achievements from the resume that should be made more prominent or rephrased to show quantifiable impact (e.g., 'Instead of 'Managed project', write 'Led a 5-person team to deliver Project X, increasing user engagement by 15%'.')."]
        },
        "alternative_path": "If the fit is poor, suggest other role types that are a better match for the candidate's core strengths.",
        "future_consideration": "Should this role/company be targeted again in the future? 'Yes' or 'No'."
      }
    }
    \`\`\`
  `.trim();
};
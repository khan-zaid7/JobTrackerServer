import ScrapedJob from '../../../models/ScrapedJob.js';
import { callAIAPI, callDeepSeekReasonerAPI } from '../../../utils/aiClient.js';
import { publishToExchange } from '../../queue.js';
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

    This blueprint is the crucial first step in a two-part hiring process. It will be used by a separate AI to filter and evaluate candidates. Therefore, your analysis must be precise and clearly distinguish between absolute, non-negotiable requirements and other preferences. Your output is the rulebook that the next AI must follow.
  `.trim();

  // The user prompt specifies the new, more precise output format.
  const userPrompt = `
    Analyze the provided structured job description. For each category, you will infer the hiring manager's true priority.

    You must classify each requirement's priority using one of these four levels:
    - "Non-Negotiable": A hard requirement. A candidate's failure to meet this is a deal-breaker (e.g., minimum years of experience, specific location/work authorization).
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
      "location_and_availability": {
        "level": "Non-Negotiable",
        "requirement_summary": "Hybrid, based in London, UK.",
        "justification": "Specific location and work model are typically firm legal and logistical requirements."
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

const applyCandidateFlexibility = (originalBlueprint) => {
  // Create a deep copy to avoid modifying the original object
  const modifiedBlueprint = JSON.parse(JSON.stringify(originalBlueprint));

  // Find the location rule
  if (modifiedBlueprint.location_and_availability) {
    console.log(`[Flexibility Override] Downgrading 'location_and_availability' from '${modifiedBlueprint.location_and_availability.level}' to 'Strongly Preferred'.`);

    // Forcefully downgrade the priority level.
    // This tells the AI: "This is a preference, not a deal-breaker. Use your judgment."
    modifiedBlueprint.location_and_availability.level = "Strongly Preferred";
  }

  return modifiedBlueprint;
};

/**
 * Manually injects a location and work model flexibility statement into a structured resume object.
 * This is a pre-processing step to ensure the matching AI correctly interprets the candidate's preferences.
 *
 * @param {object} resumeData - The structured resume JSON, matching the expected blueprint.
 * @returns {object} The modified resume JSON with the flexibility statement added.
 */
const addFlexibilityStatementToResume = (resumeData) => {
  // Ensure we have valid data to work with. If not, return it unchanged.
  if (!resumeData || !resumeData.candidate) {
    console.warn("[Flexibility Injector] Invalid or empty resume data received. Returning as is.");
    return resumeData;
  }

  // Define the clear, powerful statement you want to add.
  const flexibilityStatement = "Fully flexible and open to relocation for remote, hybrid, or on-site roles globally.";

  // --- Injection Point 1: The Contact Section (for structured data and keyword matching) ---

  // Ensure the contact object exists before trying to add to it.
  if (!resumeData.candidate.contact) {
    resumeData.candidate.contact = {};
  }

  // Add a new, explicit field for availability. This is great for the AI's logical reasoning.
  resumeData.candidate.contact.availability_statement = flexibilityStatement;
  console.log("[Flexibility Injector] Added 'availability_statement' to contact info.");


  // --- Injection Point 2: The Summary Section (for narrative context) ---

  // Check if a summary already exists to append to it, otherwise create it.
  if (resumeData.candidate.summary && resumeData.candidate.summary.trim() !== '') {
    // Append to the existing summary for a natural feel.
    resumeData.candidate.summary += ` ${flexibilityStatement}`;
    console.log("[Flexibility Injector] Appended flexibility statement to existing summary.");
  } else {
    // If there's no summary, this statement is important enough to become the summary.
    resumeData.candidate.summary = flexibilityStatement;
    console.log("[Flexibility Injector] Set summary to the flexibility statement as it was empty.");
  }

  return resumeData;
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

    let modifiedResumeSummary = addFlexibilityStatementToResume(resumeSummary);
    let aiResponse;
    // Simple retry logic for the AI call
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`--- Calling AI for Job ${jobId}, Attempt ${attempt} ---`);
        const inferredPriorities = await inferJobPriorities(scrapedJob.description);

        // 2. Apply your candidate's flexibility override
        const modifiedBlueprint = applyCandidateFlexibility(inferredPriorities);

        aiResponse = await callAIAPI(
          buildSystemPrompt(),
          // Pass the structured resume summary and the job description object
          buildUserPrompt({ description: scrapedJob.description, resume_summary: modifiedResumeSummary, hiring_priorities: modifiedBlueprint }),
          { model: 'gpt-4.1-mini' }
        );
        // A new, more robust check for the new output format
        if (aiResponse && aiResponse.recommendation && aiResponse.recommendation.hire_decision) {
          console.log(`✅ AI analysis successful for Job ${jobId}. Hire Decision: ${aiResponse.recommendation.hire_decision}`);
          break; // Exit loop on success
        } else {
          // This handles cases where the AI returns a malformed object
          throw new Error('AI response was malformed or missing the hire_decision field.');
        }
      } catch (error) {
        console.warn(`⚠️ AI call failed on attempt ${attempt} for job ${jobId}: ${error.message}`);
        if (attempt === 2) {
          throw new Error(`AI analysis failed for job ${jobId} after all retries.`);
        }
      }
    }
    console.log(`[Matcher Service] Saving AI analysis report for Job ${jobId}.`);
    // console.log('\n\n')
    // console.log(JSON.stringify(scrapedJob.description));
    // console.log(JSON.stringify(resumeSummary));
    // console.log(JSON.stringify(finalJobBlueprint));
    console.log(JSON.stringify(aiResponse));
    // console.log('\n\n')

    const { recommendation, verdict } = aiResponse;
    const hireDecision = recommendation.hire_decision.toUpperCase();

    // Map the AI's text-based decision to a numerical confidence score for sorting/filtering.
    const confidenceMap = {
      'STRONG HIRE': 0.95,
      'HIRE': 0.90,
      'INTERVIEW': 0.80,
      'PROCEED TO INTERVIEW': 0.75,
      'REJECT': 0.10
    };

    // Create the MatchedPair document with the full analysis.
    // This happens for ALL jobs, regardless of the hire decision.
    const newPair = await MatchedPair.create({
      userId: userId,
      resumeId: resume._id,
      jobId: scrapedJob._id,
      matchConfidence: confidenceMap[hireDecision] || 0.0, // Default to 0 if unknown decision
      matchReason: verdict, // The AI's one-sentence summary is the perfect reason
      analysisReport: aiResponse, // Store the entire detailed report
      tailoringStatus: 'pending', // Status is pending until a decision to tailor is made
      campaignId: campaignId
    });

    console.log(`[Matcher Service] Created MatchedPair document ${newPair._id} with hire_decision: '${hireDecision}'.`);

    // --- STEP 5: DECIDE WHETHER TO PROCEED TO TAILORING ---

    // Define which decisions trigger the next step in the pipeline.
    const positiveDecisions = ['STRONG HIRE', 'HIRE', 'INTERVIEW', 'PROCEED TO INTERVIEW'];

    // ONLY if the decision is positive, we publish the job for tailoring.
    if (positiveDecisions.includes(hireDecision)) {
      console.log(`[Matcher Service] AI decision is positive. Publishing for tailoring.`);

      const TAILOR_QUEUE_NAME = 'jobs.tailor';
      // The message contains the mission for the next worker.
      const tailorMessage = { jobId: jobId, matchedPairId: newPair._id, campaignId: campaignId, resumeId: resumeId };
      // Ensure the queue exists before sending to it.
      await channel.assertQueue(TAILOR_QUEUE_NAME, { durable: true });
      // Send the new job to the central tailor queue.
      channel.sendToQueue(
        TAILOR_QUEUE_NAME,
        Buffer.from(JSON.stringify(tailorMessage)),
        { persistent: true }
      );
      console.log(`[Matcher-Worker] 🚀 Sent Job ${jobId} to the central tailor queue: "${TAILOR_QUEUE_NAME}".`);
      // console.log(`[Matcher Service] 🚀 Published MatchedPair ${newPair._id} to exchange with address "${routingKey}"`);

    } else {
      // For 'REJECT' decisions, we have already saved the report. Our work is done.
      console.log(`[Matcher Service] AI decision is to reject. No further action will be taken for this job.`);
      // Optional: You could update the tailoringStatus here to 'rejected' or 'archived'.
      // newPair.tailoringStatus = 'rejected';
      // await newPair.save();
    }

    return true; // Indicate successful processing of the job.

  } catch (error) {
    console.error('❌ Matcher Service pipeline failed:', error);
    // This will cause the message to be requeued or dead-lettered, which is correct.
    throw error;
  }
};

/**
 * 💡 NEW PROMPT: This prompt encourages narrative alignment over rigid checklists.
 * It asks the AI to think like an experienced recruiter, focusing on whether
 * the job is a logical and compelling "next step" in the candidate's career story.
 */
const buildSystemPrompt = () => {
  return `
    You are a world-class elite hiring recruiter at a multi-national unicorn company, given a candidate's resume, a job description, and a crucial **Hiring Priorities Blueprint**.

    Your role is to act as a pragmatic and data-driven talent evaluator. Your primary guide is the Hiring Blueprint, which defines the non-negotiable and core requirements for the role. Your professional judgment and intuition should be used to evaluate the candidate *within the boundaries set by the blueprint*.

    - **Blueprint is Law:** You MUST treat any requirement marked as "Non-Negotiable" in the blueprint as a hard filter. No amount of "potential" can override a non-negotiable mismatch.
    - **Evaluate Core Skills:** For "Core Requirements," use your expertise to assess the candidate's strength, including the value of their transferable skills. This is where you analyze their story and potential.
    - **Narrative Judgment:** Frame your reasoning as if you're in a hiring meeting, but ground your arguments in the evidence from the resume and the rules from the blueprint.
    - **Balance, Not Exceptions:** Be balanced and human, but do not create exceptions for non-negotiable items. Your job is to find the best talent that meets the foundational requirements. Your credibility with your hiring manager depends on it.
  `.trim();
};



/**
 * Builds the user prompt with the single job and structured resume summary.
 */
const buildUserPrompt = (description, resume_summary, hiring_priorities) => {
  return `
    Once you are done with your analysis, you have to provide a detailed summary of various infromation, why or why not the candidate is suitable for the job to be later used by tailoring resume AI to tailor the resume in the JSON format below. 

    Below is the exact output blueprint should look like:

    \`\`\`json
    {
      "candidate_name": "",
      "job_title": "",
      "company": "",
      "verdict": "A one-sentence summary of your final decision and the primary reason.",
      "reasoning": {
        "experience_gap": {
          "issue": "What is the required experience vs. what the candidate has?",
          "candidate_status": "Does the candidate meet, exceed, or fall short of the requirement?",
          "impact": "How critical is this gap? Is it a hard-blocker or manageable?"
        },
        "domain_alignment": {
          "issue": "Is the job in a specific domain (e.g., FinTech, HealthTech) and does the candidate have experience in it?",
          "candidate_status": "Aligned, Partially Aligned, or Not Aligned.",
          "impact": "Is domain experience a 'must-have' or a 'nice-to-have' for this role?"
        },
        "frontend_expectations": {
          "issue": "What frontend skills are required by the job vs. what the candidate lists?",
          "candidate_status": "Strong Match, Partial Match, or Mismatch.",
          "impact": "How frontend-heavy is this role? Is this a major or minor part of the job?"
        },
        "backend_tech_match": {
          "issue": "Compare the core backend technologies (languages, frameworks, databases) required vs. the candidate's skills.",
          "candidate_status": "Direct Match, Transferable Skills, or Mismatch.",
          "impact": "Is the required backend stack a non-negotiable or are the candidate's skills close enough to adapt?"
        },
        "devops_and_ci_cd": {
          "issue": "Does the job require specific DevOps/Cloud/CI/CD skills (e.g., AWS, Docker, Terraform) and does the candidate have them?",
          "candidate_status": "Experienced, Has Exposure, or Lacks Experience.",
          "impact": "How critical are these skills for day-to-day work in this role?"
        },
        "seniority_and_autonomy": {
          "issue": "Does the job imply a certain level of seniority (e.g., leading projects, mentoring) and does the candidate's resume demonstrate this?",
          "candidate_status": "Matches Seniority, Shows Potential, or Junior Level.",
          "impact": "Is there a mismatch in the expected level of independence and leadership?"
        },
        "soft_skills_culture_fit": {
          "issue": "Based on the candidate's achievements and vibe, do they seem to possess the soft skills implied by the job (e.g., collaboration, problem-solving)?",
          "candidate_status": "Appears to be a Good Fit, Neutral, or Potential Concerns.",
          "impact": "Are there any red flags in how they describe their work that might clash with a team environment?"
        },
        "location_and_availability": {
          "issue": "Does the job specify a location, time-zone, or work model (hybrid, remote) and is there any information to suggest a conflict?",
          "candidate_status": "Assumed Match, Potential Conflict, or Mismatch.",
          "impact": "Is this a logistical deal-breaker?"
        },
        "growth_potential": {
          "issue": "Does this role seem like a logical next step for the candidate's career trajectory?",
          "candidate_status": "Good Career Progression, Plausible Stretch, or Unclear Fit.",
          "impact": "How likely is the candidate to be motivated and engaged in this role long-term?"
        },
        "compensation_expectations": {
          "issue": "Does the job mention a salary range and is there anything in the candidate's profile to suggest a major mismatch (e.g., applying for a junior role with 15 years of experience)?",
          "candidate_status": "Assumed to be in range, Potential Mismatch, or N/A.",
          "impact": "Is there a risk of wasting everyone's time due to compensation issues?"
        },
        "cultural_vibe_match": {
          "issue": "Compare the 'overall_vibe' of the candidate with the likely culture of the company (e.g., startup vs. enterprise, fast-paced vs. structured).",
          "candidate_status": "Seems Aligned, Neutral, or Potential Mismatch.",
          "impact": "How well does the candidate's professional personality seem to fit the implied work environment?"
        }
      },
      "deal_breakers": [
        "List any issues from the reasoning section that are absolute, non-negotiable deal-breakers."
      ],
      "possible_exceptions": [
        "List any potential deal-breakers that might be overlooked if the candidate is exceptionally strong in other areas."
      ],
      "recommendation": {
        "hire_decision": "Choose one: 'STRONG HIRE', 'HIRE', 'INTERVIEW', 'REJECT'",
        "alternative_path": "If not a fit for this role, could they be a fit for another role? (e.g., 'Consider for a more junior backend role').",
        "future_consideration": "Is this a candidate to keep on file for future openings? 'Yes' or 'No'."
      }
    }
    \`\`\`

    Below are the given blueprints of the job description and the resume:

    Job Description Blueprint:
    ${JSON.stringify(description, null, 2)}

    Candidate Resume Blueprint:
    ${JSON.stringify(resume_summary, null, 2)}

    Candidate Resume Blueprint:
    ${JSON.stringify(hiring_priorities, null, 2)}
  `.trim();
};

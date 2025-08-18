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
  console.log('Inferring hiring priorities from job description...');

  // System prompt to set the AI's role and context.
  const systemPrompt = `
    You are an expert Senior Technical Recruiter. Your task is to analyze a standard job description and infer the hiring manager's priorities for the role. Based on the language, placement of requirements (e.g., "Required" vs. "Desired"), and the core function of the role, you must generate a JSON object that assigns a 'High', 'Medium', or 'Low' priority to a predefined set of evaluation criteria.
  `.trim();

  // User prompt with detailed instructions, the required output format, and the job description data.
  const userPrompt = `
    Read the entire Job Description carefully. Pay attention to:
    - Explicit sections like "Required Qualifications" vs. "Desired Qualifications".
    - Strong keywords like "expert knowledge", "must have", "play a key role".
    - The job title itself (e.g., "Senior" implies seniority is important).
    - The frequency and emphasis of certain responsibilities.

    Produce a JSON object with two keys:
    1. \`priorities\`: The inferred priority levels for each of the 11 categories.
    2. \`justification\`: A brief explanation for each priority choice, referencing the text from the job description.

    This is the exact JSON output format you must follow:
    \`\`\`json
    {
      "priorities": {
        "experience_gap": "High/Medium/Low",
        "domain_alignment": "High/Medium/Low",
        "frontend_expectations": "High/Medium/Low",
        "backend_tech_match": "High/Medium/Low",
        "devops_and_ci_cd": "High/Medium/Low",
        "seniority_and_autonomy": "High/Medium/Low",
        "soft_skills_culture_fit": "High/Medium/Low",
        "location_and_availability": "High/Medium/Low",
        "growth_potential": "High/Medium/Low",
        "compensation_expectations": "High/Medium/Low",
        "cultural_vibe_match": "High/Medium/Low"
      },
      "justification": {
        "experience_gap": "Reasoning based on JD text.",
        "domain_alignment": "Reasoning based on JD text.",
        "frontend_expectations": "Reasoning based on JD text.",
        "backend_tech_match": "Reasoning based on JD text.",
        "devops_and_ci_cd": "Reasoning based on JD text.",
        "seniority_and_autonomy": "Reasoning based on JD text.",
        "soft_skills_culture_fit": "Reasoning based on JD text.",
        "location_and_availability": "Reasoning based on JD text.",
        "growth_potential": "Reasoning based on JD text.",
        "compensation_expectations": "Reasoning based on JD text.",
        "cultural_vibe_match": "Reasoning based on JD text."
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
    console.log('✅ Job priorities blueprint created successfully.');
    return prioritiesBlueprint;
  } catch (error) {
    console.error('❌ Failed to create the job priorities blueprint.', error);
    throw new Error('The job description could not be analyzed for its priorities. Please check its content and try again.');
  }
};


const blueprint = await summarizeResume(`ZAID KHAN 
khan.mohd.zaid@protonmail.com | 416-826-5259 | linkedin.com/in/khan
zaid7 | github.com/khan-zaid7 
SUMMARY 
Process Automation Engineer specializing in building scalable, AI-driven platforms to 
eliminate manual work and optimize complex business operations. Adept at transforming 
high-level requirements into robust, full-stack applications with a focus on API integration 
and backend system architecture. 
PROJECTS 
Full-Stack Resume Tailoring & Job Application Pipeline  
• Architected a distributed, multi-worker system using Node.js and RabbitMQ to 
automate the entire job application lifecycle, from scraping job boards to generating 
tailored resumes. 
• Engineered a sophisticated two-pass AI prompting strategy with DeepSeek/OpenAI 
to analyze job descriptions, identify skill gaps, and rewrite resume content to align 
with specific roles. 
• Containerized the entire application stack (Scraper, Matcher, Tailor workers) 
using Docker and orchestrated the local development environment with Docker 
Compose, including services for MongoDB and RabbitMQ. 
• Implemented a PDF generation module using LaTeX, automatically compiling and 
uploading the final, tailored documents to Google Cloud Storage. 
Ember Core – Offline-First Mobile Data Synchronization Platform 
• Developed a resilient mobile application architecture using React 
Native and SQLite that guarantees full functionality during network outages. 
• Engineered a bidirectional data synchronization system with Firebase 
Firestore and Node.js, featuring robust conflict resolution to ensure data integrity 
between local devices and the cloud. 
EXPERIENCE 
Software Developer | Cybertron Technologies | Chandigarh, IN | Dec 2021 - Nov 2023 
• Productized a suite of internal process automation tools using React, Django, and 
Node.js, saving an estimated 20 man-hours per week by eliminating manual data 
entry and report generation. 
• Architected and deployed secure RESTful APIs that served as the backbone for real
t
 ime data integration across multiple business-critical applications. 
• Led the optimization of PostgreSQL databases, improving query performance by 
over 35% and enhancing system reliability for data-intensive applications. 
• Engineered the CI/CD pipeline using GitHub Actions, reducing deployment time by 
40% and enabling faster iteration cycles for the development team. 
• Managed cloud infrastructure on AWS using Terraform and Docker, ensuring 
scalable and repeatable deployments. 
SKILLS 
• Languages: JavaScript (Node.js), Python, Java, C# 
• Backend: Express, Django, REST API Design, Microservices Architecture, RabbitMQ 
• Frontend: React.js, Next.js, Vue, Tailwind CSS 
• Databases: PostgreSQL, MongoDB, MySQL, DynamoDB, SQLite 
• Cloud & DevOps: AWS (EC2, S3, Lambda), Docker, Terraform, CI/CD, GitHub Actions 
• AI & Automation: AI Prompt Engineering, Playwright, LaTeX 
EDUCATION 
Lambton College | Postgraduate Diploma, Full Stack Software Development | Jan 2024 – 
Aug 2025 (Expected) 
• Relevant Coursework: DevOps, Cloud Computing, Advanced Java 
I.K. Gujral Punjab Technical University | Bachelor of Science, Information Technology | Aug 
2019 – Apr 2022 
• Relevant Coursework: Data Structures & Algorithms, Object-Oriented Programming, 
SQL Databases `);

// The 'null, 2' part tells it to format the JSON with an indentation of 2 spaces
console.log(JSON.stringify(blueprint, null, 2));
/**
 * Processes a single job against a user's master resume.
 * @param {object} jobToProcess A message object from the queue, containing jobId and campaignId.
 */
export const matchJobsToResume = async (jobToProcess) => {
  try {
    if (!jobToProcess || !jobToProcess.jobId) {
      console.log('[Matcher Service] Received an invalid job payload. Nothing to do.');
      return true;
    }

    // --- STEP 1: EXTRACT MISSION-CRITICAL DATA ---
    const { jobId, campaignId } = jobToProcess;
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

    const resumeId = process.env.RESUME_ID;
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
    let finalJobBlueprint;
    // Simple retry logic for the AI call
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`--- Calling AI for Job ${jobId}, Attempt ${attempt} ---`);
        const inferredPriorities = await inferJobPriorities(scrapedJob.description);
        
        finalJobBlueprint = {
          ...scrapedJob.description,
          ...inferredPriorities // This adds the "priorities" key to the object
        };

        aiResponse = await callDeepSeekReasonerAPI(
          buildSystemPrompt(),
          // Pass the structured resume summary and the job description object
          buildUserPrompt({ description: finalJobBlueprint, resume_summary: resumeSummary }),
          { model: 'gpt-4.1-mini' } // A powerful model is needed for this level of analysis
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
    // console.log(JSON.stringify(aiResponse));
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

      const routingKey = `tailor.${campaignId}`;
      const message = {
        matchedPairId: newPair._id.toString(),
        campaignId: campaignId
      };

      await publishToExchange(routingKey, message);
      console.log(`[Matcher Service] 🚀 Published MatchedPair ${newPair._id} to exchange with address "${routingKey}"`);

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
    You are a world-class elite hiring recruiter at a multi-national unicorn company. 
    You are given a JSON blueprint of a job description and a candidate's resume. 
    Your role is to think like a real recruiter would in a hiring meeting.

    - Go beyond keywords. Read the story of the candidate: who they are, what they bring, and the overall vibe they project.  
    - Evaluate both strengths and weaknesses, but in a narrative style, not just bullet points.  
    - Imagine explaining to your colleagues why this candidate excites you or why you have reservations.  
    - Identify potential deal-breakers (e.g., missing critical skills, lacking required language proficiency, insufficient experience), but also weigh whether adaptability, fast learning, or potential could compensate.  
    - Highlight the candidate’s strongest qualities, cultural fit (including verbal language barrier), and how they might perform in an interview.  
    - Don’t reject someone just because they’re not 100% perfect — assess tradeoffs, potential, and competitiveness.  
    - Trust your professional instincts. Be honest, balanced, and human in your judgment.  

  Make sure your reasoning feels like a thoughtful recruiter’s voice, not just a checklist.
  `.trim();
};



/**
 * Builds the user prompt with the single job and structured resume summary.
 */
const buildUserPrompt = (description, resume_summary) => {
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
  `.trim();
};

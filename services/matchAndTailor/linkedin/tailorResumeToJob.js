import MatchedPair from '../../../models/MatchedPair.js';
import Resume from '../../../models/Resume.js';
import ScrapedJob from '../../../models/ScrapedJob.js';
import TailoredResume from '../../../models/TailoredResume.js';
import { callAIAPI } from '../../../utils/aiClient.js';
import { createResumeDocument } from './createResumeDocument.js';

// 
const createMasterTailorPlan = async (resumeSummary, jobDescriptionSummary, jobToResumeAnalysis) => {
  console.log('Creating the master plan of how the resume will be tailored.');

  // Using the exact system prompt you provided.
  const systemPrompt = `
        You are an elite-level and world-class career strategist. Your task is to read and extract information-rich data from the provided Resume blueprint JSON summary, Job description, and Job-To-Resume analysis report. After analyzing, your task is to create a plan of tailoring strategies which will be used by the 1st. Professional title-and-summary maker, then resume-body-maker AI models, and enable them to tailor the resume to such an elite level of precision that it can conquer both ATS and human recruiters. 
        `.trim();

  const userPrompt = `
  The expected plan of tailoring strategies would look like below: 
    \`\`\`json
    {
      "match_tier": "A strategic classification: e.g., 'Strong Contender', 'Plausible Stretch', 'Hard Reject'",
      "confidence_score": "A numerical score from 0-100 representing the AI's confidence.",
      "analysis_summary": "A concise, one-sentence summary explaining the core strategic situation (e.g., 'High-potential candidate with strong foundational skills but critical gaps in specific, required tooling.')",
      "core_narrative_to_project": "The single, most important story or theme the tailored resume must tell. (e.g., 'Reframe the candidate from a Generalist to a Specialist in Data-Centric Automation.')",
      "strategic_goals": {
        "amplify": [
          {
            "strength": "Identify a key candidate strength that directly aligns with a major job requirement.",
            "action": "Provide a specific, tactical instruction for the Tailor AI on how to amplify this strength in the resume."
          }
        ],
        "bridge_gaps": [
          {
            "gap": "Identify a critical weakness or missing requirement from the Matcher's report.",
            "strategy": "Provide a specific, actionable strategy for the Tailor AI on how to reframe the candidate's existing experience to bridge this gap without fabricating."
          }
        ]
      },
      "conceptual_keywords_to_integrate": [
        "List of 5-7 high-value conceptual keywords and phrases from the job description that must be naturally woven into the new narrative."
      ]
    }
    \`\`\`
    Here is the Resume summary, Job description summary , and Job-To-Resume analysis report:
    ---
    ${resumeSummary}
    ${jobDescriptionSummary}
    ${jobToResumeAnalysis}
  `.trim();

  try {
    const blueprint = await callAIAPI(systemPrompt, userPrompt, {model: 'gpt-4.1-mini'});
    console.log('✅ Resume blueprint created successfully.');
    return blueprint;
  } catch (error) {
    console.error('❌ Failed to create the resume blueprint.', error);
    throw new Error('The resume could not be analyzed for its narrative. Please check its content and try again.');
  }
};

/**
 * Creates the high-impact opening of the resume (Header, Title, Summary)
 * based on the master strategic plan from Step 1.
 * @param {object} resumeSummary - The original summarized resume JSON to get contact info.
 * @param {object} strategicPlan - The master plan generated in Step 1.
 * @returns {Promise<object>} A promise that resolves to the structured Header, Title, and Summary JSON.
 */
const createResumeHeader = async (resumeSummary, jobDescriptionSummary, jobToResumeAnalysis, strategicPlan) => {
  console.log('✅ Step 2: Creating the professional title and summary.');

  // This AI persona is a specialist copywriter focused ONLY on the resume's opening.
  const systemPrompt = `
    You are a master Resume Wordsmith and Headhunter's Copywriter, specializing in creating high-impact opening statements that immediately capture a recruiter's attention and align with a core strategic narrative. Your sole task is to generate the professional 'Header', a targeting 'Title', and a powerful **but brief**  'Summary' based on the provided master plan, resume summary, job description summary, JobToResume analysis report.

    The generated resume's professional headline ('Title') should clearly connect to the position you're applying for. This doesn't mean misrepresenting experience, but rather framing it in relevant terms. If the candidate's titles don't obviously connect to the role, you must create a professional headline that bridges this gap.The title should contain only title.

    For example, if applying for a "Customer Success Manager" role but the current title is "Client Relations Specialist", you might create a headline like "*Client Relations Specialist with Customer Success Experience.*" This helps both human readers and automated systems (ATS) make the connection.
    
  `.trim();

  const userPrompt = `
    Based on the provided strategic plan and candidate data, generate the Header, Title, and Summary.

    **EXPECTED OUTPUT (JSON format only):**
    Your output must be a single, valid JSON object following this exact structure.
    \`\`\`json
    {
      "Header": {
        "fullName": "Full Name",
        "contact": {
          "email": "...",
          "phone": "...",
          "github": "...",
          "linkedin": "..."
        }
      },
      "Title": "*Your generated targeting headline here*",
      "Summary": {
        "paragraphs": [
          "Your single, powerful summary sentence here."
        ]
      }
    }
    \`\`\`
    Here is the Resume summary, Job description summary , and Job-To-Resume analysis report, master statergic plan:
    ---
    ${JSON.stringify(resumeSummary, null, 2)}
    ${JSON.stringify(jobDescriptionSummary, null, 2)}
    ${JSON.stringify(jobToResumeAnalysis, null, 2)}
    ${JSON.stringify(strategicPlan, null, 2)}
    ---
  `.trim();

  try {
    // Assuming you have a generic 'callAIAPI' function
    const headerBlueprint = await callAIAPI(systemPrompt, userPrompt, {model: 'gpt-4.1-mini'});
    console.log('✅ Header, Title, and Summary created successfully.');
    return headerBlueprint;
  } catch (error)
  {
    console.error('❌ Failed to create the resume header.', error);
    throw new Error('The resume header and summary could not be generated. Check the strategic plan and input data.');
  }
};

/**
 * Rewrites the body of the resume (Experience, Projects, Skills, Education)
 * based on the master strategic plan and the core principles of effective tailoring.
 * @param {object} resumeSummary - The original summarized resume JSON.
 * @param {object} jobDescriptionSummary - The summarized job description.
 * @param {object} jobToResumeAnalysis - The initial analysis report.
 * @param {object} strategicPlan - The master plan from Step 1.
 * @param {object} headerBlueprint - The generated header/summary from Step 2.
 * @returns {Promise<object>} A promise that resolves to the structured JSON of the rewritten resume body.
 */
const createResumeBody = async (resumeSummary, jobDescriptionSummary, jobToResumeAnalysis, strategicPlan, headerBlueprint) => {
  console.log('✅ Step 3: Rewriting the resume body (Experience, Projects, Skills, Education).');

  // This AI persona is an expert at executing a strategic plan and weaving a narrative into the details of a resume.
  const systemPrompt = `
    You are an expert Resume Strategist and Wordsmith responsible for executing a master plan to tailor the body of a resume. Your task is to rewrite the Experience, Projects, Skills, and Education sections to provide compelling evidence for the strategic narrative defined in the plan.

    // --- YOUR CORE METHODOLOGY (Follow these principles) --- //

    Your main task is **folding in relevant keywords and phrases**. You must integrate the conceptual keywords from the strategic plan naturally throughout the resume's Experience and Projects sections.

    This integration must feel **natural, not forced**. For each keyword, think about how it genuinely relates to the candidate's experience. For example, if the plan requires integrating "cross-functional collaboration," do not just add it to a skills list. Instead, fold it into an experience bullet: "Spearheaded a cross-functional collaboration between engineering and product teams to launch a new global feature."

    Your approach is not about gaming the system—it's about **advertising**. Present the candidate's authentic professional self in a way that highlights the most relevant aspects of their experience for this specific opportunity.

    // --- CRITICAL PITFALLS TO AVOID --- //
    - **No Keyword Stuffing:** Every keyword must be contextually relevant to the candidate's actual experience.
    - **No Stretching the Truth:** Do not misrepresent qualifications. Your goal is to reframe and refocus real, relevant experiences honestly.
    - **No Generic Language:** Avoid template phrases. Every bullet point should be tailored and impactful.
  `.trim();

  const userPrompt = `
    Based on the provided strategic plan and the original resume content, rewrite the body of the resume.

    // --- YOUR MISSION BRIEF: THE MASTER STRATEGIC PLAN --- //
    // Your primary task is to execute the 'strategic_goals' ('amplify' and 'bridge_gaps') from this plan.
    // You MUST integrate the 'conceptual_keywords_to_integrate' into your rewritten descriptions.
    ${JSON.stringify(strategicPlan, null, 2)}

    // --- EXPECTED OUTPUT (JSON format only) --- //
    // Your output must be a single, valid JSON object following this exact structure.
    \`\`\`json
    {
      "Experience": [
        {
          "jobTitle": "...",
          "company": "...",
          "dates": { "start": "...", "end": "..." },
          "responsibilities": ["Rewritten bullet 1...", "Rewritten bullet 2..."]
        }
      ],
      "Projects": [
        {
          "name": "...",
          "technologies": ["...", "..."],
          "details": ["Rewritten detail 1..."]
        }
      ],
      "Skills": {
        "programmingLanguages": [],
        "frontend": [],
        "backend": [],
        "databases": [],
        "cloudDevOps": []
      },
      "Education": [
        {
          "institution": "...",
          "degree": "...",
          "dates": { "start": "...", "end": "..." },
          "details": ["..."]
        }
      ]
    }
    \`\`\`
    Here is the Resume summary, Job description summary , and Job-To-Resume analysis report, master statergic plan:
    ---
    ${JSON.stringify(resumeSummary, null, 2)}
    ${JSON.stringify(jobDescriptionSummary, null, 2)}
    ${JSON.stringify(jobToResumeAnalysis, null, 2)}
    ${JSON.stringify(strategicPlan, null, 2)}
    ${JSON.stringify(headerBlueprint, null, 2)}
  `.trim();

  try {
    const bodyBlueprint = await callAIAPI(systemPrompt, userPrompt, {model: 'gpt-4.1-mini'});
    console.log('✅ Resume body rewritten successfully.');
    // Assuming the AI response might be wrapped in markdown, so we parse it safely.
    return bodyBlueprint;
  } catch (error) {
    console.error('❌ Failed to rewrite the resume body.', error);
    throw new Error('The resume body could not be generated. Check the strategic plan and input data.');
  }
};

/**
 * Generates a fully tailored resume JSON by combining the header, summary, and body.
 * @param {object} resumeSummary - Original summarized resume JSON.
 * @param {object} jobDescriptionSummary - Job description summary.
 * @param {object} jobToResumeAnalysis - Job-to-resume analysis report.
 * @param {object} strategicPlan - Master strategic tailoring plan.
 * @returns {Promise<object>} Fully structured resume JSON.
 */
const createFullResume = async (resumeSummary, jobDescriptionSummary, jobToResumeAnalysis, strategicPlan) => {
  try {
    console.log('🚀 Generating complete tailored resume...');

    // Step 1: Generate Header, Title, and Summary
    const headerBlueprint = await createResumeHeader(
      resumeSummary,
      jobDescriptionSummary,
      jobToResumeAnalysis,
      strategicPlan
    );

    // Step 2: Generate Body (Experience, Projects, Skills, Education)
    const bodyBlueprint = await createResumeBody(
      resumeSummary,
      jobDescriptionSummary,
      jobToResumeAnalysis,
      strategicPlan,
      headerBlueprint
    );

    // Step 3: Merge outputs into single JSON
    const fullResume = {
      Header: headerBlueprint.Header,
      Headline: headerBlueprint.Title, // mapping Title → Headline
      Summary: headerBlueprint.Summary,
      Experience: bodyBlueprint.Experience || [],
      Projects: bodyBlueprint.Projects || [],
      Skills: bodyBlueprint.Skills || {
        programmingLanguages: [],
        frontend: [],
        backend: [],
        databases: [],
        cloudDevOps: []
      },
      Education: bodyBlueprint.Education || []
    };

    console.log('✅ Complete resume JSON generated successfully.');
    return fullResume;

  } catch (error) {
    console.error('❌ Failed to create the full resume.', error);
    throw new Error('Full resume generation failed. Check inputs and prior steps.');
  }
};

export async function tailorResumeToJob({ userId, resumeId, jobId, matchedPairId, campaignId }) {
  try {
    const [resume, job, matchedPair] = await Promise.all([
      Resume.findById(resumeId),
      ScrapedJob.findById(jobId),
      MatchedPair.findById(matchedPairId)
    ]);

    if (!resume) throw new Error(`Resume not found: ${resumeId}`);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    if (!matchedPair) throw new Error(`Job not found: ${matchedPairId}`);

    const masterTailorPlan = await createMasterTailorPlan(resume.summary, job.description, matchedPair.analysisReport);
    const fullResume = await createFullResume(resume.summary, job.description, matchedPair.analysisReport, masterTailorPlan);

    console.warn(JSON.stringify(fullResume, null, 2));

    const tailoredResume = await TailoredResume.create({
      userId,
      resumeId,
      jobId,
      matchedPairId,
      tailoredText:  JSON.stringify(fullResume),
      status: 'success',
      campaignId: campaignId,
      masterPlan: masterTailorPlan,
    });

    await createResumeDocument(tailoredResume, userId, job);
    console.log(`[Tailoring Success] Job: ${job.title} | Resume: ${resumeId}`);
    return tailoredResume;

  } catch (err) {
    console.error('[tailorResume error]', err);
    return await TailoredResume.create({
      userId,
      resumeId,
      jobId,
      matchedPairId,
      status: 'failed',
      error: err.message,
      campaignId: campaignId,
    });
  }
}

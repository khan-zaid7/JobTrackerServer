import Resume from '../../../models/Resume.js';
import ScrapedJob from '../../../models/ScrapedJob.js';
import TailoredResume from '../../../models/TailoredResume.js';
import { callDeepSeekReasonerAPI } from '../../../utils/aiClient.js';
import { createResumeDocument } from './createResumeDocument.js';

// =================================================================
// 1. PROMPT FOR PASS 1 (ANALYSIS)
// =================================================================
const analysisSystemPrompt = `
  You are a hyper-efficient Resume Analyst AI. Your task is to compare a resume to a job description and produce a concise, structured JSON analysis report.

  **RULES:**
  - Identify top 3-5 strengths.
  - Identify the most critical gaps (missing skills, experience duration mismatch, etc.).
  - Extract 5-8 high-value keywords and conceptual phrases from the job description that are missing or underrepresented.
  - **Calculate the total years of professional experience from the resume's 'Experience' section.** Sum up the duration of all listed jobs.
  - **Identify critical skills required by the job but completely missing from the resume's skills/experience.**
  - Generate a concise "interview cheat sheet".

  **OUTPUT FORMAT (JSON only):**
  \`\`\`json
  {
    "analysis": {
      "strengths": ["List of strengths..."],
      "gaps": ["List of critical gaps..."],
      "keywordsToIntegrate": ["List of keywords..."],
      "calculatedExperience": 1.0,
      "missingCoreSkills": ["List of missing required skills..."]
    },
    "interviewPrep": {
      "talkingPoints": "A brief paragraph on what the candidate should emphasize.",
      "gapsToAddress": "A brief paragraph on how the candidate should prepare to discuss their gaps."
    },
    "matchScore": 0.75
  }
  \`\`\`
`.trim();

// =================================================================
// 2. FINAL PROMPT FOR PASS 2 (GENERATION) - The "Credibility Bridge"
// =================================================================
const getGeneratorSystemPrompt = (analysisReport) => {
  const plan = `
    **1. Core Guardrails (Non-Negotiable):**
    - **Experience Duration:** The candidate has ~${Math.round(analysisReport.calculatedExperience || 1)} year(s) of experience. This number must not be inflated.
    - **Projects & Employers:** The list of projects and employers is factual and cannot be altered or added to. However, the *descriptions* of projects and work responsibilities SHOULD be re-framed to align with the target role.
    - **Summary Content Rule: YOU ARE FORBIDDEN FROM MENTIONING THE NUMBER OF YEARS OF EXPERIENCE (e.g., '1 year') IN THE SUMMARY. Focus on impact and skills instead.**

    **2. The Credibility Bridge Statergy (The "JS vs. Java" Problem):**
    - This is a **capability projection task**. The goal is to demonstrate that the candidate's existing skills provide a powerful foundation for the target role's requirements, even if the tools differ.
    - **Strategy:** Identify the *foundational skill* behind the experience (e.g., "Object-Oriented Programming," "Asynchronous API Design," "Scalable System Architecture"). Then, re-write the experience bullet to highlight this foundational skill first, while being honest about the tool used.
    - **Example:** If the candidate built a Node.js API and the job requires Java, do NOT say "Java experience." Instead, say: "**Engineered scalable, object-oriented backend systems (Node.js), establishing a strong, transferable foundation for building and maintaining enterprise-grade services in Java.**"

    **3. Conceptual Keyword Integration Statergy:**
    - The \`keywordsToIntegrate\` list contains the target job's "dialect." Your primary goal is to rewrite the resume so it naturally uses the language and concepts from the job description.
    - **You MUST integrate at least 5-8 of these keywords and concepts** into the summary and experience/project bullets to make the candidate sound like an insider.
    - **Keywords for this run:** '${(analysisReport.keywordsToIntegrate ?? []).join(', ')}'

    **4. Presentation Statergy (CRITICAL FOR HUMAN REVIEW):**
    - You MUST create a concise **Targeting Headline** in italics. This will go in the 'Headline' field of the output JSON.
    - The Professional Summary MUST be a **single, powerful sentence** (max 2 lines). This will go in the 'Summary.paragraphs' array.
  `.trim();

  return `
    🧠 You are an expert Career Strategist and Resume Wordsmith. Your mission is to build the strongest possible case for the candidate by **aggressively re-framing** their experience to make them appear highly capable for the role, while adhering to the core factual guardrails.

    ---

    🚨 **MANDATORY STRATEGIC BRIEF** 🚨
    You must follow this plan precisely. Your task is to bridge the credibility gap.
    ${plan}

    ---

    🎯 **GENERAL STRATEGY & RULES**

    **OBJECTIVE**
    Tailor an existing resume for a target job description to **maximize match quality** without fabricating experience. You may rephrase, amplify, integrate missing keywords (as exposure), and deprioritize content. But you **must not** invent job roles, fake skills, or fabricate years of experience.

    ---

    **RULES**
    - Final resume should be **1–1.5 pages** (max ~800 words).
    - Bullet points only (\`•\`) — no paragraphs > 2 lines.
    - Use active voice and strong action verbs.
    - Quantify results wherever possible.
    - Maintain **professional tone**, no personal pronouns.
    - Existing high-quality keywords or metrics must **not be removed**.

    ---
    
    **ACTION VERB CATEGORIES**
    - Leadership: Directed, Executed, Oversaw, Spearheaded
    - Technical: Engineered, Optimized, Programmed, Built
    - Analytical: Analyzed, Assessed, Modeled, Synthesized
    - Communication: Presented, Advised, Negotiated, Authored
    - Support/Education: Trained, Facilitated, Guided, Resolved
    - Organizational: Coordinated, Launched, Streamlined, Delivered

    ---

    ✅ **FINAL CHECKLIST - VERIFY BEFORE OUTPUTTING**
    - Does my resume include an italicized Headline?
    - Is the Summary a single, punchy sentence?
    - Did I re-frame the experience to project capability in the target technologies (like the JS to Java example)?
    - Did I integrate at least 5 conceptual keywords from the job description?
    - Have I avoided lying about years of experience and projects?

    If verified, proceed with the JSON output.

    ---

    📦 **OUTPUT FORMAT**
    Return the tailored resume in **the exact JSON format specified below**, suitable for saving and rendering. Do not deviate from this structure.

    \`\`\`json
    {
      "tailored_resume": "<final_resume_text (plain text)>",
      "tailored_sections": {
        "Header": { "fullName": "Full Name", "contact": { "email": "...", "phone": "...", "github": "...", "linkedin": "..." } },
        "Headline": "*Targeting Headline Here*",
        "Summary": { "paragraphs": ["Single, powerful summary sentence here."] },
        "Experience": [ { "jobTitle": "...", "company": "...", "dates": { "start": "...", "end": "..." }, "responsibilities": ["...", "..."] } ],
        "Projects": [ { "name": "...", "technologies": ["...", "..."], "details": ["..."] } ],
        "Skills": { "programmingLanguages": [], "frontend": [], "backend": [], "databases": [], "cloudDevOps": [] },
        "Education": [ { "institution": "...", "degree": "...", "dates": { "start": "...", "end": "..." }, "gpa": "...", "details": ["..."] } ]
      },
      "tailoring_rationale": ["List of changes made..."],
      "confidence": 0.93,
      "format": "plain_text",
      "status": "success",
      "errorLog": null
    }
    \`\`\`
  `.trim();
};

function safeJsonParse(text) {
  if (typeof text !== 'string') return text;
  try {
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('No valid JSON object found in response.');
    const jsonString = text.substring(jsonStart, jsonEnd + 1);
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Failed to parse AI response as JSON:', text);
    return null;
  }
}

function validateExperienceHonesty(tailoredResumeJson, originalExperienceYears) {
  const summaryText = tailoredResumeJson.tailored_sections?.Summary?.paragraphs[0] || '';
  const summaryMatch = summaryText.match(/(\d+)\+?\s*years?/);
  const summaryYears = summaryMatch ? parseInt(summaryMatch[1], 10) : null;

  if (summaryYears && Math.round(originalExperienceYears) < summaryYears) {
    throw new Error(`AI Hallucination Detected: Summary claims ${summaryYears} years of experience, but original resume only has ~${Math.round(originalExperienceYears)} year(s). Rejecting result.`);
  }
  console.log('[Validation Pass] Experience duration check passed.');
}

export async function tailorResumeToJob({ userId, resumeId, jobId, campaignId}) {
  try {
    const [resume, job] = await Promise.all([
      Resume.findById(resumeId),
      ScrapedJob.findById(jobId)
    ]);

    if (!resume) throw new Error(`Resume not found: ${resumeId}`);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    const userPrompt = `
      Here is the job description:
      Title: ${job.title}
      Company: ${job.companyName}
      Responsibilities: ${(job.description?.responsibilities || []).join('\n')}
      Qualifications: ${(job.description?.qualifications || []).join('\n')}
      Here is the resume content:
      ${resume.textContent}
    `.trim();

    // --- PASS 1: ANALYSIS ---
    console.log(`[Pass 1/2: Analyzing] Job: ${job.title}`);
    const analysisResultRaw = await callDeepSeekReasonerAPI(analysisSystemPrompt, userPrompt);
    const analysisResult = safeJsonParse(analysisResultRaw);
    if (!analysisResult?.analysis) {
      throw new Error('Analysis Pass (1/2) failed: AI did not return a valid analysis object.');
    }

    // --- PASS 2: GENERATION ---
    console.log(`[Pass 2/2: Generating with Credibility Bridge] Job: ${job.title}`);
    const generatorSystemPrompt = getGeneratorSystemPrompt(analysisResult.analysis);
    const finalResultRaw = await callDeepSeekReasonerAPI(generatorSystemPrompt, userPrompt);
    const finalResult = safeJsonParse(finalResultRaw);

    if (!finalResult?.tailored_sections || !finalResult.tailored_resume) {
      throw new Error('Generation Pass (2/2) failed: AI did not return the required resume structure.');
    }

    // --- POST-GENERATION VALIDATION ---
    validateExperienceHonesty(finalResult, analysisResult.analysis.calculatedExperience);

    // --- FINALIZATION ---
    const { analysis = {}, interviewPrep = {} } = analysisResult;
    const tailoredResume = await TailoredResume.create({
      userId,
      resumeId,
      jobId,
      tailoredText: finalResult.tailored_resume,
      confidence: finalResult.confidence ?? analysisResult.matchScore ?? 0.5,
      tailoredSections: finalResult.tailored_sections,
      rawAIResponse: finalResult,
      analysis: analysis,
      interviewPrep: interviewPrep,
      status: 'success',
      campaignId: campaignId,
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
      status: 'failed',
      error: err.message,
      campaignId: campaignId,
    });
  }
}

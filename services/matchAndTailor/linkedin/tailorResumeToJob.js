import Resume from '../../../models/Resume.js';
import ScrapedJob from '../../../models/ScrapedJob.js';
import TailoredResume from '../../../models/TailoredResume.js';
import { callDeepSeekAPI } from '../../../utils/deepseek.js';
import { createResumeDocument } from './createResumeDocument.js';


const TAILORING_CONFIDENCE_THRESHOLD = 0.6;

export async function tailorResumeToJob({ userId, resumeId, jobId }) {
  try {
    const [resume, job] = await Promise.all([
      Resume.findById(resumeId),
      ScrapedJob.findById(jobId)
    ]);

    if (!resume) throw new Error(`Resume not found: ${resumeId}`);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    if (typeof job.confidenceFactor === 'number' && job.confidenceFactor < TAILORING_CONFIDENCE_THRESHOLD) {
      console.log(`[Skip Tailoring] Low confidence (${job.confidenceFactor}) for job ${job.title}`);
      return await TailoredResume.create({
        userId,
        resumeId,
        jobId,
        confidence: job.confidenceFactor,
        status: 'failed',
        error: `Tailoring skipped due to low confidence (${job.confidenceFactor})`
      });
    }

    // ✳️ System prompt with added sample output
    const systemPrompt = `
      🧠 You are an elite resume optimization AI, trained in advanced ATS principles and human-readable formatting. Your mission is to **tailor a resume to a specific job posting** using strict yet intelligent transformation strategies.

      ---

      🎯 **OBJECTIVE**  
      Tailor an existing resume for a target job description to **maximize match quality** without fabricating experience. You may:
      - Rephrase or amplify existing achievements (e.g., impact, scope, relevance).
      - Integrate missing **keywords or tools** (as exposure, coursework, tools used, etc.).
      - Deprioritize or compress unrelated content.
      But you **must not** invent job roles, fake skills, or fabricate years of experience.

      ---

      📏 **RULES**
      - Final resume should be **1–1.5 pages** (max ~800 words).
      - Summary: Max 4 lines.
      - Bullet points only (\`•\`) — no paragraphs >2 lines.
      - Use active voice and **action verbs** from the provided categories.
      - Quantify results wherever possible (e.g., “Increased efficiency by 22%”).
      - Maintain **professional tone**, no personal pronouns.
      - Ensure formatting is clean, consistent, and **ATS-optimized**.
      - Existing high-quality keywords or metrics must **not be removed**.

      ---

      🛠️ **ACTION VERB CATEGORIES**
      - Leadership: Directed, Executed, Oversaw, Spearheaded  
      - Technical: Engineered, Optimized, Programmed, Built  
      - Analytical: Analyzed, Assessed, Modeled, Synthesized  
      - Communication: Presented, Advised, Negotiated, Authored  
      - Support/Education: Trained, Facilitated, Guided, Resolved  
      - Organizational: Coordinated, Launched, Streamlined, Delivered

      ---

      📚 **TAILORING STRATEGY**
      - Focus on **Work Experience** and **Professional Summary**.
      - Rewrite experience bullets to reflect the **terminology and goals** in the job description.
      - You MAY combine weak bullets or compress unrelated roles to save space.
      - You MAY add inferred skills/tools only if they logically align with the candidate’s existing history (e.g., "exposure to", "used during project").
      - Never invent companies, job titles, or certifications.

      ---

      🚫 **HONESTY FILTER**
      You **must not**:
      - Invent projects, clients, job titles, tools, or companies.
      - Exaggerate experience duration.
      - Include buzzwords without substance or evidence.

      ---

      📦 **OUTPUT FORMAT**  
      Return the tailored resume in **JSON format**, suitable for saving and rendering:

      \`\`\`json
      {
        "tailored_resume": "<final_resume_text (plain text, LaTeX, or HTML)>",
        "tailored_sections": {
            "Header": {
              "fullName": "Full Name Here",
              "contact": {
                "email": "email@example.com",
                "phone": "123-456-7890",
                "github": "https://github.com/username",
                "linkedin": null,
                "website": null
              }
            },
            "Summary": {
              "paragraphs": [
                "First summary paragraph...",
                "Second summary paragraph..."
              ]
            },
            "Education": [
              {
                "institution": "Institution Name",
                "degree": "Degree or Diploma",
                "dates": {
                  "start": "Start Date",
                  "end": "End Date or Expected"
                },
                "gpa": "GPA or null",
                "details": [
                  "Relevant coursework or honors line 1",
                  "Additional details line 2"
                ]
              }
            ],
            "Experience": [
              {
                "jobTitle": "Job Title",
                "company": "Company Name",
                "dates": {
                  "start": "Start Date",
                  "end": "End Date"
                },
                "location": null,
                "responsibilities": [
                  "Bullet point 1",
                  "Bullet point 2"
                ],
                "achievements": []
              }
            ],
            "Projects": [
              {
                "name": "Project Name",
                "technologies": [
                  "Tech 1", "Tech 2"
                ],
                "details": [
                  "Project detail bullet 1",
                  "Project detail bullet 2"
                ]
              }
            ],
            "Skills": {
              "programmingLanguages": [],
              "frontend": [],
              "backend": [],
              "databases": [],
              "cloudDevOps": [],
              "uiux": []
            },
            "Certifications": [
              {
                "name": "Certification Name",
                "issuer": null,
                "date": null
              }
            ]
        },
        "confidence": 0.93,
        "format": "plain_text", // or "latex", "html"
        "status": "success", // or "failed"
        "errorLog": null
      }
      \`\`\`

      ---

      You will now receive:
      1. The **original resume**
      2. The **target job description**

      Read both carefully, and then return your response using the format above.
      `.trim();



    // 🧠 Dynamic prompt with job and resume data
    const userPrompt = `
      Here is the job description:

      Title: ${job.title}
      Company: ${job.companyName}
      Location: ${job.location || 'N/A'}
      URL: ${job.url}

      Responsibilities:
      ${(job.description?.responsibilities || []).join('\n')}

      Qualifications:
      ${(job.description?.qualifications || []).join('\n')}

      Benefits:
      ${(job.description?.benefits || []).join('\n')}

      Here is the resume content to tailor to the job above:
      ${resume.textContent}
    `.trim();

    // 🔗 Call DeepSeek
    const aiResult = await callDeepSeekAPI(systemPrompt, userPrompt);
    const parsedResult = typeof aiResult === 'string' ? JSON.parse(aiResult) : aiResult;

    const tailoredResume = await TailoredResume.create({
      userId,
      resumeId,
      jobId,
      tailoredText: parsedResult.tailored_resume,
      confidence: parsedResult.confidence,
      tailoredSections: parsedResult.tailored_sections,
      rawAIResponse: parsedResult,
      status: 'success'
    });

    let resumePath = await createResumeDocument(tailoredResume);
    
    console.log(`Resume PATH: ${resumePath}`);
    console.log(`[Tailoring Success] Job: ${job.title} | Resume: ${resumeId}`);
    
    return tailoredResume;

  } catch (err) {
    console.error('[tailorResume error]', err);

    return await TailoredResume.create({
      userId,
      resumeId,
      jobId,
      status: 'failed',
      error: err.message
    });
  }
}

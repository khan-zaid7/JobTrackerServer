import Job from '../models/Job.js';
import Resume from '../models/Resume.js';
import { callDeepSeekAPI } from '../utils/deepseek.js';
import { generatePdfFromLatex } from '../utils/generatePdfFromLatex.js';

// Clean junk from LLM response like ```latex ... ```
function cleanLatexOutput(raw) {
  return raw
    .replace(/```latex\s*/i, '')
    .replace(/```/g, '')
    .trim();
}

// Builds a tight, clean instruction prompt
const buildTailoringPrompt = ({ job, resumeText }) => `
You are a top-tier technical resume writer who outputs production-ready LaTeX for clean, ATS-friendly resumes.

⚠️ STRICT OUTPUT RULES:
- Output only valid LaTeX (no markdown, no explanations).
- Do not wrap the code in backticks or markdown.
- Format as a clean, modern, single-column resume using professional styling.
- Prioritize clear structure for fast recruiter readability and ATS parsing.
- Use \\textbf for bolding section titles and roles.
- Do NOT use tables or multicolumn layouts.
- Keep whitespace and spacing consistent and readable.
- Use bullet points with \\item for responsibilities and achievements.
- Quantify impact wherever possible (e.g., “Increased efficiency by 30%”).

TASK:
Tailor the resume below to the job. Emphasize relevant skills and achievements that match the job’s requirements.

JOB DETAILS:
Job Title: ${job.title}
Company: ${job.companyName || ''}
Location: ${job.location || ''}
Description:
${job.description || ''}

RESUME TO TAILOR:
${resumeText}
`;


export const tailorResumes = async (jobs, resumeId = null) => {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    console.log('No jobs provided for tailoring.');
    return;
  }

  for (const job of jobs) {
    try {
      // 1. Get the user's resume
      const resume = await Resume.findOne({ createdBy: job.createdBy });
      if (!resume) {
        console.warn(`No resume found for user: ${job.createdBy} (job: ${job._id})`);
        continue;
      }

      // 2. Build the prompt
      const systemPrompt = 'You are an expert resume writer that outputs only LaTeX code for tailored resumes.';
      const prompt = buildTailoringPrompt({ job, resumeText: resume.textContent });

      // 3. Call DeepSeek or LLM
      const rawLatex = await callDeepSeekAPI(systemPrompt, prompt);
      const tailoredLatex = cleanLatexOutput(rawLatex);

      // 4. Generate PDF from LaTeX
      const filename = `resume_${job._id}`;
      const pdfPath = await generatePdfFromLatex(tailoredLatex, filename);

      // 5. Save everything
      job.tailoredResumeLatex = tailoredLatex;
      job.tailoredResumePdfPath = pdfPath;
      await job.save();

      console.log(`✅ Tailored resume saved and PDF generated for job: ${job.title}`);

    } catch (err) {
      console.error(`❌ Error tailoring resume for job ${job._id}:`, err.message);
      continue;
    }
  }
};

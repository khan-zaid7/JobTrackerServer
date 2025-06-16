import Job from '../models/Job.js';
import Resume from '../models/Resume.js';
import { callDeepSeekAPI } from '../utils/deepseek.js';

const buildTailoringPrompt = ({ job, resumeText }) => `
Rewrite the following resume so it is perfectly tailored for the job below. Output only in LaTeX.

Job Title: ${job.title}
Company: ${job.companyName || ''}
Location: ${job.location || ''}
Job Description: ${job.description || ''}

Resume:
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

      // 2. Build the tailoring prompt
      const systemPrompt = 'You are an expert resume writer that outputs only LaTeX code for tailored resumes.';
      const prompt = buildTailoringPrompt({ job, resumeText: resume.textContent });

      // 3. Call DeepSeek or your LLM API
      const tailoredLatex = await callDeepSeekAPI(systemPrompt, prompt);

      // 4. Save the tailored LaTeX to the job
      job.tailoredResumeLatex = tailoredLatex;
      await job.save();
      console.log(`Tailored resume saved for job: ${job.title}`);

    } catch (err) {
      console.error('Error tailoring resume for job:', job._id, err.message);
      continue;
    }
  }
};

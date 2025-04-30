// server/controllers/matchController.js
import axios from 'axios';
import dotenv from 'dotenv';
import MatchResult from '../models/MatchResult.js';
import puppeteer from 'puppeteer';
import { generateResumeHTML } from '../utils/resumeTemplate.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

// Helper to validate and fetch the match result
const getMatchResultById = async (matchResultId) => {
  if (!matchResultId) {
    throw { status: 400, message: 'matchResultId is required.' };
  }

  const matchResult = await MatchResult.findById(matchResultId).populate('jobId').populate('resumeId');

  if (!matchResult || !matchResult.jobId || !matchResult.resumeId) {
    throw { status: 404, message: 'Match result, job, or resume not found.' };
  }

  return matchResult;
};

// Helper to generate system prompt
const buildSystemPrompt = () => {
  return `You are a professional resume optimization expert.

Your job is to tailor a resume for a job description using STRICT rules.

IMPORTANT:
- Your output MUST retain or improve the resume’s match score.
- You MUST emphasize the matched skills clearly.
- Never remove strong keywords or achievements already present.
- You MAY naturally incorporate missing skills (as tools used, coursework, exposure, etc.),
  BUT you MUST NOT fabricate any experience, companies, or projects.
- You MUST NOT falsely claim more years of experience than the original resume.

RULES:
- 1 to 1.5 pages total
- Summary max 4 lines
- Bullet points only (•), no paragraphs longer than 2 lines
- Use action verbs and metrics
- Resume must be readable and ATS-optimized

OUTPUT:
Return the final tailored resume as raw plain text only. No markdown or JSON wrapping.`;
};

// Helper to generate user prompt
const buildUserPrompt = ({ jobDescription, resumeText, matchedSkills, missingSkills, matchSummary }) => {
  return `Job Description:
${jobDescription}

Original Resume:
${resumeText}

Matched Skills:
${matchedSkills.join(', ')}

Missing Skills:
${missingSkills.join(', ')}

Match Summary:
${matchSummary}`;
};

// Helper to make API request
const callDeepSeekAPI = async (systemPrompt, userPrompt) => {
  const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.2,
    max_tokens: 1800
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.DEEPSEEK_APIKEY}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data.choices[0].message.content;
};

// Helper to sanitize the AI response
const sanitizeResumeOutput = (content) => {
  return content
    .replace(/\*\*(.*?)\*\*/g, '$1') // remove bold
    .replace(/\* /g, '\u2022 ')      // markdown bullet to bullet
    .replace(/\u2022{2,}/g, '\u2022') // collapse malformed bullets
    .trim();
};

// Main controller function
export const tailorResume = async (req, res) => {
  try {
    const { matchResultId } = req.body;

    const matchResult = await getMatchResultById(matchResultId);
    const { description: jobDescription } = matchResult.jobId;
    const { textContent: resumeText } = matchResult.resumeId;
    const { matchedSkills, missingSkills, summary: matchSummary } = matchResult;

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt({ jobDescription, resumeText, matchedSkills, missingSkills, matchSummary });

    const rawTailoredResume = await callDeepSeekAPI(systemPrompt, userPrompt);
    const tailoredResume = sanitizeResumeOutput(rawTailoredResume);

    matchResult.tailoredResume = tailoredResume;
    await matchResult.save();

    const htmlContent = generateResumeHTML(tailoredResume);
    const pdfBuffer = await generatePDFBuffer(htmlContent);

    // Save the PDF (optional, or serve from memory)
    const fileName = `tailored_resume_${matchResultId}.pdf`;
    const filePath = path.join(__dirname, `../tailored-resumes/${fileName}`);
    fs.writeFileSync(filePath, pdfBuffer);

    // Option 1: send as base64
    // const base64PDF = pdfBuffer.toString('base64');
    // res.json({ tailoredResume, pdfBase64: base64PDF });

    // Option 2: send file download URL if you're serving from `/temp`
    res.json({
      tailoredResume,
      pdfUrl: `${process.env.BACKEND_URL}/tailored-resumes/${fileName}`
    });

  } catch (error) {
    console.error('Error tailoring resume:', error.response?.data || error.message);
    res.status(error.status || 500).json({ message: error.message || 'Failed to tailor resume.' });
  }
};

const generatePDFBuffer = async (htmlContent) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
  });

  await browser.close();
  return pdfBuffer;
};

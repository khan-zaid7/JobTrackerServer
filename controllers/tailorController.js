import axios from 'axios';
import dotenv from 'dotenv';
import MatchResult from '../models/MatchResult.js';

dotenv.config();

export const tailorResume = async (req, res) => {
  try {
    const { matchResultId } = req.body;

    if (!matchResultId) {
      return res.status(400).json({ message: 'matchResultId is required.' });
    }

    const matchResult = await MatchResult.findById(matchResultId).populate('jobId').populate('resumeId');

    if (!matchResult || !matchResult.jobId || !matchResult.resumeId) {
      return res.status(404).json({ message: 'Match result, job, or resume not found.' });
    }

    const { description: jobDescription } = matchResult.jobId;
    const { textContent: resumeText } = matchResult.resumeId;
    const { matchedSkills, missingSkills, summary: matchSummary } = matchResult;

    const systemPrompt = `You are a professional resume optimization expert.

Your job is to tailor a resume for a job description using STRICT rules.

IMPORTANT:
- Your output MUST retain or improve the resume’s match score.
- You MUST emphasize the matched skills clearly.
- Never remove strong keywords or achievements already present.
- If the original resume matches well, you are only allowed to improve clarity and formatting.
- Your rewrite must include all technical keywords that are relevant to the job.

RULES:
- 1 to 1.5 pages total
- Summary max 4 lines
- Bullet points only (•), no paragraphs longer than 2 lines
- Use action verbs and metrics
- Subtly include missing skills only if they match context
- No fake experience, no fluff
- Resume must be readable and ATS-optimized

OUTPUT:
Return the final tailored resume as raw plain text only. No markdown or JSON wrapping.
`;

    const userPrompt = `
Job Description:
${jobDescription}

Original Resume:
${resumeText}

Matched Skills:
${matchedSkills.join(', ')}

Missing Skills:
${missingSkills.join(', ')}

Match Summary:
${matchSummary}
    `;

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

    const tailoredResume = response.data.choices[0].message.content;

    matchResult.tailoredResume = tailoredResume;
    await matchResult.save();

    res.json({ tailoredResume });
  } catch (error) {
    console.error('Error tailoring resume:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to tailor resume.' });
  }
};
// server/controllers/matchController.js
import axios from 'axios';
import dotenv from 'dotenv';
import cleanResumeText from '../utils/cleanText.js';
import MatchResult from '../models/MatchResult.js';

dotenv.config();

function cleanDeepseekResponse(text) {
  // Remove code block ```json ... ``` wrapper
  return text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
}

export const matchResume = async (req, res) => {
  try {
    const { jobDescription, resumeText, jobId, resumeId } = req.body;

    if (!jobDescription || !resumeText) {
      return res.status(400).json({ message: 'Job description and resume text are required.' });
    }

    const cleanedResume = cleanResumeText(resumeText);

    const apiResponse = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `You are an AI hiring expert specializing in job-resume matching.

Given a job description and a candidate's resume:

1. Analyze deeply — skill fit, experience fit, education fit.
2. Identify:
   - Matched Skills
   - Missing Critical Skills
3. Give a Score (0-100) based on fit (skill, experience, seniority).
4. Write a Short Summary (~5 lines) about why the resume is a good/bad fit.
5. Be professional. Treat the resume like a recruiter does. No hallucination.
6. Return ONLY pure JSON object without any explanation or extra text.
JSON Format: { "score": number, "matchedSkills": [], "missingSkills": [], "summary": "..." }`
        },
        {
          role: 'user',
          content: `Job Description:\n${jobDescription}\n\nResume Text:\n${cleanedResume}`
        }
      ],
      temperature: 0.2,
      max_tokens: 1000,
      timeout: 60000, // 60 seconds timeout for long resumes
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_APIKEY}`,
        'Content-Type': 'application/json'
      }
    });

    let deepSeekData = apiResponse.data.choices[0].message.content;
    console.log('Original Deepseek Output:', deepSeekData);

    // Clean up before parsing
    deepSeekData = cleanDeepseekResponse(deepSeekData);

    const parsedResult = JSON.parse(deepSeekData);

    console.log('Parsed Match Result:', parsedResult);
    const matchRecord = await MatchResult.findOneAndUpdate(
      { jobId, resumeId }, // Find existing match
      {
        jobId,
        resumeId,
        score: parsedResult.score,
        matchedSkills: parsedResult.matchedSkills,
        missingSkills: parsedResult.missingSkills,
        summary: parsedResult.summary,
      },
      { new: true, upsert: true } // Create if not exists, return updated doc
    );
    

    return res.json(matchRecord);

  } catch (error) {
    console.error('Error matching resume:', error?.response?.data || error.message || error);
    res.status(500).json({ message: 'Server error while matching resume.' });
  }
};

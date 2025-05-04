import ScrapedJob from '../models/ScrapedJob.js';
import ScrapeSession from '../models/ScrapeSession.js';
import axios from 'axios';
import mongoose from 'mongoose';

function cleanDeepseekResponse(text) {
  return text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
}

export const filterWorthyJobs = async (userId, keywords = [], resumeText = '', batchId = null) => {
    // 1. Get the batchId (from arg or from DB)
    if (!batchId) {
      const latestSession = await ScrapeSession.findOne({ userId }).sort({ createdAt: -1 }).lean();
      if (!latestSession) return { error: 'No scrape session found.' };
      batchId = latestSession.batchId;
    }
  
    // 2. Get all jobs from that batch
    const jobs = await ScrapedJob.find({ userId, batchId }).lean();
    if (!jobs.length) return { error: 'No jobs found in this batch.' };
  
    // 3. Prepare job array (id + title only)
    const jobArray = jobs.map(job => ({
      id: job._id.toString(),
      title: job.title
    }));
  
    // 4. DeepSeek prompt
    const prompt = {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `You are an intelligent job filter.
  
  Given a list of job titles (with IDs), determine which jobs are relevant to the user's skills, based ONLY on the provided keywords and/or resume.
  
  Return ONLY the relevant jobs in this strict JSON array format:
  [
    {
      "id": "string",
      "keep": true
    }
  ]`
        },
        {
          role: 'user',
          content: `KEYWORDS: ${keywords.join(', ')}
  RESUME: ${resumeText.substring(0, 3000)}
  
  JOBS TO EVALUATE:
  ${JSON.stringify(jobArray, null, 2)}`
        }
      ],
      temperature: 0.2,
      max_tokens: 2000
    };
  
    try {
      // 5. Send to DeepSeek API
      const apiResponse = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        prompt,
        {
          headers: {
            'Authorization': `Bearer ${process.env.DEEPSEEK_APIKEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
  
      const raw = apiResponse.data.choices[0].message.content;
      const cleaned = cleanDeepseekResponse(raw);
      const filtered = JSON.parse(cleaned);
  
      const keepIds = filtered.filter(j => j.keep).map(j => j.id);
      const removeIds = jobs.map(j => j._id.toString()).filter(id => !keepIds.includes(id));
  
      // 6. Update relevant jobs
      await ScrapedJob.updateMany(
        { _id: { $in: keepIds.map(id => new mongoose.Types.ObjectId(id)) } },
        { $set: { isRelevant: true } }
      );
  
      // 7. Delete irrelevant jobs
      await ScrapedJob.deleteMany({
        _id: { $in: removeIds.map(id => new mongoose.Types.ObjectId(id)) }
      });
  
      return {
        batchId,
        total: jobs.length,
        kept: keepIds.length,
        deleted: removeIds.length
      };
  
    } catch (error) {
      console.error('DeepSeek filtering failed:', error.message);
      return { error: 'DeepSeek filtering failed.' };
    }
  };
  
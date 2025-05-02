// routes/scrapeRoutes.js
import express from 'express';
import { scrapeLinkedInJobs } from '../services/scraper.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Limit to 5 requests per hour per IP
const scrapeLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: 'Too many scrape attempts, please try again later.'
  });

// Public route (no auth required)
router.post('/linkedin', scrapeLimiter ,async (req, res) => {
  try {
    // Pass null as userId since auth is disabled
    const result = await scrapeLinkedInJobs(null); 
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
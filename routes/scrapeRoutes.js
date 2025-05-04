import express from 'express';
import rateLimit from 'express-rate-limit';
import auth from '../middleware/auth.js';
import {
  scrapeLinkedIn,
  filterWorthyJobsController
} from '../controllers/scrapeController.js';

const router = express.Router();

// Limit to 20 requests per hour per IP for scraping
const scrapeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many scrape attempts, please try again later.'
});

// POST /api/scrape/linkedin
router.post('/linkedin', auth, scrapeLimiter, scrapeLinkedIn);

// POST /api/scrape/filter-worthy-jobs
// router.post('/filter-worthy-jobs', auth, filterWorthyJobsController);
router.post('/filter-worthy-jobs', filterWorthyJobsController);

export default router;

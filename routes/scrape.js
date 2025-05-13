import express from 'express';
import {
  startScrapeSession,
  getScrapeStatus,
  getScrapeResults
} from '../controllers/scrapeController.js';

const router = express.Router();

router.post('/start', startScrapeSession);
router.get('/status/:sessionId', getScrapeStatus);
router.get('/results/:sessionId', getScrapeResults);

export default router;

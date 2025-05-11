import express from 'express';
import {
  scrapeLatestJobFromLinkedIn
} from '../controllers/scrapeController.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// router.use(authMiddleware); // protect all routes

router.route('/linkedin').post(scrapeLatestJobFromLinkedIn);

export default router;

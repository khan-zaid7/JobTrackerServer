import express from 'express';
import { getAllPipelineSession, getAllScrapedJob } from '../controllers/PipelineSessionController.js';
import auth from '../middleware/auth.js'; // <-- Import the middleware
const router = express.Router();

// 🔒 Apply auth to all routes
router.get('/', auth, getAllPipelineSession);
router.get('/scraped-jobs/:batchId', auth, getAllScrapedJob);


export default router;

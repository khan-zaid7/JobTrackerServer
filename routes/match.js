import express from 'express';
import { matchResume } from '../controllers/matchController.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware); // protected

router.post('/match-resume', matchResume);

export default router;

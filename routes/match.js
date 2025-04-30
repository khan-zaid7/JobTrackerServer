import express from 'express';
import { matchResume } from '../controllers/matchController.js';
import { tailorResume } from '../controllers/tailorController.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware); // protected

router.post('/match-resume', matchResume);
router.post('/tailor-resume', tailorResume);


export default router;

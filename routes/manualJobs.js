import express from 'express';
import { createManualJob } from '../controllers/manualJobController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// POST /api/manual-jobs - Create a new manual job
router.post('/', auth, createManualJob);

export default router;

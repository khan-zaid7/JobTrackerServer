import express from 'express';
import {
  createJob,
  getAllJobs,
  getJob,
  updateJob,
  deleteJob,
} from '../controllers/jobController.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware); // protect all routes

router.route('/').get(getAllJobs).post(createJob);
router.route('/:id').get(getJob).put(updateJob).delete(deleteJob);

export default router;

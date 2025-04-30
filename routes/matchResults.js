import express from 'express';
import {
  getAllMatchResults,
  getMatchResultById,
} from '../controllers/matchResultController.js';

const router = express.Router();

router.get('/', getAllMatchResults);
router.get('/:id', getMatchResultById);

export default router;

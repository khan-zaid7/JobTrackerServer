import express from 'express';
import multer from 'multer';
import {
  uploadResume,
  updateResume,
  deleteResume,
  getAllResumes,
  getResumeById,
} from '../controllers/resumeController.js';
import auth from '../middleware/auth.js'; // <-- ADD THIS LINE

const router = express.Router();
const upload = multer({ dest: 'uploads/' }); // Adjust path

// All routes below now require auth
router.post('/', auth, upload.single('file'), uploadResume);
router.put('/:id', auth, upload.single('file'), updateResume);
router.delete('/:id', auth, deleteResume);
router.get('', auth, getAllResumes);
router.get('/:id', auth, getResumeById);

export default router;

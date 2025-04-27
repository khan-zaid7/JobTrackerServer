import express from 'express';
import multer from 'multer';
import {
  uploadResume,
  updateResume,
  deleteResume,
  getAllResumes,
} from '../controllers/resumeController.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' }); // Adjust path

router.post('/', upload.single('file'), uploadResume);
router.put('/:id', upload.single('file'), updateResume);
router.delete('/:id', deleteResume);
router.get('', getAllResumes);

export default router;

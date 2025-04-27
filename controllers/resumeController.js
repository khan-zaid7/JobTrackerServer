import fs from 'fs/promises';
import mammoth from 'mammoth';
import Resume from '../models/Resume.js';
import pdfExtract from 'pdf-text-extract';

async function extractTextFromFile(file) {
  if (file.mimetype === 'application/pdf') {
    const text = await new Promise((resolve, reject) => {
      pdfExtract(file.path, { splitPages: false }, (err, pages) => {
        if (err) reject(err);
        else resolve(pages.join('\n'));
      });
    });
    return text;
  } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ path: file.path });
    return result.value;
  } else {
    throw new Error('Unsupported file type');
  }
}

export const uploadResume = async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const textContent = await extractTextFromFile(file);

    const resume = await Resume.create({
      originalName: file.originalname,
      filePath: file.path,
      textContent,
      isMaster: req.body.isMaster === 'true',
    });

    res.json({ message: 'Resume uploaded successfully', resume });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while uploading resume.' });
  }
};

export const getAllResumes = async (req, res) => {
  try {
    const resumes = await Resume.find();
    res.json(resumes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching resumes.' });
  }
};

export const deleteResume = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Resume.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    // Also delete the file from the server
    try {
      await fs.unlink(deleted.filePath);
    } catch (fileError) {
      console.error('Error deleting file:', fileError);
      // Not critical to fail the whole operation if file deletion fails
    }

    res.json({ message: 'Resume deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while deleting resume.' });
  }
};

export const updateResume = async (req, res) => {
  try {
    const { id } = req.params;
    const { isMaster } = req.body;
    const file = req.file;

    const resume = await Resume.findById(id);
    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    if (typeof isMaster !== 'undefined') {
      resume.isMaster = isMaster === 'true';
    }

    if (file) {
      // Delete old file
      try {
        await fs.unlink(resume.filePath);
      } catch (fileError) {
        console.error('Error deleting old file:', fileError);
      }

      const textContent = await extractTextFromFile(file);
      resume.filePath = file.path;
      resume.originalName = file.originalname;
      resume.textContent = textContent;
    }

    await resume.save();

    res.json({ message: 'Resume updated successfully', resume });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while updating resume.' });
  }
};

export const getResumeById = async (req, res) => {
  try {
    const { id } = req.params;
    const resume = await Resume.findById(id);

    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    res.json(resume);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching resume.' });
  }
};



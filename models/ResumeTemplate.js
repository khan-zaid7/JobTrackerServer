import mongoose from 'mongoose';

const resumeTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // e.g., "default", "clean-latex"

  type: {
    type: String,
    enum: ['latex', 'html'],
    default: 'latex'
  },

  content: { type: String, required: true },  // actual template string
  isDefault: { type: Boolean, default: false }

}, { timestamps: true });

const ResumeTemplate = mongoose.model('ResumeTemplate', resumeTemplateSchema);
export default ResumeTemplate;

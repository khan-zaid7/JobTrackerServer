import mongoose from 'mongoose';

const matchResultSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  resumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', required: true },
  score: Number,
  matchedSkills: [String],
  missingSkills: [String],
  summary: String,
  tailoredResume: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('MatchResult', matchResultSchema);

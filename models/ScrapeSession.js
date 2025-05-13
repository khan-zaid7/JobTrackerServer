// models/ScrapeSession.js
import mongoose from 'mongoose';

const scrapeSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    batchId: { type: String, unique: true },
    note: { type: String },
    jobCount: { type: String },
    status: { type: String },
    status: { type: String, enum: ['pending', 'scraping', 'filtering', 'done', 'failed'], default: 'pending' },
    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume' },
    tags: [String],
    error: { type: String, default: null }

  },
  { timestamps: true }
);

export default mongoose.model('ScrapeSession', scrapeSessionSchema);

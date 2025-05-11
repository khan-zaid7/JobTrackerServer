// models/ScrapeSession.js
import mongoose from 'mongoose';

const scrapeSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    batchId: { type: String, required: true, unique: true },
    note: { type: String }, // optional for debugging
  },
  { timestamps: true }
);

export default mongoose.model('ScrapeSession', scrapeSessionSchema);

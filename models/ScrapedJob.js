// models/ScrapedJob.js
import mongoose from 'mongoose';

const scrapedJobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  company: { type: String, required: true },
  url: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  isRelevant: { type: Boolean, default: false },
  scrapedAt: { type: Date, default: Date.now },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  batchId: {
    type: String,
    index: true, 
  },  
});

const ScrapedJob = mongoose.model('ScrapedJob', scrapedJobSchema);
export default ScrapedJob;
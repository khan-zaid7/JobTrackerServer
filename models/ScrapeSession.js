import mongoose from 'mongoose';

const scrapeSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  batchId: {
    type: String,
    required: true,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  jobCount: {
    type: Number,
    default: 0
  },
  completed: {
    type: Boolean,
    default: false
  }
});

export default mongoose.model('ScrapeSession', scrapeSessionSchema);

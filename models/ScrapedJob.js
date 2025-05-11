import mongoose from 'mongoose';

const scrapedJobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    url: { type: String, required: true },
    companyName: { type: String, required: true },
    companyUrl: { type: String, required: true },
    location: { type: String, required: true },
    description: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    postedTime: {type: String, required: true},
    batchId: { type: String, required: true }
  },
  { timestamps: true }
);

export default mongoose.model('ScrapedJob', scrapedJobSchema);


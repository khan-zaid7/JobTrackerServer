import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    url: { type: String, required: true, unique: true },
    companyName: { type: String, required: true },
    companyUrl: { type: String },
    location: { type: String },
    postedTime: { type: String },
    description: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
    batchId: { type: String, required: true },
    rejectionReason: { type: String, default: null },
    tailoredResumeLatex: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model('Job', jobSchema);

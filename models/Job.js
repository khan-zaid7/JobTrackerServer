import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
  {
    position: { type: String, required: true },
    company: { type: String, required: true },
    location: { type: String, default: 'Remote' },
    status: {
      type: String,
      enum: ['pending', 'interview', 'declined'],
      default: 'pending',
    },
    description: { type: String },
    salary: { type: String },
    url: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export default mongoose.model('Job', jobSchema);

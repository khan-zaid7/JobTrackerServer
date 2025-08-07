import mongoose from 'mongoose';

const ScrapedJobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true, unique: true },
  companyName: { type: String, required: true },
  location: { type: String },
  postedTime: { type: String },
  description: {
    responsibilities: { type: [String], default: [] },
    qualifications: { type: [String], default: [] },
    benefits: { type: [String], default: [] }
  },
  relatedReferences: {
    email: { type: String, default: null },
    phone: { type: String, default: null },
    linkedin: { type: String, default: null }
  },
  confidenceFactor: { type: Number, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  batchId: { type: String, required: false },
  isRelevant: { type: Boolean, default: false },
  is_deleted: { type: Boolean, default: false },
  rejectionReason: { type: String, default: null },
  campaignId: { type: String, required: true, index: true },

  // ✅ New field to link to Resume
  resumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', default: null }
}, {
  timestamps: true
});

// Static method to save job if URL does not exist
ScrapedJobSchema.statics.saveJobIfNotExists = async function (jobDetails, options = {}) {
  const {
    title,
    url,
    companyName,
    campaignId,
    location = null,
    postedAt = null,
    description = {},
    relatedReferences = {},
    createdBy = null,
    batchId = null,
    isRelevant = false,
    is_deleted = false,
    rejectionReason = null,
    confidenceFactor = null,
    resumeId = null // ✅ Accept resumeId from input
  } = jobDetails;

  // Normalize description arrays
  const normalizedDescription = {
    responsibilities: Array.isArray(description.responsibilities) ? description.responsibilities : [],
    qualifications: Array.isArray(description.qualifications) ? description.qualifications : [],
    benefits: Array.isArray(description.benefits) ? description.benefits : []
  };

  const normalizedReferences = {
    email: relatedReferences.email || null,
    phone: relatedReferences.phone || null,
    linkedin: relatedReferences.linkedin || null
  };

  const existing = await this.findOne({ url });
  if (existing) {
    console.log(`[Duplicate Skipped] ${title} @ ${companyName}`);
    return null;
  }

  const jobDoc = new this({
    title,
    url,
    companyName,
    location,
    postedTime: postedAt,
    description: normalizedDescription,
    relatedReferences: normalizedReferences,
    confidenceFactor,
    createdBy,
    batchId,
    isRelevant,
    is_deleted,
    rejectionReason,
    campaignId,
    resumeId // ✅ Store resume reference
  });

  try {
    await jobDoc.save();
    return jobDoc;
  } catch (e) {
    if (e.code === 11000) {
      console.log(`[Mongo Duplicate] ${url} already exists.`);
      return null;
    }
    throw e;
  }
};

const ScrapedJob = mongoose.model('ScrapedJob', ScrapedJobSchema);
export default ScrapedJob;

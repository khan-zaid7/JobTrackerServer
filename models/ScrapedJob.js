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

// Static method to save job if it does not exist for a specific user
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
    createdBy = null, // The user's ID
    batchId = null,
    isRelevant = false,
    is_deleted = false,
    rejectionReason = null,
    confidenceFactor = null,
    resumeId = null
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

  // ✅ FIX: Check for a duplicate based on both URL and the user who created it.
  const existing = await this.findOne({ url, createdBy });

  if (existing) {
    // The log message is now more accurate, as this is a duplicate for this specific user.
    console.log(`[User Duplicate Skipped] User ${createdBy} already saved: ${title} @ ${companyName}`);
    return null; // Return null because the job already exists for this user
  }

  // If no duplicate is found for the user, create and save the new job document.
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
    resumeId
  });

  try {
    await jobDoc.save();
    return jobDoc;
  } catch (e) {
    // This handles potential race conditions if a database-level unique index is violated.
    if (e.code === 11000) {
      console.log(`[Mongo Duplicate] A race condition occurred. The job at ${url} was saved by user ${createdBy} just now.`);
      return null;
    }
    // Re-throw other types of errors.
    throw e;
  }
};

const ScrapedJob = mongoose.model('ScrapedJob', ScrapedJobSchema);
export default ScrapedJob;

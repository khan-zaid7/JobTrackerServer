import mongoose from 'mongoose';

const ScrapedJobSchema = new mongoose.Schema({
  // --- No changes to top-level fields ---
  title: { type: String, required: true },
  url: { type: String, required: true, unique: true },
  companyName: { type: String, required: true },
  location: { type: String },
  postedTime: { type: String },
  
  // ✅ UPDATED SECTION: The description field is now much more structured.
  description: {
    roleOverview: {
      title: { type: String, default: null },
      company: { type: String, default: null },
      summary: { type: String, default: null },
      work_model: { type: String, default: null }
    },
    responsibilities: { type: [String], default: [] },
    qualifications: {
      required: { type: [String], default: [] },
      desired: { type: [String], default: [] }
    },
    benefits: { type: [String], default: [] }
  },
  // --- No changes to other fields ---
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
  resumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', default: null }
}, {
  timestamps: true
});


ScrapedJobSchema.statics.saveJobIfNotExists = async function (jobDetails, options = {}) {
  const {
    // ... other fields are fine ...
    description = {}, // The incoming description is now an object
    // ... other fields are fine ...
  } = jobDetails;

  // ✅ UPDATED SECTION: Normalization logic now handles the new nested structure.
  const normalizedDescription = {
    roleOverview: {
      title: description.roleOverview?.title || null,
      company: description.roleOverview?.company || null,
      summary: description.roleOverview?.summary || null,
      work_model: description.roleOverview?.work_model || null
    },
    responsibilities: Array.isArray(description.responsibilities) ? description.responsibilities : [],
    qualifications: {
      required: Array.isArray(description.qualifications?.required) ? description.qualifications.required : [],
      desired: Array.isArray(description.qualifications?.desired) ? description.qualifications.desired : []
    },
    benefits: Array.isArray(description.benefits) ? description.benefits : []
  };

  // The rest of the function remains the same, as it deals with top-level fields.
  const {
    title,
    url,
    companyName,
    campaignId,
    location = null,
    postedAt = null,
    relatedReferences = {},
    createdBy = null,
    batchId = null,
    isRelevant = false,
    is_deleted = false,
    rejectionReason = null,
    confidenceFactor = null,
    resumeId = null
  } = jobDetails;

  const normalizedReferences = {
    email: relatedReferences.email || null,
    phone: relatedReferences.phone || null,
    linkedin: relatedReferences.linkedin || null
  };
  
  const existing = await this.findOne({ url, createdBy });

  if (existing) {
    console.log(`[User Duplicate Skipped] User ${createdBy} already saved: ${title} @ ${companyName}`);
    return null;
  }

  const jobDoc = new this({
    title,
    url,
    companyName,
    location,
    postedTime: postedAt,
    description: normalizedDescription, // Use the newly normalized description object
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
    if (e.code === 11000) {
      console.log(`[Mongo Duplicate] A race condition occurred. The job at ${url} was saved by user ${createdBy} just now.`);
      return null;
    }
    throw e;
  }
};

const ScrapedJob = mongoose.model('ScrapedJob', ScrapedJobSchema);
export default ScrapedJob;
import mongoose from 'mongoose';

const ScrapedJobSchema = new mongoose.Schema({
    title: { type: String, required: true },
    url: { type: String, required: true, unique: true },
    companyName: { type: String, required: true },
    location: { type: String },
    postedTime: { type: String },
    description: {
        responsibilities: { type: String, default: '' },
        qualifications: { type: String, default: '' },
        benefits: { type: String, default: '' }
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
    batchId: { type: String, required: true },
    isRelevant: { type: Boolean, default: false },
    is_deleted: { type: Boolean, default: false },
    rejectionReason: { type: String, default: null }
}, {
    timestamps: true
});

// Static method to save job if URL does not exist
ScrapedJobSchema.statics.saveJobIfNotExists = async function(jobDetails, options = {}) {
    const {
        title,
        url,
        companyName,
        location = null,
        postedAt = null,
        description = { responsibilities: '', qualifications: '', benefits: '' },
        createdBy,
        batchId,
        isRelevant = false,
        is_deleted = false,
        rejectionReason = null
    } = jobDetails;

    // Check duplicate by URL
    const existing = await this.findOne({ url });
    if (existing) {
        console.log(`[Duplicate Skipped] ${title} @ ${companyName}`);
        return null;
    }

    // Create new document
    const jobDoc = new this({
        title,
        url,
        companyName,
        location,
        postedTime: postedAt,
        description,
        createdBy,
        batchId,
        isRelevant,
        is_deleted,
        rejectionReason
    });

    try {
        await jobDoc.save();
        return jobDoc;
    } catch (e) {
        if (e.code === 11000) {  // Duplicate key error code
            console.log(`[Mongo Duplicate] ${url} already exists.`);
            return null;
        }
        throw e;
    }
};

const ScrapedJob = mongoose.model('ScrapedJob', ScrapedJobSchema);
export default ScrapedJob;

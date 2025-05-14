import mongoose from 'mongoose';

const ScrapedJobSchema = new mongoose.Schema({
    title: { type: String, required: true },
    url: { type: String, required: true, unique: true }, // ✅ enforce uniqueness at DB level
    companyName: { type: String, required: true },
    companyUrl: { type: String },
    location: { type: String },
    postedTime: { type: String },
    description: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
    batchId: { type: String, required: true },
    isRelevant: { type: Boolean, default: false },
    is_deleted: { type: Boolean, default: false } // ✅ add this
}, {
    timestamps: true
});

const ScrapedJob = mongoose.model('ScrapedJob', ScrapedJobSchema);
export default ScrapedJob;

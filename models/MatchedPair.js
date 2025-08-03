// src/models/MatchedPair.js

import mongoose from 'mongoose';

const matchedPairSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', required: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScrapedJob', required: true, index: true },
    matchConfidence: { type: Number, required: true },
    matchReason: { type: String },
    tailoringStatus: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending',
        index: true
    },
    tailoredResumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'TailoredResume' }
}, { timestamps: true });

matchedPairSchema.index({ userId: 1, jobId: 1 }, { unique: true });

const MatchedPair = mongoose.model('MatchedPair', matchedPairSchema);
export default MatchedPair;
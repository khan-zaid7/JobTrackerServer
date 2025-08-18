import mongoose from 'mongoose';

// Nested schemas for structured fields
const strategicGoalSchema = new mongoose.Schema({
    strength: { type: String },
    action: { type: String },
    gap: { type: String },
    strategy: { type: String }
}, { _id: false });

const masterPlanSchema = new mongoose.Schema({
    match_tier: { type: String, default: "" },
    confidence_score: { type: Number, default: 0 },
    analysis_summary: { type: String, default: "" },
    core_narrative_to_project: { type: String, default: "" },
    strategic_goals: {
        amplify: { type: [strategicGoalSchema], default: [] },
        bridge_gaps: { type: [strategicGoalSchema], default: [] }
    },
    conceptual_keywords_to_integrate: { type: [String], default: [] }
}, { _id: false });

// Update the TailoredResume schema
const tailoredResumeSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', required: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScrapedJob', required: true, index: true },
    matchedPairId: { type: mongoose.Schema.Types.ObjectId, ref: 'MatchedPair', required: true, index: true },

    tailoredText: { type: String },

    status: {
        type: String,
        enum: ['pending', 'success', 'failed'],
        default: 'pending'
    },

    error: { type: String },
    pdfPath: { type: String },
    campaignId: { type: String, required: true, index: true },

    // ✨ NEW FIELD: Structured master plan
    masterPlan: { type: masterPlanSchema, default: () => ({}) }

}, { timestamps: true });

// Compound index for fast lookup
tailoredResumeSchema.index({ userId: 1, jobId: 1 });

const TailoredResume = mongoose.model('TailoredResume', tailoredResumeSchema);
export default TailoredResume;

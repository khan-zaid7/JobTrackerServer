import mongoose from 'mongoose';

/**
 * Sub-schema for a single strength in the analysis.
 */
const strengthSchema = new mongoose.Schema({
    category: { type: String, default: "" },
    summary: { type: String, default: "" }
}, { _id: false });

/**
 * Sub-schema for a single gap in the analysis.
 */
const gapSchema = new mongoose.Schema({
    category: { type: String, default: "" },
    summary: { type: String, default: "" },
    is_deal_breaker: { type: Boolean, default: false }
}, { _id: false });

/**
 * Sub-schema for ATS-specific tailoring advice.
 */
const atsTailoringSchema = new mongoose.Schema({
    required_keywords: { type: [String], default: [] },
    phrasing_suggestions: { type: [String], default: [] }
}, { _id: false });

/**
 * Sub-schema for human reviewer-focused tailoring advice.
 */
const humanTailoringSchema = new mongoose.Schema({
    strengthen_narrative: { type: String, default: "" },
    highlight_impact: { type: [String], default: [] }
}, { _id: false });

/**
 * Sub-schema for the final, comprehensive action plan.
 */
const actionPlanSchema = new mongoose.Schema({
    application_strategy: { type: String, default: "" },
    tailoring_for_ats: { type: atsTailoringSchema, default: () => ({}) },
    tailoring_for_human_reviewer: { type: humanTailoringSchema, default: () => ({}) },
    alternative_path: { type: String, default: "" },
    future_consideration: { type: String, default: "" }
}, { _id: false });


const matchedPairSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', required: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScrapedJob', required: true, index: true },
    matchConfidence: { type: Number, required: true },
    matchReason: { type: String }, // This correctly stores the 'verdict'

    /**
     * ✅ SCHEMA UPDATED
     * This field now stores the new, streamlined analysis report.
     * It's more direct, strategic, and eliminates the redundant/subjective fields.
     */
    analysisReport: {
        type: {
            candidate_name: { type: String, default: "" },
            job_title: { type: String, default: "" },
            company: { type: String, default: "" },
            verdict: { type: String, default: "" },
            match_analysis: {
                strengths: { type: [strengthSchema], default: [] },
                gaps: { type: [gapSchema], default: [] }
            },
            action_plan: { type: actionPlanSchema, default: () => ({}) }
        },
        default: null // The report is null until the analysis is complete
    },

    tailoringStatus: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending',
        index: true
    },
    tailoredResumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'TailoredResume' },
    campaignId: { type: String, required: true, index: true }
}, { timestamps: true });

// Ensures a user can't have a duplicate match for the same job
matchedPairSchema.index({ userId: 1, jobId: 1 }, { unique: true });

const MatchedPair = mongoose.model('MatchedPair', matchedPairSchema);
export default MatchedPair;
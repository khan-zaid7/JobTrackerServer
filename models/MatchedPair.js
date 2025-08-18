import mongoose from 'mongoose';

/**
 * Sub-schema for a single point of analysis within the reasoning section.
 * Reusable for all 11 reasoning categories.
 */
const analysisPointSchema = new mongoose.Schema({
    issue: { type: String, default: "" },
    candidate_status: { type: String, default: "" },
    impact: { type: String, default: "" }
}, { _id: false });

/**
 * Sub-schema for the final recommendation object.
 */
const recommendationSchema = new mongoose.Schema({
    hire_decision: { type: String, default: "" },
    alternative_path: { type: String, default: "" },
    future_consideration: { type: String, default: "" }
}, { _id: false });

const matchedPairSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', required: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScrapedJob', required: true, index: true },
    matchConfidence: { type: Number, required: true },
    matchReason: { type: String }, // This can now store the 'verdict'

    /**
     * ✅ NEW FIELD ADDED
     * This field stores the complete, structured diagnostic report from the Matcher AI.
     * The Tailor service will read this report to understand the specific strengths,
     * weaknesses, and deal-breakers it needs to address when rewriting the resume.
     */
    analysisReport: {
        type: {
            candidate_name: { type: String, default: "" },
            job_title: { type: String, default: "" },
            company: { type: String, default: "" },
            verdict: { type: String, default: "" },
            reasoning: {
                experience_gap: { type: analysisPointSchema, default: () => ({}) },
                domain_alignment: { type: analysisPointSchema, default: () => ({}) },
                frontend_expectations: { type: analysisPointSchema, default: () => ({}) },
                backend_tech_match: { type: analysisPointSchema, default: () => ({}) },
                devops_and_ci_cd: { type: analysisPointSchema, default: () => ({}) },
                seniority_and_autonomy: { type: analysisPointSchema, default: () => ({}) },
                soft_skills_culture_fit: { type: analysisPointSchema, default: () => ({}) },
                location_and_availability: { type: analysisPointSchema, default: () => ({}) },
                growth_potential: { type: analysisPointSchema, default: () => ({}) },
                compensation_expectations: { type: analysisPointSchema, default: () => ({}) },
                cultural_vibe_match: { type: analysisPointSchema, default: () => ({}) }
            },
            deal_breakers: { type: [String], default: [] },
            possible_exceptions: { type: [String], default: [] },
            recommendation: { type: recommendationSchema, default: () => ({}) }
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
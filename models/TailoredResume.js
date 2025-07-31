import mongoose from 'mongoose';

const tailoredResumeSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', required: true }, // original/master resume
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScrapedJob', required: true, index: true }, // job used for tailoring

    tailoredText: { type: String },         // LaTeX or plain tailored resume content
    confidence: { type: Number },           // extracted from AI response
    tailoredSections: { type: Object },     // optional JSON structure: { summary, experience, ... }

    status: {
        type: String,
        enum: ['pending', 'success', 'failed'],
        default: 'pending'
    },

    error: { type: String },                // if any failure occurred
    pdfPath: { type: String },              // final compiled PDF (if used)
    rawAIResponse: { type: Object },        // full AI response if needed

    // ✨ NEW FIELD: Stores the structured output from the analysis pass (Pass 1).
    analysis: {
        type: {
            strengths: { type: [String], default: [] },
            gaps: { type: [String], default: [] },
            keywordsToIntegrate: { type: [String], default: [] }
        },
        // This entire object is optional. It will only exist if the analysis pass succeeds.
        required: false 
    },

    // ✨ NEW FIELD: Stores the interview "cheat sheet" generated in the analysis pass.
    interviewPrep: {
        type: {
            talkingPoints: { type: String, default: '' },
            gapsToAddress: { type: String, default: '' }
        },
        // This entire object is optional.
        required: false
    }

}, { timestamps: true });

// ✨ BONUS: Compound index for a common query pattern (e.g., finding all tailored resumes for a user's specific job application).
tailoredResumeSchema.index({ userId: 1, jobId: 1 });

const TailoredResume = mongoose.model('TailoredResume', tailoredResumeSchema);
export default TailoredResume;
import mongoose from 'mongoose';

const tailoredResumeSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', required: true }, // original/master resume
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScrapedJob', required: true }, // job used for tailoring

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

}, { timestamps: true });

const TailoredResume = mongoose.model('TailoredResume', tailoredResumeSchema);
export default TailoredResume;

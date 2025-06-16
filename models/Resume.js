import mongoose from "mongoose";

const resumeSchema = new mongoose.Schema({
    originalName: { type: String },
    filePath: { type: String },
    textContent: { type: String },
    isMaster: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true } // <-- Add this line
}, { timestamps: true });

const Resume = mongoose.model('Resume', resumeSchema);

export default Resume;
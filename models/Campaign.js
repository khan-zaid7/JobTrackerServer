import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema({
    _id: { type: String, required: true }, 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetRole: { type: String, required: true },
    status: {
        type: String,
        enum: ['running', 'stopped', 'completed'],
        default: 'running'
    },
    stats: {
        jobsScraped: { type: Number, default: 0 },
        jobsMatched: { type: Number, default: 0 },
        jobsTailored: { type: Number, default: 0 }
    }
}, { timestamps: true });

const Campaign = mongoose.model('Campaign', campaignSchema);
export default Campaign;
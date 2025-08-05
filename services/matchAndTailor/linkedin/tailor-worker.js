import mongoose from 'mongoose';
import User from '../../../models/User.js';
import Resume from '../../../models/Resume.js';
import ScrapedJob from '../../../models/ScrapedJob.js';
import TailoredResume from '../../../models/TailoredResume.js';
import dotenv from 'dotenv';
import {
    connectToQueue,
    getChannel,
    closeQueueConnection,
    consumeFromExchange,
    consumeFromCampaignQueue
} from '../../queue.js';

import { tailorResumeToJob } from './tailorResumeToJob.js';
import MatchedPair from '../../../models/MatchedPair.js';

dotenv.config();

// ✨ THE FIX: GET THE CAMPAIGN ID FROM THE ENVIRONMENT ✨
const CAMPAIGN_ID = process.env.CAMPAIGN_ID;

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log(`[Tailor-${CAMPAIGN_ID}] ✅ MongoDB connected.`);
    } catch (err) {
        console.error(`[Tailor-${CAMPAIGN_ID}] ❌ DB connection failed:`, err.message);
        process.exit(1);
    }
};

const startTailorWorker = async () => {
    if (!CAMPAIGN_ID) {
        throw new Error("FATAL: CAMPAIGN_ID environment variable is not set. This worker has no mission.");
    }

    await connectDB();
    await connectToQueue();

    const channel = getChannel();
    if (!channel) {
        console.error(`[Tailor-${CAMPAIGN_ID}] ❌ Failed to get RabbitMQ channel. Exiting.`);
        process.exit(1);
    }
    
    // This is a slow worker. It should only process ONE job at a time.
    channel.prefetch(1);

    // ✨ THE FIX: USE THE DYNAMIC ROUTING KEY ✨
    const routingKey = `tailor.${CAMPAIGN_ID}`;

    await consumeFromCampaignQueue('tailor', CAMPAIGN_ID, async (msg) => {
        if (!msg) return;

        const content = JSON.parse(msg.content.toString());
        // We still check for campaignId consistency, even though the routing should guarantee it.
        const { matchedPairId, campaignId: msgCampaignId } = content;

        if (!matchedPairId || msgCampaignId !== CAMPAIGN_ID) {
            console.error(`[Tailor-${CAMPAIGN_ID}] ❌ Invalid message received. Discarding.`, content);
            channel.nack(msg, false, false); // Discard malformed messages
            return;
        }

        console.log(`[Tailor-${CAMPAIGN_ID}] ✂️ Received tailoring job. MatchedPair ID: ${matchedPairId}`);

        let pair = null;
        try {
            pair = await MatchedPair.findById(matchedPairId);
            if (!pair) throw new Error(`MatchedPair ID ${matchedPairId} not found.`);

            pair.tailoringStatus = 'processing';
            await pair.save();

            const tailoredResume = await tailorResumeToJob({
                userId: pair.userId,
                resumeId: pair.resumeId,
                jobId: pair.jobId,
            });

            if (!tailoredResume || !tailoredResume._id) {
                throw new Error(`Tailoring process failed to return a valid resume document.`);
            }

            pair.tailoringStatus = 'completed';
            pair.tailoredResumeId = tailoredResume._id;
            await pair.save();

            console.log(`[Tailor-${CAMPAIGN_ID}] ✅ Tailoring complete for MatchedPair ID: ${matchedPairId}`);
            channel.ack(msg); // Acknowledge on success

        } catch (error) {
            console.error(`[Tailor-${CAMPAIGN_ID}] ❌ FAILED job ${matchedPairId}:`, error);

            if (pair) {
                pair.tailoringStatus = 'failed';
                // You could add: pair.tailoringError = error.message;
                await pair.save();
            }
            // Reject the message (don't requeue) to prevent poison pills.
            channel.nack(msg, false, false);
        }
    });
};

startTailorWorker().catch(err => {
    console.error(`[Tailor-${CAMPAIGN_ID || 'NO_CAMPAIGN'}] 🔥 Fatal startup error:`, err);
    closeQueueConnection();
    process.exit(1);
});

process.on('SIGINT', async () => {
    console.log(`[Tailor-${CAMPAIGN_ID || 'NO_CAMPAIGN'}] 🛑 Gracefully shutting down...`);
    await closeQueueConnection();
    process.exit(0);
});
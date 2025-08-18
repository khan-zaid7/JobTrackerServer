import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {
    connectToQueue,
    getChannel,
    closeQueueConnection,
    consumeFromCampaignQueue
} from '../../queue.js';
import { matchJobsToResume } from './matchJobsToResume.js';

dotenv.config();

// The CAMPAIGN_ID is passed in by the 'run_campaign.js' script.
const CAMPAIGN_ID = process.env.CAMPAIGN_ID;

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log(`[Matcher-${CAMPAIGN_ID}] ✅ MongoDB connected.`);
    } catch (err) {
        console.error(`[Matcher-${CAMPAIGN_ID}] ❌ MongoDB connection failed:`, err.message);
        process.exit(1);
    }
};

const startMatcherWorker = async () => {
    if (!CAMPAIGN_ID) {
        throw new Error("FATAL: CAMPAIGN_ID environment variable is not set. This worker has no mission.");
    }
    
    await connectDB();
    await connectToQueue();

    const channel = getChannel();
    if (!channel) {
        console.error(`[Matcher-${CAMPAIGN_ID}] ❌ Failed to get RabbitMQ channel. Exiting.`);
        process.exit(1);
    }

    // ✅ Set prefetch to 1 to process one message at a time.
    channel.prefetch(1);

    console.log(`[Matcher-${CAMPAIGN_ID}] 🔁 Ready. Waiting for jobs...`);

    // ✅ Consume one message at a time. The batching logic is removed.
    await consumeFromCampaignQueue('match', CAMPAIGN_ID, async (msg) => {
        if (msg === null) return;

        // ✅ Process each message individually as it arrives.
        const jobToProcess = JSON.parse(msg.content.toString());
        console.log(`[Matcher-${CAMPAIGN_ID}] ⚙️ Processing job ID: ${jobToProcess.jobId}`);

        try {
            // Note: We pass the job inside an array to maintain compatibility
            // with `matchJobsToResume` if it expects an array.
            const isSuccess = await matchJobsToResume(jobToProcess);

            if (isSuccess) {
                console.log(`[Matcher-${CAMPAIGN_ID}] ✅ Job matched successfully. Acknowledging message.`);
                channel.ack(msg);
            } else {
                console.warn(`[Matcher-${CAMPAIGN_ID}] ⚠️ Match failed for job. Requeueing message.`);
                channel.nack(msg, false, true); // Requeue on logical failure
            }
        } catch (error) {
            console.error(`[Matcher-${CAMPAIGN_ID}] ❌ Critical error during match. Rejecting job.`, error);
            channel.nack(msg, false, false); // Do not requeue on critical error
        } finally {
            console.log(`[Matcher-${CAMPAIGN_ID}] ⏳ Done processing job.`);
        }
    });
};

startMatcherWorker().catch(async (err) => {
    console.error(`[Matcher-${CAMPAIGN_ID || 'NO_CAMPAIGN'}] 🔥 Unhandled error:`, err);
    await closeQueueConnection();
    process.exit(1);
});

process.on('SIGINT', async () => {
    console.log(`[Matcher-${CAMPAIGN_ID || 'NO_CAMPAIGN'}] 🛑 SIGINT received. Cleaning up...`);
    await closeQueueConnection();
    process.exit(0);
});
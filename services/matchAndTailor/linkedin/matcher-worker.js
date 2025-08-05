import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {
    connectToQueue,
    getChannel,
    closeQueueConnection,
    consumeFromExchange,
    consumeFromCampaignQueue
} from '../../queue.js';

import { matchJobsToResume } from './matchJobsToResume.js';

dotenv.config();

const BATCH_SIZE = 5;
const BATCH_TIMEOUT_MS = 60000;

// ✨ THE FIX: GET THE CAMPAIGN ID FROM THE ENVIRONMENT ✨
// This is passed in by the 'run_campaign.js' script.
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

    channel.prefetch(BATCH_SIZE);

    let jobMessageBatch = [];
    let batchTimeout = null;

    console.log(`[Matcher-${CAMPAIGN_ID}] 🔁 Ready. Batch size: ${BATCH_SIZE}, Timeout: ${BATCH_TIMEOUT_MS}ms.`);

    const processBatch = async () => {
        if (batchTimeout) {
            clearTimeout(batchTimeout);
            batchTimeout = null;
        }

        const batchToProcess = [...jobMessageBatch];
        jobMessageBatch = [];

        if (batchToProcess.length === 0) return;

        // ✨ We now extract the campaignId from the message to pass it down the line
        const jobsToProcess = batchToProcess.map(msg => JSON.parse(msg.content.toString()));
        const jobIds = jobsToProcess.map(job => job.jobId);
        
        console.log(`[Matcher-${CAMPAIGN_ID}] ⚙️ Processing batch of ${jobIds.length} jobs.`);

        try {
            // Pass the entire campaign context to the matching service
            const isSuccess = await matchJobsToResume(jobsToProcess);

            if (isSuccess) {
                console.log(`[Matcher-${CAMPAIGN_ID}] ✅ Batch matched. Acknowledging messages.`);
                batchToProcess.forEach(msg => channel.ack(msg));
            } else {
                console.warn(`[Matcher-${CAMPAIGN_ID}] ⚠️ matchJobsToResume failed. Requeueing messages.`);
                batchToProcess.forEach(msg => channel.nack(msg, false, true)); // Requeue on logical failure
            }
        } catch (error) {
            console.error(`[Matcher-${CAMPAIGN_ID}] ❌ Critical error during match. Rejecting batch.`, error);
            batchToProcess.forEach(msg => channel.nack(msg, false, false)); // Do not requeue
        } finally {
            console.log(`[Matcher-${CAMPAIGN_ID}] ⏳ Done processing batch.`);
        }
    };

    // ✨ THE FIX: USE THE DYNAMIC ROUTING KEY ✨
    const routingKey = `match.${CAMPAIGN_ID}`;

    await consumeFromCampaignQueue('match', CAMPAIGN_ID, async (msg) => {
        if (msg === null) return;
        if (batchTimeout) clearTimeout(batchTimeout);
        jobMessageBatch.push(msg);

        if (jobMessageBatch.length >= BATCH_SIZE) {
            await processBatch();
        } else {
            batchTimeout = setTimeout(processBatch, BATCH_TIMEOUT_MS);
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
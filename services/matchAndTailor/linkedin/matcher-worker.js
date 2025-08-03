import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {
    connectToQueue,
    getChannel,
    closeQueueConnection,
    NEW_JOB_QUEUE
} from '../../queue.js';
import { matchJobsToResume } from './matchJobsToResume.js';

dotenv.config();

const BATCH_SIZE = 5;
const BATCH_TIMEOUT_MS = 60000; // 5 seconds

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ MongoDB connected for Matcher Worker.");
    } catch (err) {
        console.error("❌ DB connection failed:", err.message);
        process.exit(1);
    }
};

const startMatcherWorker = async () => {
    await connectDB();
    await connectToQueue();

    const channel = getChannel();
    if (!channel) {
        console.error("FATAL: Failed to get RabbitMQ channel. Exiting.");
        process.exit(1);
    }

    channel.prefetch(BATCH_SIZE);

    let jobMessageBatch = [];
    let batchTimeout = null;

    console.log(`[Matcher Worker] STANDING BY. Batch size: ${BATCH_SIZE}, Timeout: ${BATCH_TIMEOUT_MS}ms.`);

    const processBatch = async () => {
        // Stop the timeout clock. We are processing now.
        if (batchTimeout) {
            clearTimeout(batchTimeout);
            batchTimeout = null;
        }

        // Make a copy of the current batch and reset the global one immediately.
        const batchToProcess = [...jobMessageBatch];
        jobMessageBatch = [];

        if (batchToProcess.length === 0) {
            return;
        }

        const jobIdsToProcess = batchToProcess.map(message => JSON.parse(message.content.toString()).jobId);
        console.log(`[Matcher Worker] EXECUTING. Processing batch of ${jobIdsToProcess.length} jobs.`);

        try {
            const isSuccess = await matchJobsToResume(jobIdsToProcess);
            
            if (isSuccess) {
                console.log(`[Matcher Worker] SUCCESS. Acknowledging ${batchToProcess.length} messages.`);
                batchToProcess.forEach(message => channel.ack(message));
            } else {
                 console.warn(`[Matcher Worker] 'matchJobsToResume' returned failure. Messages will not be acknowledged.`);
                 // In a real scenario, you might nack these. For now, we let them time out and be redelivered.
            }
        } catch (error) {
            // THIS IS THE CRITICAL ERROR HANDLING BLOCK
            console.error(`[Matcher Worker] CATASTROPHIC FAILURE during 'matchJobsToResume'. Rejecting batch.`, error);
            // Reject all messages in the batch without requeuing them.
            // This prevents a "poison pill" batch from crashing the worker over and over.
            batchToProcess.forEach(message => channel.nack(message, false, false));
        } finally {
            console.log('[Matcher Worker] EXECUTION COMPLETE. Batch processed. Waiting for new messages...');
        }
    };

    channel.consume(NEW_JOB_QUEUE, async (msg) => {
        if (msg === null) return;

        // If a timeout was already scheduled, cancel it because a new message has arrived.
        if (batchTimeout) {
            clearTimeout(batchTimeout);
        }

        jobMessageBatch.push(msg);
        const content = JSON.parse(msg.content.toString());
        console.log(`[Matcher Worker] MESSAGE RECEIVED. Job ID: ${content.jobId}. Batch size: ${jobMessageBatch.length}/${BATCH_SIZE}.`);

        // IF THE BATCH IS FULL, PROCESS IT NOW. DO NOT WAIT.
        if (jobMessageBatch.length >= BATCH_SIZE) {
            console.log(`[Matcher Worker] BATCH FULL. Processing immediately.`);
            await processBatch();
        } else {
            // THE BATCH IS NOT FULL. START THE CLOCK.
            // IF THE CLOCK RUNS OUT (5 SECONDS) AND NO NEW JOBS ARRIVE,
            // PROCESS THE INCOMPLETE BATCH ANYWAY. DO NOT LET JOBS GET STUCK.
            console.log(`[Matcher Worker] Batch not full. Setting 5-second timeout...`);
            batchTimeout = setTimeout(processBatch, BATCH_TIMEOUT_MS);
        }
    }, {
        noAck: false
    });
};

startMatcherWorker().catch(err => {
    console.error("A critical unhandled error occurred in the matcher worker:", err);
    closeQueueConnection();
    process.exit(1);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received. Shutting down matcher worker gracefully.');
    await closeQueueConnection();
    process.exit(0);
});
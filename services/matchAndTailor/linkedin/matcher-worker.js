// services/matchAndTailor/linkedin/matcher-worker.js (Final, Refactored Version)

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import amqplib from 'amqplib';
import { matchJobsToResume } from './matchJobsToResume.js';
import { publishToExchange } from '../../queue.js'; // We still need this to talk to the tailor
import Campaign from '../../../models/Campaign.js';

dotenv.config();

// Standard database connection function
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log(`[Matcher-Worker] ✅ MongoDB connected.`);
    } catch (err) {
        console.error(`[Matcher-Worker] ❌ DB connection failed:`, err.message);
        process.exit(1);
    }
};

/**
 * Processes a single job message from the central matching queue.
 * @param {import('amqplib').ConsumeMessage | null} msg The message from RabbitMQ.
 * @param {import('amqplib').Channel} channel The RabbitMQ channel.
 */
async function processMatchJob(msg, channel) {
    if (msg === null) {
        return; // This can happen if the channel is closed
    }

    let jobDetails;
    try {
        // 1. Receive and Parse the Job
        jobDetails = JSON.parse(msg.content.toString());
        const { jobId, campaignId, resumeId } = jobDetails;

        if (!jobId || !campaignId || !resumeId) {
            throw new Error("Invalid job message received. Missing 'jobId' or 'campaignId' or 'resumeId'.");
        }

        // Check the campaign's status BEFORE doing any matching work.
        const campaign = await Campaign.findById(campaignId).select('status').lean();

        if (!campaign || campaign.status === 'stopped') {
            console.log(`--- [Matcher-Worker] 🛑 Campaign ${campaignId} is stopped. Discarding job ${jobId}. ---`);
            // Acknowledge the message to remove it from the queue. This is a successful cancellation.
            channel.ack(msg);
            return; // Stop processing this message
        }
        // ======================================================================

        console.log(`--- [Matcher-Worker] ⚙️  Processing Job: ${jobId} for Campaign: ${campaignId} ---`);

        // 2. Execute the Core Business Logic
        const isSuccess = await matchJobsToResume(jobDetails, channel);

        // 3. Handle the Result
        if (isSuccess) {
            console.log(`[Matcher-Worker] ✅ Match successful for Job ${jobId}.`);
            // The message is acknowledged *inside* matchJobsToResume or after it succeeds.
            // Your original code acknowledged here, which is also fine.
            channel.ack(msg);

        } else {
            console.warn(`[Matcher-Worker] ⚠️ Logical match failed for job ${jobId}. Rejecting message.`);
            // Acknowledge the failure, but don't requeue. A re-run won't fix a bad match.
            channel.nack(msg, false, false);
        }

    } catch (error) {
        console.error(`[Matcher-Worker] ❌ Critical error processing job ${jobDetails?.jobId}. Rejecting job.`, error);
        // Acknowledge the failure, don't requeue a job that causes a crash.
        channel.nack(msg, false, false);
    }
}

/**
 * Main startup function for the long-lived, generic matcher worker service.
 */
const startWorker = async () => {
    console.log('[Matcher-Worker] Starting...');
    await connectDB();

    try {
        const connection = await amqplib.connect(process.env.RABBITMQ_URL);
        const channel = await connection.createChannel();

        // This worker listens to the ONE SHARED QUEUE for all new matching jobs.
        // This name MUST match the queue name used by the scraper.
        const MATCH_QUEUE_NAME = 'jobs.match';
        await channel.assertQueue(MATCH_QUEUE_NAME, { durable: true });

        // Only fetch one message at a time. This worker won't receive a new job
        // until it has acknowledged the previous one. This ensures fair load balancing.
        channel.prefetch(1);

        console.log(`[Matcher-Worker] 👂 Waiting for jobs in the central queue: "${MATCH_QUEUE_NAME}".`);

        // Start consuming from the shared queue. This runs forever until the container is stopped.
        channel.consume(MATCH_QUEUE_NAME, (msg) => processMatchJob(msg, channel), { noAck: false });

    } catch (err) {
        console.error('[Matcher-Worker] 🔥 Fatal startup error:', err);
        process.exit(1);
    }
};

// Start the worker service.
startWorker();
// tailor-worker.js (Final, Refactored for Docker)

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import amqplib from 'amqplib';
import { tailorResumeToJob } from './tailorResumeToJob.js';
import MatchedPair from '../../../models/MatchedPair.js';
import Campaign from '../../../models/Campaign.js';
dotenv.config();

/**
 * Connects to the MongoDB database. Exits the process on failure.
 */
const connectDB = async () => {
    // Standard MongoDB connection logic.
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log(`[Tailor-Worker] ✅ MongoDB connected.`);
    } catch (err){
        // If the database is down, the worker can't do anything.
        console.error(`[Tailor-Worker] ❌ DB connection failed:`, err.message);
        process.exit(1);
    }
};

/**
 * Processes a single job message from the central tailoring queue.
 * @param {import('amqplib').ConsumeMessage | null} msg The message from RabbitMQ.
 * @param {import('amqplib').Channel} channel The RabbitMQ channel.
 */
async function processTailorJob(msg, channel) {
    if (msg === null) return;

    let jobDetails;
    try {
        // 1. Receive and Parse the Job
        jobDetails = JSON.parse(msg.content.toString());
        const { jobId, matchedPairId, campaignId, resumeId } = jobDetails;

        if (!matchedPairId || !campaignId || !jobId || !resumeId) {
            throw new Error("Invalid job message. Missing required fields.");
        }

        // ======================= NEW CANCELLATION CHECK =======================
        // Check the campaign's status BEFORE doing any tailoring work.
        const campaign = await Campaign.findById(campaignId).select('status').lean();

        if (!campaign || campaign.status === 'stopped') {
            console.log(`--- [Tailor-Worker] 🛑 Campaign ${campaignId} is stopped. Discarding tailoring job for MatchedPair ${matchedPairId}. ---`);
            // Acknowledge the message to remove it from the queue.
            channel.ack(msg);
            return; // Stop processing this message
        }
        // ======================================================================

        console.log(`[Tailor-Worker] ✂️  Received tailoring job for MatchedPair: ${matchedPairId}`);

        const pair = await MatchedPair.findById(matchedPairId);
        if (!pair) throw new Error(`MatchedPair ID ${matchedPairId} not found in database.`);

        // Mark the job as 'processing' in the database.
        pair.tailoringStatus = 'processing';
        await pair.save();

        // 2. --- Execute Your Core Business Logic ---
        const tailoredResume = await tailorResumeToJob({
            userId: pair.userId,
            resumeId: pair.resumeId,
            jobId: pair.jobId,
            matchedPairId: pair.id,
            campaignId: campaignId
        });

        if (!tailoredResume || !tailoredResume._id) {
            throw new Error(`Tailoring process failed to return a valid resume document.`);
        }

        // 3. --- Update the Database on Success ---
        pair.tailoringStatus = 'completed';
        pair.tailoredResumeId = tailoredResume._id;
        await pair.save();

        console.log(`[Tailor-Worker] ✅ Tailoring complete for MatchedPair: ${matchedPairId}`);
        // Acknowledge the message to remove it from the queue.
        channel.ack(msg);

    } catch (error) {
        console.error(`[Tailor-Worker] ❌ FAILED job for MatchedPair ${jobDetails?.matchedPairId}:`, error);
        
        // If an error occurs, try to update the database to reflect the failure.
        if (jobDetails?.matchedPairId) {
            try {
                await MatchedPair.updateOne(
                    { _id: jobDetails.matchedPairId },
                    { tailoringStatus: 'failed' }
                );
            } catch (dbError) {
                console.error(`[Tailor-Worker] ❌ Could not even update the job status to failed.`, dbError);
            }
        }
        
        // Reject the message (don't requeue) to prevent it from crashing the worker repeatedly.
        channel.nack(msg, false, false);
    }
}

/**
 * Main startup function for the long-lived, generic tailor worker service.
 */
const startWorker = async () => {
    console.log('[Tailor-Worker] Starting...');
    await connectDB();

    try {
        const connection = await amqplib.connect(process.env.RABBITMQ_URL);
        const channel = await connection.createChannel();

        // This worker listens to the ONE SHARED QUEUE for all new tailoring jobs.
        // This MUST match the queue name the matcher-worker sends to.
        const TAILOR_QUEUE_NAME = 'jobs.tailor';
        await channel.assertQueue(TAILOR_QUEUE_NAME, { durable: true });

        // This worker is slow, so it should only process one job at a time.
        channel.prefetch(1);

        console.log(`[Tailor-Worker] 👂 Waiting for jobs in the central queue: "${TAILOR_QUEUE_NAME}".`);

        // Start consuming from the shared queue. This runs forever.
        channel.consume(TAILOR_QUEUE_NAME, (msg) => processTailorJob(msg, channel), { noAck: false });

    } catch (err) {
        console.error('[Tailor-Worker] 🔥 Fatal startup error:', err);
        process.exit(1);
    }
};

// Start the worker service.
startWorker();
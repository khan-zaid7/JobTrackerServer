import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {
    connectToQueue,
    getChannel,
    closeQueueConnection,
    TAILORING_QUEUE
} from '../../queue.js'; // Assuming queue.js is in the same directory

// This is the sophisticated, pre-existing AI logic for tailoring.
// We are assuming the path is correct.
import { tailorResumeToJob } from './tailorResumeToJob.js'; 

// Import the model needed to look up the job details
import MatchedPair from '../../../models/MatchedPair.js';

dotenv.config();

// --- Main Worker Logic ---

const connectDB = async () => {
    // Standard boilerplate for connecting to MongoDB.
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ MongoDB connected for Tailor Worker.");
    } catch (err) {
        console.error("❌ DB connection failed:", err.message);
        process.exit(1);
    }
};

const startTailorWorker = async () => {
    await connectDB();
    await connectToQueue();

    const channel = getChannel();
    if (!channel) {
        console.error("FATAL: Failed to get RabbitMQ channel. Exiting.");
        process.exit(1);
    }

    // Set prefetch to 1.
    // This is CRITICAL for this worker. It ensures that each worker instance
    // will only take ONE message from the queue at a time. Because tailoring is
    // a slow, resource-intensive task, this allows us to scale horizontally
    // by running many instances, with each one focused on a single job.
    channel.prefetch(1);

    console.log(`[Tailor Worker] Waiting for messages on queue: "${TAILORING_QUEUE}".`);

    channel.consume(TAILORING_QUEUE, async (msg) => {
        if (msg === null) {
            return;
        }

        const content = JSON.parse(msg.content.toString());
        const { matchedPairId } = content;

        if (!matchedPairId) {
            console.error('[Tailor Worker] Received message without a matchedPairId. Discarding.', content);
            channel.ack(msg); // Acknowledge to remove the malformed message
            return;
        }
        
        console.log(`[Tailor Worker] Received new tailoring job. MatchedPair ID: ${matchedPairId}`);
        
        let pair = null;
        try {
            // 1. Fetch the MatchedPair document to get all the necessary IDs.
            pair = await MatchedPair.findById(matchedPairId);

            if (!pair) {
                throw new Error(`MatchedPair with ID ${matchedPairId} not found in the database.`);
            }

            // 2. Update the status to 'processing' to prevent re-work and provide visibility.
            pair.tailoringStatus = 'processing';
            await pair.save();

            // 3. Delegate the slow, intensive work to the existing tailoring service function.
            // This function contains the two-pass AI logic.
            const tailoredResume = await tailorResumeToJob({
                userId: pair.userId,
                resumeId: pair.resumeId,
                jobId: pair.jobId,
            });

            // 4. If successful, update the status and link the final resume.
            pair.tailoringStatus = 'completed';
            pair.tailoredResumeId = tailoredResume._id; // Link to the final output
            await pair.save();

            console.log(`[Tailor Worker] ✅ Successfully completed tailoring for MatchedPair ID: ${matchedPairId}`);

        } catch (error) {
            console.error(`[Tailor Worker] ❌ FAILED to process tailoring for MatchedPair ID: ${matchedPairId}.`, error);
            
            // If an error occurs, update the status to 'failed' for tracking.
            if (pair) {
                pair.tailoringStatus = 'failed';
                // You could add an error message field to the schema to store `error.message`.
                await pair.save();
            }

        } finally {
            // 5. CRITICAL: Acknowledge the message.
            // Whether it succeeded or failed, we acknowledge the message to remove it
            // from the queue. This prevents a "poison pill" message (a message that
            // always fails) from being re-queued and blocking the system.
            channel.ack(msg);
            console.log(`[Tailor Worker] Acknowledged message for MatchedPair ID: ${matchedPairId}`);
        }
    }, {
        noAck: false
    });
};

startTailorWorker().catch(err => {
    console.error("A critical unhandled error occurred in the tailor worker:", err);
    closeQueueConnection();
    process.exit(1);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received. Shutting down tailor worker gracefully.');
    await closeQueueConnection();
    process.exit(0);
});
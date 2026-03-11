import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { runJobScraper } from './Scraper.js';
import { getChannel, connectToQueue, closeQueueConnection } from '../../queue.js'; // Assuming getChannel is exported from your queue module
import User from '../../../models/User.js';

dotenv.config();

// Define the name of the queue this worker will listen to.
// This is a generic queue for ALL scraping jobs.
const SCRAPE_QUEUE_NAME = 'jobs.scrape.start';

const connectDB = async () => {
    // No changes here, this is good.
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log(`[Scraper-Worker] ✅ MongoDB connected.`);
    } catch (err)
 {
        console.error(`[Scraper-Worker] ❌ DB connection failed:`, err.message);
        process.exit(1);
    }
};

const startWorker = async () => {
    console.log("--- [Scraper-Worker] Starting up... ---");

    // Connect to essential services once at startup.
    await connectDB();
    await connectToQueue();

    // Get the channel for communication.
    const channel = getChannel();
    if (!channel) {
        console.error("[Scraper-Worker] ❌ Could not get RabbitMQ channel. Shutting down.");
        process.exit(1);
    }

    // Assert the queue exists. 'durable: true' means messages won't be lost if RabbitMQ restarts.
    await channel.assertQueue(SCRAPE_QUEUE_NAME, { durable: true });

    // Set prefetch to 1. This is crucial. It tells RabbitMQ to only give this worker
    // one message at a time. The worker must acknowledge the message before it gets another.
    // This prevents one worker from grabbing all the jobs and then crashing, losing them all.
    channel.prefetch(1);

    console.log(`[Scraper-Worker] 👂 Waiting for messages in queue: "${SCRAPE_QUEUE_NAME}"`);

    // The core of the worker: consume messages from the queue.
    channel.consume(SCRAPE_QUEUE_NAME, async (msg) => {
        if (msg === null) {
            return;
        }

        let jobDetails;
        try {
            // 1. Receive and Parse the Job
            jobDetails = JSON.parse(msg.content.toString());
            const { campaignId, targetRole, userId, targetLocation, resumeId } = jobDetails;

            if (!campaignId || !targetRole || !userId || !targetLocation || !resumeId) {
                throw new Error("Message is missing required job details.");
            }

            console.log(`\n--- [Scraper] 📩 MISSION RECEIVED for Campaign: ${campaignId} ---`);
            console.log(`--- [Scraper] Target: "${targetRole}" in "${targetLocation}" ---`);

            // 2. Execute the Scrape Task
            // Your core scraping logic remains UNCHANGED. We just pass it parameters from the message.
            const user = await User.findById(userId);
            if (!user) {
                throw new Error(`User with ID ${userId} not found.`);
            }

            await runJobScraper(
                { search_term: targetRole, location: targetLocation },
                user,
                campaignId, 
                resumeId
            );

            console.log(`--- [Scraper] ✅ MISSION COMPLETE for Campaign: ${campaignId} ---`);

        } catch (taskError) {
            console.error(`[Scraper] ❌ Task failed for Campaign: ${jobDetails?.campaignId}. Error:`, taskError);
            // In a real production system, you might send the message to a "dead-letter" queue here.
        } finally {
            // 3. Acknowledge the Message
            // the message will be re-queued for another worker to try.
            console.log(`--- [Scraper]  ACKNOWLEDGING message for Campaign: ${jobDetails?.campaignId} ---`);
            channel.ack(msg);
        }
    }, {
        // 'noAck: false' is the default, but we're explicit. It means we MUST manually acknowledge messages.
        noAck: false
    });
};

startWorker().catch((err) => {
    console.error(`[Scraper-Worker] 🔥 A fatal error occurred during startup:`, err);
    process.exit(1);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received. Shutting down scraper worker gracefully.');
    await closeQueueConnection();
    process.exit(0);
});
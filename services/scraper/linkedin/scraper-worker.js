import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { runJobScraper } from './Scraper.js';
import { connectToQueue, closeQueueConnection } from '../../queue.js';
import User from '../../../models/User.js';

dotenv.config();

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log(`[Scraper] ✅ MongoDB connected.`);
    } catch (err) {
        console.error(`[Scraper] ❌ DB connection failed:`, err.message);
        process.exit(1);
    }
};

const startScraperWorker = async () => {

    const campaignId = process.env.CAMPAIGN_ID;
    const targetRole = process.env.CAMPAIGN_TARGET;
    const userId = process.env.USER_ID;
    const targetLocation = process.env.CAMPAIGN_LOCATION;

    if (!campaignId || !targetRole || !userId || !targetLocation) {
        throw new Error("FATAL: Scraper worker started without a complete mission (CAMPAIGN_ID, CAMPAIGN_TARGET, and USER_ID are required).");
    }

    console.log(`--- [Scraper-${campaignId}] MISSION START ---`);
    console.log(`--- [Scraper-${campaignId}] Target Role: "${targetRole}" for User: ${userId} ---`);

    await connectDB();
    await connectToQueue();

    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error(`User with ID ${userId} not found.`);
        }
        
        // This is a short-lived process. Its only job is to run this one scrape.
        await runJobScraper(
            { search_term: targetRole, location: targetLocation }, // We can still hardcode location for now
            user,
            campaignId
        );
        
        console.log(`--- [Scraper-${campaignId}] MISSION COMPLETE. Task: "${targetRole}" ---`);

    } catch (taskError) {
        console.error(`[Scraper-${campaignId}] ❌ Task failed for "${targetRole}". Error:`, taskError);
        // We will let the process exit with an error code so the system knows it failed.
        process.exit(1);
    } finally {
        await closeQueueConnection();
        // The worker has completed its single task. It will now shut down.
        console.log(`[Scraper-${campaignId}] ✅ Shutting down gracefully.`);
        process.exit(0);
    }
};

startScraperWorker().catch(async (err) => {
    console.error(`[Scraper] 🔥 Unhandled fatal error:`, err);
    await closeQueueConnection();
    process.exit(1);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received. Shutting down scraper worker gracefully.');
    await closeQueueConnection();
    process.exit(0);
});
// src/workers/scraper-worker.js

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
        console.log("✅ MongoDB connected for Scraper Worker.");
    } catch (err) {
        console.error("❌ DB connection failed:", err.message);
        process.exit(1);
    }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// These tasks define what the worker should do. They include the userId.
const SCRAPING_TASKS = [
    { userId: '688ea3ec9e344b03a7b8d909', query: { search_term: 'Software Engineer', location: 'Canada' } },
    { userId: '688ea3ec9e344b03a7b8d909', query: { search_term: 'Data Analyst', location: 'Canada' } },
];

const startScraperWorker = async () => {
    await connectDB();
    await connectToQueue();

    while (true) {
        console.log('--- [Scraper Worker] Starting new scraping session ---');
        
        for (const task of SCRAPING_TASKS) {
            try {
                console.log(`--- [Scraper Worker] Executing task for user ${task.userId}: "${task.query.search_term}" ---`);
                
                const user = await User.findById(task.userId);
                if (!user) {
                    console.error(`User with ID ${task.userId} not found for task. Skipping.`);
                    continue;
                }
                
                // The worker calls your existing, refactored runJobScraper.
                await runJobScraper(task.query, user);
                
                console.log(`--- [Scraper Worker] Successfully completed task: "${task.query.search_term}" ---`);

            } catch (taskError) {
                console.error(`[Scraper Worker] Task failed for "${task.query.search_term}". Error: ${taskError.message}`);
            }
            
            const interTaskDelay = 60 * 1 * 1000 + Math.random() * 60 * 2 * 1000;
            console.log(`--- [Scraper Worker] Resting for ~${Math.round(interTaskDelay / 60000)} minutes before next task. ---`);
            await sleep(interTaskDelay);
        }

        const interSessionDelay = 60 * 20 * 1000 + Math.random() * 60 * 10 * 1000;
        console.log(`--- [Scraper Worker] All tasks for this session complete. Resting for ~${Math.round(interSessionDelay / 60000)} minutes. ---`);
        await sleep(interSessionDelay);
    }
};

startScraperWorker().catch(err => {
    console.error("A critical unhandled error occurred in the scraper worker:", err);
    closeQueueConnection();
});

process.on('SIGINT', async () => {
    console.log('SIGINT received. Shutting down scraper worker gracefully.');
    await closeQueueConnection();
    process.exit(0);
});
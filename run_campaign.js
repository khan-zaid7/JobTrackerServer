import { v4 as uuidv4 } from 'uuid';
import Campaign from './models/Campaign.js';
// import { getChannel } from '../../queue.js'; 
import {getChannel} from './services/queue.js';


// The new, decoupled launchCampaign function
export async function launchCampaign(userId, role = 'Backend Engineer', location="Canada", resumeId, instances = { matches: 1, tailors: 1, scrapers: 1 }) {
    try {
        if (!userId) throw new Error("UserID not defined.");
        const campaignId = uuidv4();

        // 1. Create the campaign in the database (this is still correct)
        await Campaign.create({
            _id: campaignId,
            userId: userId,
            targetRole: role,
            status: 'running' // Or perhaps 'queued' is a better status now
        });

        // 2. Define the "Mission Orders" - This is the new `envBase`
        const jobDetails = {
            campaignId: campaignId,
            userId: userId,
            targetRole: role,
            targetLocation: location,
            resumeId: resumeId
        };

        // 3. Get the RabbitMQ channel
        const channel = getChannel();
        if (!channel) {
            throw new Error("Could not connect to the message queue. Cannot launch campaign.");
        }

        // 4. Define the target queue
        const SCRAPE_QUEUE_NAME = 'jobs.scrape.start';
        await channel.assertQueue(SCRAPE_QUEUE_NAME, { durable: true });

        // 5. Publish the jobs to the queue
        // The user wants a specific number of scrapers. We will send that many messages.
        // Each message represents one "slot" of concurrent work.
        console.log(`[API-Server] Queuing ${instances.scrapers} scraper jobs for Campaign ${campaignId}...`);
        for (let i = 0; i < instances.scrapers; i++) {
            // We send the same job details. The pool of workers will process them in parallel.
            channel.sendToQueue(
                SCRAPE_QUEUE_NAME,
                Buffer.from(JSON.stringify(jobDetails)),
                { persistent: true } // 'persistent: true' ensures the message survives a RabbitMQ restart
            );
        }


        console.log(`[API-Server] ✅ Campaign ${campaignId} successfully launched and jobs queued.`);
        return { success: true, campaignId: campaignId };

    } catch (error) {
        console.error(`[API-Server] ❌ ERROR WHILE LAUNCHING CAMPAIGN: ${error.message}`);
        // In a real app, you might want to update the campaign status to 'failed' here.
        return { success: false, error: error.message };
    }
}


// --- stopCampaign needs a new architecture ---
// We will tackle this NEXT. The logic needs to change from killing processes
// to sending a "stop" message. Let's get launching working first.

/**
 * Stops a running campaign by updating its status in the database.
 * This is the definitive source of truth for all workers. Workers are designed
 * to check this status before starting a task and during long-running processes.
 * @param {string} campaignId The ID of the campaign to stop.
 */
export async function stopCampaign(campaignId) {
    if (!campaignId) {
        return { success: false, error: "CampaignID is required." };
    }

    try {
        console.log(`[API-Server] 🛑 Initiating stop for Campaign ${campaignId}...`);

        // Find the campaign and update its status to 'stopped'.
        const updatedCampaign = await Campaign.findByIdAndUpdate(
            campaignId,
            { status: 'stopped' },
            { new: true } 
        );

        // Check if a campaign was actually found and updated.
        if (!updatedCampaign) {
            console.warn(`[API-Server] ⚠️  Attempted to stop a campaign that was not found: ${campaignId}`);
            return { success: false, error: `Campaign with ID ${campaignId} not found.` };
        }

        console.log(`[API-Server] ✅ Campaign ${campaignId} status successfully updated to 'stopped' in the database.`);
        
        // The message clearly states the expected behavior of the system.
        return { 
            success: true, 
            message: `Campaign ${campaignId} has been marked as 'stopped'. Running workers will cease on their next check.` 
        };

    } catch (error) {
        console.error(`[API-Server] ❌ ERROR WHILE STOPPING CAMPAIGN ${campaignId}: ${error.message}`);
        // This would catch database connection errors, etc.
        return { success: false, error: error.message };
    }
}
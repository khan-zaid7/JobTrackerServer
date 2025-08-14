import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import Campaign from './models/Campaign.js';


dotenv.config();
const campaignProcesses = {};

function spawnWorkers(path, roleName, count, envBase, campaignId) {
    for (let i = 0; i < count; i++) {
        const env = {
            ...envBase,
            WORKER_ROLE: roleName,
            WORKER_INSTANCE_ID: String(i)
        };
        const child = spawn('node', [path], { env, stdio: 'inherit' });

        if (!campaignProcesses[campaignId]) {
            campaignProcesses[campaignId] = [];
        }

        campaignProcesses[campaignId].push(child);
        child.on('close', (code) => {
            console.log(`${roleName} #${i} for campaign ${campaignId} exited with code ${code}.`);

            // Remove the dead soldier from the roster.
            if (campaignProcesses[campaignId]) {
                campaignProcesses[campaignId] = campaignProcesses[campaignId].filter(p => p.pid !== child.pid);

                // If this was the last soldier, remove the entire campaign entry.
                if (campaignProcesses[campaignId].length === 0) {
                    console.log(`[SYSTEM] All workers for campaign ${campaignId} have exited. Removing from registry.`);
                    delete campaignProcesses[campaignId];
                }
            }
        });
        child.on('close', (code) => console.log(`${roleName} #${i} exited with code ${code}`));
    }
}


export async function launchCampaign(userId, role = 'Backend Engineer', location="Canada", resumeId, instances = { matches: 1, tailors: 1, scrapers: 1 }) {
    try {
        if (!userId) throw new Error("UserID not defined.")
        const campaignId = uuidv4();

        await Campaign.create({
            _id: campaignId,
            userId: userId,
            targetRole: role,
            status: 'running'
        });

        const envBase = {
            ...process.env,
            CAMPAIGN_ID: campaignId,
            CAMPAIGN_TARGET: role,
            USER_ID: userId,
            RESUME_ID:resumeId,
            CAMPAIGN_LOCATION:location 
        };

        //  spawn the workers
        spawnWorkers('services/scraper/linkedin/scraper-worker.js', 'scraper', instances.scrapers, envBase, campaignId);
        spawnWorkers('services/matchAndTailor/linkedin/matcher-worker.js', 'matcher', instances.matches, envBase, campaignId);
        spawnWorkers('services/matchAndTailor/linkedin/tailor-worker.js', 'tailor', instances.tailors, envBase, campaignId);

        return { success: true, campaignId: campaignId };
    }
    catch (error) {
        console.error(`ERROR WHILE LAUNCHING COMPAIN: ${error}`);
    }
}

export async function stopCampaign(campaignId){
    const processes = campaignProcesses[campaignId];
     
    if (!processes || processes.length===0){
        console.warn(`[SYSTEM] No active processes found for campaign ${campaignId}. It may have already completed or never existed.`);
        await Campaign.findByIdAndUpdate(campaignId, {status: 'stopped'});
        return {sucess: true, message: "No active process found, status updated"};
    }
    console.log(`[SYSTEM] Sending STOP signal to ${processes.length} workers for campaign ${campaignId}...`);

    // killing all the running process
    processes.forEach(child => {
        // send ctrl+c for shutdown
        child.kill('SIGINT');
    })

    delete campaignProcesses[campaignId];
    await Campaign.findByIdAndUpdate(campaignId, {status: 'stopped'});
    return { success: true, message: "Stop signal sent to all workers." };
}
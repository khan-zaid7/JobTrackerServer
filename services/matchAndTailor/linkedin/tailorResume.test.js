import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import Resume from '../../../models/Resume.js';
import { tailorResumeToJob } from './tailorResumeToJob.js';

// --- CORRECTED .ENV CONFIGURATION ---
// Get the directory of the current script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Calculate the path to the 'server' directory from the script's location
// From /linkedin/ -> go up to /matchAndTailor/ -> go up to /services/ -> go up to /server/
const serverDir = path.resolve(__dirname, '../../../');

// Construct the full path to the .env file within the 'server' directory
const envPath = path.join(serverDir, '.env');

// Load the .env file from the correct, specific path
dotenv.config({ path: envPath });
// --- END OF CORRECTION ---

// --- CONFIGURATION ---
const USER_ID = '689a2f69c752f4c50b62e6b3';
const JOB_IDS_TO_TEST = [
    // '689b9cae84b65c013e6983c0',
    '689b964284b65c013e6982e8',
    '689b967f84b65c013e6982f0'
];
const CAMPAIGN_ID = `9302c241-0773-492c-95ae-8e647adb3913`;

// --- DATABASE CONNECTION ---
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        // This check is still useful to confirm the file was read correctly
        if (!process.env.MONGO_URI) {
            console.error(`Debug: Script is looking for .env at this exact path: ${envPath}`);
            throw new Error('MONGO_URI not found. Please ensure the .env file exists at the path above and contains the MONGO_URI variable.');
        }
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Database connected successfully.');
    } catch (err) {
        console.error(`❌ DB connection failed:`, err.message);
        process.exit(1);
    }
};

// --- MAIN TEST RUNNER (No changes needed below) ---
const runTest = async () => {
    try {
        await connectDB();

        console.log(`\nFetching master resume for user: ${USER_ID}`);
        
        const masterResume = await Resume.findOne({ createdBy: new mongoose.Types.ObjectId(USER_ID), isMaster: true });

        if (!masterResume) {
            console.error(`❌ CRITICAL ERROR: Could not find a master resume for user ${USER_ID}.`);
            console.error('Please ensure a resume exists for this user with "isMaster" set to true.');
            return;
        }

        console.log(`✅ Found master resume. ID: ${masterResume._id}`);
        console.log('--------------------------------------------------\n');

        for (const jobId of JOB_IDS_TO_TEST) {
            console.log(`🚀 Starting tailoring process for Job ID: ${jobId}`);
            
            const result = await tailorResumeToJob({
                userId: USER_ID,
                resumeId: masterResume._id.toString(),
                jobId: jobId,
                campaignId: CAMPAIGN_ID,
            });

            if (result && result.status === 'success') {
                console.log(`✅ SUCCESS: Tailored resume created for job ${jobId}. New TailoredResume ID: ${result._id}`);
            } else {
                console.error(`❌ FAILED: Tailoring process for job ${jobId}.`);
                if(result && result.error) {
                    console.error(`   Error: ${result.error}`);
                }
            }
            console.log('--------------------------------------------------\n');
        }

    } catch (error) {
        console.error('An unexpected error occurred during the test run:', error);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('Database connection closed. Test finished.');
        }
    }
};

// --- EXECUTE THE SCRIPT ---
runTest();
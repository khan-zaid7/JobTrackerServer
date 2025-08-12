import { launchCampaign, stopCampaign } from '../run_campaign.js'; // Assuming this is the correct path
import ScrapedJob from '../models/ScrapedJob.js';
import MatchedPair from '../models/MatchedPair.js';
import TailoredResume from '../models/TailoredResume.js';
import Campaign from '../models/Campaign.js';
import Resume from '../models/Resume.js';
import mongoose from 'mongoose';

export async function launchCampaignController(req, res) {
    try {
        // ✨ THE FIX: Get the user ID from the authenticated user session, NOT the request body.
        // Assumes your auth middleware adds a `user` object to the request, e.g., req.user = { id: '...' }
        const userId = req.user.id; 
        
        const { targetRole, instances } = req.body;

        if (!targetRole) {
            return res.status(400).json({ success: false, message: 'targetRole is required.' });
        }

        // 1. Check if a campaign with 'running' status already exists for this user.
        const existingRunningCampaign = await Campaign.findOne({ userId: userId, status: 'running' });

        // 2. If a running campaign is found, block the new launch.
        if (existingRunningCampaign) {
            return res.status(409).json({ // 409 Conflict is the perfect status code for this.
                success: false,
                message: 'You already have a campaign running. Please stop it before launching a new one.'
            });
        }

        // 3. If no running campaign is found, proceed to launch the new one.
        const result = await launchCampaign(userId, targetRole, instances);
        
        if (result.success) {
            return res.status(202).json(result); // 202 Accepted is good for an async operation
        } else {
            // If the launch service itself fails
            return res.status(400).json({ success: false, message: result.error });
        }
    } catch (error) {
        console.error(`Unable to launch campaign for user ${req.user?.id}:`, error);
        return res.status(500).json({ success: false, message: `Internal server error` });
    }
}

export async function getAllCampaigns(req, res) {
    try {
        // ✨ THE FIX: Get the user ID from the authenticated token, not params.
        const userId = req.user.id;
        const campaigns = await Campaign.find({ userId: userId }).sort({ createdAt: -1 });
        return res.status(200).json({ campaigns });
    } catch (err) {
        console.error('Failed to fetch campaigns:', err);
        return res.status(500).json({ error: 'Failed to fetch campaigns.' });
    }
}


// controllers/campaignsController.js

export async function getCampaignStatus(req, res) {
    try {
        const { campaignId } = req.params;
        const userId = req.user.id;

        const campaign = await Campaign.findOne({ _id: campaignId, userId: userId }).lean();
        if (!campaign) {
            return res.status(404).json({ message: "Campaign not found." });
        }
        
        // --- ✨ THIS IS THE EXECUTION OF YOUR DIRECT FUCKING ORDER ✨ ---

        // STEP 1: Get the list of all job IDs that have been SUCCESSFULLY tailored for this campaign.
        const tailoredJobIds = await TailoredResume.find({ 
            campaignId: campaignId, 
            status: 'success' 
        }).distinct('jobId');

        // STEP 2: Execute all counts in parallel.
        const [scrapedCount, totalMatchedCount] = await Promise.all([
            ScrapedJob.countDocuments({ campaignId: campaignId }),
            MatchedPair.countDocuments({ campaignId: campaignId })
        ]);

        // STEP 3: CALCULATE THE FINAL, CORRECT COUNT.
        // THE TRUTH: "Jobs Matched" on the dashboard now means "Total Matches MINUS Tailored Matches."
        const pendingMatchedCount = totalMatchedCount - tailoredJobIds.length;

        // The number of tailored resumes is simply the length of the list we just fetched.
        const tailoredCount = tailoredJobIds.length;
        
        // --- END OF FIX ---

        return res.status(200).json({
            status: campaign.status,
            stats: {
                jobsScraped: scrapedCount,
                jobsMatched: pendingMatchedCount, // This will now correctly report 14
                jobsTailored: tailoredCount,       // This will now correctly report 2
                userID: userId
            }
        });

    } catch (error) {
        console.error(`Error fetching campaign status for campaign ${req.params.campaignId}:`, error);
        return res.status(500).json({ error: 'Failed to fetch campaign status.' });
    }
}


export async function stopCampaignController(req, res) {
    try {
        const { campaignId } = req.params;
        const userId = req.user.id;

        // ✨ SECURITY FIX: Ensure a user can only stop their own campaigns.
        const campaign = await Campaign.findOne({ _id: campaignId, userId: userId });
        if (!campaign) {
            return res.status(404).json({ message: "Campaign not found or you do not have permission to stop it." });
        }

        const result = await stopCampaign(campaignId);
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(500).json({ error: 'Failed to stop campaign.' });
        }
    } catch (error) {
        console.error(`Error stopping campaign ${req.params.campaignId}:`, error);
        return res.status(500).json({ error: 'Failed to stop campaign.' });
    }
}

/**
 * Fetches a complete, detailed view of a single campaign, including all
 * associated jobs and tailored resumes.
 * Ensures that the campaign belongs to the authenticated user.
*/  

export async function getCompleteCampaignDetails(req, res) {
    try {
        const { campaignId } = req.params;
        const userId = req.user.id;

        // 1. Authenticate the user and get the campaign.
        const campaign = await Campaign.findOne({ _id: campaignId, userId: userId }).lean();
        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found or you do not have permission to access it.' });
        }

        // 2. Fetch ALL three lists of data in parallel. This is efficient.
        const [scrapedJobs, matchedPairs, successfulResumes] = await Promise.all([
            // Get all jobs for the campaign.
            ScrapedJob.find({ campaignId: campaignId }).sort({ createdAt: -1 }).lean(),
            
            // Get all matched pairs for the campaign.
            MatchedPair.find({ campaignId: campaignId }).lean(),
            
            // Get all SUCCESSFULLY completed tailored resumes for the campaign.
            TailoredResume.find({ campaignId: campaignId, status: 'success' }).lean()
        ]);

        // 3. Create Maps for easy, fast lookups (O(1) access).
        const matchedPairMap = new Map(matchedPairs.map(p => [p.jobId.toString(), p]));
        const tailoredResumeMap = new Map(successfulResumes.map(r => [r.jobId.toString(), r]));

        // 4. Stitch the data together. This is the crucial step.
        // We iterate through the list of SCRAPED JOBS as our base.
        const combinedJobs = scrapedJobs.map(job => {
            const jobIdString = job._id.toString();
            
            return {
                ...job,
                // Attach the MatchedPair object if one exists for this jobId.
                matchedPair: matchedPairMap.get(jobIdString) || null,
                
                // Attach the TailoredResume object if one exists for this jobId.
                tailoredResume: tailoredResumeMap.get(jobIdString) || null
            };
        });

        // 5. Assemble the final, complete, and consistent response object.
        const completeDetails = {
            ...campaign,
            jobs: combinedJobs
        };

        return res.status(200).json(completeDetails);

    } catch (error) {
        // We add more specific error logging to help debug if it ever fails.
        console.error(`CRITICAL FAILURE in getCompleteCampaignDetails for campaign ${req.params.campaignId}:`, error);
        return res.status(500).json({ message: 'A critical server error occurred while fetching complete campaign details.' });
    }
}

/**
 * Fetches the complete details for a single job within a campaign.
 * This includes the scraped job data, the original master resume used for matching,
 * and the tailored resume (including the path to the PDF from GCP).
 * It ensures the job and campaign belong to the authenticated user.
 */
export async function getJobDetails(req, res) {
    try {
        const { campaignId, jobId } = req.params;
        const userId = req.user.id; // Assumes auth middleware provides req.user.id

        // 1. Find the core ScrapedJob and validate its ownership in one go.
        // This is the most important step for security.

        const jobObjectId = new mongoose.Types.ObjectId(jobId);
        const userObjectId = new mongoose.Types.ObjectId(userId);
        
        const job = await ScrapedJob.findOne({
            _id: jobObjectId,
            campaignId: campaignId,
            createdBy: userObjectId 
        }).lean(); // .lean() provides a faster, plain object for the response.

        // If the job doesn't exist or doesn't belong to the user/campaign, return 404.
        if (!job) {
            return res.status(404).json({
                message: "Job not found in this campaign, or you do not have permission to view it."
            });
        }

        // 2. Now that the job is validated, fetch its related documents in parallel for efficiency.
        const [tailoredResume, originalResume] = await Promise.all([
            // Find the tailored resume associated with this specific job, campaign, and user.
            TailoredResume.findOne({
                jobId: jobId,
                campaignId: campaignId,
                userId: userId
            }).lean(),

            // If a master resume was linked to this job during matching, fetch its details.
            // This directly answers "the original resume used for matching (if any)".
            job.resumeId ? Resume.findById(job.resumeId).lean() : Promise.resolve(null)
        ]);

        // 3. Assemble the final, complete response object.
        // The "get from gcp" requirement is met by including the `pdfPath` from the
        // tailoredResume document. The frontend will use this path.
        const completeJobDetails = {
            ...job, // Spread all properties of the scraped job
            tailoredResume: tailoredResume || null, // Attach the full tailored resume object or null
            originalResume: originalResume || null, // Attach the original resume object or null
        };

        return res.status(200).json(completeJobDetails);

    } catch (error) {
        console.error(`CRITICAL FAILURE in getJobDetails for job ${req.params.jobId}:`, error);
        return res.status(500).json({
            message: 'A critical server error occurred while fetching the job details.'
        });
    }
}
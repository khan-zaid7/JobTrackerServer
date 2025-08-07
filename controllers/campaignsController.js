import { launchCampaign, stopCampaign } from "../run_campaign.js";
import ScrapedJob from "../models/ScrapedJob.js";
import MatchedPair from "../models/MatchedPair.js";
import TailoredResume from "../models/TailoredResume.js";
import Campaign from "../models/Campaign.js";



export async function launchCampaignController(req, res) {

    // const userId = req.user.id;
    const userId = req.body.userId;
    if (!userId) res.status(400).json({ message: `userId not defined` });


    const instances = req.body.instances;
    if (!instances) res.status(400).json({ message: `Instances not specified` });

    const roleToSearch = req.body.role;
    if (!roleToSearch) res.status(400).json({ message: `role not defined` });

    try {
        const success = await launchCampaign(userId, roleToSearch, instances);
        // if success is true, i.e. lauched successfull do not wait for the workers to finish 
        if (success) res.status(200).json(success);
    }
    catch (error) {

        console.error(`Unable to lauch campaing controller: ${error}`);
        res.status(500).json({ message: `Internal server error: ${error}` })
    }

}

export async function getAllCampaigns(req, res) {
  try {
    const campaigns = await Campaign.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    
    // ✅ Send the actual campaigns as response
    console.log(campaigns)
    return res.status(200).json(campaigns);
  } catch (err) {
    console.error('Failed to fetch campaigns:', err);
    
    // ✅ Only send this if nothing has been sent already
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to fetch campaigns.' });
    }
  }
}

export async function getCampaignStatus(req, res) {
    // get campaign details 
    // get all scraped jobs
    // get all tailred jobs
    // get all matched jobs
    try {
        const { campaignId } = req.params;

        // Execute all database queries in parallel for maximum fucking speed.
        const [scrapedCount, matchedCount, tailoredCount, campaignStatus] = await Promise.all([
            ScrapedJob.countDocuments({ campaignId: campaignId }),
            MatchedPair.countDocuments({ campaignId: campaignId }),
            TailoredResume.countDocuments({ campaignId: campaignId, status: 'success' }),
            Campaign.findById(campaignId).select('status targetRole createdAt')
        ]);

        res.status(200).json({
            campaign: campaignStatus,
            stats: {
                jobsScraped: scrapedCount,
                jobsMatched: matchedCount,
                jobsTailored: tailoredCount
            }
        });

    } catch (error) {
        console.error(`Error fetching campaign status for ${req.params.campaignId}:`, error);
        res.status(500).json({ error: 'Failed to fetch campaign status.' });
    }
}

export async function stopCampaignController(req, res) {
     try {
        const { campaignId } = req.params;
        const success = stopCampaign(campaignId);
        if (success) res.status(200).json(success);

     } catch (error) {
        console.error(`Error stopping campaign status for ${req.params.campaignId}:`, error);
        res.status(500).json({ error: 'Failed to stop campaign.' });
    }
}
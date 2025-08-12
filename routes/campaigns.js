import express from 'express';
import { getAllCampaigns, launchCampaignController, getCampaignStatus, stopCampaignController,getCompleteCampaignDetails, getJobDetails } from '../controllers/campaignsController.js';
import auth from '../middleware/auth.js'; // Assuming this is your auth middleware

const router = express.Router();

// ✨ THE FIX: ALL ROUTES ARE NOW SECURE AND USE THE CORRECT STRUCTURE. ✨
router.post('/launch', auth,launchCampaignController);
router.get('/', auth, getAllCampaigns); // This is now the endpoint for the logged-in user
router.get('/status/:campaignId', auth, getCampaignStatus);
router.post('/stop/:campaignId', auth, stopCampaignController);
// GET /api/campaigns/:campaignId/details
router.get('/details/:campaignId', auth, getCompleteCampaignDetails);
router.get('/job-details/:campaignId/:jobId', auth, getJobDetails);

export default router;
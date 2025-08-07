import express from 'express';
import { getAllCampaigns, launchCampaignController, getCampaignStatus, stopCampaignController} from '../controllers/campaignsController.js';
const router = express.Router();

router.post('/launch', launchCampaignController);
router.get('/user/:userId', getAllCampaigns);
router.get('/status/:campaignId', getCampaignStatus);
router.post('/stop/:campaignId', stopCampaignController);

export default router;
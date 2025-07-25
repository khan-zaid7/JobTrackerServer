import { matchJobsToResume } from "./matchAndTailor/linkedin/matchJobsToResume.js";
import Resume from "../models/Resume.js";
import { runJobScraper } from "./scraper/linkedin/Scraper.js";

const hourlyPipelineLinkedIn = async (query = { search_term, location }, tags = []) => {
    // Execute the main scraper function
    let batchToken = await runJobScraper(query);
    // get the resume
    const latestMasterResume = await Resume.findOne({ isMaster: true }).sort({ createdAt: -1 });
    // call the match function to match jobs with resume
    await matchJobsToResume(batchToken, latestMasterResume);
}

hourlyPipelineLinkedIn({search_term:'Software Developer', location:'Canada'});
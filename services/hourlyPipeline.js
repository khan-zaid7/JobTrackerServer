import { matchJobsToResume } from "./matchAndTailor/linkedin/matchJobsToResume.js";
import Resume from "../models/Resume.js";
import { runJobScraper } from "./scraper/linkedin/Scraper.js";
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { tailorResumeToJob } from "./matchAndTailor/linkedin/tailorResumeToJob.js";
import { createResumeDocument } from "./matchAndTailor/linkedin/createResumeDocument.js";
import TailoredResume from "../models/TailoredResume.js";
import ScrapedJob from "../models/ScrapedJob.js";
import User from "../models/User.js";

dotenv.config();

const connectDB = async () => {
    if (mongoose.connection.readyState === 1) return; // already connected
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("✅ Scraper MongoDB connected");
    } catch (err) {
        console.error("❌ Scraper DB connection failed:", err.message);
        process.exit(1);
    }
};

const hourlyPipelineLinkedIn = async (query = { search_term, location }, tags = [], userId='680860a5c86b10aabe3bd656') => {

  await connectDB();

  const user = await User.findById(userId);

  const latestMasterResume = await Resume.findOne({ isMaster: true }).sort({ createdAt: -1 });
  
  const batchToken = await runJobScraper(query, user);

  await matchJobsToResume(batchToken, latestMasterResume, tags, user);

  const matchedJobs = await ScrapedJob.find({
    batchId: batchToken,
    isRelevant: true,
    is_deleted: false,
    createdBy: user,
  });

  // 🟨 Get borderline jobs (isRelevant: false && is_deleted: false)
  const borderlineJobs = await ScrapedJob.find({
    batchId: batchToken,
    isRelevant: false,
    is_deleted: false,
    createdBy: user,
  });


  console.log(matchedJobs);
  console.log(borderlineJobs);
  const allJobs = [...matchedJobs, ...borderlineJobs];

  for (const job of allJobs) {
    try {
      await tailorResumeToJob({
        userId,
        resumeId: latestMasterResume.id,
        jobId: job._id, 
        batchId: batchToken
      });
      console.log(`Tailored resume created for job: ${job.title}`);
    } catch (err) {
      console.error(`Failed to tailor resume for job ${job._id}:`, err.message);
    }
  }
};

hourlyPipelineLinkedIn({ search_term: 'Software Developer', location: 'Canada' });
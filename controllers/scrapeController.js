import ScrapeSession from '../models/ScrapeSession.js';
import ScrapedJob from '../models/ScrapedJob.js';
import Resume from '../models/Resume.js';
import { asyncScrapeAndFilter } from '../services/asyncScrapeAndFilter.js';

export const startScrapeSession = async (req, res) => {
  const { url, resumeId, tags } = req.body;

  if (!resumeId || !tags?.length) return res.status(400).json({ message: 'Missing resumeId or tags' });

  const newSession = await ScrapeSession.create({
    userId: '680860a5c86b10aabe3bd656',
    batchId: '', 
    resumeId,
    tags,
    status: 'pending',
    note: 'Starting scrape...'
  });

  asyncScrapeAndFilter(newSession._id, url); // Fire async task

  res.status(202).json({ sessionId: newSession._id });
};

export const getScrapeStatus = async (req, res) => {
  const { sessionId } = req.params;

  const session = await ScrapeSession.findById(sessionId);
  if (!session) return res.status(404).json({ message: 'Session not found' });

  res.json({
    status: session.status,
    batchId: session.batchId,
    jobCount: session.jobCount,
    note: session.note,
    error: session.error
  });
};

export const getScrapeResults = async (req, res) => {
  const { sessionId } = req.params;

  const session = await ScrapeSession.findById(sessionId);
  if (!session || session.status !== 'done') {
    return res.status(400).json({ message: 'Results not ready or session not found' });
  }

  const jobs = await ScrapedJob.find({ batchId: session.batchId, isRelevant: true }).lean();
  res.json(jobs);
};

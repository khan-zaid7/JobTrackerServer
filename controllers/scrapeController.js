import { scrapeLinkedInJobs } from '../services/scraper.js';
import { filterWorthyJobs } from '../services/ScrapedJobsFilter.js';

// LinkedIn scraping controller
export const scrapeLinkedIn = async (req, res) => {
  try {
    const userId = '680860a5c86b10aabe3bd656'; // Replace with req.user.id when auth is ready
    const limit = parseInt(req.query.limit) || 10;

    const result = await scrapeLinkedInJobs(userId, limit);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Filter-worthy-jobs controller
export const filterWorthyJobsController = async (req, res) => {
  try {
    const { keywords = [], resumeText = '' } = req.body;

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ error: 'Keywords must be a non-empty array.' });
    }

    const userId = '680860a5c86b10aabe3bd656'; // Replace with req.user.id when auth is ready

    const result = await filterWorthyJobs(userId, keywords, resumeText);

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error('Filtering error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

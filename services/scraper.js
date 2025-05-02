import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import ScrapedJob from '../models/ScrapedJob.js';
import dotenv from 'dotenv';

dotenv.config();

puppeteer.use(StealthPlugin());

const delay = (ms) => new Promise(resolve => 
  setTimeout(resolve, ms + Math.random() * 2000)
);


export const scrapeLinkedInJobs = async (userId) => {
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://${process.env.BROWSER_API_USERNAME}:${process.env.BROWSER_API_PASSWORD}@${process.env.BROWSER_API_HOST}:${process.env.BROWSER_API_PORT}`
  });

  const page = await browser.newPage();
  try {
    // Basic setup
    await page.setViewport({ width: 1280, height: 800 });

    // Navigation
    await page.goto('https://www.linkedin.com/jobs/search/?currentJobId=4221413538&distance=25.0&f_E=2%2C3&f_TPR=r86400&geoId=101174742&keywords=Software%20Developer&origin=JOB_SEARCH_PAGE_JOB_FILTER', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await delay(5000);

    // Scrolling
    let previousHeight = 0;
    while (true) {
      const newHeight = await page.evaluate(async () => {
        window.scrollTo(0, document.body.scrollHeight);
        return document.body.scrollHeight;
      });
      if (newHeight === previousHeight) break;
      previousHeight = newHeight;
      await delay(3000);
    }

    // Job extraction with additional fields
    const jobs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.jobs-search__results-list li')).map(job => ({
        title: job.querySelector('.base-search-card__title')?.textContent?.trim() || '',
        company: job.querySelector('.base-search-card__subtitle')?.textContent?.trim() || '',
        url: job.querySelector('.base-card__full-link')?.href || '',
        postedAt: job.querySelector('.job-search-card__listdate')?.textContent?.trim() || 'Unknown',
        location: job.querySelector('.job-search-card__location')?.textContent?.trim() || ''
      })).filter(job => job.url);
    });

    // Advanced deduplication
    const savedJobs = [];
    for (const job of jobs) {
      try {
        await delay(5000);

        // Check for existing jobs (both exact and similar)
        const existing = await ScrapedJob.findOne({
          $or: [
            { url: job.url }, // Exact match
            { 
              title: { $regex: job.title.substring(0, 20), $options: 'i' },
              company: job.company,
              lastScraped: { $gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            }
          ]
        });

        if (!existing) {
          const savedJob = await ScrapedJob.findOneAndUpdate(
            { url: job.url },
            {
              ...job,
              userId,
              lastScraped: new Date(),
              isRelevant: true // Mark new jobs as relevant by default
            },
            { upsert: true, new: true }
          );
          savedJobs.push(savedJob);
          console.log(`Saved new job: ${job.title} at ${job.company}`);
        } else {
          console.log(`Skipped duplicate/similar job: ${job.title}`);
        }
      } catch (error) {
        console.error(`Error processing job ${job.url}:`, error.message);
      }
    }

    return {
      success: true,
      newJobs: savedJobs.length,
      totalProcessed: jobs.length
    };

  } catch (error) {
    console.error('Scraping failed:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    await browser.close();
  }
};
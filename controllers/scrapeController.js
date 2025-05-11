import scrapeWebsite from '../services/LinkedInScraper.js';


export const scrapeLatestJobFromLinkedIn = async (req, res) => {

    const linkedInSearchUrl = 'https://www.linkedin.com/jobs/search/?keywords=Software%20Developer&location=Canada&geoId=101174742&f_E=1%2C2%2C3&f_TPR=r86400&f_JT=F%2CC&position=1&pageNum=0';

    const scrapedJobs = await  scrapeWebsite(linkedInSearchUrl);

    return res.json(scrapedJobs);
}
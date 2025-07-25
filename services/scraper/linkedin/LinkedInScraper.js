import { firefox } from 'playwright';
import { sub, format } from 'date-fns';
import ScrapedJob from '../../../models/ScrapedJob.js';
import { v4 as uuidv4 } from 'uuid';
import ScrapeSession from '../../../models/ScrapeSession.js';
import { RANDOMUSERID } from '../../../config/constants.js';

function parseLinkedInDate(relativeTime) {
    const now = new Date();
    if (!relativeTime) return now;

    const match = relativeTime.match(/(\d+)\s*(minute|hour|day|week|month|year)s?\s*ago/i);
    if (!match) return now;

    const amount = parseInt(match[1]);
    const unit = match[2].toLowerCase() + 's'; // pluralize

    return sub(now, { [unit]: amount });
}


async function humanDelay(min = 1000, max = 3000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
}

async function smoothScrollToTop(page) {
    // Scroll up gradually like a human would
    const currentPosition = await page.evaluate(() => window.scrollY);
    const steps = 10;
    const stepSize = currentPosition / steps;

    for (let i = 0; i < steps; i++) {
        const targetPosition = currentPosition - (stepSize * (i + 1));
        await page.evaluate((y) => {
            window.scrollTo(0, y);
        }, targetPosition);
        await humanDelay(100, 300); // Short random delay between scroll steps
    }
}

export async function loadAllJobs(page) {
    let previousHeight = 0;
    let currentHeight = 0;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        previousHeight = currentHeight;
        currentHeight = await page.evaluate(() => document.body.scrollHeight);

        // Scroll in random human-like chunks
        const scrollChunk = Math.floor(currentHeight * (0.3 + Math.random() * 0.4));
        await page.evaluate((y) => {
            window.scrollBy(0, y);
        }, scrollChunk);

        await humanDelay(1500, 3500);

        // Occasionally scroll back slightly
        if (Math.random() > 0.7) {
            await page.evaluate(() => {
                window.scrollBy(0, -100);
            });
            await humanDelay(500, 1500);
        }

        const newHeight = await page.evaluate(() => document.body.scrollHeight);
        if (newHeight === currentHeight) {
            attempts++;
        } else {
            attempts = 0;
        }
        currentHeight = newHeight;
    }

    // After loading all jobs, smoothly scroll back to top
    await smoothScrollToTop(page);
    await humanDelay(1000, 2000); // Pause at top
}

async function getJobDescription(page) {
    try {
        // Scroll to the description section smoothly
        await page.locator('.description__text--rich').scrollIntoViewIfNeeded();
        await page.waitForTimeout(2000 + Math.random() * 3000); // Human-like pause

        // Check if "Show more" button exists and click it
        const showMoreButton = page.locator('.show-more-less-html__button--more');
        if (await showMoreButton.isVisible()) {
            // Human-like movement before clicking
            await page.mouse.move(
                (await showMoreButton.boundingBox()).x + 10,
                (await showMoreButton.boundingBox()).y + 10
            );
            await page.waitForTimeout(500 + Math.random() * 1000);

            await showMoreButton.click();
            await page.waitForTimeout(3000); // Wait for content to expand
        }

        // Get the full description text
        const description = await page.locator('.show-more-less-html__markup').innerText();
        return description.trim();
    } catch (error) {
        console.log('Error getting description:', error.message);
        return '';
    }
}

export async function getJobDetails(page, batchId) {
    const title = await page.locator('.top-card-layout__title').innerText();
    const url = await page.locator('.topcard__link').getAttribute('href');
    const companyName = await page.locator('.topcard__org-name-link').innerText();
    const companyUrl = await page.locator('.topcard__org-name-link').getAttribute('href');
    const location = await page.locator('.topcard__flavor.topcard__flavor--bullet')
        .innerText()
        .catch(() => 'Location not found');
    const relativeTime = await page.locator('.posted-time-ago__text').innerText();
    const postedTime = format(parseLinkedInDate(relativeTime), 'yyyy-MM-dd');
    const description = await getJobDescription(page);
    const isRelevant = false;

    // ✅ Prevent duplicate save by URL
    const existing = await ScrapedJob.findOne({ url });
    if (existing) {
        console.log(`[Duplicate Skipped] ${title} @ ${companyName}`);
        return null;
    }

    const jobDoc = new ScrapedJob({
        title,
        url,
        companyName,
        companyUrl,
        location,
        postedTime,
        description,
        createdBy: RANDOMUSERID,
        batchId,
        isRelevant,
    });

    try {
        await jobDoc.save();
        return jobDoc;
    } catch (e) {
        if (e.code === 11000) {
            console.log(`[Mongo Duplicate] ${url} already exists.`);
            return null;
        }
        throw e;
    }
}

async function scrapeWebsite(url = linkedInSearchUrl, sessionId) {
    let allJobs = [];

    const browser = await firefox.launch({
        headless: false,
        slowMo: 50
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0'
    });

    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await humanDelay(2000, 5000);

    try {
        await page.getByRole('button', { name: 'Dismiss' }).click({ timeout: 5000 });
        await humanDelay(1000, 2000);
    } catch (e) {
        console.log('No login popup found');
    }

    await loadAllJobs(page);

    const jobRows = await page.locator('.jobs-search__results-list > li');
    const count = await jobRows.count();
    console.log(`Found ${count} jobs to process`);

    // Create batch
    const batchId = uuidv4();
    // 👇 Update existing session — DO NOT create new one
    // await ScrapeSession.findByIdAndUpdate(sessionId, {
    //     batchId,
    //     jobCount: count,
    //     status: 'scraping',
    //     note: 'Scraping started'
    // });

    for (let i = 0; i < count; i++) {
        const row = jobRows.nth(i);
        const link = row.locator('a.base-card__full-link');

        try {
            await link.scrollIntoViewIfNeeded();
            await humanDelay(500, 1500);

            // Scroll slightly above the element for more natural positioning
            await page.evaluate(() => window.scrollBy(0, -100));
            await humanDelay(300, 800);

            await link.click();
            await humanDelay(2500, 4000);

            let newJob = await getJobDetails(page, batchId);
            allJobs.push(newJob);

            await humanDelay(1000, 3000);

            if (Math.random() > 0.7) {
                await humanDelay(3000, 6000);
            }
        } catch (e) {
            console.log(`Error processing job ${i}:`, e.message);
        }
    }

    await browser.close();
    return {allJobs, batchId};
}

const linkedInSearchUrl = 'https://www.linkedin.com/jobs/search/?keywords=Software%20Developer&location=Canada&geoId=101174742&f_E=1%2C2%2C3&f_TPR=r86400&f_JT=F%2CC&position=1&pageNum=0';

// scrapeWebsite(linkedInSearchUrl).then(result => {
//     console.log('Scraping complete!');
//     console.log(`Found ${result.length} jobs:`);
//     console.log(JSON.stringify(result, null, 2));
// });

export default scrapeWebsite;
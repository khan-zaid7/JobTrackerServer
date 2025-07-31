import { selectors } from '../../../config/pageLocators.js';
import extractJobDetails from './jobDetailExtractor.js';
import { ParseJobDetailsSummary } from './jobDetailsSummaryParser.js';
import { hasNextPaginationPage, goToNextPaginationPage } from './paginationHandler.js';
import ScrapedJob from '../../../models/ScrapedJob.js';
import {getHourlyToken} from '../../../utils/humanUtils.js';
/**
 * Slowly scroll the job detail card with randomized steps, simulating human reading.
 * @param {import('@playwright/test').Page} page
 */
async function scrollJobDetailCard(page) {
    console.log("📜 Scrolling job detail pane slowly with randomized steps...");

    const selector = selectors.jobDetailCard;
    let lastScrollTop = -1;
    let noProgressCount = 0;

    while (noProgressCount < 3) {
        const scrolled = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return { success: false, scrollTop: 0, atBottom: true };

            const before = el.scrollTop;
            const scrollAmount = 80 + Math.floor(Math.random() * 150);
            el.scrollBy(0, scrollAmount);
            const after = el.scrollTop;

            return {
                success: true,
                scrollTop: after,
                atBottom: after === before
            };
        }, selector);

        if (!scrolled.success) {
            console.log("⚠️ Job detail element missing during scroll, stopping.");
            break;
        }

        if (scrolled.scrollTop === lastScrollTop && scrolled.atBottom) {
            noProgressCount++;
            console.log(`⚠️ No scroll progress detected (at bottom), attempt ${noProgressCount}`);
        } else if (scrolled.scrollTop === lastScrollTop) {
            noProgressCount++;
            console.log(`⚠️ No scroll progress detected (not at bottom), attempt ${noProgressCount}`);
        } else {
            noProgressCount = 0;
            lastScrollTop = scrolled.scrollTop;
            // console.log(`📜 Scrolled to position: ${lastScrollTop}`);
        }

        await page.waitForTimeout(400 + Math.random() * 500);
    }

    console.log("✅ Finished scrolling job detail.");
}

/**
 * Scrolls the main job list container by a small randomized distance.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
async function scrollJobListRandom(page) {
    console.log("🧍 Scrolling main job list container slightly before next click...");

    const containerSelector = selectors.scrollableJobsContainer;
    try {
        await page.waitForSelector(containerSelector, { visible: true, timeout: 10000 });
    } catch (error) {
        console.log(`⚠️ Job list container "${containerSelector}" not found or visible within timeout.`, error);
        return false;
    }

    const scrolled = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return { success: false, atBottom: true };

        const before = el.scrollTop;
        const scrollAmount = 50 + Math.floor(Math.random() * 100);
        el.scrollBy(0, scrollAmount);
        const after = el.scrollTop;

        return { success: true, scrollAmount, atBottom: after === before };
    }, containerSelector);

    if (scrolled.success && !scrolled.atBottom) {
        console.log(`🧍 Scrolled job list by approx. ${scrolled.scrollAmount}px.`);
        await page.waitForTimeout(700 + Math.random() * 800);
        return true;
    } else {
        console.log("⚠️ Could not scroll job list or already at bottom.");
        await page.waitForTimeout(700 + Math.random() * 800);
        return false;
    }
}

/**
 * Aggressively scrolls the main job list container until no more progress is made.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
async function aggressiveJobListScroll(page) {
    const containerSelector = selectors.scrollableJobsContainer;
    console.log("🔁 Aggressively scrolling job list to load more cards...");

    let lastScrollTop = -1;
    let sameScrollCount = 0;
    const maxAttempts = 5;

    while (sameScrollCount < maxAttempts) {
        const result = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return { scrollTop: 0, atBottom: true };
            const before = el.scrollTop;
            el.scrollBy(0, 400 + Math.floor(Math.random() * 200)); // scroll 400–600px
            const after = el.scrollTop;
            return {
                scrollTop: after,
                atBottom: after === before
            };
        }, containerSelector);

        if (result.scrollTop === lastScrollTop || result.atBottom) {
            sameScrollCount++;
            console.log(`⚠️ No scroll progress (${sameScrollCount}/${maxAttempts})`);
        } else {
            sameScrollCount = 0;
            lastScrollTop = result.scrollTop;
            console.log(`📦 Scrolled to ${lastScrollTop}px`);
        }

        if (result.atBottom) {
            console.log("🛑 Reached bottom of job list.");
            return false;
        }

        await page.waitForTimeout(1000 + Math.random() * 500);
    }

    console.log("✅ Done aggressive scrolling.");
    return true;
}

/**
 * Processes all visible job cards and scrolls to load more as needed.
 * @param {import('@playwright/test').Page} page
 */
export async function processAllJobCardsWithScrolling(page, user) {
    console.log("🚀 Starting job card click + detail scroll loop...");

    const processedJobIds = new Set();
    let noNewUnprocessedCardsAfterScrollAttempts = 0;
    const MAX_NO_NEW_UNPROCESSED_CARDS_ATTEMPTS = 5;
    
    // create the unique batch id 
    const batchToken = getHourlyToken();

    while (true) {
        const currentJobCardElements = await page.locator(selectors.jobCardLi).elementHandles();
        console.log(`Found ${currentJobCardElements.length} job cards in view.`);

        let cardsProcessedInThisLoopIteration = 0;

        for (const [index, cardElement] of currentJobCardElements.entries()) {
            const jobId = await cardElement.getAttribute('data-occludable-job-id');
            if (!jobId || processedJobIds.has(jobId)) continue;

            // check if this job card is already processed. 
            const expectedUrl = `https://www.linkedin.com/jobs/view/${jobId}`;
            const exists = await ScrapedJob.exists({ url: expectedUrl });
            console.log(`JOB ID : ${jobId}\n EXPECTED URL: ${expectedUrl}, EXISITS : ${exists}`);

            if (exists) {
                console.log(`⏩ Job already in DB: ${expectedUrl}`);
                processedJobIds.add(jobId);
                continue;
            }
            
            cardsProcessedInThisLoopIteration++;

            const box = await cardElement.boundingBox();
            if (!box) {
                console.log(`⚠️ Skipping card (ID=${jobId}) - no bounding box.`);
                processedJobIds.add(jobId);
                continue;
            }

            const centerX = box.x + box.width / 2;
            const centerY = box.y + box.height / 2;

            await page.waitForTimeout(1000 + Math.random() * 1500);
            await page.mouse.move(centerX, centerY, { steps: 50 });
            await page.waitForTimeout(500 + Math.random() * 1000);
            await page.mouse.click(centerX, centerY, { delay: 250 + Math.random() * 250 });

            console.log(`📄 Clicked job card #${index + 1} (id=${jobId}) at (${Math.round(centerX)}, ${Math.round(centerY)})`);

            try {
                await page.waitForSelector(selectors.jobDetailCard, { timeout: 7000 });
                await page.waitForTimeout(1500 + Math.random() * 1500);
                await scrollJobDetailCard(page);
                const jobData = await extractJobDetails(page);

                // Parse job data in a summary file 
                await ParseJobDetailsSummary(jobData, cardsProcessedInThisLoopIteration);

                //  save the scrapedjob 
                await saveScrapedJob( { ...jobData, batchId: batchToken, createdBy: user});

            } catch (error) {
                console.log(`❌ Failed to load or scroll job detail for ID ${jobId}:`, error);
            }

            if (index + 1 < currentJobCardElements.length) {
                await currentJobCardElements[index + 1].scrollIntoViewIfNeeded();
                await page.waitForTimeout(600 + Math.random() * 600);
            } else {
                await scrollJobListRandom(page);
            }
            processedJobIds.add(jobId);
        }

        if (cardsProcessedInThisLoopIteration > 0) {
            noNewUnprocessedCardsAfterScrollAttempts = 0;
            console.log(`🥳 Processed ${cardsProcessedInThisLoopIteration} new job(s).`);
            await page.waitForTimeout(1500 + Math.random() * 1500);
        } else {
            console.log("🤷 No new (unprocessed) jobs found. Aggressively scrolling...");

            const scrolledSuccessfully = await aggressiveJobListScroll(page);

            if (!scrolledSuccessfully) {
                console.log("🛑 Reached end of job list. Exiting loop.");
                break;
            }

            await page.waitForTimeout(2000 + Math.random() * 1000);

            const updatedCards = await page.locator(selectors.jobCardLi).elementHandles();
            let foundNew = false;
            for (const card of updatedCards) {
                const jobId = await card.getAttribute('data-occludable-job-id');
                if (jobId && !processedJobIds.has(jobId)) {
                    foundNew = true;
                    break;
                }
            }

            if (!foundNew) {
                noNewUnprocessedCardsAfterScrollAttempts++;
                console.log(`⚠️ No new cards after aggressive scroll (${noNewUnprocessedCardsAfterScrollAttempts}/${MAX_NO_NEW_UNPROCESSED_CARDS_ATTEMPTS})`);
                if (noNewUnprocessedCardsAfterScrollAttempts >= MAX_NO_NEW_UNPROCESSED_CARDS_ATTEMPTS) {
                    console.log("🛑 No new cards after multiple attempts. Ending process.");
                    break;
                }
            } else {
                noNewUnprocessedCardsAfterScrollAttempts = 0;
                console.log("🎉 New cards appeared after scroll. Continuing.");
            }
        }

        await page.waitForTimeout(1000 + Math.random() * 1000);
    }

    console.log("🎉 Completed processing all job cards.");
    // After "🎉 Completed processing all job cards."
    let pageNumber = 1;

    while (await hasNextPaginationPage(page)) {
        pageNumber++;
        await goToNextPaginationPage(page);
        console.log(`📄 Starting to process page ${pageNumber}...`);
        await processAllJobCardsWithScrolling(page, user); // re-use your existing logic
    }

    console.log("🏁 All pagination pages processed. Exiting.");
    await page.context().close(); // or browser.close() depending on where you manage the browser instance
    return batchToken;
}


const saveScrapedJob = async (jobData) => {
    const savedJob = await ScrapedJob.saveJobIfNotExists(jobData);
    if (savedJob) {
        console.log('Job saved:', savedJob._id);
    } else {
        console.log('Job was duplicate, skipped saving.');
    }
}
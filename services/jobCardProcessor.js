import { selectors } from '../config/pageLocators.js';

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
            if (!el) return { success: false, scrollTop: 0, atBottom: true }; // Added atBottom for consistency

            const before = el.scrollTop;
            // Randomize scroll distance between 30 and 120 px for natural variation
            const scrollAmount = 30 + Math.floor(Math.random() * 90);
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

        // Check if we've made progress. If scrollTop is the same as last time AND we are at the bottom, increment noProgressCount.
        // If we're at the bottom but it's the first time we reached it, it should still count as progress.
        if (scrolled.scrollTop === lastScrollTop && scrolled.atBottom) {
            noProgressCount++;
            console.log(`⚠️ No scroll progress detected (at bottom), attempt ${noProgressCount}`);
        } else if (scrolled.scrollTop === lastScrollTop && !scrolled.atBottom) {
            // This case means no progress but not at bottom, which is unusual. Increment count.
            noProgressCount++;
            console.log(`⚠️ No scroll progress detected (not at bottom), attempt ${noProgressCount}`);
        } else {
            noProgressCount = 0;
            lastScrollTop = scrolled.scrollTop;
            console.log(`📜 Scrolled to position: ${lastScrollTop}`);
        }

        // Random wait between 400ms and 900ms
        await page.waitForTimeout(400 + Math.random() * 500);
    }

    console.log("✅ Finished scrolling job detail.");
}

/**
 * Scrolls the main job list container by a small randomized distance.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>} True if scroll was successful and not at the very end, false otherwise.
 */
async function scrollJobListRandom(page) {
    console.log("🧍 Scrolling main job list container slightly before next click...");

    const containerSelector = selectors.scrollableJobsContainer;
    try {
        await page.waitForSelector(containerSelector, { visible: true, timeout: 10000 });
    } catch (error) {
        console.log(`⚠️ Job list container "${containerSelector}" not found or visible within timeout, cannot scroll.`, error);
        return false;
    }

    const scrolled = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return { success: false, atBottom: true }; // Consider at bottom if element missing

        const before = el.scrollTop;
        const scrollAmount = 50 + Math.floor(Math.random() * 100); // scroll 50 to 150 px
        el.scrollBy(0, scrollAmount);
        const after = el.scrollTop;

        return { success: true, scrollAmount, atBottom: (after === before) };
    }, containerSelector);

    if (scrolled.success && !scrolled.atBottom) {
        console.log(`🧍 Scrolled job list by approx. ${scrolled.scrollAmount}px.`);
        // Wait a bit after scrolling to simulate natural pause
        await page.waitForTimeout(700 + Math.random() * 800);
        return true; // Successfully scrolled and not at the very end
    } else {
        console.log("⚠️ Could not scroll job list container or already at bottom.");
        // Still wait a bit to simulate human, even if no scroll occurs
        await page.waitForTimeout(700 + Math.random() * 800);
        return false; // Did not scroll further or element was missing
    }
}

/**
 * Click each job card slowly with mouse movement,
 * wait for detail card, scroll detail card fully,
 * scroll main job list container a bit,
 * then move to next job card.
 * @param {import('@playwright/test').Page} page
 */
export async function processAllJobCardsWithScrolling(page) {
    console.log("🚀 Starting job card click + detail scroll loop...");

    const processedJobIds = new Set();
    let noNewUnprocessedCardsAfterScrollAttempts = 0; // Tracks consecutive attempts where no new *unprocessed* cards appeared
    const MAX_NO_NEW_UNPROCESSED_CARDS_ATTEMPTS = 5; // How many times we try scrolling if we don't find new jobs

    while (true) {
        // Step 1: Get all job cards currently visible in the DOM.
        // This array might include cards already processed, or new ones.
        const currentJobCardElements = await page.locator(selectors.jobCardLi).elementHandles();
        console.log(`Found ${currentJobCardElements.length} total job cards in current DOM view.`);

        let cardsProcessedInThisLoopIteration = 0; // Count of new cards processed in this `while` loop iteration

        // Step 2: Iterate through the currently available cards and process only the NEW ones.
        for (const [index, cardElement] of currentJobCardElements.entries()) {
            const jobId = await cardElement.getAttribute('data-occludable-job-id');

            // Skip if no job ID or already processed
            if (!jobId || processedJobIds.has(jobId)) {
                continue;
            }

            // A new, unprocessed card found!
            cardsProcessedInThisLoopIteration++;

            const box = await cardElement.boundingBox();
            if (!box) {
                console.log(`⚠️ Job card with ID ${jobId} bounding box not found, skipping click.`);
                processedJobIds.add(jobId); // Add to processed to avoid re-attempting this broken card
                continue;
            }

            // --- CRITICAL FIX: Define centerX and centerY here for EACH card ---
            const centerX = box.x + box.width / 2;
            const centerY = box.y + box.height / 2;
            // --- END CRITICAL FIX ---

            // Step 2a: Human-like mouse movement and click
            await page.waitForTimeout(1000 + Math.random() * 1500); // Pre-move wait
            await page.mouse.move(centerX, centerY, { steps: 50 });
            await page.waitForTimeout(500 + Math.random() * 1000); // Pre-click wait
            await page.mouse.click(centerX, centerY, { delay: 250 + Math.random() * 250 });

            console.log(`📄 Clicked job card #${index + 1} (id=${jobId}) at (${Math.round(centerX)}, ${Math.round(centerY)})`);

            // Step 2b: Wait for detail panel and scroll it
            try {
                await page.waitForSelector(selectors.jobDetailCard, { timeout: 7000 });
                await page.waitForTimeout(1500 + Math.random() * 1500);
                await scrollJobDetailCard(page);
            } catch (error) {
                console.log(`❌ Failed to load or scroll job detail for ID ${jobId}:`, error);
                // Continue to next card even if detail fails for one, but add to processed
            }

            // Step 2c: Scroll main job list container after processing *this* card's details.
            // This happens *for each card*.
            await scrollJobListRandom(page);

            processedJobIds.add(jobId); // Mark as processed after interaction and main list scroll
        } // End of for loop (processing all currently visible new cards)

        // Step 3: Determine if we should continue or stop the main `while` loop.
        if (cardsProcessedInThisLoopIteration > 0) {
            // If we processed *any* new cards in this iteration, it means there's activity.
            // Reset the 'no new jobs after scroll' counter.
            noNewUnprocessedCardsAfterScrollAttempts = 0;
            console.log(`🥳 Processed ${cardsProcessedInThisLoopIteration} new job(s) in this iteration. Continuing...`);
            // The `scrollJobListRandom` was already called for the last processed card.
            // A small wait before the next full `while` loop iteration to re-check.
            await page.waitForTimeout(1500 + Math.random() * 1500);
        } else {
            // No new cards were processed in this entire `while` loop iteration.
            // This means all currently visible cards have already been handled.
            console.log("🤷 No new (unprocessed) jobs found in current view. Attempting to scroll main list to load more.");

            const scrolledSuccessfully = await scrollJobListRandom(page); // Attempt to scroll the main list again

            if (!scrolledSuccessfully) {
                // If we tried to scroll the main list but couldn't (e.g., reached the end of the scrollable area)
                console.log("🛑 Unable to scroll job list further, likely at the end. Ending process.");
                break; // Exit the while loop
            }

            // If we *did* scroll, give the page time to load new content
            await page.waitForTimeout(2000 + Math.random() * 1000);

            // Now, check if any truly new, unprocessed cards appeared after that scroll.
            const updatedJobCardElements = await page.locator(selectors.jobCardLi).elementHandles();
            let trulyNewUnprocessedCardsAppeared = false;
            for (const cardElement of updatedJobCardElements) {
                const jobId = await cardElement.getAttribute('data-occludable-job-id');
                if (jobId && !processedJobIds.has(jobId)) {
                    trulyNewUnprocessedCardsAppeared = true;
                    break; // Found at least one new unprocessed card
                }
            }

            if (!trulyNewUnprocessedCardsAppeared) {
                // We scrolled, but still no *unprocessed* job cards appeared.
                noNewUnprocessedCardsAfterScrollAttempts++;
                console.log(`⚠️ Still no new unprocessed jobs appeared after scroll attempt ${noNewUnprocessedCardsAfterScrollAttempts} of ${MAX_NO_NEW_UNPROCESSED_CARDS_ATTEMPTS}.`);
                if (noNewUnprocessedCardsAfterScrollAttempts >= MAX_NO_NEW_UNPROCESSED_CARDS_ATTEMPTS) {
                    console.log(`🛑 Max consecutive attempts (${MAX_NO_NEW_UNPROCESSED_CARDS_ATTEMPTS}) reached without finding new unprocessed jobs. Assuming end of list.`);
                    break; // Exit the while loop if we've tried enough times
                }
            } else {
                // New unprocessed jobs *did* appear after our scroll. Reset counter.
                noNewUnprocessedCardsAfterScrollAttempts = 0;
                console.log("🎉 New unprocessed jobs detected after scrolling. Continuing next iteration.");
            }
        }
        // Small pause before starting the next overall loop cycle
        await page.waitForTimeout(1000 + Math.random() * 1000);
    } // End of while(true) loop

    console.log("🎉 Completed processing all job cards and detail scrolling.");
}
import { TITLE_INPUT, LOCATION_INPUT } from '../../../config/pageLocators.js';
import { typeLikeHuman, humanDelay } from '../../../utils/humanUtils.js';

/**
 * Performs a job search using only the job title.
 * This should be the first step in the search process.
 * @param {import('@playwright/test').Page} page
 * @param {string} title - The job title to search for.
 */
export async function performJobSearchByTitle(page, title = 'Software Developer') {
    console.log(`⌨️ Typing job title: "${title}"...`);

    try {
        const titleInput = page.locator(TITLE_INPUT());
        await titleInput.scrollIntoViewIfNeeded();

        // Click to focus and clear any existing text
        await titleInput.click({ clickCount: 3 });
        await typeLikeHuman(titleInput, title);
        await humanDelay(500, 800);

        // Press "Enter" to submit the search
        await titleInput.press('Enter');
        console.log('⌨️ Pressed "Enter" to trigger title search.');

        // Wait for search results to load
        // Note: You might want to wait for a specific element on the results page
        // for more reliability, e.g., page.waitForSelector(selectors.jobCardLi)
        console.log("⏳ Waiting for search results to load...");
        await humanDelay(4000, 6000);

    } catch (err) {
        console.error('❌ Failed during job title search:', err.message);
        throw err;
    }
}


/**
 * Changes the location on an existing job search results page.
 * This should be called *after* a search has already been performed.
 * @param {import('@playwright/test').Page} page
 * @param {string} location - The new location to filter by.
 */
export async function changeSearchLocation(page, location = 'Canada') {
    console.log(`⌨️ Changing job location to: "${location}"...`);

    try {
        // NOTE: The LOCATION_INPUT selector must work on the search results page.
        // It's often the same, but sometimes it can be different.
        const locationInput = page.locator(LOCATION_INPUT());
        await locationInput.scrollIntoViewIfNeeded();

        // Clear the existing location and type the new one
        await locationInput.click({ clickCount: 3 });
        await typeLikeHuman(locationInput, location);
        await humanDelay(500, 800);

        // Press "Enter" to apply the new location filter
        await locationInput.press('Enter');
        console.log('⌨️ Pressed "Enter" to update location.');

        // Wait for the job list to refresh with the new location
        console.log("⏳ Waiting for job list to refresh...");
        await humanDelay(4000, 6000);

    } catch (err) {
        console.error('❌ Failed while changing location:', err.message);
        throw err;
    }
}
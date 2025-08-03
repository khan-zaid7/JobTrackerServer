// paginationHandler.js
import { selectors } from '../../../config/pageLocators.js';

/**
 * Checks if there's a "Next" button in the pagination and returns its status.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>} true if next page is available
 */
export async function hasNextPaginationPage(page) {
    try {
        const nextBtn = await page.$('button.jobs-search-pagination__button--next');
        if (!nextBtn) {
            console.log("📭 No pagination 'Next' button found.");
            return false;
        }

        const isDisabled = await nextBtn.getAttribute('disabled');
        if (isDisabled !== null) {
            console.log("⛔ 'Next' button is disabled.");
            return false;
        }

        return true;
    } catch (err) {
        console.error("⚠️ Error checking pagination:", err.message);
        return false;
    }
}

/**
 * Clicks the pagination "Next" button and waits for page load.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
export async function goToNextPaginationPage(page) {
    try {
        const nextBtn = await page.$('button.jobs-search-pagination__button--next');
        if (nextBtn) {
            console.log("➡️ Navigating to next page...");
            await nextBtn.click();
            await page.waitForTimeout(3000); // Adjust if needed based on LinkedIn loading speed
        } else {
            console.log("⚠️ No next button found while trying to go to next page.");
        }
    } catch (err) {
        console.error("❌ Error navigating to next page:", err.message);
    }
}

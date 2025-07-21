// services/retrieveJobCount.js

import { selectors } from '../config/pageLocators.js';
/**
 * Retrieves the total number of job results from the page.
 * Throws a specific error if the element is not found or the count cannot be parsed.
 * @param {import('puppeteer').Page} page - The Puppeteer page object.
 * @returns {Promise<number>} The total number of job results.
 */
export async function retrieveTotalJobCount(page) {
    console.log("Attempting to retrieve total job results count...");
    let totalJobResults = 0;
    try {
        // Wait for the total results count element to be visible
        await page.waitForSelector(selectors.totalResultsCount, { visible: true, timeout: 30000 });
        console.log("Total job results element found.");

        const totalResultsText = await page.$eval(selectors.totalResultsCount, el => el.textContent);
        totalJobResults = parseInt(totalResultsText.replace(/[^0-9,.]/g, ''), 10); // Handle commas/periods in number

        if (isNaN(totalJobResults)) {
            throw new Error(`Failed to parse total job results count from: "${totalResultsText}"`);
        }
        console.log(`Successfully retrieved Total Job Results: ${totalJobResults}`);
        return totalJobResults;
    } catch (error) {
        console.error(`Error in retrieveTotalJobCount: ${error.message}`);
        // Throw a specific error for better debugging
        throw new Error(`JobCountElementError: Could not retrieve total job count. Details: ${error.message}`);
    }
}

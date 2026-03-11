import { createOrLoadSessionContext } from './createOrLoadSessionContext.js';
import { clickJobsNav } from './navigateToJobs.js';
import { performJobSearchByTitle, changeSearchLocation } from './performJobSearch.js';
import { applyFilter } from './applyJobFilters.js';
import { retrieveTotalJobCount } from './retrieveJobCount.js';
import { processAllJobCardsWithScrolling } from './jobCardProcessor.js';
import Campaign from '../../../models/Campaign.js';

/**
 * Main function to orchestrate the LinkedIn job scraping process.
 * This function handles browser setup, navigation, search, filtering,
 * and orchestrates the modularized phases of data retrieval.
 */

// ----------------------------------------------------------------

export async function runJobScraper(query = { search_term, location }, user, campaignId, resumeId) {

    if (!query) throw new Error('Search Parameters are required!');

    let campaign = await Campaign.findById(campaignId).select('status').lean();
    if (campaign.status === 'stopped') {
        console.log(`[Scraper Orchestrator] Campaign ${campaignId} stopped before work began. Exiting.`);
        return;
    }
    
    let browser, context, page;
    try {
        // 1. Initialize browser context
        ({ browser, context, page } = await createOrLoadSessionContext());
        console.log("Browser context initialized.");

        // 2. Navigate to Jobs section
        // This function uses existing selectors from your project (e.g., JOBS_NAV from pageLocator)
        await clickJobsNav(page);
        console.log("Navigated to Jobs section.");

        // 3a. Perform initial job search
        // This function uses existing selectors from your project (e.g., TITLE_INPUT, LOCATION_INPUT from pageLocator)
        await performJobSearchByTitle(page, query.search_term);
        console.log("Performed job search.");

        // 3b. Perform the location change
        await changeSearchLocation(page, query.location);

        // 4. Apply job filters
        // This function uses existing selectors from your project (e.g., FILTER_BUTTON, FILTER_OPTION_LOCATOR from pageLocator)
        await applyFilter(page, {
            "Date posted": 'Past 24 hours',
            // "Experience level": ['Entry level', 'Associate']
        });
        console.log("Applied filters.");

        // --- Phase 1: Initial Page Load & Total Job Count Retrieval ---
        console.log("\n--- Starting Phase 1: Retrieving Total Job Count ---");
        let totalJobResults = 0;
        try {
            // Call the modularized function to retrieve total job count
            totalJobResults = await retrieveTotalJobCount(page);
            console.log(`Successfully retrieved Total Job Results: ${totalJobResults}`);
        } catch (error) {
            console.error(`Error during Phase 1 (Total Job Count): ${error.message}`);
            throw error; // Re-throw the specific error from the service
        }
        // --- End of Phase 1 ---

        // --- Phase 2: Exhaustive Scrolling of the Current Job List (UL) ---
        console.log("\n--- Starting Phase 2: Scrolling Job List ---");
        try {
            // Call the modularized scrolling function
            await processAllJobCardsWithScrolling(page, user, campaignId, resumeId);
            console.log("Finished scrolling the current job list.");
        } catch (error) {
            console.error(`Error during Phase 2 (Scrolling Job List): ${error.message}`);
            throw error; // Re-throw the specific error from the service
        }


    } catch (error) {
        console.error(`An unhandled critical error occurred during the scraping process: ${error.message}`);
        // Ensure browser is closed on critical errors
        if (browser) {
            await browser.close();
            console.log("Browser closed due to error.");
        }
        throw error; // Re-throw to indicate overall failure
    }
}



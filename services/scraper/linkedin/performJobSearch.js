import { LOCATION_INPUT, TITLE_INPUT } from '../../../config/pageLocators.js';
import { typeLikeHuman, humanDelay } from '../../../utils/humanUtils.js';

export async function performJobSearch(page, { title = 'Software Developer', location = 'Canada' }) {
    console.log(`⌨️ Typing job location: "${location}" and title: "${title}"...`);

    try {
        // Step 1: Type location
        const locationInput = page.locator(LOCATION_INPUT());
        await locationInput.scrollIntoViewIfNeeded();
        // Click 3 times to select all existing text, then type to overwrite.
        await locationInput.click({ clickCount: 3 }); 
        await typeLikeHuman(locationInput, location);
        await humanDelay(500, 800);

        // Step 2: Type title
        const titleInput = page.locator(TITLE_INPUT());
        await titleInput.scrollIntoViewIfNeeded();
        await titleInput.click({ clickCount: 3 });
        await typeLikeHuman(titleInput, title);
        await humanDelay(500, 800);

        // ✨ THIS IS THE FIX. NO MORE CLICKING SUGGESTIONS. ✨
        // We simulate a real user hitting the "Enter" key to submit the search.
        // This is robust and not dependent on the unpredictable suggestion list.
        await titleInput.press('Enter');
        console.log('⌨️ Pressed "Enter" to trigger search.');

        // Give the page time to react to the search and load the results.
        await humanDelay(4000, 6000);

    } catch (err) {
        console.error('❌ Failed during job search:', err.message);
        throw err;
    }
}
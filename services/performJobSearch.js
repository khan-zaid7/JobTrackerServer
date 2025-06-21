import { typeLikeHuman, humanDelay, moveMouseLikeHuman } from '../utils/humanUtils.js';

export async function performJobSearch(page, { title = 'Software Developer', location = 'Canada' }) {
  console.log('⌨️ Typing job location and title...');

  try {
    // Step 1: Type location
    const locationInput = page.locator('input[id^="jobs-search-box-location-id"]');
    await locationInput.scrollIntoViewIfNeeded();
    await locationInput.click({ clickCount: 3 });
    await typeLikeHuman(locationInput, location);
    await humanDelay(800, 1200);

    // Step 2: Type title
    const titleInput = page.locator('input[id^="jobs-search-box-keyword-id"]');
    await titleInput.scrollIntoViewIfNeeded();
    await titleInput.click({ clickCount: 3 });
    await typeLikeHuman(titleInput, title);
    await humanDelay(800, 1200);

    // Step 3: Click first location suggestion to trigger search
    const suggestions = page.locator('.jobs-search-box__typeahead-results li');
    await suggestions.first().waitFor({ timeout: 5000 });

    const box = await suggestions.first().boundingBox();
    if (box) {
      await moveMouseLikeHuman(page, box.x + 10, box.y + 10);
      await suggestions.first().click();
      console.log('🖱️ Clicked first location suggestion — search triggered.');
    }

    await humanDelay(3000, 5000); // Let the page breathe

  } catch (err) {
    console.error('❌ Failed during job search:', err.message);
    throw err;
  }
}

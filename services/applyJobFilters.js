import { humanDelay, moveMouseLikeHuman } from '../utils/humanUtils.js';

export async function applyDatePostedFilter(page, options = {}) {
  try {
    const { datePosted = 'Past 24 hours', experienceLevel = 'Entry level' } = options;

    console.log(`⚙️ Applying Date posted filter...`);

    await humanDelay(1000, 2500);

    const filterButton = page.locator('button.search-reusables__filter-pill-button:has-text("Experience Level")');
    await filterButton.waitFor({ state: 'visible', timeout: 15000 });
    await filterButton.scrollIntoViewIfNeeded();
    await humanDelay(500, 1000);

    const box = await filterButton.boundingBox();
    if (box) {
      await moveMouseLikeHuman(page, box.x + 5, box.y + 5);
      await filterButton.click({ force: true });
    }

    // ✅ Wait for the dropdown menu and THEN assign `activeFilterMenu`
    await page.waitForSelector('.artdeco-hoverable-content__content:visible', { timeout: 15000 });
    const activeFilterMenu = page.locator('.artdeco-hoverable-content__content:visible');


    console.log(activeFilterMenu)
    await humanDelay(1000, 2000);

    const optionLocator = activeFilterMenu.locator(`.search-reusables__value-label:has-text("${experienceLevel}")`);
    await optionLocator.waitFor({ state: 'visible', timeout: 10000 });
    await optionLocator.scrollIntoViewIfNeeded();
    await humanDelay(300, 800);

    const optionBox = await optionLocator.boundingBox();
    if (optionBox) {
      await moveMouseLikeHuman(page, optionBox.x + 4, optionBox.y + 4);
      await optionLocator.click({ force: true });
      await humanDelay(500, 900);
    }

    const allShowButtons1 = activeFilterMenu.locator('button.artdeco-button--primary');
    const allShowButtons2 = page.locator('button.artdeco-button--primary');

    // Loop through and click the first one that is visible on screen
    const count1 = await allShowButtons1.count();
    const count2 = await allShowButtons2.count();
    const html = await allShowButtons1.innerHTML();
    console.log(html);

    console.log(`menu: `, count1);
    const isVisible = await allShowButtons1.isVisible();
    console.log('🔍 Visible?', isVisible);

    console.log(`page: `, count2);

    for (let i = 0; i < count2; i++) {
      const btn = allShowButtons2.nth(i);
      const isVisible = await btn.isVisible();
      console.log(`[${i}] Visible:`, isVisible);
    }


    const showResultsBtn = activeFilterMenu.locator('button.artdeco-button--primary')
      .filter({ hasText: /Show/i })
      .filter({ hasText: /result/i }); // Changed to singular
    // .first();

    // await showResultsBtn.waitFor({ state: 'visible', timeout: 15000 });
    await humanDelay(800, 1500);

    const btnBox = await showResultsBtn.boundingBox();
    if (btnBox) {
      await moveMouseLikeHuman(page, btnBox.x + 10, btnBox.y + 10);
      await showResultsBtn.click({ force: true });
      await page.waitForLoadState('networkidle');
      await humanDelay(2000, 3000);
    }

    console.log('✅ Date posted filter applied.');
  } catch (err) {
    console.error('❌ Failed to apply Date posted filter:', err);
    throw err;
  }
}

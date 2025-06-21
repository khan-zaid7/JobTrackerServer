import { humanDelay, moveMouseLikeHuman } from '../utils/humanUtils.js';

export async function applyFilter(page, options = {}) {
  const tab = {
    "Date posted": 'Past 24 hours',
    "Experience level": ['Entry level', 'Associate']
  };
  let counter = 1;
  for (const [key, value] of Object.entries(tab)) {
    console.log("---------------------------------", counter);
    await humanDelay(1000, 2500);
    await filterFunction(page, key, value);
    counter++;
  }
}

const filterFunction = async (page, filterLabel, filterName) => {
  try {
    console.log(`⚙️ Applying Date posted filter...`);

    await humanDelay(1000, 2500);

    const filterButton = page.locator(`button.search-reusables__filter-pill-button:has-text("${filterLabel}")`);
    await filterButton.waitFor({ state: 'visible', timeout: 15000 });
    await filterButton.scrollIntoViewIfNeeded();
    await humanDelay(500, 1000);

    const box = await filterButton.boundingBox();
    if (box) {
      await moveMouseLikeHuman(page, box.x + 5, box.y + 5);
      await filterButton.click({ force: true });
    }

    await page.waitForSelector('.artdeco-hoverable-content__content:visible', { timeout: 15000 });
    const activeFilterMenu = page.locator('.artdeco-hoverable-content__content:visible');

    console.log(activeFilterMenu);
    await humanDelay(1000, 2000);

    const filterNames = Array.isArray(filterName) ? filterName : [filterName];
    for (const name of filterNames) {
      const optionLocator = activeFilterMenu.locator(`.search-reusables__value-label:has-text("${name}")`);
      await optionLocator.waitFor({ state: 'visible', timeout: 10000 });
      await optionLocator.scrollIntoViewIfNeeded();
      await humanDelay(300, 800);

      const optionBox = await optionLocator.boundingBox();
      if (optionBox) {
        await moveMouseLikeHuman(page, optionBox.x + 4, optionBox.y + 4);
        await optionLocator.click({ force: true });
        await humanDelay(500, 900);
      }
    }

    const showResultsBtn = activeFilterMenu.locator('button.artdeco-button--primary')
      .filter({ hasText: /Show/i })
      .filter({ hasText: /result/i });

    await humanDelay(800, 1500);

    const btnBox = await showResultsBtn.boundingBox();
    if (btnBox) {
      await moveMouseLikeHuman(page, btnBox.x + 10, btnBox.y + 10);
      await showResultsBtn.click({ force: true });
      await page.waitForSelector('.job-card-container__link', { timeout: 15000 });
      await humanDelay(2000, 3000);
    }

    console.log('✅ Date posted filter applied.');
  } catch (err) {
    console.error('❌ Failed to apply Date posted filter:', err);
    throw err;
  }
};

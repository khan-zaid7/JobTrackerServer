import { humanDelay, moveMouseLikeHuman } from '../../../utils/humanUtils.js';
import {
  FILTER_BUTTON,
  ACTIVE_FILTER_MENU,
  FILTER_OPTION_LOCATOR,
  SHOW_RESULTS_BUTTON,
  JOB_CARD_CONTAINER_LINK
} from '../../../config/pageLocators.js';


export async function applyFilter(page, options = {
    "Date posted": 'Past 24 hours',
    // "Experience level": ['Entry level', 'Associate'] // <-- THIS LINE IS NOW COMMENTED OUT
  }) {

  let counter = 1;
  for (const [key, value] of Object.entries(options)) {
    console.log("---------------------------------", counter);
    await humanDelay(1000, 2500);
    await filterFunction(page, key, value);
    counter++;
  }
}

// The filterFunction remains completely unchanged.
const filterFunction = async (page, filterLabel, filterName) => {
  try {
    // Using dynamic logging as a small improvement
    console.log(`⚙️ Applying filter "${filterLabel}"...`);

    await humanDelay(1000, 2500);

    const filterButton = page.locator(FILTER_BUTTON(filterLabel));
    await filterButton.waitFor({ state: 'visible', timeout: 15000 });
    await filterButton.scrollIntoViewIfNeeded();
    await humanDelay(500, 1000);

    const box = await filterButton.boundingBox();
    if (box) {
      await moveMouseLikeHuman(page, box.x + 5, box.y + 5);
      await filterButton.click({ force: true });
    }

    await page.waitForSelector(ACTIVE_FILTER_MENU(), { timeout: 15000 });
    const activeFilterMenu = page.locator(ACTIVE_FILTER_MENU());

    await humanDelay(1000, 2000);

    const filterNames = Array.isArray(filterName) ? filterName : [filterName];
    for (const name of filterNames) {
      const optionLocator = activeFilterMenu.locator(FILTER_OPTION_LOCATOR(name));
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

    const showResultsBtn = activeFilterMenu.locator(SHOW_RESULTS_BUTTON())
      .filter({ hasText: /Show/i })
      .filter({ hasText: /result/i });

    await humanDelay(800, 1500);

    const btnBox = await showResultsBtn.boundingBox();
    if (btnBox) {
      await moveMouseLikeHuman(page, btnBox.x + 10, btnBox.y + 10);
      await showResultsBtn.click({ force: true });
      await page.waitForSelector(JOB_CARD_CONTAINER_LINK(), { timeout: 15000 });
      await humanDelay(2000, 3000);
    }

    console.log(`✅ Filter "${filterLabel}" applied.`);
  } catch (err) {
    console.error(`❌ Failed to apply filter "${filterLabel}":`, err);
    throw err;
  }
};
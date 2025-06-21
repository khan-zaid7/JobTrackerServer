import { humanDelay } from '../utils/humanUtils.js';

/**
 * Clicks on the Jobs nav item from the LinkedIn feed top navbar
 * @param {import('playwright').Page} page
 */
export async function clickJobsNav(page) {
  try {
    console.log('🧭 Looking for "Jobs" nav item...');

    // Target ONLY nav bar link with visible "Jobs" label
    const jobsNav = page.locator('nav.global-nav__nav a', {
      hasText: 'Jobs'
    });

    await jobsNav.scrollIntoViewIfNeeded();
    await humanDelay(1000, 3000);

    const box = await jobsNav.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 10, box.y + 10);
      await humanDelay(500, 1200);
    }

    console.log('🖱️ Clicking on "Jobs"...');
    await humanDelay(3000, 8000); // <-- simulate human hesitation before clicking
    await jobsNav.click();

    // Wait for the Jobs page to load
    await page.waitForURL('**/jobs/**', { timeout: 20000 });
    await humanDelay(3000, 10000); // <-- simulate user reading the Jobs page

    console.log('✅ Navigated to Jobs page.');
    return true;
  } catch (err) {
    console.error('❌ Failed to click "Jobs" nav:', err.message);
    throw err;
  }
}

// services/scrollJobsList.js

import { selectors } from '../config/pageLocators.js';

/**
 * Smoothly scrolls through the jobs list like a human using a trackpad.
 * @param {import('puppeteer').Page} page - The Puppeteer page object.
 */
export async function scrollJobsList(page) {
  console.log("🧍 Starting slow, human-like scroll through job list...");

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    await page.waitForSelector(selectors.scrollableJobsContainer, { visible: true, timeout: 10000 });

    let done = false;
    let lastScrollTop = -1;

    while (!done) {
      const { scrolledTop, maxScroll, reachedBottom } = await page.evaluate(({ selector }) => {
        const container = document.querySelector(selector);
        if (!container) return { reachedBottom: true, scrolledTop: 0, maxScroll: 0 };

        const maxScroll = container.scrollHeight - container.clientHeight;
        const randomDistance = Math.floor(Math.random() * (180 - 80 + 1)) + 80;

        container.scrollBy({ top: randomDistance, behavior: 'smooth' });

        return {
          scrolledTop: container.scrollTop,
          maxScroll,
          reachedBottom: container.scrollTop + container.clientHeight >= container.scrollHeight - 5,
        };
      }, { selector: selectors.scrollableJobsContainer });

      // If no movement or bottom reached, stop
      if (reachedBottom || scrolledTop === lastScrollTop) {
        console.log("🛑 Reached end of job list.");
        done = true;
        break;
      }

      lastScrollTop = scrolledTop;

      // Wait for smooth scroll animation and human pause
      const pause = Math.floor(Math.random() * (1500 - 500 + 1)) + 500;
      await delay(pause);
    }

    console.log("✅ Finished natural scroll of job list.");
  } catch (error) {
    console.error(`❌ Error during scroll: ${error.message}`);
    throw new Error(`ScrollJobsListError: ${error.message}`);
  }
}

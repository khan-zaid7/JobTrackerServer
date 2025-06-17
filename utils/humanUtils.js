// utils/humanUtils.js

/**
 * Simulates a human-like delay
 * @param {number} min - minimum delay in ms
 * @param {number} max - maximum delay in ms
 */
export async function humanDelay(min = 800, max = 2500) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise(resolve => setTimeout(resolve, delay));
}



/**
 * Simulates realistic human typing speed (25–45 WPM)
 * @param {import('playwright').Page} page
 * @param {string} text - The string to type
 */
export async function typeLikeHuman(page, text) {
  for (const char of text) {
    await page.keyboard.type(char);
    const delay = Math.floor(Math.random() * (480 - 267 + 1)) + 267; // Between 267ms and 480ms
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

/**
 * Simulate natural scrolling + pausing as if browsing the LinkedIn feed
 */
export async function simulateFeedScroll(page) {
  let previousHeight = 0;
  let currentHeight = 0;
  let attempts = 0;
  const maxAttempts = 3;
  let scrollSteps = 0;

  console.log('🧍 Browsing feed with real scroll pattern...');
  while (attempts < maxAttempts) {
    previousHeight = currentHeight;
    currentHeight = await page.evaluate(() => document.body.scrollHeight);

    const scrollChunk = Math.floor(currentHeight * (0.3 + Math.random() * 0.4));
    await page.evaluate((y) => {
      window.scrollBy(0, y);
    }, scrollChunk);
    scrollSteps++;

    await humanDelay(1500, 3500);

    // Occasionally simulate reading a post (once per session)
    if (scrollSteps === 2 && Math.random() > 0.3) {
      const readPause = Math.floor(Math.random() * 9000) + 1000; // 1s–10s
      console.log(`📖 Pausing to read a post... (${readPause}ms)`);
      await new Promise(resolve => setTimeout(resolve, readPause));
    }

    if (Math.random() > 0.7) {
      await page.evaluate(() => {
        window.scrollBy(0, -100);
      });
      await humanDelay(500, 1500);
    }

    const newHeight = await page.evaluate(() => document.body.scrollHeight);
    if (newHeight === currentHeight) {
      attempts++;
    } else {
      attempts = 0;
    }

    currentHeight = newHeight;
  }

  await smoothScrollToTop(page);
  await humanDelay(1000, 2000); // Final pause after returning to top
  console.log('🔼 Back on top. Ready to continue.');
}

/**
 * Smoothly scrolls back to the top in natural steps
 * @param {import('playwright').Page} page
 * @param {number} steps - Optional: how many scroll steps (default 10)
 */
export async function smoothScrollToTop(page, steps = 10) {
  const currentPosition = await page.evaluate(() => window.scrollY);
  if (currentPosition === 0) {
    return; // Already at top
  }

  const stepSize = currentPosition / steps;

  for (let i = 0; i < steps; i++) {
    const scrollY = currentPosition - stepSize * (i + 1);
    await page.evaluate(y => window.scrollTo(0, y), scrollY);
    await humanDelay(100, 250);
  }

  console.log(`🔼 Smooth-scrolled back to top in ${steps} steps`);
  await humanDelay(800, 1500);
}


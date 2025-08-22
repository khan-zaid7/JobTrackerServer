// createOrLoadSessionContext.js (Complete and Updated for Persistent Sessions)

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { loginToLinkedIn } from './loginToLinkedIn.js';
import { GLOBAL_NAV } from '../../../config/pageLocators.js'; // Adjust path if necessary

// --- Define a consistent, absolute path inside the container's working directory ---
// WORKDIR in your Dockerfile is /usr/src/app, so this resolves to /usr/src/app/sessions
const SESSION_DIR = path.resolve('sessions');
const STORAGE_FILE = path.join(SESSION_DIR, 'state.json');

/**
 * Launches a browser context: reuses session if saved, else performs login and saves it.
 * The session is now persisted to a Docker volume.
 */
export async function createOrLoadSessionContext() {
  // --- Ensure the target directory for the session file exists ---
  if (!fs.existsSync(SESSION_DIR)) {
    console.log(`[Session] Creating session directory at: ${SESSION_DIR}`);
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: false,
    slowMo: 50,
    // We use the bundled browser and require '--no-sandbox' for Docker
    args: ['--no-sandbox']
  });

  const hasSession = fs.existsSync(STORAGE_FILE);

  const context = hasSession
    ? await browser.newContext({ storageState: STORAGE_FILE })
    : await browser.newContext();

  const page = await context.newPage();

  if (hasSession) {
    console.log(`[Session] ✅ Loaded existing session from ${STORAGE_FILE}`);
    try {
      await page.goto('https://www.linkedin.com/feed', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(GLOBAL_NAV(), { timeout: 10000 });
      console.log('[Session] ✅ Session validated successfully.');
    } catch (error) {
      console.warn(`[Session] ⚠️ Session from ${STORAGE_FILE} is invalid. Forcing new login.`);
      fs.unlinkSync(STORAGE_FILE); // Delete the bad session file

      await loginToLinkedIn(page);
      await page.waitForSelector(GLOBAL_NAV());
      await context.storageState({ path: STORAGE_FILE });
      console.log(`[Session] 💾 New session saved to ${STORAGE_FILE}`);
    }
  } else {
    console.log(`[Session] No session found. Performing new login.`);
    await loginToLinkedIn(page);
    await page.waitForSelector(GLOBAL_NAV());
    await context.storageState({ path: STORAGE_FILE });
    console.log(`[Session] 💾 New session saved to ${STORAGE_FILE}`);
  }

  return { browser, context, page };
}
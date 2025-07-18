import { firefox } from 'playwright';
import fs from 'fs';
import path from 'path';
import { STORAGE_FILE } from '../config/constants.js';
import { loginToLinkedIn } from '../services/loginToLinkedIn.js';
import { GLOBAL_NAV } from '../config/pageLocators.js';

/**
 * Launches a browser context: reuses session if saved, else performs login and saves it.
 */
// helpers/createOrLoadSessionContext.js

export async function createOrLoadSessionContext() {
  const browser = await firefox.launch({ headless: false, slowMo: 50 });
  const sessionPath = path.resolve(STORAGE_FILE);
  const hasSession = fs.existsSync(sessionPath);

  const context = hasSession
    ? await browser.newContext({ storageState: sessionPath })
    : await browser.newContext();

  const page = await context.newPage();

  if (!hasSession) {
    await loginToLinkedIn(page);
    // await page.waitForURL('**/feed', { timeout: 15000 });
    await page.waitForSelector(GLOBAL_NAV);
    await context.storageState({ path: STORAGE_FILE });
    console.log('💾 Session saved to', STORAGE_FILE);
  } else {
    console.log('✅ Loaded existing session.');
    await page.goto('https://www.linkedin.com/feed', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(GLOBAL_NAV, { timeout: 10000 });
  }

  return { browser, context, page };
}

import { firefox } from 'playwright';
import fs from 'fs';
import path from 'path';
import { STORAGE_FILE } from '../config/constants.js';
import { loginToLinkedIn } from '../services/loginToLinkedIn.js';
import { clickJobsNav } from '../services/navigateToJobs.js';
/**
 * Launches a browser context: reuses session if saved, else performs login and saves it.
 */
export async function createOrLoadSessionContext() {
    const browser = await firefox.launch({ headless: false, slowMo: 50 });

    const sessionPath = path.resolve(STORAGE_FILE);
    const hasSession = fs.existsSync(sessionPath);

    const context = hasSession
        ? await browser.newContext({ storageState: sessionPath })
        : await browser.newContext(); // No session — new login

    const page = await context.newPage();

    if (!hasSession) {
        await loginToLinkedIn(page);
        await page.waitForURL('**/feed', { timeout: 15000 });
        await page.waitForSelector('#global-nav');
        await context.storageState({ path: STORAGE_FILE });
        console.log('💾 Session saved to', STORAGE_FILE);
    } else {
        console.log('✅ Loaded existing session.');
        await page.goto('https://www.linkedin.com/feed', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#global-nav', { timeout: 10000 });
    }

    // ✅ Always run this after session is ensured
    await clickJobsNav(page);

    return { browser, context, page };
}

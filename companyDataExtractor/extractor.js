// extractor.js

// --- 1. IMPORT THE STEALTH TOOLS ---
import { chromium } from 'playwright-extra';
import stealth from '@extra/playwright-stealth';

import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import he from 'he';

// --- 2. APPLY THE STEALTH PLUGIN ---
chromium.use(stealth());

// --- Constants (Increased Timeout) ---
const MIN_CONTENT_LENGTH = 500;
const PAGE_LOAD_TIMEOUT = 45000; // Increased to 45 seconds for tough sites

// The cleaner function remains the same, it's good.
function cleanNoisyHtml(html) {
    if (!html) return '';
    let text = html.replace(/<\/(p|div|h[1-6]|li|br|tr|article|section)>/gi, '\n');
    text = text.replace(/<[^>]+>/g, '');
    text = he.decode(text);
    return text.split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n');
}


export async function extractPageContent(targetUrl) {
    if (!targetUrl) {
        console.error('[Extractor] Received an invalid URL.');
        return { content: null, status: 'failed' };
    }

    console.log(`--- Starting Phase 2: Extraction for "${targetUrl}" ---`);
    let browser;
    try {
        // --- 3. LAUNCH THE STEALTH-ENABLED BROWSER ---
        browser = await chromium.launch({ headless: true });

        const context = await browser.newContext({
            // --- 4. USE A MORE HUMAN-LIKE USER AGENT ---
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        console.log(`[Step 4] Navigating stealthily...`);
        // --- 5. USE A MORE ROBUST WAITING STRATEGY ---
        // 'domcontentloaded' is faster and less likely to time out than 'networkidle'
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_LOAD_TIMEOUT });

        // Wait for a common element like 'footer' to ensure the page has likely rendered.
        console.log(`[Step 4] Waiting for page to render...`);
        await page.waitForSelector('body', { timeout: 15000 });

        // Try to find and click a cookie banner if it exists
        try {
            await page.click('button:has-text("Accept"), button:has-text("Agree"), button:has-text("Allow")', { timeout: 3000 });
            console.log('[Step 4] Clicked a cookie consent button.');
        } catch (e) {
            // It's fine if it doesn't exist
            console.log('[Step 4] No obvious cookie button found to click.');
        }

        const pageHtml = await page.content();
        const dom = new JSDOM(pageHtml, { url: targetUrl });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();

        if (article && article.content && article.content.length > MIN_CONTENT_LENGTH) {
            const cleanedContent = cleanNoisyHtml(article.content);
            return { content: cleanedContent, status: 'clean' };
        }

        const bodyHtml = await page.evaluate(() => document.body.innerHTML);
        const cleanedBodyText = cleanNoisyHtml(bodyHtml);
        return { content: cleanedBodyText, status: 'noisy' };

    } catch (error) {
        console.error(`[Extractor] CRITICAL FAILURE during extraction for ${targetUrl}: ${error.message}`);
        return { content: null, status: 'failed' };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
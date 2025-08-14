// index.js

import 'dotenv/config';
import axios from 'axios';
import { chromium } from 'playwright'; // The final tool for tough sites

// --- API Credentials from .env ---
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CX = process.env.GOOGLE_CX;
const SERPER_API_KEY = process.env.SERPER_API_KEY;

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Connection': 'keep-alive',
};

// A list of common slugs for "About Us" style pages.
const ABOUT_PAGE_SLUGS = [
    '/about', '/about-us', '/company', '/who-we-are', '/our-mission', '/aboutus'
];

// --- No changes needed to the helper functions below ---

async function performSearch(query) {
    if (GOOGLE_API_KEY && GOOGLE_CX) {
        try {
            console.log(`[Search Client] Attempting search with Google API...`);
            const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}`;
            const response = await axios.get(url);
            if (response.data.items && response.data.items.length > 0) {
                console.log(`[Search Client] Google API Success.`);
                return response.data.items.map(item => ({ link: item.link }));
            }
        } catch (error) {
            console.warn(`[Search Client] Google API failed. Reason: ${error.message}. Falling back to Serper.`);
        }
    }
    try {
        console.log(`[Search Client] Attempting search with Serper API...`);
        const response = await axios.post('https://google.serper.dev/search', { q: query }, { headers: { 'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json' }});
        if (response.data.organic && response.data.organic.length > 0) {
            console.log(`[Search Client] Serper API Success.`);
            return response.data.organic.map(item => ({ link: item.link }));
        }
    } catch (error) {
        console.error(`[Search Client] CRITICAL: Fallback Serper API also failed. Reason: ${error.message}`);
    }
    return null;
}

async function findOfficialDomain(companyName) {
    console.log(`[Step 2] Searching for official domain for: "${companyName}"`);
    const searchResults = await performSearch(`"${companyName}" official website`);
    if (searchResults) {
        for (const result of searchResults.slice(0, 3)) {
            const domain = new URL(result.link).hostname.replace(/^www\./, '');
            const cleanedCompanyName = companyName.toLowerCase().replace(/\s+/g, '');
            if (domain.includes(cleanedCompanyName)) {
                console.log(`[Step 2] Found plausible domain: ${domain}`);
                return domain;
            }
        }
    }
    console.warn(`[Step 2] Could not confidently determine an official domain for "${companyName}".`);
    return null;
}

async function probeAboutUrls(domain) {
    console.log(`[Step 3A] Probing common 'About Us' URLs for domain: ${domain}`);
    for (const slug of ABOUT_PAGE_SLUGS) {
        const url = `https://${domain}${slug}`;
        try {
            await axios.head(url, { timeout: 3000, headers: BROWSER_HEADERS });
            console.log(`[Step 3A] Success! Found valid page at: ${url}`);
            return url;
        } catch (error) {/* Expected to fail often */}
    }
    console.log(`[Step 3A] Probing failed to find a common 'About Us' page.`);
    return null;
}

// --- THIS IS THE FINAL, UPGRADED FUNCTION ---

/**
 * Uses a site search and then validates results using a full browser (Playwright)
 * to bypass advanced bot detection that blocks simple clients like axios.
 * @param {string} domain - The root domain to search within.
 * @returns {Promise<string|null>} A promise that resolves to a LIVE, valid URL or null.
 */
async function findAboutPageViaSiteSearch(domain) {
    console.log(`[Step 3B] Performing targeted site search for 'About Us' page on: ${domain}`);
    const searchResults = await performSearch(`site:${domain} "about us" OR "our mission" OR "who we are"`);

    if (!searchResults || searchResults.length === 0) {
        console.log(`[Step 3B] Targeted site search yielded no initial results.`);
        return null;
    }
    
    console.log(`[Step 3B] Found ${searchResults.length} potential candidates. Validating with a full browser (Playwright)...`);
    
    // Launch the browser once for efficiency.
    const browser = await chromium.launch();
    const context = await browser.newContext({ extraHTTPHeaders: BROWSER_HEADERS });

    try {
        for (const result of searchResults) {
            const potentialUrl = result.link;
            
            // Skip subdomains to avoid client project pages.
            if (!potentialUrl.startsWith(`https://${domain}`) && !potentialUrl.startsWith(`https://www.${domain}`)) {
                continue;
            }

            const page = await context.newPage();
            try {
                console.log(`[Step 3B] Validating with browser: ${potentialUrl}`);
                // page.goto() is the key. It executes JavaScript and bypasses security challenges.
                const response = await page.goto(potentialUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
                
                if (response && response.ok()) {
                    console.log(`[Step 3B] SUCCESS! Browser confirmed URL is live: ${potentialUrl}`);
                    return potentialUrl; // We found the first live, valid link. We're done.
                } else {
                    console.warn(`[Step 3B] Browser loaded, but page status was not 'ok' for: ${potentialUrl}`);
                }
            } catch (error) {
                console.warn(`[Step 3B] Browser failed to load (stale link or blocked): ${potentialUrl}`);
            } finally {
                // Always close the page to free up resources.
                await page.close();
            }
        }
    } finally {
        // ALWAYS close the browser when the function is done.
        await browser.close();
    }

    console.warn(`[Step 3B] No LIVE 'About Us' page was found on the root domain after checking all candidates.`);
    return null;
}


// --- The main orchestrator function's logic remains the same and is correct ---

export async function getCompanyAboutPageUrl(companyName) {
    console.log(`\n--- Starting Phase 1: Discovery for "${companyName}" ---`);
    if (!companyName) {
        console.error("Company name cannot be empty.");
        return null;
    }
    const domain = await findOfficialDomain(companyName);
    if (!domain) {
        console.error(`--- Phase 1 Failed: Could not determine domain for "${companyName}". ---`);
        return null;
    }

    // Attempt 1: Fast & Free
    let aboutUrl = await probeAboutUrls(domain);
    if (aboutUrl) {
        console.log(`--- Phase 1 Success: Final URL for "${companyName}" is ${aboutUrl} ---`);
        return aboutUrl;
    }

    // Attempt 2: Powerful & Resourceful
    aboutUrl = await findAboutPageViaSiteSearch(domain);
    if (aboutUrl) {
        console.log(`--- Phase 1 Success: Final URL for "${companyName}" is ${aboutUrl} ---`);
        return aboutUrl;
    }

    // Fallback: Default to homepage if all else fails
    const fallbackUrl = `https://${domain}`;
    console.warn(`[Fallback] Could not find a specific 'About Us' page. Defaulting to homepage: ${fallbackUrl}`);
    console.log(`--- Phase 1 Success (via Fallback): Final URL for "${companyName}" is ${fallbackUrl} ---`);
    return fallbackUrl;
}

// --- Example Usage ---
console.log("--- Running examples with dual-API client and Playwright validation ---");
await getCompanyAboutPageUrl("Microsoft");
await getCompanyAboutPageUrl("Lumenalta");
await getCompanyAboutPageUrl("OpenAI"); // The ultimate test case
await getCompanyAboutPageUrl("Cybertron Technologies");
await getCompanyAboutPageUrl("NonExistent Company 12345");
console.log("\n--- Examples complete ---");
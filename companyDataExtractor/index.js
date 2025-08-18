// index.js

import 'dotenv/config';
import axios from 'axios';
import { chromium } from 'playwright';
import { extractPageContent } from './extractor.js';
import { triageContent } from './triage.js';

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

// Common "About Us" slugs
const ABOUT_PAGE_SLUGS = ['/about', '/about-us', '/company', '/who-we-are', '/our-mission', '/aboutus'];

// --- Search with region support ---
async function performSearch(query, region = 'CA') {
    if (GOOGLE_API_KEY && GOOGLE_CX) {
        try {
            console.log(`[Search Client] Attempting search with Google API...`);
            const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}&gl=${region}`;
            const response = await axios.get(url);
            if (response.data.items && response.data.items.length > 0) {
                console.log(`[Search Client] Google API Success.`);
                return response.data.items.map(item => ({ link: item.link }));
            }
        } catch (error) {
            console.warn(`[Search Client] Google API failed: ${error.message}. Falling back to Serper.`);
        }
    }

    try {
        console.log(`[Search Client] Attempting search with Serper API...`);
        const response = await axios.post(
            'https://google.serper.dev/search',
            { q: query, gl: region },
            { headers: { 'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json' } }
        );
        if (response.data.organic && response.data.organic.length > 0) {
            console.log(`[Search Client] Serper API Success.`);
            return response.data.organic.map(item => ({ link: item.link }));
        }
    } catch (error) {
        console.error(`[Search Client] CRITICAL: Fallback Serper API also failed: ${error.message}`);
    }

    return null;
}

// --- Find official domain ---
async function findOfficialDomain(companyName, region = 'CA') {
    console.log(`[Step 2] Searching for official domain for: "${companyName}" in region: ${region}`);
    const query = `"${companyName}" official website`;
    const searchResults = await performSearch(query, region);

    if (!searchResults || searchResults.length === 0) {
        console.warn(`[Step 2] No search results found for "${companyName}" in region: ${region}.`);
        return null;
    }

    const companyWords = companyName
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(word => word.length > 2);

    console.log(`[Step 2] Meaningful company words: ${companyWords.join(', ')}`);

    for (const result of searchResults.slice(0, 5)) {
        try {
            const domain = new URL(result.link).hostname.replace(/^www\./, '').toLowerCase();
            const cleanedDomain = domain.replace(/[^a-z0-9]/g, '');
            if (companyWords.some(word => cleanedDomain.includes(word))) {
                console.log(`[Step 2] Found plausible domain: ${domain}`);
                return domain;
            }
            console.log(`[Step 2] Skipping domain (no match): ${domain}`);
        } catch (err) {
            console.warn(`[Step 2] Skipping invalid URL: ${result.link}`);
        }
    }

    console.warn(`[Step 2] Could not confidently determine an official domain for "${companyName}" in region: ${region}.`);
    return null;
}

// --- Probe common About Us slugs ---
async function probeAboutUrls(domain) {
    console.log(`[Step 3A] Probing common 'About Us' URLs for domain: ${domain}`);
    for (const slug of ABOUT_PAGE_SLUGS) {
        const url = `https://${domain}${slug}`;
        try {
            await axios.head(url, { timeout: 3000, headers: BROWSER_HEADERS });
            console.log(`[Step 3A] Success! Found valid page at: ${url}`);
            return url;
        } catch (error) {/* Expected to fail */ }
    }
    console.log(`[Step 3A] No common 'About Us' page found.`);
    return null;
}

// --- Validate via Playwright ---
async function findAboutPageViaSiteSearch(domain, region = 'CA') {
    console.log(`[Step 3B] Performing targeted site search for 'About Us' on: ${domain}`);
    const searchResults = await performSearch(`site:${domain} "about us" OR "our mission" OR "who we are"`, region);

    if (!searchResults || searchResults.length === 0) return null;

    console.log(`[Step 3B] Found ${searchResults.length} candidates. Validating with Playwright...`);
    const browser = await chromium.launch();
    const context = await browser.newContext({ extraHTTPHeaders: BROWSER_HEADERS });

    try {
        for (const result of searchResults) {
            const potentialUrl = result.link;
            if (!potentialUrl.startsWith(`https://${domain}`) && !potentialUrl.startsWith(`https://www.${domain}`)) continue;

            const page = await context.newPage();
            try {
                console.log(`[Step 3B] Validating: ${potentialUrl}`);
                const response = await page.goto(potentialUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
                if (response && response.ok()) return potentialUrl;
            } catch { }
            finally { await page.close(); }
        }
    } finally {
        await browser.close();
    }

    return null;
}

// --- Main orchestrator ---
export async function getCompanyAboutPageUrl(companyName, region = 'CA') {
    console.log(`\n--- Starting Phase 1: Discovery for "${companyName}" ---`);
    if (!companyName) return null;

    const domain = await findOfficialDomain(companyName, region);
    if (!domain) {
        console.error(`--- Phase 1 Failed: Could not determine domain for "${companyName}". ---`);
        return null;
    }

    let aboutUrl = await probeAboutUrls(domain);
    if (aboutUrl) return aboutUrl;

    aboutUrl = await findAboutPageViaSiteSearch(domain, region);
    if (aboutUrl) return aboutUrl;

    const fallbackUrl = `https://${domain}`;
    console.warn(`[Fallback] Defaulting to homepage: ${fallbackUrl}`);
    return fallbackUrl;
}

const companyName = "Microsoft";

const aboutUrl = await getCompanyAboutPageUrl(companyName);


// --- PHASE 2 ---
const extractionResult = await extractPageContent(aboutUrl); // <-- USE THE NEW FUNCTION

// --- PREPARE FOR PHASE 3 ---
if (extractionResult.status === 'failed') {
    console.error(`--- Pipeline Failed at Phase 2 for "${companyName}". ---`);
}

console.log(`\n--- Pipeline Complete for now ---`);
console.log({
    companyName: companyName,
    discoveredUrl: aboutUrl,
    extractionStatus: extractionResult.status,
    extractedContent: extractionResult.content
});

const extractedContent = await triageContent(extractionResult.content);
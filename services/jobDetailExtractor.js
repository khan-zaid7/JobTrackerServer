// extractors/jobDetailExtract.js
import { DateTime } from 'luxon'; // if not available, you can use JS Date manually
import { callDeepSeekAPI } from '../utils/deepseek.js';

/**
 * Master function to extract all job detail fields.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ title: string | null, location: string | null, postedAt: string | null }>}
 */
export default async function extractJobDetails(page) {
    const title = await extractTitle(page);
    const location = await extractLocation(page);
    const postedAgoText = await extractPostedAt(page);
    const postedAt = postedAgoText ? parsePostedTime(postedAgoText) : null;
    const isProfileQualified = await extractIsProfileQualified(page);
    const description = await extractJobDescription(page);
    const url = await extractJobUrl(page);
    const companyName = await extractCompanyName(page);

    return {
        title,
        location,
        postedAt,
        isProfileQualified,
        description,
        url,
        companyName
    };
}

/**
 * Extracts job title from LinkedIn job detail view.
 */
async function extractTitle(page) {
    const selector = 'div.job-details-jobs-unified-top-card__job-title h1.t-24.t-bold.inline a';
    try {
        return await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            return el?.innerText?.trim() || null;
        }, selector);
    } catch (err) {
        console.error("❌ Failed to extract title:", err);
        return null;
    }
}

// ⏰ Convert "14 hours ago" to absolute time in America/Toronto
function parsePostedTime(text) {
    const now = DateTime.now().setZone('America/Toronto');

    const match = text.match(/(\d+)\s+(minute|hour|day)s?\s+ago/i);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    const postedDateTime = now.minus({ [unit + 's']: value });
    return postedDateTime.toFormat('hh:mm a');
}

// 📍 Extract job location
async function extractLocation(page) {
    return await page.evaluate(() => {
        const container = document.querySelector('.job-details-jobs-unified-top-card__primary-description-container');
        if (!container) return null;

        const locationEl = container.querySelector('.tvm__text--low-emphasis');
        return locationEl?.innerText?.trim() || null;
    });
}

// ⏱️ Extract "14 hours ago" and convert it
async function extractPostedAt(page) {
    return await page.evaluate(() => {
        const container = document.querySelector('.job-details-jobs-unified-top-card__primary-description-container');
        if (!container) return null;

        const strongEl = container.querySelector('strong');
        return strongEl?.innerText?.trim() || null;
    });
}

async function extractIsProfileQualified(page) {
    return await page.evaluate(() => {
        const container = document.querySelector('.job-details-fit-level-card');
        if (!container) return null;

        const headingEl = container.querySelector('h2 strong');
        if (!headingEl) return null;

        const rawText = headingEl.innerText.trim().toLowerCase();

        const cleaned = rawText.replace(/\s+/g, ' ').trim();

        // Match variants
        if (/missing.*required.*qualification/.test(cleaned)) {
            return { status: 'missing', percentage: 33 };
        } else if (/match(es|ing)?\s+(some|a few)\s+required.*qualification/.test(cleaned)) {
            return { status: 'some', percentage: 60 };
        } else if (/match(es|ing)?\s+(several|many)\s+required.*qualification/.test(cleaned)) {
            return { status: 'several', percentage: 80 };
        } else if (/match(es|ing)?.*all.*required.*qualification/.test(cleaned)) {
            return { status: 'perfect', percentage: 100 };
        }

        return { status: 'unknown', percentage: null, raw: cleaned };
    });
}


/**
 * Extracts sections from a job post page using a hybrid method:
 * 1. Try DOM-based header parsing.
 * 2. Fallback to DeepSeek LLM if missing or incomplete.
 * 
 * @param {import('playwright').Page} page 
 * @returns {Promise<{ responsibilities?: string, qualifications?: string, benefits?: string }>}
 */
export async function extractJobDescription(page) {
    const contentHandle = await page.$('.jobs-description__content');
    if (!contentHandle) {
        console.warn('❌ No job description container found.');
        return {
                responsibilities: '',
                qualifications: '',
                benefits: ''
        };
    }

    // Just fetch raw HTML for DeepSeek — skip DOM parsing completely
    const rawHTML = await contentHandle.evaluate(el => el.innerHTML);

    const systemPrompt = `You are a job description parser. You extract and clean specific sections from raw HTML job descriptions.`;

    const userPrompt = `
Extract the following fields from this raw HTML of a job post. Return only JSON, no explanation.

- responsibilities: Clear description of what the candidate is expected to do.
- qualifications: Skills, experience, degrees, or traits required.
- benefits: Perks, salary, healthcare, PTO, etc.

HTML:
${rawHTML}
`;

    try {
        const parsed = await callDeepSeekAPI(systemPrompt, userPrompt);
        return {
            responsibilities: parsed.responsibilities || '',
            qualifications: parsed.qualifications || '',
            benefits: parsed.benefits || ''
        };
    } catch (e) {
        console.error("❌ Failed to parse with DeepSeek:", e);
        return {
            responsibilities: '',
            qualifications: '',
            benefits: ''
        };
    }
}

async function extractJobUrl(page) {
    try {
        return page.url(); // Playwright's built-in method to get current page URL
    } catch (err) {
        console.error("❌ Failed to extract job URL:", err);
        return null;
    }
}

async function extractCompanyName(page) {
    try {
        return await page.evaluate(() => {
            const el = document.querySelector('.job-details-jobs-unified-top-card__company-name a');
            return el?.innerText?.trim() || null;
        });
    } catch (err) {
        console.error("❌ Failed to extract company name:", err);
        return null;
    }
}

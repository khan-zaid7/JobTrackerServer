// extractors/jobDetailExtract.js
import { DateTime } from 'luxon'; // if not available, you can use JS Date manually
import { callAIAPI } from '../../../utils/aiClient.js';

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
    
    // ✨ THIS IS THE CRITICAL FIX: THE GUARD CLAUSE ✨
    // Before returning, we validate that the most important data was actually found.
    if (!title || !companyName) {
        // If we are missing a title or company name, this job data is corrupt.
        // We throw a specific error that the calling function can catch.
        // This stops us from ever trying to save an invalid job to the database.
        throw new Error(`Data extraction failed: Missing required fields (title: ${title}, companyName: ${companyName})`);
    }

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
    console.info('Started fetching descprtion');
    const systemPrompt = `
        You are a specialized HTML-to-JSON extraction model focused on job listings.

        Your purpose is to convert messy or inconsistent job description HTML into accurate, structured data. You do this by understanding the **meaning** of the content — not relying on visual formatting, tags, or headings.

        Your results must be reliable, clean, and complete. Prioritize semantic accuracy and real-world usefulness.
        `;


    const userPrompt = `
        You are analyzing raw HTML taken from a job listing. Your task is to extract structured information about the role, even if the content is unorganized, the headings are missing, or the format is inconsistent.

        Return a valid JSON object with **all three fields**, as shown below:

        - "responsibilities" (REQUIRED): List the tasks, duties, or deliverables expected of the candidate. This may appear anywhere — at the start, middle, or end — and must be extracted based on meaning, not section titles.
        - "qualifications" (REQUIRED): Extract any listed or implied skills, experiences, education, or credentials the employer is seeking. Look across the entire HTML. Do not skip this field, even if a heading like “Qualifications” is missing.
        - "benefits": Include any perks, compensation info, PTO, health coverage, bonuses, or internal culture notes that serve the employee.
        - "relatedReferences": Extract any email addresses, phone numbers, or LinkedIn profile links mentioned in the HTML.

        Mandatory Requirements:
        - You **must extract responsibilities and qualifications**. If headings are missing, **infer** based on sentence meaning and phrasing.
        - If content is embedded in a general paragraph, still extract it.
        - If one section overlaps with another, divide the content based on logical meaning.
        - If no benefits are mentioned, return an empty string for "benefits".

        Output Rules:
        - Only return a well-formed JSON object with the fields: responsibilities, qualifications, and benefits.
        - Do not return any extra commentary, explanation, or HTML.

        HTML to analyze:
        ${rawHTML}
        `;



    try {
        const parsed = await callAIAPI(systemPrompt, userPrompt);
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
        const fullUrl = page.url();
        const urlObj = new URL(fullUrl);

        const jobId = urlObj.searchParams.get('currentJobId');

        if (jobId) {
            return `https://www.linkedin.com/jobs/view/${jobId}`;
        }

        console.warn("⚠️ Could not extract jobId from URL:", fullUrl);
        return null;
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

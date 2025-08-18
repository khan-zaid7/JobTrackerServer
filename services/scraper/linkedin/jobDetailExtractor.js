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

    if (!title || !companyName) {
        // This stops us from ever trying to save an invalid job to the database.
        console.warn(`Data extraction failed: Missing required fields (title: ${title}, companyName: ${companyName})`);
    }
    
    if (description.language && description.language.toLowerCase() !== 'english') {
        // This is a non-English job, so we reject it.
        console.log(`[Gatekeeper] Rejecting job. Reason: Language is '${description.language}', not 'english'.`);
        return null; // Or `return true;` to exit the function.
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
            roleOverview: '',
            responsibilities: '',
            qualifications: '',
            benefits: ''
        };
    }

    // Just fetch raw HTML for DeepSeek — skip DOM parsing completely
    const rawHTML = await contentHandle.evaluate(el => el.innerHTML);
    console.info('Started fetching descprtion');
    const systemPrompt = `
        You are a world class and elite level HTML data sanitizer and extractor. You are given a raw HTML content of a Job Description and you are asked to clean that content. With your powerful and elite capabilites you can sanitize that data to remove all the unnessesray bluff and html markup lanaguge to fetch and convert only rich text into a json blueprint that an later AI can use to extract relevant and important infromation regarding the Role overview, Responsibilties of the role, Qualifications required for the role and benifits if any.  
        `;


    const userPrompt = `
        Your task is to populate the following JSON blueprint. Analyze the provided HTML and extract the relevant information into the correct fields.

    ### JSON Blueprint ###
    {
        "role_overview": {
            "title": "a string (if available)",
            "company": "a string (if available)",
            "summary": "a string (if available)",
            "work_model": "a string like 'Remote', 'On-site', or 'Hybrid' (if explicitly mentioned)"
        },
        "responsibilities": [
           "an Array of tasks (if available)"
        ],
        "qualifications": {
            "required": [
                "an Array of mandatory skills/experience (if available)"
            ],
            "desired": [
                "an Array of non-mandatory skills, often marked as 'preferred', 'a plus', or 'nice to have' (if available)"
            ]
        },
        "benefits": [
           "an Array of perks for the employee, (if available)"
        ]
        "language": "Analyze the entire HTML document. Determine the primary language the text is written in. Return the full name of the language (e.g., 'French', 'English'). This is an analysis task, not an extraction task."
    }

    ### HTML to Analyze: ###
    ${rawHTML}
        `;



    try {
        const parsed = await callAIAPI(systemPrompt, userPrompt);
        console.log(JSON.stringify(parsed));

        return {
            roleOverview: {
                title: parsed.role_overview?.title ?? null,
                company: parsed.role_overview?.company ?? null,
                summary: parsed.role_overview?.summary ?? null,
                work_model: parsed.role_overview?.work_model ?? null
            },
            responsibilities: parsed.responsibilities ?? [],
            qualifications: {
                required: parsed.qualifications?.required ?? [],
                desired: parsed.qualifications?.desired ?? []
            },
            benefits: parsed.benefits ?? [],
            language: parsed.language ?? []
        };
    } catch (e) {
        console.error("❌ Failed to parse with AI:", e);

        // ✅ RETURN A CONSISTENT EMPTY SCHEMA ON ERROR
        // This ensures the function always returns the same "shape" of object,
        // which prevents errors in the code that uses this function's output.
        return {
            roleOverview: {
                title: null,
                company: null,
                summary: null,
                work_model: null
            },
            responsibilities: [],
            qualifications: {
                required: [],
                desired: []
            },
            benefits: []
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

import ScrapedJob from '../models/ScrapedJob.js';
import Campaign from '../models/Campaign.js';
import Resume from '../models/Resume.js';
import { getChannel } from '../services/queue.js';
import { v4 as uuidv4 } from 'uuid';
import { callAIAPI } from '../utils/aiClient.js';

/**
 * Create a manual job entry
 * POST /api/manual-jobs
 */
export const createManualJob = async (req, res) => {
    try {
        const userId = req.user.id;

        // Validate required fields
        const {
            title,
            url,
            companyName,
            location,
            postedTime,
            description,
            relatedReferences = {},
            forceTailoring = false,
            resumeId
        } = req.body;

        // Basic validation
        if (!title || !url || !companyName) {
            return res.status(400).json({
                error: 'Missing required fields: title, url, companyName'
            });
        }

        // Find the master resume for the user (automatically)
        const resume = await Resume.findOne({ _id: resumeId, createdBy: userId }).lean();

        if (!resume) {
            return res.status(404).json({
                error: 'No resume found for user'
            });
        }

        // Get or create default campaign
        const defaultCampaignId = await getOrCreateDefaultCampaign(userId);

        // Parse and normalize description using AI
        console.log('🔍 Processing job description...');
        const normalizedDescription = await normalizeDescription(description);

        // Prepare job data structure (matching ScrapedJob schema)
        const jobData = {
            title,
            url,
            companyName,
            location: location || null,
            postedAt: postedTime || null,
            description: normalizedDescription,
            relatedReferences: normalizeReferences(relatedReferences),
            createdBy: userId,
            campaignId: defaultCampaignId,
            resumeId: resume._id.toString(), // Use the found resume's ID
            isRelevant: true, // Manual jobs are considered relevant by default
            confidenceFactor: 100 // Manual entry = 100% confidence
        };

        // Save job using the existing ScrapedJob method
        const savedJob = await ScrapedJob.saveJobIfNotExists(jobData);

        if (!savedJob) {
            return res.status(409).json({
                error: 'Job with this URL already exists for this user'
            });
        }

        // Prepare queue message (same structure as jobCardProcessor)
        const queueMessage = {
            ...jobData,
            jobId: savedJob._id.toString(),
            campaignId: defaultCampaignId,
            resumeId: resume._id.toString(), // Use the found resume's ID
            isManualJob: true,
            forceTailoring: forceTailoring
        };

        // Send to match queue
        const channel = getChannel();
        if (channel) {
            const MATCH_QUEUE_NAME = 'jobs.match';
            await channel.assertQueue(MATCH_QUEUE_NAME, { durable: true });

            channel.sendToQueue(
                MATCH_QUEUE_NAME,
                Buffer.from(JSON.stringify(queueMessage)),
                { persistent: true }
            );

            console.log(`🚀 Manual job ${savedJob._id} sent to match queue`);
        } else {
            console.warn('⚠️ Queue channel not available, job saved but not queued for matching');
        }

        res.status(201).json({
            message: 'Manual job created successfully',
            jobId: savedJob._id,
            campaignId: defaultCampaignId,
            queuedForMatching: !!channel
        });

    } catch (error) {
        console.error('Error creating manual job:', error);
        res.status(500).json({
            error: 'Failed to create manual job',
            details: error.message
        });
    }
};

/**
 * Get or create the default campaign for manual jobs
 */
const getOrCreateDefaultCampaign = async (userId) => {
    const defaultCampaignName = 'Direct Applications';

    // Try to find existing default campaign
    let defaultCampaign = await Campaign.findOne({
        userId: userId,
        targetRole: defaultCampaignName
    });

    if (!defaultCampaign) {
        // Create new default campaign
        const campaignId = uuidv4();
        defaultCampaign = await Campaign.create({
            _id: campaignId,
            userId: userId,
            targetRole: defaultCampaignName,
            status: 'running'
        });

        console.log(`✅ Created default campaign "${defaultCampaignName}" for user ${userId}`);
    }

    return defaultCampaign._id;
};

/**
 * Normalize description using AI to parse string content into structured arrays
 */
const normalizeDescription = async (description = {}) => {
    try {
        // If already in array format, return as-is
        if (Array.isArray(description.responsibilities) && 
            Array.isArray(description.qualifications?.required) &&
            Array.isArray(description.qualifications?.desired) &&
            Array.isArray(description.benefits)) {
            return {
                roleOverview: {
                    title: description.roleOverview?.title || null,
                    company: description.roleOverview?.company || null,
                    summary: description.roleOverview?.summary || null,
                    work_model: description.roleOverview?.work_model || null
                },
                responsibilities: description.responsibilities,
                qualifications: {
                    required: description.qualifications.required,
                    desired: description.qualifications.desired
                },
                benefits: description.benefits
            };
        }

        // Prepare content for AI parsing
        const contentToParse = {
            responsibilities: description.responsibilities || '',
            requiredQualifications: description.qualifications?.required || '',
            desiredQualifications: description.qualifications?.desired || '',
            benefits: description.benefits || ''
        };

        const systemPrompt = `You are a job description parser. Your task is to take unstructured text content from job descriptions and convert them into clean, structured arrays.

Rules:
1. Parse bullet points, numbered lists, and paragraph text into individual array items
2. Remove markdown formatting (*, **, #, etc.) but keep the content
3. Clean up extra whitespace and normalize text
4. Split on logical boundaries (bullet points, line breaks, sentences for benefits)
5. Each array item should be a complete, standalone statement
6. Remove empty items and duplicates
7. Keep technical terms and specific requirements intact

Expected output format:
{
  "responsibilities": ["item1", "item2", "item3"],
  "requiredQualifications": ["req1", "req2", "req3"],
  "desiredQualifications": ["des1", "des2", "des3"],
  "benefits": ["benefit1", "benefit2", "benefit3"]
}`;

        const userPrompt = `Please parse the following job description content into structured arrays:

RESPONSIBILITIES:
${contentToParse.responsibilities}

REQUIRED QUALIFICATIONS:
${contentToParse.requiredQualifications}

DESIRED QUALIFICATIONS:
${contentToParse.desiredQualifications}

BENEFITS:
${contentToParse.benefits}

Parse each section into clean array items. Return the result as JSON.`;

        console.log('🤖 Parsing job description with AI...');
        const aiResponse = await callAIAPI(systemPrompt, userPrompt, { model: 'gpt-4o-mini' });

        // Validate AI response structure
        if (!aiResponse || typeof aiResponse !== 'object') {
            throw new Error('Invalid AI response format');
        }

        console.log('✅ AI parsing completed successfully');

        return {
            roleOverview: {
                title: description.roleOverview?.title || null,
                company: description.roleOverview?.company || null,
                summary: description.roleOverview?.summary || null,
                work_model: description.roleOverview?.work_model || null
            },
            responsibilities: Array.isArray(aiResponse.responsibilities) 
                ? aiResponse.responsibilities 
                : [],
            qualifications: {
                required: Array.isArray(aiResponse.requiredQualifications) 
                    ? aiResponse.requiredQualifications 
                    : [],
                desired: Array.isArray(aiResponse.desiredQualifications) 
                    ? aiResponse.desiredQualifications 
                    : []
            },
            benefits: Array.isArray(aiResponse.benefits) 
                ? aiResponse.benefits 
                : []
        };

    } catch (error) {
        console.error('⚠️ AI parsing failed, falling back to basic parsing:', error.message);
        
        // Fallback to basic string splitting if AI fails
        return {
            roleOverview: {
                title: description.roleOverview?.title || null,
                company: description.roleOverview?.company || null,
                summary: description.roleOverview?.summary || null,
                work_model: description.roleOverview?.work_model || null
            },
            responsibilities: parseStringToArray(description.responsibilities),
            qualifications: {
                required: parseStringToArray(description.qualifications?.required),
                desired: parseStringToArray(description.qualifications?.desired)
            },
            benefits: parseStringToArray(description.benefits)
        };
    }
};

/**
 * Fallback function to parse string content into arrays using basic text processing
 */
const parseStringToArray = (text) => {
    if (!text || typeof text !== 'string') return [];
    
    // Split on bullet points, numbers, or line breaks
    const items = text
        .split(/\n|•|\*|\d+\./)
        .map(item => item.trim())
        .filter(item => item.length > 0)
        .map(item => item.replace(/^\*+\s*/, '').trim()) // Remove leading asterisks
        .filter(item => item.length > 3); // Remove very short items
    
    return items;
};

/**
 * Normalize references to match ScrapedJob schema structure
 */
const normalizeReferences = (references = {}) => {
    return {
        email: references.email || null,
        phone: references.phone || null,
        linkedin: references.linkedin || null
    };
};
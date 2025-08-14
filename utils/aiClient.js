import dotenv from 'dotenv';
import axios from 'axios';
import http from 'http';
import https from 'https';

dotenv.config();

// Create a reusable, robust Axios instance with keepAlive enabled for performance.
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

// --- THE PRIMARY OPENAI API CLIENT ---
const openaiClient = axios.create({
    baseURL: 'https://api.openai.com/v1',
    httpAgent,
    httpsAgent,
    timeout: 120000, // 120-second timeout for long creative tasks
    headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
    }
});

/*
// --- COMMENTED OUT: THE OLD DEEPSEEK API CLIENT ---
const deepseekClient = axios.create({
    baseURL: 'https://api.deepseek.com/v1',
    httpAgent,
    httpsAgent,
    timeout: 60000,
    headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_APIKEY}`,
        'Content-Type': 'application/json'
    }
});
*/

/**
 * A utility function to introduce a delay for retries.
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));


/**
 * Calls a specified AI API with robust retry and dynamic token logic.
 *
 * @param {string} systemPrompt The system prompt to guide the model.
 * @param {string} userPrompt The user's request or content.
 * @param {object} [options={}] Optional parameters.
 * @param {string} [options.model='gpt-4o-mini'] The model to use.
 * @returns {Promise<object|string>} A promise that resolves to a parsed JSON object or raw string.
 */
export const callAIAPI = async (systemPrompt, userPrompt, options = {}) => {
    // Default to the cost-effective OpenAI model
    const { model = 'gpt-4o-mini' } = options;

    const MAX_ATTEMPTS = 3;
    const RETRY_DELAY_MS = 2000;
    
    // Start with a reasonable token limit, ready to expand if needed.
    let currentMaxTokens = 4096;
    const MAX_POSSIBLE_TOKENS = 16384; // A safe upper limit for most models

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            // ✨ THE FIX: The request body is built cleanly here with no duplicate keys. ✨
            const body = {
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                response_format: { "type": "json_object" }, // Request JSON output
                temperature: 0.6,                          // Low temp for predictability
                max_tokens: currentMaxTokens,              // Use the dynamic token limit
            };

            console.log(`[AI Client] Attempt ${attempt}: Calling model '${model}' with max_tokens=${currentMaxTokens}...`);
            
            const response = await openaiClient.post('/chat/completions', body);

            const choice = response.data.choices[0];
            const content = choice?.message?.content;
            const finishReason = choice?.finish_reason;

            // ✨ THE FIX: Check for truncation first. ✨
            if (finishReason === 'length') {
                const nextMax = Math.min(currentMaxTokens * 2, MAX_POSSIBLE_TOKENS);
                console.warn(`⚠️ API response was TRUNCATED (finish_reason: length).`);
                
                if (attempt < MAX_ATTEMPTS && nextMax > currentMaxTokens) {
                    console.warn(`...Retrying attempt #${attempt + 1} with max_tokens=${nextMax}.`);
                    currentMaxTokens = nextMax; // Double the token limit for the next try
                    await delay(500); // Short delay before immediate retry
                    continue; // Skip to the next iteration of the loop
                } else {
                    // We've hit max retries or max tokens, throw a specific error.
                    throw new Error(`Response was truncated and could not be recovered after ${attempt} attempts.`);
                }
            }

            // If not truncated, attempt to parse the JSON.
            if (typeof content === 'string') {
                try {
                    return JSON.parse(content);
                } catch (parseError) {
                    console.error(`❌ Final JSON parse error for model '${model}'. Content was not valid JSON.`, {
                        content: content,
                    });
                    // This is a critical failure if we expected JSON.
                    throw new Error('AI returned a non-JSON response when JSON was expected.');
                }
            }
            
            throw new Error('Received empty or invalid content from AI.');

        } catch (error) {
            // Handle network errors and server-side errors with retries.
            const isNetworkError = error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
            const isServerError = error.response && error.response.status >= 500;

            if ((isNetworkError || isServerError) && attempt < MAX_ATTEMPTS) {
                const delayTime = RETRY_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff
                console.warn(`🛑 Network/Server error on attempt ${attempt}: ${error.message}. Retrying in ${delayTime / 1000}s...`);
                await delay(delayTime);
                continue; // Go to the next iteration of the loop
            }

            // Log detailed errors if all retries fail.
            if (error.response) {
                console.error(`🛑 OpenAI API Error (model: ${model}) after all retries:`, {
                    status: error.response.status,
                    data: error.response.data,
                });
            } else {
                console.error(`🛑 OpenAI Network Error (model: ${model}) after all retries:`, error.message);
            }
            
            throw error; // Re-throw the final error to be handled by the calling service.
        }
    }

    // This line is a final safeguard.
    throw new Error(`Failed to get a valid response from model '${model}' after ${MAX_ATTEMPTS} attempts.`);
};

/**
 * Calls the specialized DeepSeek Reasoner AI API with long timeouts and robust retry logic.
 * It is designed for complex tasks that require Chain of Thought and may take several minutes.
 * If all attempts fail, it automatically falls back to the primary OpenAI API.
 *
 * @param {string} systemPrompt The system prompt to guide the model.
 * @param {string} userPrompt The user's request or content.
 * @param {object} [options={}] Optional parameters. The model is fixed to 'deepseek-reasoner'.
 * @returns {Promise<object|string>} A promise that resolves to a parsed JSON object.
 */
export const callDeepSeekReasonerAPI = async (systemPrompt, userPrompt, options = {}) => {
    const model = 'deepseek-reasoner'; 
    
    // --- DEEPSEEK REASONER SPECIFIC CONFIG ---
    const deepseekClient = axios.create({
        baseURL: 'https://api.deepseek.com/v1',
        httpAgent: new http.Agent({ keepAlive: true }),
        httpsAgent: new https.Agent({ keepAlive: true }),
        timeout: 300000, // CRITICAL: 5-minute timeout for long reasoning tasks.
        headers: {
            'Authorization': `Bearer ${process.env.DEEPSEEK_APIKEY}`,
            'Content-Type': 'application/json'
        }
    });

    const MAX_ATTEMPTS = 3;
    const RETRY_DELAY_MS = 2000;
    
    // Start with a higher token limit as reasoner tasks are often large.
    let currentMaxTokens = 32000; 
    const MAX_POSSIBLE_TOKENS = 64000; 

    try {
        // This block attempts to get a valid response from DeepSeek Reasoner.
        // It will throw an error if all retries fail, triggering the fallback.
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                // Body is compliant with deepseek-reasoner (no temp, top_p, etc.)
                const body = {
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    response_format: { "type": "json_object" },
                    max_tokens: currentMaxTokens,
                };

                console.log(`[DeepSeek Reasoner] Attempt ${attempt}: Calling model '${model}' with max_tokens=${currentMaxTokens}...`);

                const response = await deepseekClient.post('/chat/completions', body);
                
                const choice = response.data.choices[0];
                const message = choice?.message;
                const finalContent = message?.content; // The final answer is here.
                const reasoningContent = message?.reasoning_content; // The Chain of Thought.
                const finishReason = choice?.finish_reason;

                console.log(`[DeepSeek Reasoner] Received CoT (length: ${reasoningContent?.length || 0}) and final content.`);

                // Handle truncation by increasing token limit and retrying.
                if (finishReason === 'length') {
                    const nextMax = Math.min(currentMaxTokens * 2, MAX_POSSIBLE_TOKENS);
                    console.warn(`⚠️ DeepSeek Reasoner response was TRUNCATED.`);
                    
                    if (attempt < MAX_ATTEMPTS && nextMax > currentMaxTokens) {
                        console.warn(`...Retrying attempt #${attempt + 1} with max_tokens=${nextMax}.`);
                        currentMaxTokens = nextMax;
                        await delay(500);
                        continue;
                    } else {
                        throw new Error(`Response was truncated and could not be recovered after ${attempt} attempts.`);
                    }
                }

                // If not truncated, parse the final content.
                if (typeof finalContent === 'string') {
                    try {
                        return JSON.parse(finalContent);
                    } catch (parseError) {
                        console.error(`❌ Final JSON parse error for DeepSeek Reasoner. Content was not valid JSON.`, { finalContent });
                        throw new Error('DeepSeek Reasoner returned a non-JSON response when JSON was expected.');
                    }
                }
                
                throw new Error('Received empty or invalid final content from DeepSeek Reasoner.');

            } catch (error) {
                const isNetworkError = error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
                const isServerError = error.response && error.response.status >= 500;

                if ((isNetworkError || isServerError) && attempt < MAX_ATTEMPTS) {
                    const delayTime = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                    console.warn(`🛑 DeepSeek Reasoner Network/Server error on attempt ${attempt}: ${error.message}. Retrying in ${delayTime / 1000}s...`);
                    await delay(delayTime);
                    continue;
                }
                
                // If it's not a retryable error or if retries are exhausted, throw to exit the loop.
                throw error;
            }
        }
        throw new Error(`Failed to get a valid response from DeepSeek Reasoner after ${MAX_ATTEMPTS} attempts.`);

    } catch (deepSeekError) {
        // --- FALLBACK LOGIC ---
        console.warn(`🛑 DeepSeek Reasoner process failed after all attempts. Reason: ${deepSeekError.message}`);
        console.log(`🚀 Initiating fallback to primary OpenAI model...`);

        // Create new options object without the 'model' property to avoid conflicts.
        const { model, ...fallbackOptions } = options;
        
        // Fallback to the primary, reliable OpenAI API.
        return callAIAPI(systemPrompt, userPrompt, fallbackOptions);
    }
};
import dotenv from 'dotenv';
import axios from 'axios';
import http from 'http';
import https from 'https';

dotenv.config();

// Create a dedicated Axios instance with keepAlive enabled for performance and stability.
// This reuses TCP connections, which can significantly reduce the chances of ECONNRESET.
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

const apiClient = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 60000, // Set a 60-second timeout for requests.
  headers: {
    'Authorization': `Bearer ${process.env.DEEPSEEK_APIKEY}`,
    'Content-Type': 'application/json'
  }
});


/**
 * Configuration for different DeepSeek models.
 */
const MODEL_CONFIGS = {
  'deepseek-chat': {
    maxOutputTokens: 8192,
  },
  'deepseek-reasoner': {
    maxOutputTokens: 65536,
  }
};

/**
 * Extracts the first valid JSON object or array from a string.
 * @param {string} text The text to search for JSON within.
 * @returns {string} The extracted JSON string, or the original text if no JSON is found.
 */
const extractJSON = (text) => {
  const match = text.match(/(?:\{[\s\S]*\}|\[[\s\S]*\])/);
  return match ? match[0] : text;
};

/**
 * A utility function to introduce a delay.
 * @param {number} ms The number of milliseconds to wait.
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));


/**
 * Calls the DeepSeek API with specified prompts and returns a parsed JSON object.
 * This function is robust, with retry logic for network errors and truncated responses.
 *
 * @param {string} systemPrompt The system prompt to guide the model.
 * @param {string} userPrompt The user's request or content.
 * @param {object} [options={}] Optional parameters.
 * @param {string} [options.model='deepseek-chat'] The model to use.
 * @param {number} [options.maxTokens=10000] The initial maximum tokens for the response.
 * @returns {Promise<object|string>} A promise that resolves to a parsed JSON object, or the raw string on failure.
 */
export const callDeepSeekAPI = async (systemPrompt, userPrompt, options = {}) => {
  const { model = 'deepseek-chat', maxTokens = 10000 } = options;
  const config = MODEL_CONFIGS[model];
  if (!config) {
    throw new Error(`Invalid model specified: '${model}'. Available models are: ${Object.keys(MODEL_CONFIGS).join(', ')}`);
  }

  const MAX_ATTEMPTS = 3;
  const RETRY_DELAY_MS = 1000;
  let currentMaxTokens = Math.max(1, Math.min(maxTokens, config.maxOutputTokens));

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await apiClient.post('https://api.deepseek.com/v1/chat/completions', {
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0,
        max_tokens: currentMaxTokens,
        top_p: 1,
      });

      const choice = response.data.choices[0];
      let content = choice?.message?.content;
      if (typeof content !== 'string') return content;

      const cleaned = content
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```$/, '')
        .trim();

      try {
        const jsonOnly = extractJSON(cleaned);
        return JSON.parse(jsonOnly);
      } catch (parseError) {
        const finishReason = choice?.finish_reason;
        const isTruncated = finishReason === 'length';
        const nextMax = Math.min(currentMaxTokens * 2, config.maxOutputTokens);

        if (isTruncated && nextMax > currentMaxTokens) {
          console.warn(`⚠️ Attempt ${attempt} for model '${model}' was truncated. Retrying with max_tokens=${nextMax}...`);
          currentMaxTokens = nextMax; // Increase tokens for the next loop iteration
          continue; // Immediately retry with more tokens
        }

        console.error(`❌ Final JSON parse error for model '${model}'.`, {
          parseErrorMessage: parseError.message,
          finishReason: finishReason,
          attempt: attempt,
          content: cleaned,
        });
        return cleaned; // Return the cleaned string if parsing fails after all attempts
      }

    } catch (error) {
      const isNetworkError = error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
      const isServerError = error.response && error.response.status >= 500;

      if ((isNetworkError || isServerError) && attempt < MAX_ATTEMPTS) {
        const delayTime = RETRY_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff
        console.warn(`🛑 Attempt ${attempt} failed for model '${model}' with error: ${error.message}. Retrying in ${delayTime}ms...`);
        await delay(delayTime);
        continue; // Go to the next iteration of the loop
      }

      if (error.response) {
        console.error(`🛑 DeepSeek API Error (model: ${model}):`, {
          status: error.response.status,
          data: error.response.data,
        });
      } else if (error.request) {
        console.error(`🛑 DeepSeek Network Error (model: ${model}): No response received.`, error.message);
      } else {
        console.error(`🛑 DeepSeek Client Error (model: ${model}):`, error.message);
      }
      throw error; // Re-throw the error after all retries have failed
    }
  }

  // This part is reached if all attempts to get a valid, parsable response fail.
  throw new Error(`Failed to get a valid response from model '${model}' after ${MAX_ATTEMPTS} attempts.`);
};
import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

/**
 * Configuration for different DeepSeek models.
 * NOTE: The 'maxOutputTokens' is based on the official documentation.
 * 'deepseek-chat' supports a 32K context with 8K max output.
 * 'deepseek-reasoner' supports a 128K context with 64K max output.
 */
const MODEL_CONFIGS = {
  'deepseek-chat': {
    maxOutputTokens: 8192, // 8K maximum output
  },
  'deepseek-reasoner': {
    maxOutputTokens: 65536, // 64K maximum output
  }
  // You can add more models here in the future
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
 * Calls the DeepSeek API with specified prompts and returns a parsed JSON object.
 * This function is robust, with retry logic for truncated responses.
 * 
 * @param {string} systemPrompt The system prompt to guide the model.
 * @param {string} userPrompt The user's request or content.
 * @param {object} [options={}] Optional parameters.
 * @param {string} [options.model='deepseek-chat'] The model to use ('deepseek-chat' or 'deepseek-reasoner').
 * @param {number} [options.maxTokens=10000] The initial maximum tokens for the response.
 * @param {number} [attempt=1] Internal parameter for tracking retry attempts.
 * @returns {Promise<object|string>} A promise that resolves to a parsed JSON object, or the raw string on failure.
 */
export const callDeepSeekAPI = async (systemPrompt, userPrompt, options = {}, attempt = 1) => {
  // ✅ Destructure options with defaults for backward compatibility
  const { model = 'deepseek-chat', maxTokens = 10000 } = options;

  // ✅ Get model-specific configuration
  const config = MODEL_CONFIGS[model];
  if (!config) {
    throw new Error(`Invalid model specified: '${model}'. Available models are: ${Object.keys(MODEL_CONFIGS).join(', ')}`);
  }
  
  const MAX_MODEL_LIMIT = config.maxOutputTokens;

  try {
    const safeMaxTokens = Math.max(1, Math.min(maxTokens, MAX_MODEL_LIMIT));

    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: model, // ✅ Use the dynamic model name
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0,
      max_tokens: safeMaxTokens,
      top_p: 1,
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_APIKEY}`,
        'Content-Type': 'application/json'
      }
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
      
      const nextMax = Math.min(safeMaxTokens * 2, MAX_MODEL_LIMIT);

      if (attempt < 3 && isTruncated && nextMax > safeMaxTokens) {
        console.warn(`⚠️ Attempt ${attempt} for model '${model}' was truncated. Retrying with max_tokens=${nextMax}...`);
        // Pass the original options object through for the retry
        return await callDeepSeekAPI(systemPrompt, userPrompt, { ...options, maxTokens: nextMax }, attempt + 1);
      }
      
      console.error(`❌ Final JSON parse error for model '${model}'.`, {
        parseErrorMessage: parseError.message,
        finishReason: finishReason,
        attempt: attempt,
        content: cleaned,
      });
      return cleaned;
    }

  } catch (error) {
    if (error.response) {
      console.error(`🛑 DeepSeek API Error (model: ${model}):`, {
        status: error.response.status,
        data: error.response.data,
      });
    } else if (error.request) {
      console.error(`🛑 DeepSeek Network Error (model: ${model}): No response received.`, error.request);
    } else {
      console.error(`🛑 DeepSeek Client Error (model: ${model}):`, error.message);
    }
    throw error;
  }
};
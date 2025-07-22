import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

export const callDeepSeekAPI = async (systemPrompt, userPrompt) => {
  try {
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0,
      max_tokens: 1800,
      top_p: 1,
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_APIKEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log("API Response:", response.data);

    let content = response.data.choices[0].message.content;

    // Clean up code block wrappers if present
    if (typeof content === 'string') {
      try {
        const cleaned = content
          .replace(/^```json\s*/i, '')
          .replace(/^```/, '')
          .replace(/```$/, '')
          .trim();

        const parsed = JSON.parse(cleaned);
        return parsed;  // Return parsed JSON directly
      } catch (parseError) {
        console.error('❌ Failed to parse DeepSeek API JSON response:', content);
        // Fall back to returning raw string or throw error as you prefer
        return content;
      }
    }

    // If content is not a string, return as-is
    return content;

  } catch (error) {
    console.error("API Error:", error.response?.data || error.message);
    throw error;
  }
};

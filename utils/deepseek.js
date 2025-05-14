import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

export const callDeepSeekAPI = async (systemPrompt, userPrompt) => {
  console.log("System Prompt:", systemPrompt);
  console.log("User Prompt:", userPrompt);
  
  try {
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 1800
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_APIKEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log("API Response:", response.data);
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("API Error:", error.response?.data || error.message);
    throw error;
  }
};
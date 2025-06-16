import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

// Get best model based on DeepSeek's discount hours (UTC 16:30–00:30)
const getDeepSeekModel = () => {
  const hour = new Date().getUTCHours();
  const minute = new Date().getUTCMinutes();
  const decimalHour = hour + minute / 60;
  return (decimalHour >= 16.5 || decimalHour < 0.5) ? 'deepseek-reasoner' : 'deepseek-chat';
};

// Pricing (non-discounted rates)
const PRICING = {
  'deepseek-chat': {
    input: 0.27 / 1_000_000,
    output: 1.10 / 1_000_000
  },
  'deepseek-reasoner': {
    input: 0.55 / 1_000_000,
    output: 2.19 / 1_000_000
  }
};

export const callDeepSeekAPI = async (systemPrompt, userPrompt, model=null) => {
  if (model == null){
    model = getDeepSeekModel();
  }

  console.log(`---------------------------MODEL:${model}---------------------------------\n`);

  try {
    const startTime = Date.now();

    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0,
      max_tokens: 1800,
      top_p: 1
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_APIKEY}`,
        'Content-Type': 'application/json'
      }
    });

    const result = response.data.choices[0].message.content;
    const usage = response.data.usage || {};
    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;

    const inputCost = inputTokens * PRICING[model].input;
    const outputCost = outputTokens * PRICING[model].output;
    const totalCost = inputCost + outputCost;

    console.log(`✅ DeepSeek (${model}) used: ${inputTokens} in / ${outputTokens} out`);
    console.log(`💰 Estimated cost: $${totalCost.toFixed(5)} USD`);
    console.log(`⏱️ Took ${(Date.now() - startTime)} ms`);

    return result;

  } catch (error) {
    console.error("❌ DeepSeek API Error:", error.response?.data || error.message);
    throw error;
  }
};

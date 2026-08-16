const { ai } = require('../config/gemini');

/**
 * Generate Hindi news content and tags using Gemini.
 * @param {string} rawTitle 
 * @param {string} rawContent 
 * @returns {Promise<Object|null>}
 */
async function generateNewsContent(rawTitle, rawContent) {
  const prompt = `
You are an expert Hindi news editor for an agri-tech company (Rosni Prime App) focusing on farmers.
Your job is to read the raw article and generate structured news content.

Raw Title: ${rawTitle}
Raw Content:
${rawContent.substring(0, 3000)} // Truncating to avoid huge token sizes if content is too long

Instructions:
1. "hindi_headline": A short, catchy Hindi headline (max 10 words).
2. "hindi_subline": A short sub-line elaborating the headline (max 15 words).
3. "lead_sentence": A bold lead sentence summarizing the core news (max 20 words).
4. "body_paragraph": A concise paragraph explaining the news (max 60 words).
5. "state_tags": An array of states mentioned (e.g., ["Haryana", "Uttar Pradesh"]). Leave empty if none.
6. "interest_tags": An array of agricultural interest categories (e.g., ["fertilizer", "crop prices", "loans", "weather"]).
7. "image_prompt": A descriptive prompt in English to generate a relevant image for this news (focus on visual elements, e.g., "A happy Indian farmer in a green wheat field holding a smartphone").

Respond ONLY in strict JSON format matching exactly this structure:
{
  "hindi_headline": "...",
  "hindi_subline": "...",
  "lead_sentence": "...",
  "body_paragraph": "...",
  "state_tags": [],
  "interest_tags": [],
  "image_prompt": "..."
}
`;

  let attempt = 0;
  const maxRetries = 3;

  while (attempt < maxRetries) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const resultText = response.text;
      return JSON.parse(resultText);
    } catch (error) {
      if (error.status === 429 || (error.message && error.message.includes('429'))) {
        const errorMsg = error.message ? error.message.toLowerCase() : '';
        if (errorMsg.includes('quota') || errorMsg.includes('exhausted')) {
          console.error("🚨 Gemini API Daily Quota Exhausted.");
          throw new Error("DAILY_QUOTA_EXCEEDED");
        }
        
        attempt++;
        console.warn(`[Gemini Rate Limit] 429 Error. Retrying in ${15 * attempt}s (Attempt ${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 15000 * attempt));
      } else {
        console.error("Error generating content with Gemini:", error);
        return null;
      }
    }
  }
  
  console.error("Failed to generate content after max retries.");
  return null;
}

/**
 * Generate a text embedding using Gemini's gemini-embedding-2 model.
 * @param {string} text 
 * @returns {Promise<Array<number>|null>} Array of 768 floats
 */
async function generateEmbedding(text) {
  try {
    const response = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: text.substring(0, 5000), // Ensure we don't exceed limits
      config: {
        outputDimensionality: 768
      }
    });
    
    // It returns response.embeddings[0].values
    if (response.embeddings && response.embeddings.length > 0) {
      return response.embeddings[0].values;
    }
    return null;
  } catch (error) {
    console.error("Error generating embedding:", error);
    return null;
  }
}

module.exports = { generateNewsContent, generateEmbedding };

/**
 * Note: This image generation script uses Vertex AI Express Mode for Gemini 3.1 Flash Image.
 * This is currently a 90-day free trial. To continue using it after the trial,
 * billing will need to be enabled on your Google Cloud Project.
 */
const { supabase } = require('../config/supabase');
const { GoogleGenAI } = require('@google/genai');

// We create a separate Gemini client specifically for Vertex AI Express Mode
// using the image API key, so we don't interfere with the text API client.
const imageAi = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_IMAGE_API_KEY, 
  vertexai: true 
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function generateAndUploadImage(item) {
  const prompt = item.image_prompt;
  let attempt = 0;
  const maxRetries = 5;

  while (attempt < maxRetries) {
    try {
      console.log(`[ImageGen] Generating for ID ${item.id} (Attempt ${attempt + 1})...`);
      
      const response = await imageAi.models.generateContent({
        model: 'gemini-3.1-flash-image',
        contents: prompt,
        config: {
          responseModalities: ['TEXT', 'IMAGE']
        }
      });
      
      console.log(`[ImageGen] ✅ Received response from Gemini!`);

      const part = response.candidates[0]?.content?.parts?.find(p => p.inlineData);
      if (!part || !part.inlineData) {
         throw new Error("No image data returned from Gemini");
      }

      const buffer = Buffer.from(part.inlineData.data, 'base64');
      console.log(`[ImageGen] ✅ Converted response to Buffer. Byte length: ${buffer.byteLength}`);
      
      // Upload to Supabase Storage
      const fileName = `${Date.now()}-${item.id}.jpg`;
      console.log(`[ImageGen] Uploading to Supabase bucket as ${fileName}...`);
      
      const { error: uploadError } = await supabase.storage
        .from('news-images')
        .upload(fileName, buffer, {
          contentType: part.inlineData.mimeType || 'image/jpeg'
        });

      if (uploadError) {
        console.error(`[ImageGen] ❌ Upload error:`, uploadError);
        return false;
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('news-images')
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData.publicUrl;

      // Update database
      const { error: updateError } = await supabase
        .from('news_items')
        .update({ image_url: publicUrl })
        .eq('id', item.id);

      if (updateError) {
        console.error(`[ImageGen] ❌ DB Update error:`, updateError);
        return false;
      }

      console.log(`[ImageGen] 🌿 Successfully added image to item ${item.id}`);
      return true;

    } catch (error) {
      if (error.status === 429 || (error.message && error.message.includes('429'))) {
        const errorMsg = error.message ? error.message.toLowerCase() : '';
        if (errorMsg.includes('quota') || errorMsg.includes('exhausted')) {
          console.error("🚨 Gemini Vertex Express Mode Daily Quota Exhausted.");
          return false; // Exit this generation gracefully
        }
      }
      console.error(`[ImageGen] ❌ Error:`, error.message);
      await sleep(5000);
      attempt++;
    }
  }

  console.error(`[ImageGen] Failed after ${maxRetries} retries.`);
  return false;
}

async function processPendingImages() {
  console.log("Checking for items requiring images...");
  
  let totalProcessed = 0;

  while (true) {
    const { data: items, error } = await supabase
      .from('news_items')
      .select('id, image_prompt')
      .is('image_url', null)
      .not('image_prompt', 'is', null)
      .limit(5);

    if (error) {
      console.error("Error fetching items for image generation:", error);
      break;
    }

    if (items.length === 0) {
      if (totalProcessed === 0) {
        console.log("No images need generation at this time.");
      } else {
        console.log(`✅ Finished generating all pending images. Total processed: ${totalProcessed}`);
      }
      break;
    }

    console.log(`Processing batch of ${items.length} items...`);

    for (let i = 0; i < items.length; i++) {
      const success = await generateAndUploadImage(items[i]);
      if (!success) {
        // If generateAndUploadImage fails (e.g. quota exhausted), we break out of the loop
        console.log("Skipping remaining images in batch due to failure.");
        return; 
      }
      
      totalProcessed++;
      
      // Add a 5 second delay between generations (and before the next batch)
      if (i < items.length - 1 || items.length === 5) {
        console.log("Waiting 5 seconds before next image generation...");
        await sleep(5000);
      }
    }
  }
}

if (require.main === module) {
  processPendingImages();
}

module.exports = { processPendingImages, generateAndUploadImage };

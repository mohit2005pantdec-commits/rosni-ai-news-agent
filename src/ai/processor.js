const { supabase } = require('../config/supabase');
const { generateNewsContent, generateEmbedding } = require('./generate');

async function processPendingArticles() {
  console.log("Fetching pending articles for AI processing...");
  
  // 1. Fetch articles with status 'pending_ai'
  const { data: articles, error } = await supabase
    .from('raw_articles')
    .select('*')
    .eq('status', 'pending_ai')
    .limit(10); // Process 10 at a time

  if (error) {
    console.error("Error fetching pending articles:", error);
    return;
  }

  if (articles.length === 0) {
    console.log("No pending articles found.");
    return;
  }

  console.log(`Processing ${articles.length} articles...`);

  // 2. Loop through and process each
  for (const article of articles) {
    console.log(`\n---------------------------------`);
    console.log(`Processing: ${article.raw_title}`);
    
    // Check for semantic duplicates first
    let isDuplicate = false;
    try {
      console.log(`Generating embedding for deduplication check...`);
      const textToEmbed = `${article.raw_title}\n\n${article.raw_content}`;
      const embedding = await generateEmbedding(textToEmbed);
      
      if (embedding) {
        // Save the embedding to the database
        await supabase
          .from('raw_articles')
          .update({ embedding })
          .eq('id', article.id);

        // Find matches
        const { data: matches, error: matchError } = await supabase.rpc('match_articles', {
          query_embedding: embedding,
          match_threshold: 0.90, // 90% similarity
          match_count: 1,
          article_id: article.id
        });

        if (matchError) {
          console.error("Error matching articles:", matchError);
        } else if (matches && matches.length > 0) {
          console.log(`⚠️ DUPLICATE FOUND! Matches article ID: ${matches[0].id} (Similarity: ${(matches[0].similarity * 100).toFixed(1)}%)`);
          isDuplicate = true;
          
          await supabase
            .from('raw_articles')
            .update({ status: 'duplicate', duplicate_of: matches[0].id })
            .eq('id', article.id);
        }
      }
    } catch (e) {
      console.error("Error during deduplication check:", e);
    }

    if (isDuplicate) {
      console.log("Skipping AI text generation for duplicate.");
      continue;
    }

    console.log(`Generating AI content...`);
    let generatedData = null;
    try {
      generatedData = await generateNewsContent(article.raw_title, article.raw_content);
    } catch (error) {
      if (error.message === "DAILY_QUOTA_EXCEEDED") {
        console.error("\n🛑 DAILY LIMIT REACHED: Halting text generation for today. Remaining articles will stay in 'pending_ai' status.\n");
        break; // Exit the for-loop immediately
      }
      console.error("Unexpected error during generation:", error);
    }

    if (generatedData) {
      // 3. Save to news_items
      const { error: insertError } = await supabase
        .from('news_items')
        .insert([{
          raw_article_id: article.id,
          hindi_headline: generatedData.hindi_headline,
          hindi_subline: generatedData.hindi_subline,
          lead_sentence: generatedData.lead_sentence,
          body_paragraph: generatedData.body_paragraph,
          state_tags: generatedData.state_tags,
          interest_tags: generatedData.interest_tags,
          image_prompt: generatedData.image_prompt,
          status: 'pending_approval' // Ready for human review
        }]);

      if (insertError) {
        console.error(`Failed to insert news_item for article ${article.id}:`, insertError);
        continue;
      }

      // 4. Update raw_article status
      await supabase
        .from('raw_articles')
        .update({ status: 'ai_processed' })
        .eq('id', article.id);

      console.log(`Successfully processed and queued for review: ${generatedData.hindi_headline}`);
    } else {
      // Mark as failed if generation returned null
      await supabase
        .from('raw_articles')
        .update({ status: 'failed' })
        .eq('id', article.id);
    }

    // Wait 15 seconds before processing the next article to respect Gemini free-tier rate limits (5 req/min)
    if (articles.indexOf(article) < articles.length - 1) {
      console.log("Waiting 15 seconds before the next Gemini API call to avoid rate limits...");
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
  }
}

// Allow running directly
if (require.main === module) {
  processPendingArticles();
}

module.exports = processPendingArticles;

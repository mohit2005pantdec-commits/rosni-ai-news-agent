const { supabase } = require('../config/supabase');

/**
 * Check if an article URL already exists in the raw_articles table.
 * @param {string} url - The original article URL
 * @returns {Promise<boolean>} True if it exists, false otherwise
 */
async function articleExists(url) {
  const { data, error } = await supabase
    .from('raw_articles')
    .select('id')
    .eq('original_url', url)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 means no rows returned, which is fine.
    console.error(`Error checking article existence for ${url}:`, error);
  }

  return !!data;
}

/**
 * Get the source ID by name.
 * @param {string} name - Name of the source (e.g., 'Krishijagran')
 * @returns {Promise<string|null>} The UUID of the source
 */
async function getSourceId(name) {
  const { data, error } = await supabase
    .from('sources')
    .select('id')
    .ilike('name', name)
    .single();

  if (error) {
    console.error(`Error fetching source ID for ${name}:`, error);
    return null;
  }
  
  return data.id;
}

/**
 * Save a raw article to the database.
 * @param {string} sourceId - The UUID of the source
 * @param {string} url - The original article URL
 * @param {string} title - The raw title
 * @param {string} content - The raw content text
 */
async function saveRawArticle(sourceId, url, title, content) {
  const { data, error } = await supabase
    .from('raw_articles')
    .insert([
      {
        source_id: sourceId,
        original_url: url,
        raw_title: title,
        raw_content: content,
        status: 'pending_ai'
      }
    ]);

  if (error) {
    console.error(`Error saving raw article ${url}:`, error.message);
    return false;
  }
  
  console.log(`Saved raw article: ${title}`);
  return true;
}

module.exports = {
  articleExists,
  getSourceId,
  saveRawArticle
};

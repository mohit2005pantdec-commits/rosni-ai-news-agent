const express = require('express');
const cors = require('cors');
const path = require('path');
const { supabase } = require('../config/supabase');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Fetch all pending articles
app.get('/api/pending', async (req, res) => {
  const { data, error } = await supabase
    .from('news_items')
    .select('*, raw_articles(raw_title, original_url, sources(name))')
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching pending items:", error);
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// Fetch all approved and published articles
app.get('/api/published', async (req, res) => {
  const { data, error } = await supabase
    .from('news_items')
    .select('*, raw_articles(raw_title, original_url, sources(name))')
    .in('status', ['approved', 'published'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching published items:", error);
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// Approve an article (accepts edited content)
app.post('/api/approve/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const { error } = await supabase
    .from('news_items')
    .update({ 
      ...updates, 
      status: 'approved'
    })
    .eq('id', id);

  if (error) {
    console.error(`Error approving item ${id}:`, error);
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true, message: 'Article approved successfully.' });
});

// Final Publish an article
app.post('/api/publish/:id', async (req, res) => {
  const { id } = req.params;
  
  const { error } = await supabase
    .from('news_items')
    .update({ 
      status: 'published',
      published_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) {
    console.error(`Error publishing item ${id}:`, error);
    return res.status(500).json({ error: error.message });
  }

  // Fetch headline to create notification
  const { data: item } = await supabase
    .from('news_items')
    .select('hindi_headline')
    .eq('id', id)
    .single();

  if (item) {
    await supabase.from('notification_log').insert([{
      news_item_id: id,
      message: `Notification would be sent: ${item.hindi_headline}`
    }]);
  }

  res.json({ success: true, message: 'Article published successfully.' });
});

// Fetch notification logs
app.get('/api/notifications', async (req, res) => {
  const { data, error } = await supabase
    .from('notification_log')
    .select('*, news_items(hindi_headline)')
    .order('sent_at', { ascending: false });

  if (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// Reject an article
app.post('/api/reject/:id', async (req, res) => {
  const { id } = req.params;
  
  const { error } = await supabase
    .from('news_items')
    .update({ status: 'rejected' })
    .eq('id', id);

  if (error) {
    console.error(`Error rejecting item ${id}:`, error);
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true, message: 'Article rejected successfully.' });
});

// Regenerate image
app.post('/api/regenerate-image/:id', async (req, res) => {
  const { id } = req.params;
  const { image_prompt } = req.body;

  // 1. Update the prompt and set image_url to null
  const { data, error: updateError } = await supabase
    .from('news_items')
    .update({ image_prompt, image_url: null })
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) {
    console.error("DB update error:", updateError);
    return res.status(500).json({ error: updateError.message });
  }

  // 2. Call the generator
  try {
    const { generateAndUploadImage } = require('../ai/imageGenerator');
    const success = await generateAndUploadImage(data);

    if (!success) {
      console.error("[API] generateAndUploadImage returned false for item", id);
      return res.status(500).json({ error: "Failed to generate new image" });
    }
  } catch (err) {
    console.error("[API] Exception during generateAndUploadImage:", err);
    return res.status(500).json({ error: err.message });
  }

  // 3. Fetch the new image URL
  const { data: updatedItem, error: fetchError } = await supabase
    .from('news_items')
    .select('image_url')
    .eq('id', id)
    .single();

  res.json({ success: true, image_url: updatedItem.image_url });
});

app.listen(PORT, () => {
  console.log(`🚀 Admin UI running on http://localhost:${PORT}`);
});

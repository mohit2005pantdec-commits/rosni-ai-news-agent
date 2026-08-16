-- Run this in your Supabase SQL Editor to allow our Node.js agent to read/write using the anon key.

-- Enable RLS on tables (if not already done)
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_items ENABLE ROW LEVEL SECURITY;

-- Policies for sources: Agent needs to read the source IDs
CREATE POLICY "Allow public read sources" ON sources FOR SELECT USING (true);

-- Policies for raw_articles: Agent needs to select and insert raw articles
CREATE POLICY "Allow public select raw_articles" ON raw_articles FOR SELECT USING (true);
CREATE POLICY "Allow public insert raw_articles" ON raw_articles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update raw_articles" ON raw_articles FOR UPDATE USING (true);

-- Policies for news_items: Agent needs to insert AI-generated news drafts
CREATE POLICY "Allow public select news_items" ON news_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert news_items" ON news_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update news_items" ON news_items FOR UPDATE USING (true);

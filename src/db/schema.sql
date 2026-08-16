-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Table 1: sources
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table 2: raw_articles
CREATE TABLE raw_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    original_url TEXT NOT NULL UNIQUE,
    raw_title TEXT NOT NULL,
    raw_content TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending_ai', -- pending_ai, ai_processed, failed, duplicate
    duplicate_of UUID REFERENCES raw_articles(id) ON DELETE SET NULL,
    embedding vector(768),
    fetch_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table 3: news_items
CREATE TABLE news_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    raw_article_id UUID NOT NULL UNIQUE REFERENCES raw_articles(id) ON DELETE CASCADE,
    hindi_headline TEXT,
    hindi_subline TEXT,
    lead_sentence TEXT,
    body_paragraph TEXT,
    state_tags JSONB, -- Array of strings e.g. ["Haryana", "UP"]
    interest_tags JSONB, -- Array of strings e.g. ["fertilizer", "crop prices"]
    image_prompt TEXT,
    image_url TEXT, -- URL of the generated image
    status VARCHAR(50) DEFAULT 'pending_approval', -- pending_approval, approved, rejected, published
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE
);

-- Function to find duplicate articles based on cosine similarity
CREATE OR REPLACE FUNCTION match_articles (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  article_id uuid
)
RETURNS TABLE (
  id uuid,
  raw_title text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    raw_title,
    1 - (embedding <=> query_embedding) AS similarity
  FROM raw_articles
  WHERE id != article_id
    AND embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > match_threshold
    AND fetch_date > now() - interval '3 days'
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Insert initial sources
INSERT INTO sources (name, url) VALUES
('Krishijagran', 'https://hindi.krishijagran.com/news'),
('Aajtak', 'https://www.aajtak.in/agriculture'),
('ABP', 'https://www.abplive.com/agriculture'),
('ZeeBiz', 'https://www.zeebiz.com/hindi/economy/agriculture'),
('KisanTak', 'https://www.kisantak.in/');

-- Table 4: notification_log
CREATE TABLE notification_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    news_item_id UUID NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

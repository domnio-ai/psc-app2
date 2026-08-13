ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS source_type VARCHAR(30) NOT NULL DEFAULT 'App2 Upload';
ALTER TABLE knowledge_items DROP CONSTRAINT IF EXISTS knowledge_items_source_type_check;
ALTER TABLE knowledge_items ADD CONSTRAINT knowledge_items_source_type_check CHECK(source_type IN('Internet','Research','Assignment','Task','App2 Report','External Upload','App2 Upload'));
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS source_url TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS knowledge_items_source_type_idx ON knowledge_items(source_type,updated_at DESC);

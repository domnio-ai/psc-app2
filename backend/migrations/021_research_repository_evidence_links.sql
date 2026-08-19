BEGIN;
ALTER TABLE research_knowledge_links ADD COLUMN IF NOT EXISTS linked_by UUID REFERENCES users(id);
ALTER TABLE research_knowledge_links ADD COLUMN IF NOT EXISTS linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS research_knowledge_links_project_idx ON research_knowledge_links(project_id,linked_at DESC);
COMMIT;

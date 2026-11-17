BEGIN;

CREATE TABLE IF NOT EXISTS assignment_report_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES generated_documents(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES assignment_tasks(id) ON DELETE RESTRICT,
  task_title TEXT NOT NULL,
  task_owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  task_owner_name TEXT,
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewer_name TEXT,
  task_report_version INTEGER NOT NULL DEFAULT 1,
  task_approved_at TIMESTAMPTZ,
  repository_document_id UUID REFERENCES knowledge_items(id) ON DELETE SET NULL,
  repository_document_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(document_id, task_id)
);

CREATE INDEX IF NOT EXISTS assignment_report_sources_document_idx
  ON assignment_report_sources(document_id);

CREATE INDEX IF NOT EXISTS assignment_report_sources_task_idx
  ON assignment_report_sources(task_id);

COMMIT;

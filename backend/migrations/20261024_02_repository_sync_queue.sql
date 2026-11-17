-- App2 transactional outbox for best-effort Repository mirrors.
-- Primary work and the pending sync job are committed together; Repository rendering
-- happens after commit and is retried independently.
CREATE TABLE IF NOT EXISTS repository_sync_queue (
  id BIGSERIAL PRIMARY KEY,
  job_kind TEXT NOT NULL CHECK (job_kind IN (
    'assignment_draft', 'task_draft', 'task_report_draft',
    'assignment_report_draft', 'research_report_draft'
  )),
  entity_id UUID NOT NULL,
  parent_id UUID,
  requested_by UUID NOT NULL,
  actor_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'retry', 'done', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  repository_document_id UUID,
  repository_version INTEGER,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_succeeded_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_repository_sync_queue_ready
  ON repository_sync_queue(status, available_at, created_at);
CREATE INDEX IF NOT EXISTS idx_repository_sync_queue_entity
  ON repository_sync_queue(job_kind, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS assignment_report_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES generated_documents(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES users(id),
  version_number INTEGER NOT NULL DEFAULT 1,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type VARCHAR(160) NOT NULL,
  size_bytes BIGINT NOT NULL,
  sha256_hash VARCHAR(64) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Draft',
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_assignment_report_import_current
  ON assignment_report_imports(document_id)
  WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS ix_assignment_report_import_document
  ON assignment_report_imports(document_id, version_number DESC);

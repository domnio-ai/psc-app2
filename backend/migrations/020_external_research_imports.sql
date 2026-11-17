-- Phase 3: reader-only external completed research intake and review workflow.
-- External imports deliberately do NOT create rows in research_projects.

CREATE TABLE IF NOT EXISTS external_research_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id UUID NOT NULL UNIQUE REFERENCES knowledge_items(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  institution VARCHAR(200),
  research_type VARCHAR(100) NOT NULL DEFAULT 'Research Report',
  status VARCHAR(40) NOT NULL DEFAULT 'Pending Review'
    CHECK (status IN ('Pending Review','Under Review','Revision Requested','Resubmitted','Published','Rejected')),
  revision_ready BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_external_research_imports_submitter
  ON external_research_imports(submitted_by, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_research_imports_status
  ON external_research_imports(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS external_research_import_reviewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES external_research_imports(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(import_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_external_research_import_reviewers_reviewer
  ON external_research_import_reviewers(reviewer_id, active);

CREATE TABLE IF NOT EXISTS external_research_import_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES external_research_imports(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  decision VARCHAR(40) NOT NULL
    CHECK (decision IN ('Review Started','Revision Requested','Resubmitted','Approved','Rejected')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_external_research_import_reviews_import
  ON external_research_import_reviews(import_id, created_at DESC);

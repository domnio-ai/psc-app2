-- Research report submission/review version control
ALTER TABLE research_report_versions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Draft';
ALTER TABLE research_report_versions ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE research_report_versions ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE research_report_versions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE research_report_versions ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE research_report_versions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE research_report_versions ADD COLUMN IF NOT EXISTS review_comments TEXT NOT NULL DEFAULT '';
ALTER TABLE research_report_versions ADD COLUMN IF NOT EXISTS parent_version_id UUID REFERENCES research_report_versions(id) ON DELETE SET NULL;
DO $$ BEGIN
  ALTER TABLE research_report_versions ADD CONSTRAINT research_report_versions_status_check CHECK(status IN('Draft','Submitted','Changes Requested','Approved','Rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_research_report_versions_review ON research_report_versions(project_id,status,created_at DESC);

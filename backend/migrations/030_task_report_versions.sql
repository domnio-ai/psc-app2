CREATE TABLE IF NOT EXISTS task_report_versions(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES assignment_tasks(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK(version_number>0),
  report_snapshot JSONB NOT NULL,
  html_snapshot TEXT NOT NULL,
  snapshot_sha256 VARCHAR(64) NOT NULL,
  status VARCHAR(30) NOT NULL CHECK(status IN('Submitted','Changes Requested','Approved','Rejected','Finalised')),
  submitted_by UUID NOT NULL REFERENCES users(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewer_id UUID NOT NULL REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_comments TEXT NOT NULL DEFAULT '',
  finalised_by UUID REFERENCES users(id),
  finalised_at TIMESTAMPTZ,
  UNIQUE(task_id,version_number)
);
CREATE INDEX IF NOT EXISTS task_report_versions_task_idx ON task_report_versions(task_id,version_number DESC);
CREATE INDEX IF NOT EXISTS task_report_versions_review_idx ON task_report_versions(reviewer_id,status,submitted_at DESC);

INSERT INTO task_report_versions(task_id,version_number,report_snapshot,html_snapshot,snapshot_sha256,status,submitted_by,submitted_at,reviewer_id,reviewed_by,reviewed_at,review_comments)
SELECT t.id,t.contribution_report_version,to_jsonb(t),COALESCE(t.contribution_report_html,''),
  encode(digest(convert_to(to_jsonb(t)::text,'UTF8'),'sha256'),'hex'),
  CASE WHEN t.contribution_status='Integrated' THEN 'Approved' ELSE 'Submitted' END,
  t.owner_id,COALESCE(t.contribution_ready_at,t.updated_at,t.created_at),t.reviewer_id,
  CASE WHEN t.contribution_status='Integrated' THEN t.contribution_integrated_by ELSE NULL END,
  CASE WHEN t.contribution_status='Integrated' THEN t.contribution_integrated_at ELSE NULL END,
  'Backfilled from the governed pre-versioning task report state.'
FROM assignment_tasks t
WHERE t.contribution_status IN('Ready for Integration','Integrated')
  AND t.contribution_report_version>0 AND t.owner_id IS NOT NULL AND t.reviewer_id IS NOT NULL
ON CONFLICT(task_id,version_number) DO NOTHING;

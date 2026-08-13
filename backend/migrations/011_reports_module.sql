BEGIN;
CREATE TABLE IF NOT EXISTS user_report_favourites(
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_key VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_id,report_key)
);
CREATE INDEX IF NOT EXISTS assignments_reporting_idx ON assignments(created_at,status,division,priority,due_date);
CREATE INDEX IF NOT EXISTS research_projects_reporting_idx ON research_projects(created_at,status);
CREATE INDEX IF NOT EXISTS knowledge_items_reporting_idx ON knowledge_items(created_at,status,category,is_archived);
COMMIT;

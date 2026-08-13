BEGIN;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS sla_due_date DATE;
UPDATE assignments SET completed_at=updated_at WHERE status='Completed' AND completed_at IS NULL;
UPDATE assignments SET sla_due_date=due_date WHERE sla_due_date IS NULL;
CREATE OR REPLACE FUNCTION set_assignment_reporting_dates() RETURNS trigger AS $$
BEGIN
  IF NEW.status='Completed' AND OLD.status IS DISTINCT FROM 'Completed' THEN NEW.completed_at=COALESCE(NEW.completed_at,NOW()); END IF;
  IF NEW.status<>'Completed' THEN NEW.completed_at=NULL; END IF;
  IF NEW.sla_due_date IS NULL THEN NEW.sla_due_date=NEW.due_date; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS assignments_reporting_dates_trigger ON assignments;
CREATE TRIGGER assignments_reporting_dates_trigger BEFORE INSERT OR UPDATE OF status,due_date,sla_due_date ON assignments FOR EACH ROW EXECUTE FUNCTION set_assignment_reporting_dates();

CREATE TABLE IF NOT EXISTS user_report_views(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_key VARCHAR(100) NOT NULL,
  name VARCHAR(120) NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id,report_key,name)
);
CREATE INDEX IF NOT EXISTS user_report_views_lookup_idx ON user_report_views(user_id,report_key,updated_at DESC);

CREATE TABLE IF NOT EXISTS report_exports(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  report_key VARCHAR(100) NOT NULL,
  format VARCHAR(10) NOT NULL CHECK(format IN('pdf','docx','xlsx')),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  row_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS report_exports_audit_idx ON report_exports(user_id,report_key,created_at DESC);

CREATE TABLE IF NOT EXISTS report_decisions(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_key VARCHAR(100) NOT NULL,
  title VARCHAR(240) NOT NULL,
  decision TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Open' CHECK(status IN('Open','Resolved')),
  created_by UUID NOT NULL REFERENCES users(id),
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS felix_report_metrics(
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  mode VARCHAR(40),
  query_length INTEGER NOT NULL DEFAULT 0,
  response_ok BOOLEAN NOT NULL DEFAULT FALSE,
  source_count INTEGER NOT NULL DEFAULT 0,
  confidence NUMERIC(5,4),
  response_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS felix_report_metrics_created_idx ON felix_report_metrics(created_at,user_id);
COMMIT;

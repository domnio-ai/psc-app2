BEGIN;

CREATE TABLE IF NOT EXISTS assignment_sections(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  title VARCHAR(250) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  section_order INTEGER NOT NULL DEFAULT 1 CHECK(section_order>0),
  lead_id UUID REFERENCES users(id) ON DELETE SET NULL,
  start_date DATE,
  due_date DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'Not Started' CHECK(status IN('Not Started','In Progress','Blocked','Ready for Integration','Completed')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
  is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  archived_by UUID REFERENCES users(id),
  CHECK(due_date IS NULL OR start_date IS NULL OR due_date>=start_date)
);

ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS assignment_section_id UUID REFERENCES assignment_sections(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS assignment_sections_assignment_order_idx ON assignment_sections(assignment_id,archived_at,section_order);
CREATE INDEX IF NOT EXISTS assignment_sections_lead_idx ON assignment_sections(lead_id,status) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS assignment_tasks_section_idx ON assignment_tasks(assignment_section_id) WHERE assignment_section_id IS NOT NULL;

COMMIT;

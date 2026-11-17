CREATE TABLE IF NOT EXISTS research_assignment_requests(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  title VARCHAR(240) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  division VARCHAR(160) NOT NULL,
  due_date DATE,
  priority VARCHAR(20) NOT NULL DEFAULT 'Normal' CHECK(priority IN('Low','Normal','High','Critical')),
  member_ids UUID[] NOT NULL DEFAULT '{}',
  requested_by UUID NOT NULL REFERENCES users(id),
  status VARCHAR(30) NOT NULL DEFAULT 'Pending Approval' CHECK(status IN('Pending Approval','Approved','Rejected')),
  decided_by UUID REFERENCES users(id),
  decision_comment TEXT NOT NULL DEFAULT '',
  assignment_id UUID REFERENCES assignments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS research_assignment_requests_project_idx ON research_assignment_requests(project_id,status,created_at DESC);

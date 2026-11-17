CREATE TABLE IF NOT EXISTS assignment_member_requests(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id),
  requested_user_id UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL CHECK(char_length(reason) BETWEEN 5 AND 2000),
  status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK(status IN('Pending','Approved','Rejected','Withdrawn')),
  reviewed_by UUID REFERENCES users(id),
  review_comments TEXT NOT NULL DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS assignment_member_requests_assignment_idx
  ON assignment_member_requests(assignment_id,status,created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS assignment_member_requests_pending_idx
  ON assignment_member_requests(assignment_id,requested_user_id)
  WHERE status='Pending';

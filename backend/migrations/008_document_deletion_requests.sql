CREATE TABLE IF NOT EXISTS document_deletion_requests(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id UUID REFERENCES knowledge_items(id) ON DELETE SET NULL,
  knowledge_title VARCHAR(240) NOT NULL,
  requested_by UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL CHECK(char_length(reason) BETWEEN 5 AND 2000),
  status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK(status IN('Pending','Approved','Rejected')),
  reviewed_by UUID REFERENCES users(id),
  review_comments TEXT NOT NULL DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS document_deletion_requests_pending_idx ON document_deletion_requests(knowledge_id) WHERE status='Pending' AND knowledge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS document_deletion_requests_requester_idx ON document_deletion_requests(requested_by,created_at DESC);

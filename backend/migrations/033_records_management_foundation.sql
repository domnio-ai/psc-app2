BEGIN;

ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS record_number VARCHAR(80),
  ADD COLUMN IF NOT EXISTS record_class VARCHAR(120) NOT NULL DEFAULT 'General Record',
  ADD COLUMN IF NOT EXISTS records_lifecycle_state VARCHAR(40) NOT NULL DEFAULT 'Working Document',
  ADD COLUMN IF NOT EXISTS review_due_at DATE,
  ADD COLUMN IF NOT EXISTS legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS legal_hold_reason TEXT,
  ADD COLUMN IF NOT EXISTS declared_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS declared_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS supersedes_id UUID REFERENCES knowledge_items(id),
  ADD COLUMN IF NOT EXISTS disposition_action VARCHAR(40) NOT NULL DEFAULT 'Review',
  ADD COLUMN IF NOT EXISTS disposition_notes TEXT;

ALTER TABLE knowledge_items
  DROP CONSTRAINT IF EXISTS knowledge_items_records_lifecycle_check;
ALTER TABLE knowledge_items
  ADD CONSTRAINT knowledge_items_records_lifecycle_check
  CHECK(records_lifecycle_state IN(
    'Working Document',
    'Under Improvement',
    'Under Review',
    'Active Record',
    'Superseded',
    'Archived',
    'Disposition Review'
  ));

ALTER TABLE knowledge_items
  DROP CONSTRAINT IF EXISTS knowledge_items_disposition_action_check;
ALTER TABLE knowledge_items
  ADD CONSTRAINT knowledge_items_disposition_action_check
  CHECK(disposition_action IN('Review','Destroy','Transfer','Permanent'));

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_items_record_number_idx
  ON knowledge_items(record_number)
  WHERE record_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS document_improvement_assignments(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  assignee_id UUID NOT NULL REFERENCES users(id),
  reviewer_id UUID NOT NULL REFERENCES users(id),
  created_by UUID NOT NULL REFERENCES users(id),
  improvement_type VARCHAR(40) NOT NULL
    CHECK(improvement_type IN('Content Update','Policy Review','Legal Review','Metadata Improvement','Formatting','Annual Review','Other')),
  reason TEXT NOT NULL,
  due_date DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'Assigned'
    CHECK(status IN('Assigned','In Progress','Submitted','Completed','Cancelled')),
  starting_version INTEGER NOT NULL DEFAULT 1,
  completed_version INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS document_improvement_knowledge_idx
  ON document_improvement_assignments(knowledge_id,status);
CREATE INDEX IF NOT EXISTS document_improvement_assignee_idx
  ON document_improvement_assignments(assignee_id,status);
CREATE INDEX IF NOT EXISTS document_improvement_reviewer_idx
  ON document_improvement_assignments(reviewer_id,status);

UPDATE knowledge_items
SET records_lifecycle_state=CASE
  WHEN status='Published' THEN 'Active Record'
  WHEN status='Pending Approval' THEN 'Under Review'
  WHEN status='Archived' THEN 'Archived'
  ELSE 'Working Document'
END
WHERE records_lifecycle_state='Working Document';

COMMIT;

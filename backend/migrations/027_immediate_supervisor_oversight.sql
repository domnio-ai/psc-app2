BEGIN;

-- Legacy App2 Research Officer accounts pre-date the reporting hierarchy.
-- Backfill them only when the organisation has one unambiguous active
-- Assistant Director; otherwise leave them for an administrator to assign.
UPDATE users
SET supervisor_id=(SELECT id FROM users WHERE active=TRUE AND role='Assistant Director' LIMIT 1),
    updated_at=NOW()
WHERE active=TRUE
  AND role='Research Officer'
  AND supervisor_id IS NULL
  AND (SELECT COUNT(*) FROM users WHERE active=TRUE AND role='Assistant Director')=1;

COMMIT;

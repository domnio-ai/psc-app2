DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'assignment_tasks'::regclass
      AND contype = 'c'
      AND (
        pg_get_constraintdef(oid) ILIKE '%contribution_section_statuses%'
        OR pg_get_constraintdef(oid) ILIKE '%contribution_summary%'
        OR pg_get_constraintdef(oid) ILIKE '%contribution_findings%'
        OR pg_get_constraintdef(oid) ILIKE '%contribution_recommendations%'
        OR pg_get_constraintdef(oid) ILIKE '%evidence_reviewed%'
        OR pg_get_constraintdef(oid) ILIKE '%contribution_challenges%'
        OR pg_get_constraintdef(oid) ILIKE '%contribution_next_actions%'
      )
  LOOP
    EXECUTE format('ALTER TABLE assignment_tasks DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

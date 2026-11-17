BEGIN;

ALTER TABLE assignment_tasks
  ADD COLUMN IF NOT EXISTS report_mode VARCHAR(20) NOT NULL DEFAULT 'structured';

ALTER TABLE assignment_tasks
  ADD COLUMN IF NOT EXISTS blank_content TEXT NOT NULL DEFAULT '';

UPDATE assignment_tasks
SET report_mode='structured'
WHERE report_mode IS NULL OR BTRIM(report_mode)='';

UPDATE assignment_tasks
SET blank_content=''
WHERE blank_content IS NULL;

COMMIT;

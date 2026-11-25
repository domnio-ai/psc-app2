BEGIN;

ALTER TABLE meeting_actions
  ADD COLUMN IF NOT EXISTS assignment_task_id UUID
  REFERENCES assignment_tasks(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS meeting_actions_assignment_task_unique
  ON meeting_actions(assignment_task_id)
  WHERE assignment_task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS meeting_actions_meeting_due_idx
  ON meeting_actions(meeting_id,due_date)
  WHERE due_date IS NOT NULL;

COMMIT;

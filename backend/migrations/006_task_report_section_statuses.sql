ALTER TABLE assignment_tasks
  ADD COLUMN IF NOT EXISTS contribution_section_statuses JSONB NOT NULL DEFAULT '{}'::jsonb;

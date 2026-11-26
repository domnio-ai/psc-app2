BEGIN;

ALTER TABLE research_milestones
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES assignment_tasks(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS research_milestones_task_id_unique
  ON research_milestones(task_id)
  WHERE task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS research_milestones_project_task_idx
  ON research_milestones(project_id, task_id)
  WHERE task_id IS NOT NULL;

COMMIT;

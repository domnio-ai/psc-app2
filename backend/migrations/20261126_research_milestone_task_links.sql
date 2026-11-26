-- Governed many-to-many links between research milestones and assignment tasks.
-- A task can support multiple milestones, but only within the research project
-- to which its parent assignment is linked.

CREATE TABLE IF NOT EXISTS research_milestone_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  milestone_id UUID NOT NULL REFERENCES research_milestones(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES assignment_tasks(id) ON DELETE CASCADE,
  linked_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (milestone_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_research_milestone_tasks_project
  ON research_milestone_tasks(project_id, milestone_id);
CREATE INDEX IF NOT EXISTS idx_research_milestone_tasks_task
  ON research_milestone_tasks(task_id);

CREATE OR REPLACE FUNCTION enforce_research_milestone_task_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  milestone_project UUID;
  linked_project UUID;
  task_assignment UUID;
BEGIN
  SELECT project_id INTO milestone_project
  FROM research_milestones
  WHERE id = NEW.milestone_id;

  IF milestone_project IS NULL OR milestone_project <> NEW.project_id THEN
    RAISE EXCEPTION 'Milestone does not belong to the supplied research project'
      USING ERRCODE = '23514';
  END IF;

  SELECT assignment_id INTO task_assignment
  FROM assignment_tasks
  WHERE id = NEW.task_id
    AND archived_at IS NULL;

  IF task_assignment IS NULL THEN
    RAISE EXCEPTION 'Task does not exist or is archived'
      USING ERRCODE = '23514';
  END IF;

  SELECT project_id INTO linked_project
  FROM research_assignment_links
  WHERE assignment_id = task_assignment;

  IF linked_project IS NULL OR linked_project <> NEW.project_id THEN
    RAISE EXCEPTION 'Task assignment is not linked to this research project'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS research_milestone_task_scope_guard
  ON research_milestone_tasks;
CREATE TRIGGER research_milestone_task_scope_guard
BEFORE INSERT OR UPDATE OF project_id, milestone_id, task_id
ON research_milestone_tasks
FOR EACH ROW
EXECUTE FUNCTION enforce_research_milestone_task_scope();

CREATE OR REPLACE FUNCTION prevent_research_milestone_orphaning()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'research_assignment_links' THEN
    IF EXISTS (
      SELECT 1
      FROM research_milestone_tasks mt
      JOIN assignment_tasks t ON t.id = mt.task_id
      WHERE mt.project_id = OLD.project_id
        AND t.assignment_id = OLD.assignment_id
    ) THEN
      RAISE EXCEPTION 'Unlink milestone tasks before unlinking the research assignment'
        USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'assignment_tasks' THEN
    IF EXISTS (
      SELECT 1 FROM research_milestone_tasks mt WHERE mt.task_id = OLD.id
    ) THEN
      RAISE EXCEPTION 'Unlink the research milestone before archiving or deleting the task'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS research_assignment_unlink_guard
  ON research_assignment_links;
CREATE TRIGGER research_assignment_unlink_guard
BEFORE DELETE ON research_assignment_links
FOR EACH ROW
EXECUTE FUNCTION prevent_research_milestone_orphaning();

DROP TRIGGER IF EXISTS research_milestone_task_delete_guard
  ON assignment_tasks;
CREATE TRIGGER research_milestone_task_delete_guard
BEFORE DELETE ON assignment_tasks
FOR EACH ROW
EXECUTE FUNCTION prevent_research_milestone_orphaning();

DROP TRIGGER IF EXISTS research_milestone_task_archive_guard
  ON assignment_tasks;
CREATE TRIGGER research_milestone_task_archive_guard
BEFORE UPDATE OF archived_at ON assignment_tasks
FOR EACH ROW
WHEN (OLD.archived_at IS DISTINCT FROM NEW.archived_at AND NEW.archived_at IS NOT NULL)
EXECUTE FUNCTION prevent_research_milestone_orphaning();

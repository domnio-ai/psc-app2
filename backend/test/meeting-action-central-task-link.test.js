import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const routes=fs.readFileSync("backend/src/meetings/meetings-routes.js","utf8");
const calendar=fs.readFileSync("backend/src/calendar-service.js","utf8");
const migration=fs.readFileSync("backend/migrations/20261125_03_meeting_action_task_links.sql","utf8");
const migrationPlan=fs.readFileSync("backend/src/production-migration-plan.js","utf8");
const setup=fs.readFileSync("backend/src/setup-database.js","utf8");
const workspace=fs.readFileSync("src/modules/meetings/MeetingsWorkspace.tsx","utf8");
const api=fs.readFileSync("src/modules/meetings/meetingsApi.ts","utf8");
const types=fs.readFileSync("src/modules/meetings/types.ts","utf8");

test("meeting actions can link one-to-one to an existing central assignment task",()=>{
  assert.match(migration,/ADD COLUMN IF NOT EXISTS assignment_task_id UUID/);
  assert.match(migration,/REFERENCES assignment_tasks\(id\) ON DELETE SET NULL/);
  assert.match(migration,/CREATE UNIQUE INDEX IF NOT EXISTS meeting_actions_assignment_task_unique/);
  assert.match(routes,/assignmentTaskScope/);
  assert.match(routes,/assertCanAccessAssignmentTask/);
  assert.match(routes,/api\/meetings\/:id\/linkable-tasks/);
  assert.match(routes,/assignment_task_id\)/);
  assert.match(routes,/already linked to another meeting action/);
  assert.match(routes,/Only the action owner, linked task owner\/reviewer or meeting manager/);
  assert.match(routes,/Meeting action linked to your task/);
  assert.match(routes,/Meeting action unlinked from your task/);
  assert.match(routes,/Task ownership and progress remain managed in Tasks/);
  assert.match(routes,/new Set\(\[task\.owner_id,task\.reviewer_id\]/);
});

test("linked meeting action state is derived from the central task lifecycle",()=>{
  assert.match(routes,/CASE WHEN linked\.id IS NULL THEN a\.status WHEN linked\.status='Not Started' THEN 'Open' ELSE linked\.status END status/);
  assert.match(routes,/UPDATE assignment_tasks SET status=\$2,progress=CASE WHEN \$2='Completed' THEN 100/);
  assert.match(routes,/sourceOfTruth:'assignment_tasks'/);
  assert.match(routes,/linked_task_status!=='Completed'/);
  assert.match(routes,/approved final Task Report publication workflow/);
  assert.match(routes,/linked_task_status/);
  assert.match(routes,/linked_task_title/);
  assert.match(routes,/status=\$8,updated_at=NOW\(\)/);
  assert.match(calendar,/ma\.assignment_task_id IS NULL/);
});

test("meeting calendar includes authorised meetings and standalone meeting actions without duplicating linked tasks",()=>{
  assert.match(calendar,/\bresearchDeadlines,milestones,reviews,notices,meetings,meetingActions,events,leave\b/);
  assert.match(calendar,/'meeting' type/);
  assert.match(calendar,/'meeting_action' type/);
  assert.match(calendar,/meeting_participants/);
  assert.match(calendar,/ma\.owner_id=ANY\(\$2::uuid\[\]\)/);
  assert.match(routes,/action\.owner_id=ANY\(\$2::uuid\[\]\)/);
});

test("meeting action task link migration is registered for production and development",()=>{
  assert.match(migrationPlan,/20261125_03_meeting_action_task_links\.sql/);
  assert.match(migrationPlan,/3B5A47B576194371927A67AB43D4F21C756F52E326F3BFED462E1251D06C67AF/);
  assert.match(setup,/20261125_03_meeting_action_task_links\.sql/);
});

test("meeting workspace exposes authorised task linking and linked status",()=>{
  assert.match(types,/MeetingTaskLinkOption/);
  assert.match(types,/linked_task_status/);
  assert.match(api,/linkableTasks:/);
  assert.match(api,/linkActionTask:/);
  assert.match(workspace,/Link existing assignment task/);
  assert.match(workspace,/no duplicate task is created/);
  assert.match(workspace,/Linked to Tasks:/);
  assert.match(workspace,/Unlink task/);
});

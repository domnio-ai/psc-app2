import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../migrations/045_research_milestone_task_links.sql", import.meta.url), "utf8");
const plan = fs.readFileSync(new URL("../src/production-migration-plan.js", import.meta.url), "utf8");
const setup = fs.readFileSync(new URL("../src/setup-database.js", import.meta.url), "utf8");
const api = fs.readFileSync(new URL("../../src/api.ts", import.meta.url), "utf8");
const panel = fs.readFileSync(new URL("../../src/modules/research/components/ResearchWorkPlanPanel.tsx", import.meta.url), "utf8");
const appUi = fs.readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");

test("research milestone central task relation is nullable, unique and migration-managed", () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES assignment_tasks\(id\) ON DELETE SET NULL/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS research_milestones_task_id_unique/);
  assert.match(migration, /WHERE task_id IS NOT NULL/);
  assert.match(plan, /045_research_milestone_task_links\.sql/);
  assert.match(plan, /A69F3A7219A16E658120FFC86E11F2D3C12785101D18CDE386B3EE3CA935C702/);
  assert.match(setup, /045_research_milestone_task_links\.sql/);
});

test("linking a milestone requires an existing task in a linked assignment and valid team ownership", () => {
  const start = app.indexOf("app.post('/api/research/:id/milestones/:milestoneId/link-task'");
  const end = app.indexOf("app.delete('/api/research/:id/milestones/:milestoneId/link-task'", start);
  assert.ok(start >= 0 && end > start, "link route must exist before unlink route");
  const route = app.slice(start, end);
  assert.match(route, /canEditResearch/);
  assert.match(route, /research_assignment_links/);
  assert.match(route, /research_collaborators/);
  assert.match(route, /assignment_members/);
  assert.match(route, /canAccessAssignment/);
  assert.match(route, /task\.owner_id!==milestone\.owner_id/);
  assert.match(route, /task_owner\.active=TRUE/);
  assert.match(route, /task_id/);
  assert.match(route, /MILESTONE_TASK_LINKED/);
  assert.match(route, /RESEARCH_MILESTONE_TASK_LINKED/);
});

test("linked milestone progress is read from its central task and cannot bypass task completion governance", () => {
  assert.match(app, /'linked_task',CASE WHEN linked_task\.id IS NULL THEN NULL ELSE json_build_object/);
  assert.match(app, /linked_task\.status='Completed'/);
  assert.match(app, /This milestone is linked to a central assignment task\. Update its status through the task workflow/);
  assert.match(app, /app\.delete\('\/api\/research\/:id\/milestones\/:milestoneId\/link-task'/);
  assert.match(api, /linkResearchMilestoneTask/);
  assert.match(api, /unlinkResearchMilestoneTask/);
});

test("research work plan lets users link or unlink an existing task and reflects central progress", () => {
  assert.match(panel, /api\.assignmentTasks\(token, assignmentId\)/);
  assert.match(panel, /Link an existing assignment task/);
  assert.match(panel, /Unlink task/);
  assert.match(panel, /milestone\.linked_task\.progress/);
  assert.match(panel, /disabled=\{Boolean\(milestone\.linked_task\)\}/);
  assert.match(appUi, /onLinkTask=\{async \(milestoneId, taskId\)/);
  assert.match(appUi, /onUnlinkTask=\{async \(milestoneId\)/);
});

test("linked research milestone tasks cannot be archived and link/archive operations serialize on the task row", () => {
  const linkStart = app.indexOf("app.post('/api/research/:id/milestones/:milestoneId/link-task'");
  const unlinkStart = app.indexOf("app.delete('/api/research/:id/milestones/:milestoneId/link-task'", linkStart);
  const archiveStart = app.indexOf("app.post('/api/assignments/:id/tasks/:taskId/archive'");
  const archiveEnd = app.indexOf("app.delete('/api/assignments/:id/tasks/:taskId'", archiveStart);
  assert.ok(linkStart >= 0 && unlinkStart > linkStart);
  assert.ok(archiveStart >= 0 && archiveEnd > archiveStart);
  const linkRoute = app.slice(linkStart, unlinkStart);
  const archiveRoute = app.slice(archiveStart, archiveEnd);
  assert.match(linkRoute, /SELECT id,archived_at FROM assignment_tasks WHERE id=\$1 FOR UPDATE/);
  assert.match(linkRoute, /lockedTask\.archived_at/);
  assert.match(archiveRoute, /EXISTS\(SELECT 1 FROM research_milestones rm WHERE rm\.task_id=t\.id\) AS linked_research_milestone/);
  assert.match(archiveRoute, /FOR UPDATE OF t/);
  assert.match(archiveRoute, /if\(task\.linked_research_milestone\)throw Object\.assign/);
  assert.match(archiveRoute, /Unlink it from the Research Work Plan before archiving the task/);
});

test("dashboard milestone lists, counts and due notifications use linked task status as the source of truth", () => {
  const dashboardStart = app.indexOf("app.get('/api/dashboard'");
  const dashboardEnd = app.indexOf("app.get('/api/", dashboardStart + 20);
  const dashboard = app.slice(dashboardStart, dashboardEnd > dashboardStart ? dashboardEnd : undefined);
  const notificationStart = app.indexOf("const syncResearchNotificationsForUser");
  const notificationEnd = app.indexOf("app.get('/api/pulse'", notificationStart);
  const notifications = app.slice(notificationStart, notificationEnd);
  const effectiveStatus = /CASE WHEN linked_task\.id IS NULL THEN m\.status WHEN linked_task\.status='Completed' THEN 'Completed' WHEN linked_task\.status='Not Started' THEN 'Pending' ELSE 'In Progress' END/;
  assert.match(dashboard, effectiveStatus);
  assert.match(dashboard, /LEFT JOIN assignment_tasks linked_task ON linked_task\.id=m\.task_id/);
  assert.match(notifications, effectiveStatus);
  assert.match(notifications, /LEFT JOIN assignment_tasks linked_task ON linked_task\.id=m\.task_id/);
});

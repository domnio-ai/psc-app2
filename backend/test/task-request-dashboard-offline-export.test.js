import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../../src/App.tsx');
const tasks = read('../../src/modules/tasks/TasksWorkspaceEntry.tsx');
const notifications = read('../../src/NotificationCenter.tsx');
const taskCss = read('../../src/modules/tasks/tasks-workspace.css');
const dashboardCss = read('../../src/modules/dashboard/dashboard-task-requests.css');

test('Dashboard loads Task Requests through the existing authenticated, scoped API', () => {
  assert.match(app, /api\.taskRequests\(token\)/);
  assert.match(app, /item\.can_decide && item\.status === "Pending"/);
  assert.match(app, /item\.is_mine && item\.status === "Pending"/);
  assert.match(app, /Awaiting your approval/);
  assert.match(app, /My pending requests/);
});

test('Dashboard approval and own-request cards open the matching Task Workspace queue', () => {
  assert.match(app, /dashboardRequestPicker === "approvals"/);
  assert.match(app, /dashboardRequestPicker === "mine"/);
  assert.match(app, /requestId: selectedRequest\.id, intent: "approval"/);
  assert.match(app, /requestId: selectedRequest\.id, intent: "focus"/);
  assert.match(tasks, /requestedTaskRequestView\?: "Task Requests" \| "Requests for Approval" \| null/);
  assert.match(tasks, /setView\(requestedTaskRequestView\)/);
});

test('Task request approval notifications are classified as Reviews in the notification UI', () => {
  assert.match(notifications, /item\.entity_type === "assignment_task_request"/);
  assert.match(notifications, /task request awaiting approval/i);
  assert.match(notifications, /return "Review"/);
});

test('Requesters and supervisors can download an offline request brief', () => {
  assert.match(tasks, /Download request brief/);
  assert.match(tasks, /downloadTaskRequestPack\(request\)/);
  assert.match(tasks, /pending supervisor approval/i);
  assert.match(tasks, /Do not commence the task until it is approved/);
});

test('Permitted Task rows can download an editable offline work pack', () => {
  assert.match(tasks, /Download offline work pack/);
  assert.match(tasks, /downloadTaskPack\(task\)/);
  assert.match(tasks, /task\.blank_content \|\| task\.contribution_report_html/);
  assert.match(tasks, /offlineDraftText/);
  assert.match(tasks, /application\/rtf;charset=utf-8/);
  assert.match(tasks, /\.rtf`/);
});

test('Offline work pack preserves the Task Report governance path', () => {
  assert.match(tasks, /does not submit a report, approve work, or mark a task complete/);
  assert.match(tasks, /return to APP2 and enter or paste the completed work into the Task Report/);
  assert.match(tasks, /review, approval, and Repository publication remain governed by APP2/);
});

test('Dashboard and task action styling is isolated in dedicated/canonical stylesheets', () => {
  assert.match(app, /dashboard-task-requests\.css/);
  assert.match(dashboardCss, /\.dashboard-task-requests/);
  assert.match(taskCss, /\.standalone-task-actions/);
  assert.match(taskCss, /\.task-request-actions/);
});

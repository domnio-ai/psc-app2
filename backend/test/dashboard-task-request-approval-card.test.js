import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../../src/App.tsx');
const dashboard = read('../../src/modules/dashboard/ProgressiveDashboard.tsx');
const css = read('../../src/modules/dashboard/dashboard-task-requests.css');
const pickerCss = read('../../src/modules/dashboard/dashboard-record-picker.css');

test('Dashboard approval-card count comes from permission-scoped pending Task Requests', () => {
  assert.match(app, /showTaskRequestApprovalCard=\{isManager\}/);
  assert.match(app, /dashboardTaskRequests\.filter\(\(item\) => item\.can_decide && item\.status === "Pending"\)\.length/);
  assert.match(app, /taskRequestApprovalItems=\{dashboardTaskRequests\.filter\(\(item\) => item\.can_decide && item\.status === "Pending"\)\}/);
});

test('Task Requests Awaiting Approval appears as a separate card and opens a record chooser', () => {
  assert.match(dashboard, /module === "Tasks" && showTaskRequestApprovalCard/);
  assert.match(dashboard, /Task Requests Awaiting Approval/);
  assert.match(dashboard, /taskRequestApprovalCount/);
  assert.match(dashboard, /onClick=\{\(\) => setRecordPicker\(\{/);
  assert.match(dashboard, /onSelect: \(\) => onOpenTaskRequestApprovals\?\.\(request\.id\)/);
});

test('Choosing an approval request opens exactly the selected pending request', () => {
  assert.match(app, /item\.id === requestId && item\.can_decide && item\.status === "Pending"/);
  assert.match(app, /setDashboardTaskRequestTarget\(\{ requestId: selectedRequest\.id, intent: "approval" \}\)/);
});

test('Approval card is keyboard-focusable and retains dashboard card styling', () => {
  assert.match(dashboard, /type="button"/);
  assert.match(dashboard, /Task Requests Awaiting Approval/);
  assert.match(css, /dashboard-task-request-approval-card-style/);
  assert.match(css, /pulse-task-request-approval-card:focus-visible/);
  assert.match(pickerCss, /:focus-visible/);
});

test('Approval card is permission-gated and does not change task execution counts', () => {
  assert.match(dashboard, /showTaskRequestApprovalCard\?:boolean/);
  assert.match(dashboard, /module === "Tasks" && showTaskRequestApprovalCard/);
  assert.match(dashboard, /Object\.entries\(visibleCounts\)\.map/);
  assert.match(dashboard, /pulse-task-request-approval-card/);
});

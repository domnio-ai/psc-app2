import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../../src/App.tsx');
const dashboard = read('../../src/modules/dashboard/ProgressiveDashboard.tsx');
const picker = read('../../src/modules/dashboard/DashboardRecordPickerModal.tsx');
const pickerCss = read('../../src/modules/dashboard/dashboard-record-picker.css');

test('Tasks, Assignments and Research cards build a matching-record chooser before opening a workspace', () => {
  assert.match(dashboard, /\["Tasks", "Assignments", "Research Repository"\]\.includes\(module\)/);
  assert.match(dashboard, /const sourceRows = data\.modules\[module\]\?\.rows \|\| \[\]/);
  assert.match(dashboard, /const matchingRows = label === "All" \? sourceRows : sourceRows\.filter\(\(row\) => row\.buckets\.includes\(label\)\)/);
  assert.match(dashboard, /items: matchingRows\.map\(\(row\) =>/);
  assert.doesNotMatch(dashboard, /openRememberedRecord\(matchingRows\[0\]\)/);
});

test('The user explicitly selects a listed item before its open callback is invoked', () => {
  assert.match(picker, /role="dialog"/);
  assert.match(picker, /aria-modal="true"/);
  assert.match(picker, /onClick=\{\(\) => void selectItem\(item\)\}/);
  assert.match(picker, /await item\.onSelect\(\)/);
  assert.match(picker, /Choose an action above or select a specific authorised record below\./);
  assert.match(picker, /Available module actions/);
});

test('Chooser includes accessible search, status metadata, Escape handling and a cancel action', () => {
  assert.match(picker, /type="search"/);
  assert.match(picker, /document\.addEventListener\("keydown", onKeyDown\)/);
  assert.match(picker, /event\.key === "Escape"/);
  assert.match(picker, /className="dashboard-record-picker-footer"/);
  assert.match(picker, /onClick=\{onClose\}/);
  assert.match(pickerCss, /max-height: min\(82vh, 820px\)/);
  assert.match(pickerCss, /overflow: auto/);
});

test('Task Requests Awaiting Approval chooser contains only scoped pending requests', () => {
  assert.match(app, /taskRequestApprovalItems=\{dashboardTaskRequests\.filter\(\(item\) => item\.can_decide && item\.status === "Pending"\)\}/);
  assert.match(dashboard, /onSelect: \(\) => onOpenTaskRequestApprovals\?\.\(request\.id\)/);
  assert.match(app, /item\.id === requestId && item\.can_decide && item\.status === "Pending"/);
  assert.match(app, /setDashboardTaskRequestTarget\(\{ requestId: selectedRequest\.id, intent: "approval" \}\)/);
});

test('Top-level Awaiting Approval and My Pending Requests cards also wait for an item selection', () => {
  assert.match(app, /onClick=\{\(\) => setDashboardRequestPicker\("approvals"\)\}/);
  assert.match(app, /onClick=\{\(\) => setDashboardRequestPicker\("mine"\)\}/);
  assert.match(app, /open=\{dashboardRequestPicker === "approvals"\}/);
  assert.match(app, /open=\{dashboardRequestPicker === "mine"\}/);
  assert.match(app, /requestId: selectedRequest\.id, intent: "focus"/);
});

test('Chooser selection uses existing authorised workspace routing for Task, Assignment and Research records', () => {
  assert.match(dashboard, /onSelect: \(\) => onOpen\(row\)/);
  assert.match(app, /if \(item\.type === "Assignment"\)/);
  assert.match(app, /await openAssignmentDetails\(assignment\)/);
  assert.match(app, /if \(item\.type === "Task"\)/);
  assert.match(app, /await openStandaloneTask\(item\.id\)/);
  assert.match(app, /api\.researchProject\(token, projectId\)/);
  assert.match(app, /await openResearchWorkspace\(project/);
});

test('Selection cards accurately indicate that the next step is choosing a record', () => {
  assert.match(dashboard, /chooserModule \? "Choose item" : "View"/);
  assert.match(dashboard, /Choose request/);
  assert.match(dashboard, /const countLabel = chooserModule/);
});

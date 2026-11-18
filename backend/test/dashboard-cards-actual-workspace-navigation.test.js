import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../../src/App.tsx");
const dashboard = read("../../src/modules/dashboard/ProgressiveDashboard.tsx");
const tasks = read("../../src/modules/tasks/TasksWorkspaceEntry.tsx");
const workspace = read("../../src/modules/tasks/TaskWorkspaceEntry.tsx");
const picker = read("../../src/modules/dashboard/DashboardRecordPickerModal.tsx");

test("Tasks, Assignments and Research cards open a selection dialog rather than auto-opening an arbitrary record", () => {
  assert.match(dashboard, /\["Tasks", "Assignments", "Research Repository"\]\.includes\(module\)/);
  assert.match(dashboard, /const matchingRows = label === "All" \? sourceRows : sourceRows\.filter/);
  assert.match(dashboard, /setRecordPicker\(\{/);
  assert.match(dashboard, /onSelect: \(\) => onOpen\(row\)/);
  assert.doesNotMatch(dashboard, /openRememberedRecord\(matchingRows\[0\]\)/);
  assert.match(picker, /Choose an action above or select a specific authorised record below\./);
  assert.match(picker, /Available module actions/);
  assert.match(picker, /await item\.onSelect\(\)/);
});

test("selecting a specific Task opens its actual Task workspace", () => {
  assert.match(app, /if \(item\.type === "Task"\) \{\s*await openStandaloneTask\(item\.id\)/);
  assert.match(workspace, /ref=\{workspaceRef\}/);
  assert.match(workspace, /querySelector<HTMLElement>\("\.task-screen-title h2"\)/);
  assert.match(workspace, /heading\.focus\(\{ preventScroll: true \}\)/);
});

test("approval dashboard cards list pending authorised requests and open only the selected request", () => {
  assert.match(app, /taskRequestApprovalItems=\{dashboardTaskRequests\.filter\(\(item\) => item\.can_decide && item\.status === "Pending"\)\}/);
  assert.match(dashboard, /onSelect: \(\) => onOpenTaskRequestApprovals\?\.\(request\.id\)/);
  assert.match(app, /item\.id === requestId && item\.can_decide && item\.status === "Pending"/);
  assert.match(app, /intent: "approval"/);
  assert.match(tasks, /target\.intent === "approval"[\s\S]*void openApproval\(request\)/);
  assert.match(tasks, /autoFocus[\s\S]*value=\{approvalDraft\.title\}/);
});

test("My pending requests shows a chooser and focuses only the request the user selected", () => {
  assert.match(app, /dashboardRequestPicker === "mine"/);
  assert.match(app, /item\.is_mine && item\.status === "Pending"/);
  assert.match(app, /requestId: selectedRequest\.id, intent: "focus"/);
  assert.match(tasks, /id=\{`task-request-\$\{request\.id\}`\} tabIndex=\{-1\}/);
  assert.match(tasks, /entry\.scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/);
  assert.match(tasks, /entry\.focus\(\{ preventScroll: true \}\)/);
});

test("request-level navigation still validates refreshed permission-scoped request data", () => {
  assert.match(tasks, /handledRequestTargetRef\.current === targetKey/);
  assert.match(tasks, /if \(!active \|\| !requestsReady \|\| handledRequestTargetRef\.current === targetKey\) return/);
  assert.match(tasks, /request && request\.can_decide && request\.status === "Pending"/);
  assert.match(tasks, /request && request\.is_mine/);
});

test("sidebar Notifications opens the full notification workspace", () => {
  assert.match(app, /const navigateSidebar = \(destination:string\) => \{\s*dashboardReturnRef\.current=null;\s*if\(destination==='Notifications'\)\{navigateTo\('Notifications'\);return;\}/);
  assert.doesNotMatch(app, /const shared=\[[^\]]*'Notifications'/);
});

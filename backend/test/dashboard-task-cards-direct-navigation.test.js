import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../../src/App.tsx');
const dashboard = read('../../src/modules/dashboard/ProgressiveDashboard.tsx');
const tasks = read('../../src/modules/tasks/TasksWorkspaceEntry.tsx');
const shortcutType = read('../../src/modules/tasks/taskDashboardShortcut.ts');
const picker = read('../../src/modules/dashboard/DashboardRecordPickerModal.tsx');

test('Task, Assignment and Research status cards offer matching records in a chooser', () => {
  assert.match(dashboard, /\["Tasks", "Assignments", "Research Repository"\]\.includes\(module\)/);
  assert.match(dashboard, /const matchingRows = label === "All" \? sourceRows : sourceRows\.filter/);
  assert.match(dashboard, /items: matchingRows\.map/);
  assert.match(dashboard, /setRecordPicker\(\{/);
  assert.doesNotMatch(dashboard, /openRememberedRecord\(matchingRows\[0\]\)/);
});

test('A workspace opens only when a user selects a specific item in the chooser', () => {
  assert.match(picker, /onClick=\{\(\) => void selectItem\(item\)\}/);
  assert.match(picker, /await item\.onSelect\(\)/);
  assert.match(dashboard, /onSelect: \(\) => onOpen\(row\)/);
});

test('Manager and individual task workspace scopes stay intact after an item is selected', () => {
  assert.match(tasks, /setView\(isManager \? "All Permitted" : "My Tasks"\)/);
  assert.match(tasks, /if \(isManager \|\| rows\.some\(\(task\) => task\.owner_id !== currentUserId/);
});

test('Legacy dashboard shortcut contract remains compatible but is not the default card click behaviour', () => {
  assert.match(tasks, /dashboardShortcut\.taskIds\.includes\(task\.id\)/);
  assert.match(tasks, /Showing \{dashboardShortcut\.label\} tasks/);
  assert.match(tasks, /Clear filter/);
  assert.match(tasks, /setDashboardShortcut\(null\)/);
  assert.doesNotMatch(dashboard, /onOpenTaskDashboardShortcut\(label as TaskDashboardShortcutLabel, matchingTasks/);
});

test('Task shortcut labels cover every task status and approval requests use a separate chooser', () => {
  for (const label of ['All','Assigned','In Progress','Almost Due','Overdue','Under Review','Returned','Completed']) {
    assert.ok(shortcutType.includes(`"${label}"`), `missing label: ${label}`);
  }
  assert.match(dashboard, /Task Requests Awaiting Approval/);
  assert.match(dashboard, /onOpenTaskRequestApprovals\?\.\(request\.id\)/);
});

test('Task cards use clear names and omit the DRILL-DOWN eyebrow', () => {
  assert.doesNotMatch(dashboard, /pulse-card-eyebrow[^\n]*Drill-down/i);
  assert.doesNotMatch(dashboard, /pulse-card-eyebrow[^\n]*Task workflow/i);
  assert.match(dashboard, /<span className="pulse-card-title">\{label\}<\/span>/);
  assert.match(dashboard, /const itemWord = module === "Tasks" \? "task" : module === "Assignments" \? "assignment" : "research item"/);
  assert.match(dashboard, /chooserModule \? "Choose item" : "View"/);
});

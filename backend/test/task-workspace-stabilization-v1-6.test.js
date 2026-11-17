import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = fs.existsSync(path.resolve(process.cwd(), 'src/App.tsx'))
  ? process.cwd()
  : path.resolve(process.cwd(), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('task reviewer picker is a shared module used by editor and preview', () => {
  const app = read('src/App.tsx');
  const preview = read('src/modules/tasks/TaskReportPreviewPanel.tsx');
  const workspace = read('src/modules/assignments/components/TaskSectionWorkspace.tsx');
  const picker = read('src/modules/tasks/TaskReportReviewerPicker.tsx');
  assert.match(picker, /export default function TaskReportReviewerPicker/);
  assert.match(preview, /<TaskReportReviewerPicker/);
  assert.match(workspace, /<TaskReportReviewerPicker/);
});

test('task draft preview uses the dedicated preview endpoint and just-saved override', () => {
  const app = read('src/App.tsx');
  assert.match(app, /shouldUseDraftTaskPreview\(selectedAssignmentTask, user\?\.id\)/);
  assert.match(app, /api\.previewAssignmentTaskContribution/);
  assert.match(app, /openAssignmentTaskContributionPreview\(\{[\s\S]*key: taskReportSectionModal\.key,[\s\S]*value,/);
});

test('reviewer selection is saved by its picker and preview reads the saved assignment', () => {
  const workspace = read('src/modules/assignments/components/TaskSectionWorkspace.tsx');
  const app = read('src/App.tsx');
  const previewStart = app.indexOf('{assignmentTaskReportPreviewOpen && (');
  const previewEnd = app.indexOf('</TaskReportPreviewErrorBoundary>', previewStart);
  const preview = app.slice(previewStart, previewEnd);
  assert.match(workspace, /const persistTaskReviewerChoice = async/);
  assert.match(workspace, /await props\.onSave\(latestValue, nextReviewerId\)/);
  assert.match(workspace, /onPreviewReport\(latestValue, undefined\)/);
  assert.match(preview, /selectedReviewerId=\{selectedAssignmentTask\?\.reviewer_id \|\| ""\}/);
  assert.match(preview, /onReviewerChange=\{\(reviewerId\) => \{\s*void selectAssignmentTaskReviewer\(reviewerId\)/);
});

test('task report reviewer control is persistent rather than hidden behind Review ribbon', () => {
  const workspace = read('src/modules/assignments/components/TaskSectionWorkspace.tsx');
  assert.match(workspace, /task-report-governance-bar/);
  assert.match(workspace, /Reviewer for this Task Report/);
  assert.match(workspace, /props\.workspaceVariant !== "task-report"/);
});

test('task overview exposes operational task details', () => {
  const header = read('src/modules/assignments/components/AssignmentTaskWorkspaceHeader.tsx');
  assert.match(header, /TASK OVERVIEW/);
  assert.match(header, /task\.task_purpose/);
  assert.match(header, /task\.specific_instructions/);
  assert.match(header, /task\.expected_findings/);
  assert.match(header, /task\.evidence_required/);
});

test('task report draft preference and reviewer workflow have dedicated task modules', () => {
  const flow = read('src/modules/tasks/taskReportDraftWorkflow.ts');
  assert.match(flow, /shouldUseDraftTaskPreview/);
  assert.match(flow, /taskReportTemplatePreferenceKey/);
  const workspace = read('src/modules/assignments/components/TaskSectionWorkspace.tsx');
  assert.match(workspace, /taskReportTemplatePreferenceKey\(contextTitle \|\| reportTitle\)/);
});

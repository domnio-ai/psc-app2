import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workspace = fs.readFileSync(
  path.join(root, 'src/modules/assignments/components/TaskSectionWorkspace.tsx'),
  'utf8',
);
const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/api.ts'), 'utf8');
const backend = fs.readFileSync(path.join(root, 'backend/src/app.js'), 'utf8');

test('task template selection survives closing and reopening the builder', () => {
  const draftWorkflow = fs.readFileSync(
    path.join(root, 'src/modules/tasks/taskReportDraftWorkflow.ts'),
    'utf8',
  );
  assert.match(draftWorkflow, /app2-task-report-template:/);
  assert.match(draftWorkflow, /taskReportTemplatePreferenceKey/);
  assert.match(workspace, /taskReportTemplatePreferenceKey\(contextTitle \|\| reportTitle\)/);
  assert.match(workspace, /window\.localStorage\.getItem\(taskTemplateStorageKey\)/);
  assert.match(workspace, /window\.localStorage\.setItem\(taskTemplateStorageKey, templateId\)/);
  assert.match(workspace, /props\.currentTemplateId \|\| readPersistedTaskTemplateId\(\)/);
});

test('task report submission offers backend-authoritative eligible reviewer candidates instead of only the preassigned reviewer', () => {
  const reviewerAuthority = fs.readFileSync(
    path.join(root, 'src/modules/tasks/useTaskReportReviewerOptions.ts'),
    'utf8',
  );
  assert.match(app, /useTaskReportReviewerOptions\(\{/);
  assert.match(app, /const taskReportReviewerCandidates = taskReportReviewerAuthority\.options/);
  assert.match(app, /reviewerOptions=\{taskReportReviewerCandidates\}/);
  assert.match(app, /Select an eligible reviewer before submitting this TASK Report/);
  assert.match(reviewerAuthority, /api\s*\.\s*assignmentReviewerCandidates\(token, assignmentId, ownerId\)/);
  assert.doesNotMatch(app, /const taskReportReviewerCandidates = selectedAssignmentTask\s*\?\s*deriveTaskReviewerOptions/);
});

test('selected reviewer is governed and persisted before task report submission', () => {
  assert.match(api, /assignAssignmentTaskReviewer:/);
  assert.match(api, /tasks\/\$\{taskId\}\/reviewer/);
  assert.match(app, /api\.assignAssignmentTaskReviewer\(/);
  assert.match(backend, /tasks\/:taskId\/reviewer/);
  assert.match(backend, /current\.contribution_status!==['"]Draft['"]/);
  assert.match(backend, /The task assignee cannot review their own work/);
  assert.match(backend, /isEligibleAssignmentTaskReviewer\(/);
  assert.match(backend, /TASK_REVIEWER_SELECTED/);
});

test('closing preview returns to the task report context instead of assignment overview', () => {
  assert.match(app, /taskReportPreviewReturnSectionRef/);
  assert.match(app, /closeAssignmentTaskReportPreview/);
  assert.match(app, /setTaskReportSectionModal\(\{ key: returnSection, mode: "edit" \}\)/);
  assert.match(app, /if \(selectedAssignmentTask\) \{\s*setTaskReportSectionModal\(null\);\s*return;/);
  assert.match(app, /onClose=\{closeAssignmentTaskReportPreview\}/);
});


test('task report Preview lets the draft owner choose the reviewer before submission', () => {
  const reviewerPicker = fs.readFileSync(
    path.join(root, 'src/modules/tasks/TaskReportReviewerPicker.tsx'),
    'utf8',
  );
  const workspace = fs.readFileSync(path.join(root, 'src/modules/assignments/components/TaskSectionWorkspace.tsx'), 'utf8');
  assert.match(workspace, /<TaskReportReviewerPicker/);
  assert.match(workspace, /label="Reviewer for this Task Report"/);
  assert.match(app, /taskReportReviewerCandidates/);
  assert.match(app, /api\.assignAssignmentTaskReviewer\(/);
  assert.match(app, /selectedAssignmentTask\?\.contribution_status === "Draft"/);
  assert.match(reviewerPicker, /Self-review is not permitted/);
});

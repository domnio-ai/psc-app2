import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = fs.existsSync('src/App.tsx') ? '.' : '..';
const app = fs.readFileSync(`${root}/src/App.tsx`, 'utf8');
const workspace = fs.readFileSync(`${root}/src/modules/assignments/components/TaskSectionWorkspace.tsx`, 'utf8');
const layout = fs.readFileSync(`${root}/src/modules/report-builder/styles/report-builder-command-layout.css`, 'utf8');

test('task report exit path protects unsaved changes', () => {
  assert.match(workspace, /APP2_TASK_REPORT_CLOSE_SAVE_V1/);
  assert.match(workspace, /const saveClosingDraftAndRemember = async \(\) =>/);
  assert.match(workspace, /Draft saved\. Closing workspace\.\.\./);
  assert.match(workspace, /The latest Task Report changes could not be saved/);
  assert.match(workspace, /A newer Task Report draft exists on the server/);
  assert.match(workspace, /Close without saving and reopen the task/);
  assert.match(workspace, /beforeunload/);
  assert.match(workspace, /onClick=\{\(\) => void requestClose\(\)\}/);
});

test('save draft updates the local saved snapshot used by the exit guard', () => {
  assert.match(workspace, /const saveDraftAndRemember = async \(\) =>/);
  assert.match(workspace, /lastSavedValueRef\.current = latestValue/);
});

test('task preview keeps the editor open when full preview cannot open', () => {
  assert.match(app, /const openAssignmentTaskContributionPreview = async \([\s\S]*?\): Promise<boolean>/);
  assert.match(app, /const opened = await openAssignmentTaskContributionPreview\(\{/);
  assert.match(app, /if \(!opened\) \{/);
  assert.match(app, /Your saved draft remains in the editor/);
});

test('task preview reports an explicit visible error instead of silently failing', () => {
  assert.match(app, /setAssignmentTaskReviewResult\(\{ tone: "error", message \}\)/);
  assert.match(workspace, /The full Task Report preview could not be opened/);
});

test('task report review command deck has enough vertical room to avoid clipping', () => {
  assert.match(layout, /TASK REPORT WORKFLOW STABILITY[\s\S]{1,3}V1\.5 R4/);
  assert.match(layout, /task-report-builder-v1 \.report-command-row[\s\S]*grid-template-rows: 36px 56px/);
  assert.match(layout, /task-report-builder-v1 \.report-command-workflow-slot[\s\S]*height: 56px/);
});

test('reviewer-in-preview continuity remains present through shared reviewer picker', () => {
  const workspace = fs.readFileSync(`${root}/src/modules/assignments/components/TaskSectionWorkspace.tsx`, 'utf8');
  assert.match(workspace, /<TaskReportReviewerPicker/);
  assert.match(workspace, /label="Reviewer for this Task Report"/);
  assert.match(app, /const selectAssignmentTaskReviewerFromPreview = selectAssignmentTaskReviewer/);
});


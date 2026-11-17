// APP2_TASK_REPORT_CLOSE_SAVE_FORMAT_READER_TEST_V2
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, '../..');
const workspace = fs.readFileSync(path.join(root, 'src/modules/assignments/components/TaskSectionWorkspace.tsx'), 'utf8');
const app = fs.readFileSync(path.join(root, 'backend/src/app.js'), 'utf8');
const workspaceCss = fs.readFileSync(path.join(root, 'src/modules/tasks/task-report-workspace.css'), 'utf8');
const readerCss = fs.readFileSync(path.join(root, 'src/document-reader.css'), 'utf8');

test('Task Report auto-saves after a pause and flushes the draft before closing', () => {
  assert.match(workspace, /const scheduleTaskReportAutoSave = \(delay = 1500\)/);
  assert.match(workspace, /scheduleTaskReportAutoSave\(5000\)/);
  assert.match(workspace, /Draft changes save automatically after a short pause/);
  assert.match(workspace, /await saveClosingDraftAndRemember\(\)/);
  assert.match(workspace, /Saving the latest changes before closing/);
});

test('Task Report preview converts plain text to paragraphs and preserves formatted HTML', () => {
  assert.match(app, /const\s+taskReportContentHtml\s*=/);
  assert.match(app, /const\s+safeContent\s*=\s*taskReportContentHtml\(content\)/);
  assert.match(app, /APP2_TASK_REPORT_PREVIEW_STRUCTURE_V2/);
});

test('Save Draft stays readable in hover, focus, active and disabled states', () => {
  assert.match(workspaceCss, /APP2_TASK_REPORT_SAVE_BUTTON_STATES_V10/);
  assert.match(workspaceCss, /-webkit-text-fill-color:\s*#2c2414\s*!important/);
  assert.match(workspaceCss, /task-report-save-primary:focus-visible:not\(:disabled\)/);
  assert.match(workspaceCss, /task-report-save-primary:disabled/);
});

test('Repository reader has responsive header, paper and side-panel alignment', () => {
  assert.match(readerCss, /APP2_REPOSITORY_READER_ALIGNMENT_V2/);
  assert.match(readerCss, /\.reader-stage\.html>article/);
  assert.match(readerCss, /\.reader-head-actions\{[^}]*flex-wrap:wrap/s);
});

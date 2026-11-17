import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("src/App.tsx", "utf8");
const preview = fs.readFileSync("src/modules/tasks/TaskReportPreviewPanel.tsx", "utf8");
const modalCss = fs.readFileSync("src/assignment-task-workspace.css", "utf8");
const scrollCss = fs.readFileSync("src/modules/tasks/task-final-shared-v1-1.css", "utf8");

test("reviewer picker is removed from the external App overlay", () => {
  assert.doesNotMatch(app, /task-report-preview-reviewer-dock/);
  assert.match(app, /reviewerOptions=\{taskReportReviewerCandidates\}/);
});

test("reviewer selector appears inside the preview footer before the action buttons", () => {
  const footer = preview.indexOf("<footer>");
  const selector = preview.indexOf("task-preview-reviewer-selection", footer);
  const action = preview.indexOf("task-modal-secondary", footer);
  assert.ok(footer >= 0 && selector > footer && selector < action);
  assert.match(preview, /onChange=\{onReviewerChange\}/);
});

test("reviewer footer has its own row and responsive layout", () => {
  assert.match(modalCss, /APP2_REVIEWER_IN_FOOTER_V2/);
  assert.match(modalCss, /grid-column:\s*1\s*\/\s*-1/);
});

test("Task Workspace has one scroll owner and footer in normal flow", () => {
  assert.match(scrollCss, /APP2_TASK_WORKSPACE_SCROLL_FLOW_V1/);
  assert.match(scrollCss, /overflow-y:\s*auto\s*!important/);
  assert.match(scrollCss, /height:\s*auto\s*!important/);
  assert.match(scrollCss, /position:\s*relative\s*!important/);
});
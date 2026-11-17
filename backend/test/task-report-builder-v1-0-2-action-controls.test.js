import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workspace = fs.readFileSync("src/modules/assignments/components/TaskSectionWorkspace.tsx", "utf8");
const editor = fs.readFileSync("src/modules/report-editor/App2LexicalReportEditor.tsx", "utf8");
const html = fs.readFileSync("src/modules/report-editor/reportHtml.ts", "utf8");
const css = fs.readFileSync("src/modules/tasks/task-report-workspace.css", "utf8");

test("Task Report Builder V1.0.2 exposes persistent Save and Preview actions", () => {
  assert.match(workspace, /task-report-primary-actions/);
  assert.match(workspace, /task-report-save-primary/);
  assert.match(workspace, /task-report-preview-primary/);
  assert.match(workspace, /onClick=\{handleSaveDraft\}/);
  assert.match(workspace, /onClick=\{handlePreview\}/);
});

test("Task Report Builder V1.0.2 removes duplicate task Save and Preview controls", () => {
  assert.match(workspace, /editMode && props\.workspaceVariant !== "task-report"/);
  assert.match(workspace, /props\.workspaceVariant !== "task-report" && \(/);
});

test("indent/outdent are supported for paragraphs and lists without a separate editor extension", () => {
  assert.match(editor, /case "indent"/);
  assert.match(editor, /case "outdent"/);
  assert.match(editor, /Math\.min\(current \+ 1, 6\)/);
  assert.match(editor, /Math\.max\(current - 1, 0\)/);
  assert.match(html, /data-app2-indent/);
});

test("Task primary actions remain visible in the refined theme", () => {
  assert.match(css, /APP2 TASK REPORT BUILDER V1\.0\.2 - persistent primary actions/);
  assert.match(css, /task-report-primary-actions/);
  assert.match(css, /report-command-row[\s\S]*overflow: visible !important/);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const workspace = read("src/modules/assignments/components/TaskSectionWorkspace.tsx");
const editor = read("src/modules/report-editor/App2LexicalReportEditor.tsx");
const html = read("src/modules/report-editor/reportHtml.ts");
const styles = read("src/modules/report-builder/styles/report-builder-command-layout.css");

test("Task report workspace uses the current Lexical editor", () => {
  assert.match(workspace, /App2LexicalReportEditor/);
  assert.match(workspace, /App2LexicalReportEditorHandle/);
  assert.match(workspace, /lazy\(/);
  assert.match(workspace, /Suspense/);
});

test("Task report workspace retains its report HTML normalization boundary", () => {
  assert.match(workspace, /normalizeReportHtml/);
  assert.match(workspace, /sanitizeReportHtmlForEditor/);
  assert.match(html, /normalizeReportHtml/);
  assert.match(html, /sanitizeReportHtmlForEditor/);
});

test("Task report review submission remains connected to the workspace", () => {
  assert.match(workspace, /onSubmitForReview/);
  assert.match(workspace, /reviewNote/);
});

test("Current report command layout stylesheet remains available", () => {
  assert.match(styles, /report-command-row/);
  assert.match(styles, /task-report-builder-v1/);
});

test("Current Lexical editor module exists and is non-empty", () => {
  assert.ok(editor.trim().length > 0);
  assert.match(editor, /Lexical/i);
});
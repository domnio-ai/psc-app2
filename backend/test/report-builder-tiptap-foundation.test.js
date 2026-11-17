import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const editor = read("src/modules/report-editor/App2LexicalReportEditor.tsx");
const workspace = read("src/modules/assignments/components/TaskSectionWorkspace.tsx");
const html = read("src/modules/report-editor/reportHtml.ts");
const commandLayout = read("src/modules/report-builder/styles/report-builder-command-layout.css");
const standardStyles = read("src/modules/report-builder/styles/report-editor-standard.css");

test("Report editor foundation uses the current Lexical editor module", () => {
  assert.match(editor, /Lexical/i);
  assert.match(workspace, /App2LexicalReportEditor/);
});

test("Workspace maintains an editor handle for the current editor", () => {
  assert.match(workspace, /App2LexicalReportEditorHandle/);
  assert.match(workspace, /reportEditorRef/);
});

test("Report HTML utilities provide normalization and sanitization", () => {
  assert.match(html, /normalizeReportHtml/);
  assert.match(html, /sanitizeReportHtmlForEditor/);
});

test("Canonical report command layout styles are present", () => {
  assert.match(commandLayout, /report-command-row/);
  assert.match(commandLayout, /ribbon-tabs/);
});

test("Canonical report editor styling is present", () => {
  assert.match(standardStyles, /report-command-row/);
  assert.match(standardStyles, /ribbon-tabs/);
});
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("shared Lexical engine configures table support at the editor-engine layer", () => {
  const editor = read("src/modules/report-editor/App2LexicalReportEditor.tsx");
  assert.match(editor, /TablePlugin hasCellMerge=\{true\}/);
  assert.match(editor, /INSERT_TABLE_COMMAND/);
  assert.match(editor, /TableCellNode/);
});

test("shared Lexical command bridge exposes table operations", () => {
  const editor = read("src/modules/report-editor/App2LexicalReportEditor.tsx");
  for (const command of [
    "addRowAfter","deleteRow","addColumnAfter","deleteColumn",
    "toggleHeaderRow","mergeCells","splitCell","deleteTable"
  ]) {
    assert.match(editor, new RegExp(`case "${command}"`));
  }
  assert.match(editor, /name === "insertTable"/);
  assert.match(editor, /rows: "3", columns: "3"/);
});

test("Assignment and Task ribbon expose table tools", () => {
  const workspace = read("src/modules/assignments/components/TaskSectionWorkspace.tsx");
  for (const label of [
    "Insert table","Add row","Delete row","Add column","Delete column",
    "Header row","Merge cells","Split cell","Delete table"
  ]) assert.match(workspace, new RegExp(label));
  assert.match(workspace, /command\("insertTable"\)/);
});

test("Research ribbon consumes the same shared table commands", () => {
  const research = read("src/modules/research/components/ResearchReportWorkspace.tsx");
  assert.match(research, /run\("insertTable"\)/);
  assert.match(research, /run\("addRowAfter"\)/);
  assert.match(research, /run\("addColumnAfter"\)/);
  assert.match(research, /run\("deleteTable"\)/);
  assert.match(research, /disabled=\{!editable\}/);
});

test("table presentation is shared and A4-safe", () => {
  const css = read("src/modules/report-editor/lexical-editor.css");
  assert.match(css, /table-layout: fixed/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /app2-lexical-table-cell-selected/);
  assert.match(css, /@media print/);
});

test("Lexical table dependency matches the pinned editor release", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.dependencies["@lexical/table"], "0.52.0");
  assert.equal(pkg.dependencies.lexical, "0.52.0");
});

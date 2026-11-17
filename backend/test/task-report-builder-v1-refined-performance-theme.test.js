import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workspace=fs.readFileSync("src/modules/assignments/components/TaskSectionWorkspace.tsx","utf8");
const editor=fs.readFileSync("src/modules/report-editor/App2LexicalReportEditor.tsx","utf8");
const css=fs.readFileSync("src/modules/tasks/task-report-workspace.css","utf8");

test("Task Report Builder V1 uses a dedicated refined task shell",()=>{
  assert.match(workspace,/task-report-builder-v1 task-report-builder-refined/);
  assert.match(css,/APP2 TASK REPORT BUILDER V1 - REFINED PERFORMANCE THEME/);
});

test("Task Report Builder V1 removes tall ribbon bands",()=>{
  assert.match(css,/grid-template-rows:\s*44px auto/);
  assert.match(css,/section-word-toolbar\[data-active-tab="Home"\][\s\S]*height:\s*48px/);
  assert.match(css,/\.task-report-builder-v1 \.report-command-row/);
  assert.match(css,/\.task-report-builder-v1 \.ribbon-tabs[\s\S]*?height:\s*36px/);
  assert.match(css,/\.task-report-builder-v1 \.report-command-workflow-slot[\s\S]*?height:\s*56px/);
  assert.match(css,/\.task-report-builder-v1 \.report-command-actions[\s\S]*?height:\s*56px/);
});

test("Task Report Builder V1 keeps task command-centre governance cards",()=>{
  assert.match(css,/task-report-governance-state \.task-report-review-meta/);
  assert.match(css,/border-top:\s*3px solid var\(--trb-blue/);
  assert.match(css,/action-required/);
  assert.match(css,/ready/);
});

test("Lexical HTML propagation is buffered to avoid whole-workspace rerender on every keystroke",()=>{
  assert.match(editor,/changeTimerRef/);
  assert.match(editor,/pendingHtmlRef/);
  assert.match(editor,/setTimeout\(\(\) =>/);
  assert.match(editor,/120\)/);
});

test("Workspace beforeunload listener no longer rebinds on every render",()=>{
  assert.match(workspace,/window\.addEventListener\("beforeunload"/);
  assert.match(workspace,/\}, \[editMode\]\);/);
});

test("A4 stage uses paint containment and bounded document width",()=>{
  assert.match(css,/contain:\s*layout paint/);
  assert.match(css,/width:\s*min\(100%, 1040px\)/);
  assert.match(css,/overscroll-behavior:\s*contain/);
});


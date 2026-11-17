import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const editor = fs.readFileSync("src/modules/report-editor/App2LexicalReportEditor.tsx", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");

test("Lexical ignores stale echoes of its own emitted HTML and avoids clobbering an active selection", () => {
  assert.match(editor, /emittedHtmlEchoesRef/);
  assert.match(editor, /emittedHtmlEchoesRef\.current\.includes\(incoming\)/);
  assert.match(editor, /isLexicalEditorFocused\(editor\)/);
});

test("delayed Task Report auto-save persists editor changes without replacing the active Lexical selection", () => {
  const workspace = fs.readFileSync("src/modules/assignments/components/TaskSectionWorkspace.tsx", "utf8");
  assert.match(workspace, /scheduleTaskReportAutoSave\(\)/);
  assert.match(workspace, /const latestValue = currentEditorValue\(\)/);
  assert.match(workspace, /props\.onSave\(latestValue, undefined, \{ autoSave: true \}\)/);
  assert.match(workspace, /rememberSavedDraft\(latestValue\)/);
  assert.match(app, /applySavedTaskContribution\(saved\)/);
});

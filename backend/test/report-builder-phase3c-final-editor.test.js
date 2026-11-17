import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("the shared Lexical engine is the only Task/Assignment editing surface", () => {
  const workspace = read("src/modules/assignments/components/TaskSectionWorkspace.tsx");
  const editor = read("src/modules/report-editor/App2LexicalReportEditor.tsx");
  assert.equal((workspace.match(/<App2LexicalReportEditor(?:\s|>)/g) || []).length, 1);
  assert.match(workspace, /const currentEditorValue = \(\): string =>\s*reportEditorRef\.current\?\.getHTML\(\) \?\? latestValueRef\.current/s);
  assert.match(editor, /LexicalComposer/);
  assert.match(editor, /\$generateNodesFromDOM/);
  assert.match(editor, /\$generateHtmlFromNodes/);
  assert.doesNotMatch(workspace, /@tiptap|App2ReportEditor|reportTiptap/);
});

test("Task Report image paste remains connected to the shared Lexical editor host", () => {
  const workspace = read("src/modules/assignments/components/TaskSectionWorkspace.tsx");
  assert.match(workspace, /onPaste=\{\(event\) =>/);
  assert.match(workspace, /insertImage\(image\)/);
  assert.match(workspace, /app2-lexical-document/);
});

test("font sizing preserves direct CSS pixel values in the shared engine", () => {
  const editor = read("src/modules/report-editor/App2LexicalReportEditor.tsx");
  const workspace = read("src/modules/assignments/components/TaskSectionWorkspace.tsx");
  assert.match(workspace, /command\("fontSize", event\.target\.value\)/);
  assert.match(editor, /\$patchStyleText\(selection, \{ "font-size": `\$\{size\}px` \}\)/);
});

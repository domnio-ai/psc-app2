import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("Assignment workspace uses the current Lexical editor", () => {
  const workspace = read("src/modules/assignments/components/TaskSectionWorkspace.tsx");
  assert.match(workspace, /App2LexicalReportEditor/);
  assert.match(workspace, /currentEditorValue\(\)/);
  assert.doesNotMatch(workspace, /document\.execCommand/);
  assert.doesNotMatch(workspace, /contentEditable=/);
});

test("Lexical editor exposes the current report editing handle", () => {
  const editor = read("src/modules/report-editor/App2LexicalReportEditor.tsx");
  assert.match(editor, /App2LexicalReportEditorHandle/);
  assert.match(editor, /executeCommand:/);
  assert.match(editor, /insertImage:/);
  assert.match(editor, /updateImage:/);
  assert.match(editor, /removeImage:/);
});

test("Assignment workspace retains report HTML and workflow integration", () => {
  const workspace = read("src/modules/assignments/components/TaskSectionWorkspace.tsx");
  assert.match(workspace, /App2LexicalReportEditor/);
  assert.match(workspace, /currentEditorValue\(\)/);
  assert.match(workspace, /reportEditorRef/);
  assert.match(workspace, /workflowBusy/);
});

test("Lexical image state remains serialized", () => {
  const editor = read("src/modules/report-editor/App2LexicalReportEditor.tsx");
  assert.match(editor, /type SerializedApp2ImageNode/);
  assert.match(editor, /static importJSON\(serializedNode: SerializedApp2ImageNode\)/);
  assert.match(editor, /exportJSON\(\): SerializedApp2ImageNode/);
  assert.match(editor, /src: this\.getSrc\(\)/);
  assert.match(editor, /alt: this\.getAlt\(\)/);
  assert.match(editor, /width: this\.getWidth\(\)/);
  assert.match(editor, /alignment: this\.getAlignment\(\)/);
  assert.match(editor, /insertImage:/);
  assert.match(editor, /updateImage:/);
  assert.match(editor, /removeImage:/);
});



import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("Research Report Builder uses the current Lexical editor", () => {
  const research = read("src/modules/research/components/ResearchReportWorkspace.tsx");
  assert.match(research, /App2LexicalReportEditor/);
  assert.match(research, /ref=\{editorRef\}/);
  assert.doesNotMatch(research, /contentEditable=/);
  assert.doesNotMatch(research, /document\.execCommand/);
});

test("Research section HTML persistence and approval lock are preserved", () => {
  const research = read("src/modules/research/components/ResearchReportWorkspace.tsx");
  assert.match(research, /editorRef\.current\?\.getHTML\(\)/);
  assert.match(research, /editable=\{editable\}/);
  assert.match(research, /onChange=\{props\.onChange\}/);
  assert.match(research, /props\.onSave\(currentValue\(\)\)/);
});

test("Research ribbon uses the current Lexical command bridge", () => {
  const research = read("src/modules/research/components/ResearchReportWorkspace.tsx");
  const editor = read("src/modules/report-editor/App2LexicalReportEditor.tsx");

  assert.match(research, /editorRef\.current\?\.executeCommand/);
  assert.match(editor, /executeCommand:\s*\(name, argument\)/);

  for (const command of ["createLink", "unlink", "removeFormat"]) {
    assert.match(editor, new RegExp(command));
  }

  assert.match(editor, /executeCommand:\s*\(name, argument\)/);
  assert.match(editor, /case "blockquote"|blockquote/i);
  assert.match(editor, /setFormat|formatBlock|paragraph/i);
});

test("Research font-size controls pass pixel sizes to Lexical", () => {
  const research = read(
    "src/modules/research/components/ResearchReportWorkspace.tsx",
  );

  assert.match(research, /useState\("12"\)/);
  assert.match(research, /\[10,11,12,14,16,18,20,24\]/);
  assert.match(research, /run\("fontSize", event\.target\.value\)/);
});

test("Assignment and Task shared workspace is not duplicated in Research", () => {
  const research = read(
    "src/modules/research/components/ResearchReportBuilderPanel.tsx",
  );

  assert.doesNotMatch(research, /TaskSectionWorkspace/);
  assert.match(research, /ResearchReferencePanel/);
  assert.match(research, /FelixAdvicePanel/);
  assert.match(research, /reviewerOptions/);
  assert.match(research, /saveResearchSectionStatus/);
});



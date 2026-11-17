import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("image preparation is owned by one shared Report Builder module", () => {
  const processing = read("src/modules/report-editor/reportImageProcessing.ts");
  const workspace = read("src/modules/assignments/components/TaskSectionWorkspace.tsx");
  const research = read("src/modules/research/components/ResearchReportWorkspace.tsx");

  assert.match(processing, /prepareReportImage/);
  assert.match(processing, /maxDimension = 1200/);
  assert.match(processing, /image\/png/);
  assert.match(processing, /image\/jpeg/);
  assert.match(processing, /image\/gif/);
  assert.match(workspace, /prepareReportImage/);
  assert.match(research, /prepareReportImage/);
});

test("Assignment and Task retain complete selected-image controls", () => {
  const workspace = read("src/modules/assignments/components/TaskSectionWorkspace.tsx");

  for (const label of ["Small","Medium","Full","Left","Centre","Right","Replace","Alt text","Remove"]) {
    assert.match(workspace, new RegExp(label));
  }

  assert.match(workspace, /setImageWidth\("40%"\)/);
  assert.match(workspace, /setImageWidth\("70%"\)/);
  assert.match(workspace, /setImageWidth\("100%"\)/);
  assert.match(workspace, /selectReportImage/);
});

test("Research consumes the same image engine and remains approval-safe", () => {
  const research = read("src/modules/research/components/ResearchReportWorkspace.tsx");

  assert.match(research, /prepareReportImage/);
  assert.match(research, /editorRef\.current\?\.insertImage/);
  assert.match(research, /const editable = props\.mode === "edit" && props\.canEditSection === true && !props\.busy/);
  assert.match(research, /disabled=\{!editable\}/);
  assert.match(research, /Insert image/);
});

test("selected images have shared screen-only visual feedback", () => {
  const css = read("src/modules/report-editor/lexical-editor.css");
  assert.match(css, /\.app2-report-image-selected/);
  assert.match(css, /outline-color: #2f80ed/);
  assert.match(css, /@media print/);
  assert.match(css, /box-shadow: none/);
});

test("Phase 4E keeps one shared Lexical editor architecture", () => {
  const workspace = read("src/modules/assignments/components/TaskSectionWorkspace.tsx");
  const research = read("src/modules/research/components/ResearchReportWorkspace.tsx");

  assert.match(workspace, /<App2LexicalReportEditor/);
  assert.match(research, /<App2LexicalReportEditor/);
  assert.doesNotMatch(workspace, /document\.execCommand/);
  assert.doesNotMatch(research, /document\.execCommand/);
});

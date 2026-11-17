import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("TaskSectionWorkspace exposes descriptive Word-like ribbon labels", () => {
  const workspace = read(
    "src/modules/assignments/components/TaskSectionWorkspace.tsx",
  );

  for (const label of [
    "Bold",
    "Italic",
    "Underline",
    "Strike",
    "Left",
    "Centre",
    "Right",
    "Justify",
    "Paragraph",
    "Heading 1",
    "Heading 2",
    "Quote",
    "Link",
    "Unlink",
    "Clear formatting",
  ]) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(workspace, new RegExp(`>\\s*${escaped}\\s*<`, "s"));
  }
});

test("Phase 4B surfaces only commands already supported by the shared Lexical bridge", () => {
  const workspace = read(
    "src/modules/assignments/components/TaskSectionWorkspace.tsx",
  );
  const editor = read("src/modules/report-editor/App2LexicalReportEditor.tsx");

  assert.match(workspace, /command\("formatBlock", "p"\)/);
  assert.match(workspace, /command\("formatBlock", "blockquote"\)/);
  assert.match(workspace, /command\("unlink"\)/);
  assert.match(workspace, /command\("removeFormat"\)/);
  assert.match(workspace, /onClick=\{createEditorLink\}/);

  assert.match(editor, /case "formatBlock"/);
  assert.match(editor, /argument === "blockquote"/);
  assert.match(editor, /argument === "p"/);
  assert.match(editor, /name === "createLink"/);
  assert.match(editor, /name === "unlink"/);
  assert.match(editor, /case "removeFormat"/);
});

test("template terminology is neutral in shared controls and specific in assignment-only UI", () => {
  const workspace = read(
    "src/modules/assignments/components/TaskSectionWorkspace.tsx",
  );

  assert.doesNotMatch(workspace, /aria-label="Research report template"/);
  assert.match(workspace, /aria-label="Report structure template"/);
  assert.match(workspace, /report structures/);
  assert.match(workspace, />\s*Assignment template\s*</s);
});

test("Phase 4B does not introduce new editor architecture or workflow APIs", () => {
  const workspace = read(
    "src/modules/assignments/components/TaskSectionWorkspace.tsx",
  );

  assert.doesNotMatch(workspace, /document\.execCommand/);
  assert.doesNotMatch(workspace, /contentEditable=/);
  assert.match(workspace, /<App2LexicalReportEditor/);
  assert.match(workspace, /props\.onSubmitForReview/);
  assert.match(workspace, /props\.reviewerOptions/);
});


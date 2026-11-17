import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (name) => readFile(path.join(root, name), "utf8");

test("References is permanent and Templates remains conditional at the end of the ribbon", async () => {
  const editor = await read("src/modules/assignments/components/TaskSectionWorkspace.tsx");

  assert.match(
    editor,
    /"Layout",\s*"References",\s*"Review",\s*"View",\s*\.\.\.\(props\.reportTemplateOptions\?\.length\s*\|\|\s*props\.templateOptions\?\.length\s*\?\s*\["Templates"\]\s*:\s*\[\]\),\s*\]\.map\(\(tab\) => \(/,
  );
  assert.doesNotMatch(
    editor,
    /props\.reportTemplateOptions\?\.length\s*\|\|\s*props\.templateOptions\?\.length\s*\?\s*"Templates"\s*:\s*"References"/,
  );
});

test("Template details are collapsed by default after selection and can be reopened manually", async () => {
  const [editor, css] = await Promise.all([
    read("src/modules/assignments/components/TaskSectionWorkspace.tsx"),
    read("src/modules/tasks/task-report-workspace.css"),
  ]);

  assert.match(editor, /setTemplatePreviewOpen\(false\);/);
  assert.doesNotMatch(editor, /setTemplatePreviewOpen\(Boolean\(selection\)\)/);
  assert.match(editor, /className="task-report-template-details-toggle"/);
  assert.match(editor, /onClick=\{\(\) => setTemplatePreviewOpen\(\(open\) => !open\)\}/);
  assert.match(css, /APP2_TASK_REPORT_TEMPLATE_LAYOUT_V1/);
  assert.match(css, /#C89B2C/);
});
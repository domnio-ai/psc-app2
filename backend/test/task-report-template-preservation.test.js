import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = await readFile(path.join(root, "src/modules/assignments/components/TaskSectionWorkspace.tsx"), "utf8");
const css = await readFile(path.join(root, "src/modules/tasks/task-report-workspace.css"), "utf8");
test("Task Report template selection does not rewrite editor content", () => {
  const selectStart = source.indexOf("const selectTemplate = async (selection: string) => {");
  const selectEnd = source.indexOf("const downloadWord =", selectStart);
  assert.notEqual(selectStart, -1);
  const selectTemplate = source.slice(selectStart, selectEnd);
  assert.ok(selectTemplate.includes("setSelectedTemplateId(selection)"));
  assert.ok(selectTemplate.includes("persistTaskTemplateId(selection)"));
  assert.ok(!selectTemplate.includes("currentEditorValue()"));
  assert.ok(!selectTemplate.includes("setHTML("));
  assert.ok(!selectTemplate.includes("props.onChange("));
  assert.ok(!source.includes("Existing draft content"));
});
test("Task Report inserts missing template headings only after an explicit action", () => {
  assert.ok(source.includes("const applySelectedTemplateStructure = async () =>"));
  assert.ok(source.includes("missingSections = template.sections.filter"));
  assert.ok(source.includes("const templatePositions = new Map<string, number>"));
  assert.ok(source.includes("nextTemplateHeading.parentNode.insertBefore(insertion, nextTemplateHeading)"));
  assert.ok(source.includes("Insert missing headings"));
  assert.ok(source.includes("onClick={() => void applySelectedTemplateStructure()}"));
  assert.ok(source.includes("scheduleTaskReportAutoSave();"));
});
test("Task Report Save Draft remains readable when hovered or focused", () => {
  assert.ok(css.includes("APP2_TASK_REPORT_SAVE_BUTTON_STATES_V10"));
  assert.match(css, /task-report-save-primary:hover:not\(:disabled\)/);
  assert.match(css, /task-report-save-primary:focus-visible:not\(:disabled\)/);
  assert.match(css, /-webkit-text-fill-color:\s*#2c2414\s*!important/);
  assert.match(css, /animation:\s*none\s*!important/);
  assert.match(css, /transition:\s*none\s*!important/);
});

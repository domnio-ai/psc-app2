import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const assignment = readFileSync("src/modules/assignments/components/AssignmentReportBuilder.tsx", "utf8");
const workspace = readFileSync("src/modules/assignments/components/TaskSectionWorkspace.tsx", "utf8");

test("Assignment Report Save Draft propagates the actual save outcome", () => {
  assert.match(assignment, /onSave=\{async \(latestValue\) => \{\s*return save\(false, latestValue\);\s*\}\}/);
});

test("Assignment Report preview surfaces a failed save instead of silently returning", () => {
  assert.match(assignment, /onPreviewReport=\{async \(latestValue\) => \{\s*const saved = await save\(false, latestValue\);\s*if \(!saved\)\s*\{\s*throw new Error\("The report draft could not be saved\. Preview was not opened\."\);/);
  assert.match(assignment, /setReaderPreview\(fresh\)/);
});

test("Assignment Report PDF export stops clearly when saving fails", () => {
  assert.match(assignment, /onOpenFinalDocument=\{async \(latestValue\) => \{\s*const saved = await save\(false, latestValue\);\s*if \(!saved\)\s*\{\s*throw new Error\("The report draft could not be saved\. PDF export was not started\."\);/);
});

test("shared report workspace treats an explicit false callback result as failure", () => {
  assert.match(workspace, /const result = await action\(currentEditorValue\(\)\);\s*if \(result === false\) throw new Error\(failureMessage\);/);
});
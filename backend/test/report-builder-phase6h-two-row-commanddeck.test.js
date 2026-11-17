import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const tsx = fs.readFileSync(
  "src/modules/assignments/components/TaskSectionWorkspace.tsx",
  "utf8",
);
const css = fs.readFileSync(
  "src/modules/report-builder/styles/report-builder-command-layout.css",
  "utf8",
);

test("command deck has tabs on row one and workflow/actions on row two", () => {
  assert.match(css, /grid-template-rows: 36px 40px !important/);
  assert.match(css, /"tabs tabs"\s*"workflow actions" !important/s);
});

test("workflow lives in row two", () => {
  assert.match(tsx, /className="report-command-workflow-slot"/);
  assert.match(css, /grid-area: workflow !important/);
});

test("Save Preview Import remain anchored at far right on row two", () => {
  assert.match(tsx, /className="assignment-report-editor-buttons report-command-actions"/);
  assert.match(css, /grid-area: actions !important/);
  assert.match(css, /justify-content: flex-end !important/);
});

test("tabs occupy the full first row", () => {
  assert.match(css, /grid-area: tabs !important/);
  assert.match(css, /width: 100% !important/);
});

test("submit workflow contract remains unchanged", () => {
  assert.match(tsx, /props\.onSubmitForReview\?\.\(\s*reviewerId,\s*reviewNote\.trim\(\),\s*latestValue/);
});

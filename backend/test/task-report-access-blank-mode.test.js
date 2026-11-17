import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("src/App.tsx", "utf8");
const panel = fs.readFileSync("src/modules/tasks/TaskReportAccessPanel.tsx", "utf8");
const css = fs.readFileSync("src/modules/tasks/task-report-work-v5.css", "utf8");

test("Task Report access panel receives the authoritative selected template mode", () => {
  assert.match(app, /<TaskReportAccessPanel[\s\S]*?reportMode=\{taskReportDocumentMode\}/);
});

test("Blank mode shows one body status and no structured section progress", () => {
  const start = panel.indexOf('if (reportMode === "blank")');
  const end = panel.indexOf("const percentage =", start);
  assert.ok(start >= 0 && end > start);
  const branch = panel.slice(start, end);
  assert.doesNotMatch(branch, /task-report-work-progress/);
  assert.doesNotMatch(branch, /task-report-work-outline/);
  assert.doesNotMatch(branch, /percentage/);
  assert.match(branch, /No report content yet/);
  assert.match(branch, /Start Task Report/);
});

test("structured reports retain the existing section progress and outline", () => {
  assert.match(panel, /const percentage =/);
  assert.match(panel, /task-report-simple-progress/);
  assert.match(panel, /task-report-simple-count/);
  assert.match(panel, /task-report-work-bar/);
});

test("blank mode styles remain scoped to the blank-report panel", () => {
  assert.match(css, /APP2_BLANK_REPORT_NO_SECTION_PROGRESS_V1/);
  assert.match(css, /task-report-blank-work-panel/);
});


import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("src/App.tsx", "utf8");
const workspace = fs.readFileSync(
  "src/modules/assignments/components/TaskSectionWorkspace.tsx",
  "utf8",
);
const css = fs.readFileSync(
  "src/modules/report-builder/styles/report-builder.css",
  "utf8",
);

test("task report rejects HTML-contaminated report titles", () => {
  assert.match(app, /\/<\[a-z\]\[\\s\\S\]\*>\//);
  assert.match(app, /const taskReportSafeTitle = \(candidate: unknown\)/);
  assert.match(app, /if \(!taskReportTitleNeedsRepair\(value\)\) return value/);
  assert.match(app, /return `\$\{selectedAssignmentTask\?\.title \|\| "Task"\} - TASK Report`/);
});

test("Task Report keeps a navigable outline without a section-status gate", () => {
  assert.match(app, /readySectionCount=\{0\}/);
  assert.match(app, /totalSectionCount=\{0\}/);
  assert.match(app, /outlineSections=\{taskReportRequiredSectionKeys\.map\(\(key\) => \(\{/);
  assert.match(workspace, /workspaceVariant === "task-report" \? "TASK REPORT OUTLINE" : "REPORT OUTLINE"/);
  assert.match(app, /const taskReportMissingSectionKeys: string\[\] = \[\]/);
});

test("task report workspace no longer ships known encoding artefacts in active controls", () => {
  assert.doesNotMatch(workspace, /Â·|â†|â†’/);
});

test("task report footer navigation remains opaque where navigation is rendered", () => {
  assert.match(css, /TASK REPORT FOOTER — SOLID, OPAQUE NAVIGATION/);
  assert.match(css, /\.task-report-builder-v1 \.task-report-footer \.section-footer-navigation button/);
  assert.match(css, /background-color: #415166 !important/);
  assert.match(css, /button:disabled[\s\S]{0,260}opacity: 1 !important/);
});

test("superseded component-local report-builder CSS layers are removed", () => {
  for (const file of [
    "src/modules/assignments/components/report-builder-a4-v1.css",
    "src/modules/assignments/components/report-builder-chrome-final-v3.css",
    "src/modules/assignments/components/report-builder-layout-polish-v1.css",
    "src/modules/assignments/components/assignment-report-builder-final-v1.css",
  ]) {
    assert.equal(fs.existsSync(file), false, `${file} should be removed`);
  }
});

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

test("visible workflow status is compact", () => {
  assert.match(tsx, /report-compact-readiness/);
  assert.match(tsx, /sections remaining/);
  assert.match(tsx, /Ready for review/);
});

test("legacy Phase 4F readiness contract remains available off-screen", () => {
  for (const label of [
    "Submission readiness",
    "Reviewer",
    "Report structure",
    "Sections drafted",
    "Ready to submit",
    "Action required",
  ]) {
    assert.match(tsx, new RegExp(label));
  }
  assert.match(tsx, /className="report-readiness-contract" role="status"/);
});

test("legacy readiness contract does not consume layout space", () => {
  assert.match(css, /\.report-readiness-contract/);
  assert.match(css, /position: absolute !important/);
  assert.match(css, /clip-path: inset\(50%\) !important/);
});

test("reviewer note submit controls remain present", () => {
  assert.match(tsx, /Select reviewer/);
  assert.match(tsx, /Submission note/);
  assert.match(tsx, /Submit to Reviewer/);
});

test("submission action contract is unchanged", () => {
  assert.match(tsx, /props\.onSubmitForReview\?\.\(\s*reviewerId,\s*reviewNote\.trim\(\),\s*latestValue/);
});

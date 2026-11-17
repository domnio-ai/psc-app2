import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("Assignment and Task derive submission readiness from existing props only", () => {
  const workspace = read("src/modules/assignments/components/TaskSectionWorkspace.tsx");

  assert.match(workspace, /const selectedReviewer = props\.reviewerOptions\?\.find/);
  assert.match(workspace, /const selectedReportStructure = props\.reportTemplateOptions\?\.find/);
  assert.match(workspace, /const submissionBlockers = \[/);
  assert.match(workspace, /remainingSectionCount/);
  assert.match(workspace, /No eligible reviewer is currently available/);
  assert.match(workspace, /Wait for the current operation to finish/);
});

test("submission readiness UI names reviewer, structure, section progress and blockers", () => {
  const workspace = read("src/modules/assignments/components/TaskSectionWorkspace.tsx");

  for (const label of [
    "Submission readiness",
    "Reviewer",
    "Report structure",
    "Sections drafted",
    "Ready to submit",
    "Action required",
  ]) {
    assert.match(workspace, new RegExp(label));
  }

  assert.match(workspace, /submissionBlockerMessage/);
  assert.match(workspace, /role="status"/);
});

test("Submit button title explains the actual first blocker", () => {
  const workspace = read("src/modules/assignments/components/TaskSectionWorkspace.tsx");

  assert.match(
    workspace,
    /title=\{\s*submissionBlockers\.length\s*\?\s*submissionBlockerMessage/s,
  );
  assert.match(workspace, /reviewerId[\s\S]*submissionReady|submissionReady[\s\S]*reviewerId/s);
});

test("Research exposes section reviewer/content/status readiness without changing workflow", () => {
  const research = read("src/modules/research/components/ResearchReportBuilderPanel.tsx");

  assert.match(research, /Selected section readiness/);
  assert.match(research, /selectedReviewer/);
  assert.match(research, /selectedReportSection\.content\.trim\(\)/);
  assert.match(research, /Section governance/);
  assert.match(research, /<small>Reviewer<\/small>/);
  assert.match(research, /No draft content yet/);
  assert.match(research, /Approved and locked/);
  assert.match(research, /onGoToReview/);
});

test("Phase 4F preserves existing reviewer and submission actions", () => {
  const workspace = read("src/modules/assignments/components/TaskSectionWorkspace.tsx");
  const research = read("src/modules/research/components/ResearchReportBuilderPanel.tsx");

  assert.match(workspace, /props\.onSubmitForReview\?\.\(\s*reviewerId,\s*reviewNote\.trim\(\),\s*latestValue/);
  assert.match(research, /onGoToReview/);
  assert.doesNotMatch(workspace, /document\.execCommand/);
  assert.doesNotMatch(research, /document\.execCommand/);
});


import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const tsx = fs.readFileSync(
  "src/modules/assignments/components/TaskSectionWorkspace.tsx",
  "utf8",
);
const layout = fs.readFileSync(
  "src/modules/report-builder/styles/report-builder-command-layout.css",
  "utf8",
);

test("tabs and primary actions share one command row", () => {
  assert.match(tsx, /className="report-command-row"/);
  assert.match(tsx, /className="assignment-report-editor-buttons report-command-actions"/);
  for (const label of ["Save Draft", "Preview", "Import"]) {
    assert.match(tsx, new RegExp(label));
  }
});

test("workflow is rehomed into Review rather than top-level document layout", () => {
  assert.match(tsx, /activeRibbonTab === "Review"/);
  assert.match(tsx, /className="report-review-workflow"/);
  assert.match(tsx, /Submission readiness/);
  assert.match(tsx, /Submit to Reviewer/);
});

test("legacy workflow contracts remain intact", () => {
  assert.match(tsx, /props\.onSubmitForReview\?\.\(\s*reviewerId,\s*reviewNote\.trim\(\),\s*latestValue/);
  assert.match(tsx, /props\.onImportExternalReport\(file\)/);
  assert.match(tsx, /props\.onSave\(/);
  assert.match(tsx, /props\.onPreviewReport/);
});

test("document stage geometry is not owned by Phase 6C module", () => {
  assert.doesNotMatch(layout, /grid-template-columns:\s*188px/);
  assert.doesNotMatch(layout, /\.workspace-section-outline\s*\{/);
  assert.doesNotMatch(layout, /\.a4-document-page\s*\{/);
  assert.doesNotMatch(layout, /\.app2-lexical-editor-engine\s*\{/);
});

test("layout follows App2 theme variables", () => {
  for (const token of [
    "--surface-elevated",
    "--surface-primary",
    "--surface-secondary",
    "--text-primary",
    "--text-secondary",
    "--border-default",
    "--interaction-hover-bg",
    "--accent-primary",
  ]) {
    assert.match(layout, new RegExp(token));
  }
});

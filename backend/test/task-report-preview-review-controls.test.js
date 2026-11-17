import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (relative) => readFileSync(relative, "utf8");
const app = read("src/App.tsx");
const preview = read("src/modules/tasks/TaskReportPreviewPanel.tsx");
const decision = read("src/modules/tasks/TaskReviewDecisionPanel.tsx");

test("opening the Task Report preview removes the underlying reviewer decision panel", () => {
  const start = app.indexOf("const renderTaskReviewDecision = () => {");
  const end = app.indexOf("const taskReportTitleNeedsRepair", start);
  assert.ok(start >= 0 && end > start);
  const renderer = app.slice(start, end);
  assert.match(renderer, /if \(!selectedAssignmentTask \|\| assignmentTaskReportPreviewOpen\) return null/);
  assert.match(app, /\{assignmentTaskReportPreviewOpen && \([\s\S]{0,1200}<TaskReportPreviewPanel/);
});

test("the preview contains one reviewer form and keeps the existing formal decisions", () => {
  const reviewStart = preview.indexOf("{reviewerReady && (");
  const reviewEnd = preview.indexOf("{isReviewer && contributionStatus === \"Accepted\"", reviewStart);
  assert.ok(reviewStart >= 0 && reviewEnd > reviewStart);
  const form = preview.slice(reviewStart, reviewEnd);
  assert.equal((form.match(/<textarea/g) || []).length, 1);
  assert.match(form, /onReviewDecision\("Changes Requested"\)/);
  assert.match(form, /onReviewDecision\("Rejected"\)/);
  assert.match(form, /onReviewDecision\("Approved"\)/);
  assert.match(decision, /if \(contributionStatus !== "Ready for Integration"\) return null/);
});

test("closing preview restores the single task review panel without changing decision callbacks", () => {
  assert.match(preview, /onClick=\{onClose\}[\s\S]{0,100}Close Preview/);
  const closeStart = app.indexOf("const closeAssignmentTaskReportPreview = () => {");
  const closeEnd = app.indexOf("const reviewAssignmentTaskContribution", closeStart);
  const close = app.slice(closeStart, closeEnd);
  assert.match(close, /setAssignmentTaskReportPreviewOpen\(false\)/);
  assert.match(close, /setTaskReportSectionModal\(null\)/);
  assert.match(decision, /onDecision\("Changes Requested"\)/);
  assert.match(decision, /onDecision\("Rejected"\)/);
  assert.match(decision, /onDecision\("Approved"\)/);
});

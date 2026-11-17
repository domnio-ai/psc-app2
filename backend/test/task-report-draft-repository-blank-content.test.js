import test from "node:test";
import assert from "node:assert/strict";
import { buildTaskReportDraftSnapshot } from "../src/private-draft-repository.js";

const readSnapshot = (input) =>
  buildTaskReportDraftSnapshot(input).toString("utf8");

test("blank Task Report draft mirrors the authored rich-text body", () => {
  const body = readSnapshot({
    task: {
      id: "3b71f181-e028-4ba4-9e84-f1ab7806a4b6",
      title: "Integration of app2 task",
      contribution_title: "Integration of app2 task - Task Report",
      report_mode: "blank",
      blank_content: "<p>This is my task report.</p><p>I wrote this in the blank editor.</p>",
      contribution_summary: "STALE structured work summary",
      evidence_reviewed: "STALE structured evidence",
      contribution_findings: "STALE structured findings",
      contribution_recommendations: "STALE structured recommendations",
      contribution_challenges: "STALE structured challenges",
      contribution_next_actions: "STALE structured next actions",
      description: "Task metadata must not replace report body",
      task_purpose: "Unrelated task purpose",
    },
    assignment: { title: "Integration of app2" },
    ownerName: "Researcher Example",
  });

  assert.match(body, /<h1[^>]*>Integration of app2 task - Task Report<\/h1>/);
  assert.match(body, /<strong>Assignment:<\/strong> Integration of app2/);
  assert.match(body, /<h2[^>]*>Report body<\/h2>/);
  assert.match(body, /<p>This is my task report\.<\/p>\s*<p>I wrote this in the blank editor\.<\/p>/);
  assert.doesNotMatch(body, /STALE structured/);
  assert.doesNotMatch(body, /Unrelated task purpose/);
  assert.match(body, /Integration of app2/);
});

test("structured Task Report drafts keep the existing structured snapshot", () => {
  const body = readSnapshot({
    task: {
      id: "3b71f181-e028-4ba4-9e84-f1ab7806a4b6",
      title: "Integration of app2 task",
      report_mode: "structured",
      contribution_summary: "Structured work completed",
      evidence_reviewed: "Evidence used",
      contribution_findings: "Finding one",
    },
    assignment: { title: "Integration of app2" },
    ownerName: "Researcher Example",
  });

  assert.match(body, /<h2[^>]*>Work completed<\/h2>/);
  assert.match(body, /Structured work completed/);
  assert.match(body, /<h2[^>]*>Evidence reviewed<\/h2>/);
  assert.match(body, /Evidence used/);
  assert.match(body, /<h2[^>]*>Key findings<\/h2>/);
  assert.match(body, /Finding one/);
  assert.doesNotMatch(body, /REPORT BODY/);
});

import fs from "node:fs";

const backend = fs.readFileSync("backend/src/app.js", "utf8");
test("Repository report draft title is distinguishable from the task metadata draft", () => {
  assert.match(backend, /const title = \/task report draft\$\/i\.test\(contributionTitle\)/);
  assert.match(backend, /fileExtension: '\.html'/);
  assert.match(backend, /documentType:\s*'Task Report Draft'/);
});


test("Task Report Repository snapshots preserve safe rich content and escape metadata", () => {
  const body = readSnapshot({
    task: {
      id: "test-ref",
      title: "<script>alert(1)</script> Report",
      contribution_title: "Report & Findings",
      report_mode: "blank",
      blank_content: '<h2>Key findings</h2><p>A <strong>bold</strong> finding.</p><table class="app2-report-table"><tbody><tr><td>Evidence</td><td>Verified</td></tr></tbody></table><script>alert(1)</script>',
    },
    assignment: { title: "Safe assignment" },
    ownerName: "Researcher Example",
  });
  assert.match(body, /<h2>Key findings<\/h2>/);
  assert.match(body, /<strong>bold<\/strong>/);
  assert.match(body, /<table class="app2-report-table">/);
  assert.doesNotMatch(body, /<script|alert\(1\)/i);
  assert.match(body, /Report &amp; Findings/);
});

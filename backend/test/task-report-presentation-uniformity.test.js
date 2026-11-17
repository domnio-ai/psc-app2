import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const editor = fs.readFileSync("src/modules/assignments/components/TaskSectionWorkspace.tsx", "utf8");
const panel = fs.readFileSync("src/modules/tasks/TaskReportSectionPanel.tsx", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");
const backend = fs.readFileSync("backend/src/app.js", "utf8");
const repository = fs.readFileSync("backend/src/private-draft-repository.js", "utf8");

test("blank Task Report editor shows presentation chrome outside the authored body", () => {
  assert.match(editor, /props\.reportDocumentMode === "blank"/);
  assert.match(editor, /app2-task-report-title/);
  assert.match(editor, /app2-task-report-section-title">Report body/);
});

test("assignment, author, status and save timestamp are passed to the editor frame", () => {
  assert.match(app, /reportDocumentMode=\{taskReportDocumentMode\}/);
  assert.match(app, /documentFrameMeta=\{\{/);
  assert.match(panel, /documentFrameMeta=\{documentFrameMeta\}/);
});

test("blank preview uses the same title, metadata and Report body framing", () => {
  assert.match(backend, /buildBlankTaskContributionReport=\(\{title,content,task,assignment,ownerName,preparedBy\}\)/);
  assert.match(backend, /class="app2-task-report-title"/);
  assert.match(backend, /class="app2-task-report-meta"/);
  assert.match(backend, /class="app2-task-report-section-title">Report body/);
  assert.match(backend, /const taskReportContentHtml=value=>/); assert.match(backend, /return sanitizeTaskReportHtml\(raw\)/); assert.match(backend, /const safeContent=taskReportContentHtml\(content\)/);
});

test("Repository framing remains presentation-only around the authored blank content", () => {
  assert.match(repository, /app2-task-report-kicker/);
  assert.match(repository, /app2-task-report-section-title/);
  assert.match(repository, /task\.blank_content \?\? task\.blankContent/);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = fs.existsSync(path.resolve(process.cwd(), "src/App.tsx"))
  ? process.cwd()
  : path.resolve(process.cwd(), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("blank Task Report mode is persisted as a governed document mode", () => {
  const flow = read("src/modules/tasks/taskReportDraftWorkflow.ts");
  const app = read("src/App.tsx");
  assert.match(flow, /TaskReportDocumentMode = "structured" \| "blank"/);
  assert.match(flow, /templateId === "__blank__" \? "blank" : "structured"/);
  assert.match(app, /currentTaskReportDocumentMode/);
  assert.match(app, /taskReportTemplatePreferenceKey\(contextIdentity\)/);
});

test("blank draft preview carries only freeform document content to the backend", () => {
  const app = read("src/App.tsx");
  const backend = read("backend/src/app.js");
  assert.match(app, /reportMode,/);
  assert.match(app, /blankContent:\s*reportMode === "blank"\s*\?\s*sectionOverride\?\.value \?\? selectedAssignmentTask\.blank_content \?\? ""\s*:\s*""/s);
  assert.match(backend, /reportMode:z\.enum\(\['structured','blank'\]\)/);
  assert.match(backend, /blankContent:z\.string\(\)\.max\(5000000\)/);
  assert.match(backend, /if\(reportMode==='blank'\)return buildBlankTaskContributionReport/);
  assert.match(backend, /const buildBlankTaskContributionReport=\(\{title,content,task,assignment,ownerName,preparedBy\}\)=>\{/);
  assert.match(backend, /const safeContent=taskReportContentHtml\(content\)/);
  assert.match(backend, /class="app2-task-report-section-content">\$\{safeContent\}/);
});

test("Task Report submission is a whole-document contract with no required sections", () => {
  const workspace = read("src/modules/assignments/components/TaskSectionWorkspace.tsx");
  const app = read("src/App.tsx");
  assert.match(workspace, /props\.workspaceVariant === "task-report"\s*\?\s*hasBlankDocumentContent/);
  assert.match(workspace, /Add report content before submitting this Task Report/);
  assert.match(app, /const taskReportMissingSectionKeys: string\[\] = \[\]/);
  assert.doesNotMatch(app, /Complete all TASK Report sections before submission/);
  assert.doesNotMatch(app, /Complete the required TASK REPORT sections before submission/);
});

test("submit action explains blockers instead of exposing a disabled stop cursor", () => {
  const workspace = read("src/modules/assignments/components/TaskSectionWorkspace.tsx");
  assert.match(workspace, /aria-disabled=\{submissionBlockers\.length > 0\}/);
  assert.match(workspace, /setWorkflowMessage\(blockers\[0\]\)/);
  assert.match(workspace, /submissionActionLabel/);
  assert.match(workspace, /Select reviewer to submit/);
  assert.match(workspace, /Add report content to submit/);
});

test("Task Report command deck has one compact readiness surface", () => {
  const workspace = read("src/modules/assignments/components/TaskSectionWorkspace.tsx");
  const css = read("src/modules/tasks/task-report-workspace.css");
  assert.match(workspace, /className="task-report-governance-bar"/);
  assert.match(workspace, /className="task-report-review-meta"/);
  assert.doesNotMatch(workspace, /className="task-report-progress-compact"/);
  assert.match(css, /grid-template-rows: 36px 56px !important/);
  assert.match(css, /\.task-report-progress-compact\s*\{\s*display: none !important;/s);
});

test("submitted Task Report preview consumes the immutable snapshot", () => {
  const backend = read("backend/src/app.js");
  assert.match(backend, /SELECT html_snapshot,report_snapshot\s+FROM task_report_versions/s);
  assert.match(backend, /if\(immutable\?\.html_snapshot\)/);
  assert.match(backend, /return res\.json\(\{html:immutable\.html_snapshot/);
});


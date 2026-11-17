import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync("src/App.tsx","utf8");
const workspace=fs.readFileSync("src/modules/assignments/components/TaskSectionWorkspace.tsx","utf8");
const backend=fs.readFileSync("backend/src/app.js","utf8");
const migration=fs.readFileSync("backend/migrations/20260915_task_report_sectionless_contract_v1010.sql","utf8");

test("Task Reports have no mandatory section gate",()=>{
  assert.match(app,/const taskReportMissingSectionKeys: string\[\] = \[\]/);
  assert.doesNotMatch(app,/Complete all TASK Report sections before submission/);
  assert.doesNotMatch(app,/Complete the required TASK REPORT sections before submission/);
});

test("Task Report workspace uses content instead of section counts",()=>{
  assert.match(workspace,/props\.workspaceVariant === "task-report"\s*\?\s*hasBlankDocumentContent/);
  assert.match(workspace,/Add report content before submitting this Task Report/);
  assert.match(workspace,/TASK REPORT · EDITING DOCUMENT/);
});

test("Task Report hides section progress while keeping its document outline",()=>{
  assert.match(workspace,/props\.workspaceVariant !== "task-report" &&\s*props\.sectionNumber/);
  assert.match(workspace,/props\.workspaceVariant !== "task-report" &&\s*props\.sectionNumber/);
  assert.match(workspace,/workspaceVariant === "task-report" \? "TASK REPORT OUTLINE" : "REPORT OUTLINE"/);
});

test("server submit checks document content and reviewer only",()=>{
  assert.match(backend,/const submissionText=taskReportSubmissionText\(clean\)/);
  const start=backend.indexOf("if(v.contributionStatus==='Ready for Integration')");
  const end=backend.indexOf("const assignment=",start);
  const block=backend.slice(start,end);
  assert.doesNotMatch(block,/contribution_section_statuses/);
  assert.doesNotMatch(block,/sectionKey/);
});

test("database migration only targets assignment_tasks CHECK constraints",()=>{
  assert.match(migration,/conrelid = 'assignment_tasks'::regclass/);
  assert.match(migration,/contype = 'c'/);
  assert.match(migration,/contribution_section_statuses/);
  assert.doesNotMatch(migration,/\bDROP TABLE\b/i);
  assert.doesNotMatch(migration,/\bDROP COLUMN\b/i);
});

test("Task Report panel receives its navigable document outline",()=>{
  assert.match(app,/sectionNumber=\{0\}/);
  assert.match(app,/outlineSections=\{taskReportRequiredSectionKeys\.map\(\(key\) => \(\{/);
});

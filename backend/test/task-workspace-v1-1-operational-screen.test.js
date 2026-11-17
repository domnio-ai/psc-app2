import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const header=fs.readFileSync("src/modules/assignments/components/AssignmentTaskWorkspaceHeader.tsx","utf8");
const access=fs.readFileSync("src/modules/tasks/TaskReportAccessPanel.tsx","utf8");
const screen=fs.readFileSync("src/modules/tasks/task-workspace-screen2-v5.css","utf8");
const report=fs.readFileSync("src/modules/tasks/task-report-work-v5.css","utf8");

test("Task V1.1 makes unassigned and reviewer-pending states explicit",()=>{
  assert.match(header,/Owner assignment required/);
  assert.match(header,/Reviewer resolution required/);
  assert.match(header,/task-header-operational-gate/);
  assert.match(header,/Pending owner assignment/);
});
test("Task V1.1 removes ambiguous Attach report wording",()=>{
  assert.match(header,/Attach evidence/);
  assert.doesNotMatch(header,/\+ Attach report/);
});
test("Task V1.1 report access supports the current blank-body and compact-progress layouts",()=>{
  assert.match(access,/task-report-blank-work-panel/);
  assert.match(access,/task-report-blank-status/);
  assert.match(access,/task-report-simple-progress/);
  assert.match(access,/task-report-simple-footer/);
  assert.match(access,/task-report-next-action-button/);
  assert.match(report,/task-report-blank-work-panel/);
  assert.match(report,/task-report-simple-progress/);
});
test("Task V1.1 keeps existing report lifecycle calls unchanged",()=>{
  assert.match(access,/onContinueReport/);
  assert.match(access,/onPreviewLockedReport/);
  assert.match(access,/submissionReady/);
});
test("Task V1.1 keeps operational state styling in canonical Task stylesheets",()=>{
  assert.match(screen,/APP2 Task Workspace V1\.1 - operational screen hierarchy/);
  assert.match(screen,/task-next-responsibility\.is-blocked/);
  assert.match(report,/APP2 Task Workspace V1\.1 - operational report surface/);
});

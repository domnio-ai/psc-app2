import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const backend=fs.readFileSync("backend/src/app.js","utf8");
const ui=fs.readFileSync("src/modules/tasks/TasksWorkspaceEntry.tsx","utf8");
const api=fs.readFileSync("src/api.ts","utf8");
const workflow=fs.readFileSync("src/modules/tasks/taskWorkspaceWorkflow.ts","utf8");
const statusPanel=fs.readFileSync("src/modules/tasks/TaskWorkflowStatusPanel.tsx","utf8");
const footer=fs.readFileSync("src/modules/tasks/TaskWorkspaceFooter.tsx","utf8");

test("authorised manager assignee pool drives direct assignment and approvals",()=>{
  assert.match(api,/assignmentTaskAssignableUsers/);
  assert.match(backend,/\/api\/assignments\/:id\/assignable-task-users/);
  assert.match(backend,/managedUserIds\(req\.user\)/);
  assert.match(backend,/u\.active=TRUE/);
  assert.match(ui,/directAssignableUsers/);
  assert.match(ui,/approvalAssignableUsers/);
  assert.doesNotMatch(ui,/disabled=\{!assignment\.members\.length\}/);
});

test("authorised non-members are governed Assignment Contributors before Task creation",()=>{
  assert.match(backend,/TASK_OWNER_AUTO_ENROLLED/);
  assert.match(backend,/source:'direct-task-assignment'/);
  assert.match(backend,/source:'task-request-approval'/);
  assert.match(backend,/source:'task-reassignment'/);
  assert.match(backend,/VALUES\(\$1,\$2,'Contributor'\)/);
});

test("task assignment still notifies owner and reviewer",()=>{
  assert.match(backend,/New task contribution assigned/);
  assert.match(backend,/Task review assigned/);
  assert.match(backend,/Task report ready for review/);
});

test("generic Task editing cannot mark a Task complete",()=>{
  assert.match(workflow,/TaskWorkspaceAction = "save" \| "start"/);
  assert.doesNotMatch(workflow,/action === "complete"/);
  assert.match(backend,/if\(v\.status==='Completed'\)return res\.status\(409\)/);
  assert.match(footer,/completion is recorded only after the approved final report/);
});

test("submission is immutable, review-controlled and workspace-locking",()=>{
  assert.match(backend,/INSERT INTO task_report_versions\(task_id,version_number,report_snapshot,html_snapshot,snapshot_sha256,status,submitted_by,reviewer_id\)/);
  assert.match(backend,/TASK_REPORT_SUBMITTED_TO_REVIEWER/);
  assert.match(backend,/\['Ready for Integration','Integrated','Accepted'\]\.includes\(task\.contribution_status\)/);
  assert.match(statusPanel,/Submitted · locked for reviewer/);
});

test("review supports approval, changes and rejection",()=>{
  assert.match(backend,/TASK_REPORT_APPROVED/);
  assert.match(backend,/TASK_REPORT_CHANGES_REQUESTED/);
  assert.match(backend,/TASK_REPORT_REJECTED/);
  assert.match(statusPanel,/Changes requested/);
});

test("Repository publication is still the only Task completion gate",()=>{
  const publishIndex=backend.indexOf("finalizationStage='publish-repository'");
  const completeIndex=backend.indexOf("finalizationStage='complete-task'");
  assert.ok(publishIndex>=0);
  assert.ok(completeIndex>publishIndex);
  assert.match(backend,/task_report_versions WHERE task_id=\$1 AND version_number=\$2 AND status='Approved'/);
  assert.match(backend,/contribution_status='Accepted',[\s\S]*status='Completed',[\s\S]*progress=100/);
});

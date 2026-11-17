import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workspace=fs.readFileSync("src/modules/assignments/components/TaskSectionWorkspace.tsx","utf8");
const app=fs.readFileSync("src/App.tsx","utf8");
const backend=fs.readFileSync("backend/src/app.js","utf8");

test("Preview saves the live Task Report draft before opening",()=>{
  const start=workspace.indexOf("const runFullReportPreview");
  const end=workspace.indexOf("const visualLines",start);
  const block=workspace.slice(start,end);
  assert.match(block,/await saveDraftAndRemember\(\)/);
  assert.match(block,/props\.onPreviewReport\(latestValue, undefined\)/);
  assert.ok(block.indexOf("await saveDraftAndRemember()") < block.indexOf("await props.onPreviewReport"));
  assert.match(block,/currentEditorValue\(\)/);
  assert.match(block,/await props\.onPreviewReport/);
});

test("Task preview callback contains no duplicate Task save",()=>{
  const marker='onPreviewReport={async (latestValue) => {';
  const panelStart=app.indexOf('sectionKey={taskReportSectionModal.key}');
  const start=app.indexOf(marker,panelStart);
  const end=app.indexOf("onProceedForReview=",start);
  const block=app.slice(start,end);
  assert.ok(start>=0);
  assert.doesNotMatch(block,/saveAssignmentTaskContribution\(/);
  assert.match(block,/openAssignmentTaskContributionPreview/);
});

test("Authoritative Task draft and Repository outbox job commit together",()=>{
  const route=backend.indexOf("app.patch('/api/assignments/:id/tasks/:taskId/contribution'");
  const tx=backend.indexOf("const row=await transaction",route);
  const mirror=backend.indexOf("jobKind:'task_report_draft'",route);
  const joined=backend.indexOf("const joined=",route);
  assert.ok(route>=0);
  assert.ok(tx>route);
  assert.ok(mirror>tx);
  assert.ok(joined>mirror);
  assert.doesNotMatch(backend.slice(route, joined), /savePrivateDraftRepositoryVersion\(/);
});

test("Repository draft sync failures cannot undo the committed Task Report",()=>{
  assert.match(backend,/Your primary save is safe\. Repository synchronization is queued for automatic retry\./);
  assert.match(backend,/APP2_REPOSITORY_SYNC_ATTEMPT_FAILED/);
  assert.match(backend,/repository_sync_status:\s*'retry'/);
});


test("V1.0.4.1 preview does not race a second reviewer assignment write",()=>{
  assert.match(
    workspace,
    /onPreviewReport\(latestValue, undefined\)/
  );
});


test("V1.0.4.2 preserves established Preview busy-label contract",()=>{
  assert.match(
    workspace,
    /workflowAction === "preview" \? "Opening\.\.\." : "Preview"/
  );
});


test("V1.0.4.3 supersedes the obsolete save-first Preview contract",()=>{
  const legacy=fs.readFileSync("backend/test/task-report-builder-v1-0-3-save-preview-workflow.test.js","utf8");
  assert.match(legacy,/Preview persists the latest editor value before opening/);
  assert.match(legacy,/assert\.match\(block,\/await saveDraftAndRemember/);
});

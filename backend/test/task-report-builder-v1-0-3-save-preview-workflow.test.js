import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workspace=fs.readFileSync("src/modules/assignments/components/TaskSectionWorkspace.tsx","utf8");
const app=fs.readFileSync("src/App.tsx","utf8");

test("Save Draft reports a real success or failure state",()=>{
  assert.match(workspace,/Saving the latest Task Report draft/);
  assert.match(workspace,/Draft saved successfully at/);
  assert.match(workspace,/The Task Report draft could not be saved/);
  assert.match(workspace,/workflowAction === "save"/);
});

test("Preview persists the latest editor value before opening",()=>{
  const previewStart=workspace.indexOf("const runFullReportPreview");
  const previewEnd=workspace.indexOf("const visualLines",previewStart);
  const block=workspace.slice(previewStart,previewEnd);
  assert.match(block,/currentEditorValue\(\)/);
  assert.match(block,/await props\.onPreviewReport/);
  assert.match(block,/await saveDraftAndRemember\(\)/);
  assert.ok(block.indexOf("await saveDraftAndRemember()") < block.indexOf("await props.onPreviewReport"));
});

test("Task preview callback remains free of duplicate Task saves",()=>{
  const marker='onPreviewReport={async (latestValue) => {';
  const panelStart=app.indexOf('sectionKey={taskReportSectionModal.key}');
  const start=app.indexOf(marker,panelStart);
  const end=app.indexOf('onProceedForReview=',start);
  const block=app.slice(start,end);
  assert.ok(start>=0);
  assert.doesNotMatch(block,/saveAssignmentTaskContribution\(/);
  assert.match(block,/openAssignmentTaskContributionPreview/);
});

test("Preview button stays Preview while external full preview owns navigation",()=>{
  assert.match(workspace,/workflowAction === "preview" \? "Opening\.\.\." : "Preview"/);
});


test("V1.0.3.1 preserves established Task preview source contracts",()=>{
  assert.match(app,/const opened = await openAssignmentTaskContributionPreview\(\{/);
  assert.match(workspace,/onPreviewReport\(latestValue, undefined\)/);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync("src/App.tsx","utf8");
const workspace=fs.readFileSync("src/modules/assignments/components/TaskSectionWorkspace.tsx","utf8");
const panel=fs.readFileSync("src/modules/tasks/TaskReportSectionPanel.tsx","utf8");
const css=fs.readFileSync("src/modules/tasks/task-report-workspace.css","utf8");

test("Task Save and Preview buttons are not silently disabled by App busy prop",()=>{
  const actionStart=workspace.indexOf('className="task-report-primary-actions"');
  const actionEnd=workspace.indexOf("</div>",actionStart)+6;
  const block=workspace.slice(actionStart,actionEnd+1500);
  assert.match(block,/disabled=\{workflowBusy\}/);
  assert.doesNotMatch(block,/disabled=\{busy \|\| workflowBusy\}/);
});

test("Task action feedback is always visible in the governance strip",()=>{
  assert.match(workspace,/task-report-action-feedback/);
  assert.match(workspace,/workflowMessage \|\| props\.statusMessage/);
  assert.match(panel,/statusMessage=\{statusMessage\}/);
  assert.match(css,/APP2 TASK REPORT BUILDER V1\.0\.5 - runtime action feedback/);
});

test("Task save callback can propagate the actual runtime error",()=>{
  assert.match(app,/options\?: \{ throwOnError\?: boolean; autoSave\?: boolean \}/);
  assert.match(app,/if \(options\?\.throwOnError \|\| options\?\.autoSave\) \{\s*throw error instanceof Error/);
  assert.match(app,/\{ throwOnError: true, autoSave: saveOptions\?\.autoSave \},/);
});

test("Task preview callback propagates runtime errors while preserving the legacy call shape",()=>{
  assert.match(app,/A Task Report preview is already opening/);
  assert.match(app,/const opened = await openAssignmentTaskContributionPreview\(\{/);
  assert.match(app,/throwOnError: true/);
  assert.match(app,/sectionOverride\?\.throwOnError/);
});

test("Established Preview label and call contracts stay intact",()=>{
  assert.match(workspace,/workflowAction === "preview" \? "Opening\.\.\." : "Preview"/);
  assert.match(workspace,/props\.onPreviewReport\(latestValue, undefined\)/);
});

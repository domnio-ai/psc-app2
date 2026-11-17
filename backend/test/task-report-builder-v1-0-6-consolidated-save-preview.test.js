import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync("src/App.tsx","utf8");
const workspace=fs.readFileSync("src/modules/assignments/components/TaskSectionWorkspace.tsx","utf8");

test("Blank report Save Draft isolates editor HTML from structured contribution fields",()=>{
  const start=app.indexOf("const saveAssignmentTaskContribution = async");
  const end=app.indexOf("\n  const ",start+50);
  const block=app.slice(start,end);
  assert.match(block,/const structuredSectionOverride =\s*reportMode === "blank" \? undefined : sectionOverride/);
  assert.match(block,/statusOverride,\s*structuredSectionOverride,/);
  assert.match(block,/blankContent:\s*reportMode === "blank"\s*\?\s*sectionOverride\?\.value \?\? taskForSave\.blank_content \?\? ""\s*:\s*""/);
});

test("Blank report Preview isolates editor HTML from contributionTitle",()=>{
  const start=app.indexOf("const openAssignmentTaskContributionPreview = async");
  const end=app.indexOf("\n  const ",start+50);
  const block=app.slice(start,end);
  assert.match(block,/const structuredSectionOverride =\s*reportMode === "blank" \? undefined : sectionOverride/);
  assert.match(block,/"Draft",\s*structuredSectionOverride,/);
  assert.match(block,/blankContent:\s*reportMode === "blank"\s*\?\s*sectionOverride\?\.value \?\? selectedAssignmentTask\.blank_content \?\? ""\s*:\s*""/);
});

test("Runtime Preview guard remains present",()=>{
  assert.match(app,/A Task Report preview is already opening/);
  assert.match(app,/sectionOverride\?\.throwOnError/);
});

test("Legacy preview source contracts remain present",()=>{
  assert.match(app,/const opened = await openAssignmentTaskContributionPreview\(\{/);
  assert.match(workspace,/workflowAction === "preview" \? "Opening\.\.\." : "Preview"/);
  assert.match(workspace,/props\.onPreviewReport\(latestValue, undefined\)/);
});

test("Runtime Save error propagation remains present",()=>{
  assert.match(app,/options\?: \{ throwOnError\?: boolean; autoSave\?: boolean \}/);
  assert.match(app,/options\?\.throwOnError/);
});

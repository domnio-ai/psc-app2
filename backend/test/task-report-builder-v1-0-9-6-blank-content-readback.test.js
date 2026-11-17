import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync("src/App.tsx","utf8");
const api=fs.readFileSync("src/api.ts","utf8");

test("ApiAssignmentTask exposes persisted blank report fields",()=>{
  assert.match(api,/report_mode\?: "structured" \| "blank"/);
  assert.match(api,/blank_content\?: string/);
});

test("blank editor reloads the saved body from blank_content",()=>{
  assert.match(app,/recoverTaskReportMarkup\(\s*selectedAssignmentTask\?\.blank_content,/);
});

test("blank editor updates blank_content before structured section logic",()=>{
  const s=app.indexOf("const setTaskReportSectionValue");
  const e=app.indexOf("\n\n  const openTaskReportPreviewForTask",s);
  const block=app.slice(s,e);
  assert.match(block,/currentTaskReportDocumentMode\(\) === "blank"/);
  assert.match(block,/blank_content: value/);
  assert.match(block,/return;/);
  assert.match(block,/buildTaskReportSectionPatch\(key, value\)/);
});

test("Save Draft retains current blank body",()=>{
  const s=app.indexOf("const saveAssignmentTaskContribution = async");
  const e=app.indexOf("\n  const finalizeAssignmentTaskContribution",s);
  assert.match(app.slice(s,e),/sectionOverride\?\.value \?\? taskForSave\.blank_content \?\? ""/);
});

test("Preview retains current blank body",()=>{
  const s=app.indexOf("const openAssignmentTaskContributionPreview = async");
  const e=app.indexOf("\n  const openSavedAssignmentTaskContributionReport",s);
  assert.match(app.slice(s,e),/sectionOverride\?\.value \?\? selectedAssignmentTask\.blank_content \?\? ""/);
});

test("runtime guards remain intact",()=>{
  assert.match(app,/options\?: \{ throwOnError\?: boolean; autoSave\?: boolean \}/);
  assert.match(app,/A Task Report preview is already opening/);
  assert.match(app,/sectionOverride\?\.throwOnError/);
});


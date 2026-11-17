import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync("src/App.tsx","utf8");
const api=fs.readFileSync("src/api.ts","utf8");

test("persisted report_mode remains available as the saved Task Report mode",()=>{
  assert.match(api,/report_mode\?: "structured" \| "blank"/);
  const s=app.indexOf("const currentTaskReportDocumentMode");
  const e=app.indexOf("\n\n  const saveAssignmentTaskContribution",s);
  const block=app.slice(s,e);
  assert.match(block,/if \(selectedAssignmentTask\?\.report_mode === "blank"\) return "blank"/);
  assert.match(block,/if \(selectedAssignmentTask\?\.report_mode === "structured"\) return "structured"/);
});

test("approved template selection does not switch the active Task Report document mode",()=>{
  const s=app.indexOf("const currentTaskReportDocumentMode");
  const e=app.indexOf("\n\n  const saveAssignmentTaskContribution",s);
  const block=app.slice(s,e);
  const localStorageRead=block.indexOf("window.localStorage.getItem");
  const persistedCheck=block.indexOf('selectedAssignmentTask?.report_mode === "blank"');
  assert.ok(localStorageRead >= 0);
  assert.ok(persistedCheck > localStorageRead);
  assert.match(block,/if \(preferredTemplateId === "__blank__"\) return "blank"/);
  assert.doesNotMatch(block,/preferredTemplateId === "structured"/);
  assert.match(block,/Selecting an approved template is only a preference/);
});

test("blank-content readback remains intact",()=>{
  assert.match(api,/blank_content\?: string/);
  assert.match(app,/recoverTaskReportMarkup\(\s*selectedAssignmentTask\?\.blank_content,/);
  assert.match(app,/blank_content: value/);
  assert.match(app,/sectionOverride\?\.value \?\? taskForSave\.blank_content \?\? ""/);
});

test("Save and Preview runtime guards remain intact",()=>{
  assert.match(app,/options\?: \{ throwOnError\?: boolean; autoSave\?: boolean \}/);
  assert.match(app,/A Task Report preview is already opening/);
  assert.match(app,/sectionOverride\?\.throwOnError/);
});


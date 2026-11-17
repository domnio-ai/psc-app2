import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync("src/App.tsx","utf8");
const workspace=fs.readFileSync("src/modules/assignments/components/TaskSectionWorkspace.tsx","utf8");

test("legacy preview repair contract remains satisfied",()=>{
  assert.match(
    app,
    /openAssignmentTaskContributionPreview\(\{[\s\S]*?key: taskReportSectionModal\.key,[\s\S]*?value,[\s\S]*?\}\)/
  );
});

test("legacy stability call shape remains satisfied",()=>{
  assert.match(app,/const opened = await openAssignmentTaskContributionPreview\(\{/);
});

test("legacy task workspace preview signature remains satisfied",()=>{
  assert.match(
    workspace,
    /props\.onPreviewReport\(latestValue, undefined\)/
  );
});

test("runtime propagation is carried inside the legacy-compatible preview object",()=>{
  assert.match(app,/throwOnError: true/);
  assert.match(app,/sectionOverride\?\.throwOnError/);
});

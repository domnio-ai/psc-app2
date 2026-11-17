import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync("src/App.tsx","utf8");

test("Task save uses its declared options argument for throwOnError",()=>{
  const start=app.indexOf("const saveAssignmentTaskContribution = async");
  const end=app.indexOf("\n  const ",start+50);
  const block=app.slice(start,end);
  assert.match(block,/options\?: \{ throwOnError\?: boolean; autoSave\?: boolean \}/);
  assert.match(block,/options\?\.throwOnError/);
  assert.doesNotMatch(block,/sectionOverride\?\.throwOnError/);
});

test("Task preview carries throwOnError inside sectionOverride",()=>{
  const start=app.indexOf("const openAssignmentTaskContributionPreview = async");
  const end=app.indexOf("\n  const ",start+50);
  const block=app.slice(start,end);
  assert.match(block,/sectionOverride\?: \{ key: string; value: string; throwOnError\?: boolean \}/);
  assert.match(block,/sectionOverride\?\.throwOnError/);
  assert.doesNotMatch(block,/options\?\.throwOnError/);
});

test("legacy preview call shape remains intact",()=>{
  assert.match(app,/const opened = await openAssignmentTaskContributionPreview\(\{/);
  assert.match(app,/throwOnError: true/);
});

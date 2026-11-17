import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const screen=fs.readFileSync("src/modules/tasks/task-workspace-screen2-v5.css","utf8");
const admin=fs.readFileSync("src/modules/assignments/components/task-admin-v5.css","utf8");
const header=fs.readFileSync("src/modules/assignments/components/AssignmentTaskWorkspaceHeader.tsx","utf8");

test("Task V7 keeps workflow visible before secondary task controls",()=>{
  assert.match(screen,/APP2 Tasks V7 - functional workspace arrangement/);
  assert.match(screen,/\.governed-workflow-strip\s*\{[\s\S]*order:\s*-20/);
  assert.match(screen,/\.task-report-access-notice\s*\{[\s\S]*order:\s*-10/);
});

test("Task V7 compacts overview into a functional four-column information grid",()=>{
  assert.match(admin,/APP2 Tasks V7 - functional task overview layout/);
  assert.match(admin,/grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(admin,/task-overview-detail--wide/);
  assert.match(admin,/border-top:\s*3px solid/);
});

test("Task V7 preserves all core overview information",()=>{
  for(const text of ["Purpose","Specific instructions","Expected contribution","Expected findings","Evidence required","Assignment area"]){
    assert.match(header,new RegExp(text,"i"));
  }
  assert.match(header,/task-overview-details__footer/);
});

test("Task V7 keeps canonical task workflow and footer surfaces",()=>{
  assert.match(screen,/task-workspace-body\.task-screen-body/);
  assert.match(screen,/task-workspace-footer\.task-screen-footer/);
  assert.match(screen,/task-completion-rule/);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const model=fs.readFileSync("src/modules/workflow/governedWorkflowModel.ts","utf8");
const strip=fs.readFileSync("src/modules/workflow/GovernedWorkflowStrip.tsx","utf8");
const css=fs.readFileSync("src/modules/workflow/governed-workflow-strip.css","utf8");
const task=fs.readFileSync("src/modules/tasks/TaskWorkflowStatusPanel.tsx","utf8");
const taskWorkflow=fs.readFileSync("src/modules/tasks/taskWorkspaceWorkflow.ts","utf8");
const assignment=fs.readFileSync("src/modules/assignments/components/AssignmentWorkflowGuide.tsx","utf8");
const research=fs.readFileSync("src/modules/research/components/ResearchReviewHandoffPanel.tsx","utf8");

test("Governed Workflow V1 defines one shared five-stage lifecycle",()=>{
  for(const label of ["Work","Draft","Review","Finalise","Complete"]) assert.match(model,new RegExp(`label: "${label}"`));
  assert.match(strip,/governedWorkflowStages\.map/);
  assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
});
test("Task workflow uses shared lifecycle without weakening publication governance",()=>{
  assert.match(task,/GovernedWorkflowStrip/);
  assert.match(task,/taskGovernedStageIndex/);
  assert.match(model,/contributionStatus === "Accepted"/);
  assert.match(model,/contributionStatus === "Integrated"/);
  assert.match(model,/contributionStatus === "Ready for Integration"/);
  assert.match(taskWorkflow,/TaskWorkspaceAction = "save" \| "start"/);
  assert.doesNotMatch(taskWorkflow,/action === "complete"/);
});
test("Assignment workflow uses shared lifecycle and preserves workspace navigation",()=>{
  assert.match(assignment,/GovernedWorkflowStrip/);
  assert.match(assignment,/assignmentGovernedStageIndex/);
  assert.match(assignment,/onNavigate\(stageTabs\[index\] \|\| "Overview", source\)/);
  assert.match(assignment,/NEXT ACTION/);
});
test("Research formal review uses shared lifecycle and preserves locked review actions",()=>{
  assert.match(research,/GovernedWorkflowStrip/);
  assert.match(research,/researchGovernedStageIndex/);
  assert.match(research,/Lock Version & Submit/);
  assert.match(research,/Approve Report/);
  assert.match(research,/Request Changes/);
  assert.match(research,/Reject Report/);
});
test("Shared workflow visually distinguishes complete current returned and blocked states",()=>{
  for(const state of ["complete","current","returned","blocked","upcoming"]) assert.match(css,new RegExp(`governed-workflow-stage\\.${state}`));
});

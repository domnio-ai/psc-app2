import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync("src/App.tsx","utf8");
const workspace=fs.readFileSync(
  "src/modules/assignments/components/TaskSectionWorkspace.tsx",
  "utf8"
);

test("Task Reports do not inherit structured missing-section requirements",()=>{
  assert.match(app,/const taskReportMissingSectionKeys: string\[\] = \[\]/);
  assert.match(app,/const taskReportMissingSectionNames: string\[\] = \[\]/);
  assert.doesNotMatch(app,/getTaskReportMissingSectionKeys\(assignmentTaskWorkspaceForm\)/);
});

test("Task Report submission is content governed rather than section governed",()=>{
  assert.match(
    app,
    /taskReportPlainText\([\s\S]*taskReportSectionValue\(taskReportSectionModal\?\.key \|\| "workCompleted"\)[\s\S]*\)\.trim\(\)\.length > 0/
  );
  assert.doesNotMatch(app,/Complete all TASK Report sections before submission/);
  assert.doesNotMatch(app,/Complete the required TASK REPORT sections before submission/);
});

test("Task Report submit workflow is visible outside Review tab",()=>{
  assert.match(
    workspace,
    /\(props\.workspaceVariant === "task-report" \|\|\s*activeRibbonTab === "Review"\)/
  );
});

test("Task Report submission remains reviewer + content governed",()=>{
  assert.match(
    workspace,
    /props\.workspaceVariant === "task-report"\s*\?\s*hasBlankDocumentContent/
  );
  assert.match(workspace,/Add report content before submitting this Task Report/);
  assert.match(workspace,/Select reviewer to submit/);
  assert.match(workspace,/Submit to Reviewer/);
});


test("preview submission forwards the latest editor value only for the active task section", () => {
  const start = app.indexOf("const approveAndSendAssignmentTaskContribution = async");
  assert.ok(start >= 0, "generic submission handler must exist");
  const boundary = /\r?\n\r?\n  const \{/.exec(app.slice(start));
  assert.ok(boundary, "handler boundary must support LF and CRLF");
  const handler = app.slice(start, start + boundary.index);

  assert.match(handler, /taskReportLatestEditorValueRef\.current/);
  assert.match(handler, /latestEditorValue\.taskId === currentTaskId/);
  assert.match(handler, /latestEditorValue\.sectionKey === currentSection\.key/);
  assert.match(handler, /saveAssignmentTaskContribution\(\s*"Ready for Integration",\s*sectionOverride,\s*\{ throwOnError: true \}/);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workspace=fs.readFileSync(
  "src/modules/assignments/components/TaskSectionWorkspace.tsx",
  "utf8"
);

test("Task Report submit button does not depend on canSubmitForReview prop",()=>{
  assert.match(
    workspace,
    /\(props\.workspaceVariant === "task-report" \|\|\s*props\.canSubmitForReview\) &&\s*props\.onSubmitForReview/
  );
});

test("Task Report submit control still renders the governed action label",()=>{
  assert.match(workspace,/className="report-action-submit primary"/);
  assert.match(workspace,/Submit to Reviewer/);
  assert.match(workspace,/submissionBlockers\.length/);
});

test("Task Report submit workflow remains visible outside Review tab",()=>{
  assert.match(
    workspace,
    /\(props\.workspaceVariant === "task-report" \|\|\s*activeRibbonTab === "Review"\)/
  );
});

test("reviewer and whole-document content governance remain enforced",()=>{
  assert.match(workspace,/Select reviewer to submit/);
  assert.match(workspace,/Add report content before submitting this Task Report/);
  assert.match(workspace,/if \(!reviewerId\) return/);
});

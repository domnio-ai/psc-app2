import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const backend=fs.readFileSync("backend/src/app.js","utf8");
const app=fs.readFileSync("src/App.tsx","utf8");

test("current live Save and Preview runtime contracts remain intact",()=>{
  assert.match(app,/options\?: \{ throwOnError\?: boolean; autoSave\?: boolean \}/);
  assert.match(app,/A Task Report preview is already opening/);
  assert.match(app,/sectionOverride\?\.throwOnError/);
});

test("large blank Task Reports are accepted by Save and Preview",()=>{
  assert.equal((backend.match(/contributionTitle:z\.string\(\)\.max\(5000000\)/g)||[]).length,2);
  assert.equal((backend.match(/blankContent:z\.string\(\)\.max\(5000000\)/g)||[]).length,2);
});

test("oversized accidental title payload is migrated into blankContent",()=>{
  assert.match(backend,/normalizedContribution\.blankContent=incomingTitleRaw/);
  assert.match(backend,/previewOverride\.blankContent=previewTitleRaw/);
  assert.match(backend,/normalizedContribution\.reportMode='blank'/);
  assert.match(backend,/previewOverride\.reportMode='blank'/);
});

test("stored report title remains capped at 300 characters",()=>{
  assert.match(backend,/contributionTitle:plainTaskReportText\(normalizedContribution\.contributionTitle\)\.slice\(0,300\)/);
});

test("report mode and blank content are persisted on Save Draft",()=>{
  assert.match(backend,/report_mode=\$12::varchar/);
  assert.match(backend,/blank_content=\$13::text/);
  assert.match(backend,/WHERE id=\$14 AND assignment_id=\$15 AND owner_id=\$16 AND status<>'Blocked' AND status<>'Completed' AND contribution_status='Draft' RETURNING/);
});

test("best-effort Repository draft mirroring remains intact",()=>{
  const start=backend.indexOf("app.patch('/api/assignments/:id/tasks/:taskId/contribution'");
  const end=backend.indexOf("app.post('/api/assignments/:id/tasks/:taskId/contribution-review'",start);
  const route=backend.slice(start,end);
  assert.match(route,/jobKind:'task_report_draft'/);
  assert.doesNotMatch(route,/runAndReadRepositorySync\(row\.repository_sync_job_id\)/,'Task Report Save Draft must return before Repository rendering');
  assert.match(route,/repository_sync_status:row\.repository_sync_job_id\?'pending':'unavailable'/);
  assert.match(route,/persistence_status:'saved'/);
});

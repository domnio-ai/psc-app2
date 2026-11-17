import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const app = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
const backend = fs.readFileSync(path.join(root, "backend/src/app.js"), "utf8");

test("Task Report saves against its last confirmed revision without a pre-save context GET", () => {
  const saveStart = app.indexOf("const saveAssignmentTaskContribution = async");
  const saveEnd = app.indexOf("const finalizeAssignmentTaskContribution", saveStart);
  assert.ok(saveStart >= 0 && saveEnd > saveStart, "save function boundaries must exist");
  const saveFunction = app.slice(saveStart, saveEnd);
  assert.match(app, /taskReportRevisionFingerprint/);
  assert.match(app, /taskReportRevisionSnapshot\(task\)/);
  assert.match(app, /taskReportAuthoritativeRevisionRef = useRef/);
  assert.match(saveFunction, /const confirmedRevision = taskReportAuthoritativeRevisionRef\.current/);
  assert.match(saveFunction, /confirmedRevision\.taskId !== selectedAssignmentTask\.id/);
  assert.match(saveFunction, /expectedContributionUpdatedAt: confirmedRevision\.updatedAt/);
  assert.doesNotMatch(saveFunction, /api\.taskContext\s*\(/, "save must not issue a pre-save task-context GET");
  assert.doesNotMatch(saveFunction, /latestFingerprint|confirmedRevision\.fingerprint !==/, "save must not rebase onto a newer revision");
});

test("Task Report retains all persisted body fields in its revision fingerprint", () => {
  for (const field of [
    "contribution_title", "contribution_summary", "contribution_findings",
    "contribution_recommendations", "evidence_reviewed", "contribution_challenges",
    "contribution_next_actions", "notes", "report_mode", "blank_content",
  ]) {
    assert.match(app, new RegExp(`task\\.${field}\\s*\\?\\?`), `missing ${field} from the revision fingerprint`);
  }
});

test("Completed tasks cannot be edited through the contribution save route", () => {
  assert.match(backend, /if\(current\.status==='Completed'\)return res\.status\(409\)/);
  assert.match(backend, /if\(locked\.status==='Completed'\)throw Object\.assign/);
  assert.match(backend, /AND status<>'Completed' AND contribution_status='Draft' RETURNING \*/);
});

test("The transaction still rejects stale writes and submitted report versions", () => {
  assert.match(backend, /expected!==actual/);
  assert.match(backend, /locked\.contribution_status!=='Draft'/);
  assert.match(backend, /FROM assignment_tasks WHERE id=\$1 AND assignment_id=\$2 FOR UPDATE/);
});
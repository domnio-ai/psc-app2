import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const backend=fs.readFileSync("backend/src/app.js","utf8");
const migration=fs.readFileSync("backend/migrations/20260915_task_report_blank_content_v1092.sql","utf8");

test("current backend expects report_mode and blank_content persistence",()=>{
  assert.match(backend,/report_mode=\$12::varchar/);
  assert.match(backend,/blank_content=\$13::text/);
});

test("migration adds both assignment_tasks columns idempotently",()=>{
  assert.match(migration,/ADD COLUMN IF NOT EXISTS report_mode VARCHAR\(20\) NOT NULL DEFAULT 'structured'/);
  assert.match(migration,/ADD COLUMN IF NOT EXISTS blank_content TEXT NOT NULL DEFAULT ''/);
});

test("migration is additive and does not drop or rename assignment_tasks fields",()=>{
  assert.doesNotMatch(migration,/\bDROP\b/i);
  assert.doesNotMatch(migration,/\bRENAME\b/i);
});

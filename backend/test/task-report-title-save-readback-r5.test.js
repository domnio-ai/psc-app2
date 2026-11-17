import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const app = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
const start = app.indexOf('const persistedSection = reportMode === "blank"');
const end = app.indexOf('const normalizePersistedText', start);
assert.ok(start >= 0 && end > start, "Task Report save readback guard must exist");
const guard = app.slice(start, end);

test("Task Report title edits validate against the persisted title field", () => {
  assert.match(guard, /title:\s*saved\.contribution_title/);
  assert.match(guard, /sectionOverride\?\.key === "title"\s*\?\s*governedPayload\.contributionTitle/);
});

test("Task Report body section readback mappings remain intact", () => {
  for (const [key, field] of [
    ["workCompleted", "contribution_summary"],
    ["findings", "contribution_findings"],
    ["recommendations", "contribution_recommendations"],
    ["evidence", "evidence_reviewed"],
    ["challenges", "contribution_challenges"],
    ["nextActions", "contribution_next_actions"],
  ]) {
    assert.match(guard, new RegExp(`${key}:\\s*saved\\.${field}`));
  }
});

test("Blank report validation uses the exact outgoing blank-content payload", () => {
  assert.match(guard, /saved\.blank_content\s*\|\|\s*""/);
  assert.match(guard, /governedPayload\.blankContent/);
});
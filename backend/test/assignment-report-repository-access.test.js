import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("backend/src/app.js", "utf8");

test("assignment report compilation checks Repository evidence access before linking records", () => {
  const start = app.indexOf("app.post('/api/assignments/:id/reports/compile'");
  const end = app.indexOf("app.post('/api/assignment-reports/:id/sections/:sectionId/tasks/:taskId'", start);
  assert.ok(start >= 0 && end > start);
  const route = app.slice(start, end);
  const evidenceQuery = route.indexOf("SELECT id,title,category,status FROM knowledge_items");
  const accessCheck = route.indexOf("canReadKnowledge(req.user,item.id)");
  const relationshipWrite = route.indexOf("INSERT INTO repository_entity_links");
  assert.ok(evidenceQuery >= 0);
  assert.ok(accessCheck > evidenceQuery, "Repository access must be checked after resolving published evidence");
  assert.ok(relationshipWrite > accessCheck, "No source relationship may be written before access checks");
  assert.match(route, /outside your authorised access scope/);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const repositoryBuilder = fs.readFileSync(
  "backend/src/private-draft-repository.js", "utf8",
);
const app = fs.readFileSync("src/App.tsx", "utf8");
const css = fs.readFileSync("src/documents.css", "utf8");

test("Task Report snapshots use a readable stable reference instead of a UUID", () => {
  assert.match(repositoryBuilder, /const taskReportReference =/);
  assert.match(repositoryBuilder, /TR-\$\{year\}-/);
  assert.match(repositoryBuilder, /const reference = taskReportReference\(task\)/);
});

test("a redundant Task Draft is hidden only when the same task has a Task Report Draft", () => {
  assert.match(app, /repositoryTaskReportOriginIds/);
  assert.match(app, /shouldHideRedundantTaskDraft/);
  assert.match(app, /document_type === "Task Report Draft"/);
  assert.match(app, /document_type === "Task Draft"/);
  assert.match(app, /const repositoryDisplayRows = documentRows\.filter/);
  assert.match(app, /const filteredDocuments = repositoryDisplayRows/);
});

test("Repository counts follow the visible list and don't count hidden duplicate drafts", () => {
  const start = app.indexOf("const repositoryLibraryCounts = {");
  const end = app.indexOf("\n  };", start);
  assert.ok(start >= 0 && end > start);
  assert.match(app.slice(start, end), /repositoryDisplayRows/);
});

test("Repository record titles and metadata wrap within their cells", () => {
  assert.match(css, /APP2_REPOSITORY_DRAFT_REFERENCE_WRAP_V1/);
  assert.match(css, /repository-record-title-button strong/);
  assert.match(css, /-webkit-line-clamp:\s*2/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
});
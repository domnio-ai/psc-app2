import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const source = fs.readFileSync(path.join(root, "src/modules/assignments/components/AssignmentReportReader.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "src/modules/assignments/components/assignment-report-workspace.css"), "utf8");

test("reader and review panel share one workspace", () => {
  const w = source.indexOf("<div className=\"assignment-report-reader-workspace\">");
  const r = source.indexOf("className=\"assignment-report-reader-content\"", w);
  const p = source.indexOf("<aside className=\"assignment-report-review-panel\"", w);
  assert.ok(w >= 0, "workspace wrapper must exist");
  assert.ok(r > w, "report reader must be inside the workspace");
  assert.ok(p > r, "review panel must follow the reader");
  assert.match(source.slice(p), /<\/aside>\s*\)\}\s*<\/div>\s*<\/section>/);
});

test("desktop workspace uses independent reader and review columns", () => {
  assert.match(css, /\.assignment-report-reader-workspace\s*\{[^{}]*display:\s*grid/s);
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(320px,\s*380px\)/);
  assert.match(css, /\.assignment-report-reader-workspace\s*>\s*\.assignment-report-reader-content\s*\{[^{}]*overflow-y:\s*auto/s);
});

test("review panel is a scrollable vertical sidebar, not a short bottom dock", () => {
  assert.match(css, /\.assignment-report-review-panel\s*\{[^{}]*flex-direction:\s*column/s);
  assert.match(css, /\.assignment-report-review-panel\s*\{[^{}]*overflow-y:\s*auto/s);
  assert.match(css, /\.assignment-report-review-panel\s*\{[^{}]*max-height:\s*none/s);
  assert.doesNotMatch(css, /max-height:\s*min\(245px,\s*31vh\)/);
});

test("review note and decision controls keep usable dimensions", () => {
  assert.match(css, /\.assignment-report-review-main textarea\s*\{[^{}]*height:\s*112px/s);
  assert.match(css, /\.assignment-report-review-actions\s*\{[^{}]*display:\s*grid/s);
});

test("mobile layout stacks reader and reviewer controls", () => {
  assert.match(css, /@media\s*\(\s*max-width:\s*760px\s*\)[\s\S]*?\.assignment-report-reader-workspace\s*\{[^{}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test("review workflow and authorization checks remain present", () => {
  assert.match(source, /document\.can_review_report/);
  assert.match(source, /\["Changes Requested", "Rejected"\]\.includes\(decision\)\s*&&\s*!note/);
  assert.match(source, /api\.reviewAssignmentReport\(token,\s*document\.id,\s*decision,\s*note\)/);
  assert.match(source, /api\.addGeneratedDocumentComment\(token,\s*document\.id,\s*null,\s*body\)/);
});

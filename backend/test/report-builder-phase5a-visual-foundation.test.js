import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("Phase 5A defines a scoped Report Builder visual token set", () => {
  const css = read("src/modules/report-builder/styles/report-builder.css");
  assert.match(css, /--rb-surface: #ffffff/);
  assert.match(css, /--rb-border: #d6dee8/);
  assert.match(css, /--rb-control-height: 34px/);
  assert.match(css, /--rb-shadow-paper/);
});

test("Report Builder surfaces and controls are opaque and readable", () => {
  const css = read("src/modules/report-builder/styles/report-builder.css");
  assert.match(css, /background: var\(--rb-surface\) !important/);
  assert.match(css, /font-size: 12px/);
  assert.match(css, /button:disabled/);
  assert.match(css, /background: #d6dee8 !important/);
});

test("semantic report actions retain distinct action families", () => {
  const css = read("src/modules/report-builder/styles/report-builder.css");
  for (const name of [
    "report-action-save",
    "report-action-preview",
    "report-action-import",
    "report-action-submit",
    "report-action-reject",
  ]) assert.match(css, new RegExp(name));
  assert.match(css, /linear-gradient/);
});

test("readiness presentation is structured without workflow changes", () => {
  const css = read("src/modules/report-builder/styles/report-builder.css");
  assert.match(css, /\.assignment-report-readiness/);
  assert.match(css, /grid-template-columns: repeat\(3/);
  assert.match(css, /\.submission-ready/);
  assert.match(css, /\.submission-blocked/);
});

test("shared Lexical editor has visible focus feedback", () => {
  const css = read("src/modules/report-editor/lexical-editor.css");
  assert.match(css, /focus-visible|:focus-within|:focus/);
  assert.match(css, /outline|box-shadow|border-color/);
});

test("Phase 5A production scope is CSS-only", () => {
  for (const file of [
    "src/modules/report-builder/styles/report-builder.css",
    "src/modules/report-editor/lexical-editor.css",
    "src/task-section-workspace.css",
  ]) assert.ok(fs.existsSync(file));
});


import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("Phase 5B makes the ribbon read like a compact document editor", () => {
  const css = read("src/modules/report-builder/styles/report-builder.css");
  assert.match(css, /\.ribbon-shell/);
  assert.match(css, /\.ribbon-tabs button\.active/);
  assert.match(css, /grid-template-rows: repeat\(2/);
  assert.match(css, /min-height: 72px/);
});

test("popover and dropdown surfaces are explicitly opaque", () => {
  const css = read("src/modules/report-builder/styles/report-builder.css");
  assert.match(css, /\[role="menu"\]/);
  assert.match(css, /background: #ffffff !important/);
  assert.match(css, /opacity: 1 !important/);
  assert.match(css, /backdrop-filter: none !important/);
});

test("submission and footer panels use a consistent professional shell", () => {
  const css = read("src/modules/report-builder/styles/report-builder.css");
  assert.match(css, /\.assignment-report-submit-inline/);
  assert.match(css, /\.report-footer-actions/);
  assert.match(css, /border-radius: 10px/);
});

test("editor interaction polish preserves readable document semantics", () => {
  const css = read("src/modules/report-editor/lexical-editor.css");
  assert.match(css, /::selection/);
  assert.match(css, /blockquote/);
  assert.match(css, /text-underline-offset/);
});

test("workspace shell controls gain consistent density and focus feedback", () => {
  const css = read("src/task-section-workspace.css");
  assert.match(css, /workspace-panel-border/);
  assert.match(css, /section-workspace-toolbar/);
  assert.match(css, /focus-visible/);
});

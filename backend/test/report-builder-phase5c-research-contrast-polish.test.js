import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("Phase 5C gives Research the same neutral ribbon language as other reports", () => {
  const css = read("src/modules/report-editor/lexical-editor.css");

  assert.match(css, /\.research-editor-ribbon/);
  assert.match(css, /\.research-editor-tool-group/);
  assert.match(css, /grid-template-rows: repeat\(2/);
  assert.match(css, /background: #ffffff !important/);
  assert.match(css, /font-size: 12px/);
});

test("Research readiness card has structured reviewer/content/status presentation", () => {
  const css = read("src/modules/report-editor/lexical-editor.css");

  assert.match(css, /\.research-section-readiness/);
  assert.match(css, /grid-template-columns: repeat\(3/);
  assert.match(css, /\.submission-ready/);
  assert.match(css, /\.submission-blocked/);
});

test("approved Research editor has a distinct read-only visual state", () => {
  const css = read("src/modules/report-editor/lexical-editor.css");

  assert.match(css, /\.research-unified-rich-editor\.readonly/);
  assert.match(css, /background: #f4f6f9/);
  assert.match(css, /cursor: default/);
});

test("Research popovers are opaque and high-contrast", () => {
  const css = read("src/modules/report-editor/lexical-editor.css");

  assert.match(css, /\[role="menu"\]/);
  assert.match(css, /opacity: 1 !important/);
  assert.match(css, /backdrop-filter: none !important/);
});

test("shared Report Builder paper and outline remain legible on light themes", () => {
  const css = read("src/modules/report-builder/styles/report-builder.css");

  assert.match(css, /\.a4-document-page/);
  assert.match(css, /background: #ffffff !important/);
  assert.match(css, /\.workspace-section-outline/);
  assert.match(css, /box-shadow: inset 3px 0 0 #2f80ed/);
});

test("workspace form controls retain explicit foreground/background contrast", () => {
  const css = read("src/task-section-workspace.css");

  assert.match(css, /background: #ffffff/);
  assert.match(css, /color: #172033/);
  assert.match(css, /::placeholder/);
});

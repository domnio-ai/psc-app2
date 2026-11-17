import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("Phase 5D reduces the fixed top stack without changing workflow markup", () => {
  const css = read("src/modules/report-builder/styles/report-builder.css");
  assert.match(
    css,
    /grid-template-rows: 38px 42px 72px minmax\(0, 1fr\) 34px !important/,
  );
  assert.match(css, /height: 38px !important/);
});

test("desktop ribbon no longer relies on a permanent horizontal scrollbar", () => {
  const css = read("src/modules/report-builder/styles/report-builder.css");
  assert.match(css, /\.section-word-toolbar[\s\S]*overflow-x: hidden !important/);
  assert.match(css, /\.ribbon-group > small[\s\S]*display: block !important/);
  assert.match(css, /min-width: 0 !important/);
});

test("report outline is wider and section titles are clamped for scanning", () => {
  const css = read("src/modules/report-builder/styles/report-builder.css");
  assert.match(css, /grid-template-columns: 188px minmax\(0, 1fr\) !important/);
  assert.match(css, /width: 188px !important/);
  assert.match(css, /-webkit-line-clamp: 2 !important/);
});

test("A4 editor visually merges with the paper surface", () => {
  const reportCss = read("src/modules/report-builder/styles/report-builder.css");
  const editorCss = read("src/modules/report-editor/lexical-editor.css");

  assert.match(reportCss, /\.a4-document-page \.app2-lexical-editor-engine/);
  assert.match(reportCss, /border: 0 !important/);
  assert.match(reportCss, /background: transparent !important/);
  assert.match(editorCss, /A4 editor should read as paper/);
});

test("readiness and submission panels are more compact", () => {
  const css = read("src/modules/report-builder/styles/report-builder.css");
  assert.match(css, /\.assignment-report-readiness[\s\S]*padding: 8px 10px !important/);
  assert.match(css, /\.assignment-report-submit-inline[\s\S]*padding: 8px 10px !important/);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("screen A4 uses the 96dpi physical target and preserves aspect ratio", () => {
  const css = read("src/modules/report-builder/styles/report-builder.css");
  assert.match(css, /--rb-a4-width: min\(794px, calc\(100vw - 190px\)\)/);
  assert.match(css, /--rb-a4-height: calc\(var\(--rb-a4-width\) \* 1\.4142857143\)/);
  assert.match(css, /padding: 68px 72px 72px !important/);
});

test("preview mirrors editor typography and constrained media", () => {
  const css = read("src/modules/report-builder/styles/report-builder.css");
  assert.match(css, /Phase 4D — preview fidelity/);
  assert.match(css, /overflow-wrap: anywhere !important/);
  assert.match(css, /\.a4-document-page > article img/);
  assert.match(css, /\.a4-document-page > article table/);
  assert.match(css, /table-layout: fixed !important/);
});

test("shared Lexical host mirrors preview body spacing", () => {
  const css = read("src/modules/report-editor/lexical-editor.css");
  assert.match(css, /Phase 4D — edit\/preview document fidelity/);
  assert.match(css, /min-height: calc\(var\(--rb-a4-height, 1123px\) - 255px\)/);
  assert.match(css, /margin-bottom: 0\.75em/);
});

test("print remains physical A4 portrait with matching margins", () => {
  const css = read("src/modules/report-builder/styles/report-builder.css");
  assert.match(css, /size: A4 portrait/);
  assert.match(css, /width: 210mm !important/);
  assert.match(css, /min-height: 297mm !important/);
  assert.match(css, /padding: 18mm 19mm 19mm !important/);
  assert.match(css, /break-after: page !important/);
});

test("smaller windows shrink the paper and hide the outline without changing document content", () => {
  const css = read("src/modules/report-builder/styles/report-builder.css");
  assert.match(css, /@media \(max-width: 980px\)/);
  assert.match(css, /--rb-a4-width: min\(794px, calc\(100vw - 48px\)\)/);
  assert.match(css, /\.workspace-section-outline \{\s*display: none !important/s);
});

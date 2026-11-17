import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(
  "src/modules/report-builder/styles/report-builder-command-layout.css",
  "utf8",
);

test("final command layout keeps workflow controls inside Review", () => {
  assert.match(css, /\.report-review-workflow/);
  assert.match(css, /\.assignment-report-readiness/);
  assert.match(css, /\.assignment-report-submit-inline/);
});

test("ribbon tabs use the full available width", () => {
  assert.match(css, /\.ribbon-tabs/);
  assert.match(css, /display: flex !important/);
  assert.match(css, /min-width: 76px !important/);
});

test("Templates uses compact governed tool groups", () => {
  assert.match(css, /data-active-tab="Templates"/);
  assert.match(css, /> :is\(\.report-template-tools, \.template-tools\)/);
  assert.match(css, /var\(--rb-layout-surface-soft\)/);
});

test("Review search and commands use a wide band", () => {
  assert.match(css, /data-active-tab="Review"/);
  assert.match(css, /grid-template-columns: minmax\(360px, 0\.85fr\) minmax\(680px, 1\.65fr\) !important/);
});

test("View fills the empty command surface", () => {
  assert.match(css, /data-active-tab="View"/);
  assert.match(css, /data-active-tab="View"/);
  assert.match(css, /overflow-x: auto !important/);
});

test("responsive workflow deck reflows rather than cramming", () => {
  assert.match(css, /@media \(max-width: 1180px\)/);
  assert.match(css, /overflow-x: auto !important/);
});

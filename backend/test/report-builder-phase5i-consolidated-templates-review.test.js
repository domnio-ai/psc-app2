import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(
  "src/modules/report-builder/styles/report-builder.css",
  "utf8",
);

test("Phase 5I removes superseded visual blocks", () => {
  assert.doesNotMatch(css, /PHASE 5F —/);
  assert.doesNotMatch(css, /PHASE 5G —/);
  assert.doesNotMatch(css, /PHASE 5H —/);
});

test("Templates has distinct report-template and document-template groups", () => {
  assert.match(css, /> \.report-template-tools/);
  assert.match(css, /> \.template-tools/);
  assert.match(css, /grid-template-columns: 250px 126px !important/);
  assert.match(css, /grid-template-columns: 300px 134px !important/);
});

test("Review has explicit Find and command layout", () => {
  assert.match(css, /data-active-tab="Review"/);
  assert.match(css, /> \.editing-tools/);
  assert.match(css, /grid-template-columns: 190px repeat\(5, max-content\) !important/);
});

test("hidden import input consumes no Templates layout space", () => {
  assert.match(css, /input\[type="file"\]\[hidden\]/);
  assert.match(css, /display: none !important/);
});

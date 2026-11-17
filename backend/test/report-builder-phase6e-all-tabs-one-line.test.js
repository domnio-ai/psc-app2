import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(
  "src/modules/report-builder/styles/report-builder-command-layout.css",
  "utf8",
);

for (const tab of ["Insert", "Layout", "Templates", "Review", "View"]) {
  test(`${tab} ribbon stays one horizontal line`, () => {
    assert.match(css, new RegExp(`data-active-tab="${tab}"`));
  });
}

test("all remaining ribbon tabs use no-wrap horizontal overflow", () => {
  assert.match(css, /flex-wrap: nowrap !important/);
  assert.match(css, /overflow-x: auto !important/);
});

test("Templates selector and import remain inline", () => {
  assert.match(css, /workspace-report-template-picker/);
  assert.match(css, /min-width: 140px !important/);
});

test("Review workflow remains inline", () => {
  assert.match(css, /\.report-review-workflow/);
  assert.match(css, /assignment-report-submit-inline/);
  assert.match(css, /min-width: 140px !important/);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(
  "src/modules/report-builder/styles/report-builder-command-layout.css",
  "utf8",
);

test("actual Home span wrappers are flattened", () => {
  assert.match(css, /> :is\(\.font-tools, \.paragraph-tools\)\s*> span/s);
  assert.match(css, /flex-direction: row !important/);
});

test("actual Layout span wrappers are flattened", () => {
  assert.match(css, /> \.layout-tools\s*> span/s);
});

test("Review no longer relies on max-content workflow width", () => {
  assert.match(css, /\.report-review-workflow/);
  assert.match(css, /flex: 1 1 860px !important/);
  assert.match(css, /min-width: 760px !important/);
});

test("Review submission controls can shrink but remain usable", () => {
  assert.match(css, /assignment-report-submit-inline/);
  assert.match(css, /min-width: 390px !important/);
  assert.match(css, /flex: 0 0 136px !important/);
});

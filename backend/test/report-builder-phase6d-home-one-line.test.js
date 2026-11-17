import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(
  "src/modules/report-builder/styles/report-builder-command-layout.css",
  "utf8",
);

test("Home ribbon is one horizontal line", () => {
  assert.match(css, /data-active-tab="Home"/);
  assert.match(css, /flex-wrap: nowrap !important/);
  assert.match(css, /overflow-x: auto !important/);
  assert.match(css, /height: 54px !important/);
});

test("Home groups do not wrap", () => {
  assert.match(css, /min-width: max-content !important/);
  assert.match(css, /height: 44px !important/);
});

test("Home controls remain compact", () => {
  assert.match(css, /min-height: 32px !important/);
  assert.match(css, /height: 32px !important/);
});

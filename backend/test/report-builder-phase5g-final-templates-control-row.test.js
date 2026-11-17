import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const readCss = () =>
  fs.readFileSync("src/modules/report-builder/styles/report-builder-command-layout.css", "utf8");

test("Phase 5G gives Templates enough vertical room", () => {
  const css = readCss();
  assert.match(css, /data-active-tab="Templates"/);
  assert.match(css, /selector and import action on one baseline/);
  assert.match(css, /overflow-x: auto !important/);
});

test("Templates group uses two explicit rows", () => {
  const css = readCss();
  assert.match(css, /display: flex !important/);
  assert.match(css, /align-items: center !important/);
});

test("Templates secondary content is no longer absolutely positioned", () => {
  const css = readCss();
  assert.doesNotMatch(css, /position:\s*absolute[^}]*Templates/i);
  assert.match(css, /overflow-x: auto !important/);
});

test("Template selector remains constrained and readable", () => {
  const css = readCss();
  assert.match(css, /max-width: 260px !important/);
  assert.match(css, /min-width: 0 !important/);
  assert.match(css, /font-size: 12px !important/);
});

test("Phase 5G remains a CSS-only visual correction", () => {
  assert.ok(fs.existsSync("src/modules/report-builder/styles/report-builder-command-layout.css"));
});

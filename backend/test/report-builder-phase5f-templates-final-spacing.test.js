import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = () => fs.readFileSync(
  "src/modules/report-builder/styles/report-builder-command-layout.css",
  "utf8",
);

test("Phase 5F compacts the Templates toolbar", () => {
  const text = css();
  assert.match(text, /data-active-tab="Templates"/);
  assert.match(text, /selector and import action on one baseline/);
  assert.match(text, /workspace-report-template-picker/);
});

test("Template groups no longer stretch across the ribbon", () => {
  const text = css();
  assert.match(text, /> :is\(\.report-template-tools, \.template-tools\)/);
  assert.match(text, /max-width: none !important/);
});

test("Template selector remains compact and readable", () => {
  const text = css();
  assert.match(text, /max-width: 260px !important/);
  assert.match(text, /min-width: 0 !important/);
  assert.match(text, /font-size: 12px !important/);
});

test("document workspace gap is reduced", () => {
  const text = css();
  assert.match(
    text,
    /\.section-document-stage \{\s*flex: 1 1 auto !important/s,
  );
});

test("sparse ribbon groups avoid full-width stretching", () => {
  const text = css();
  assert.match(
    text,
    /\.section-word-toolbar \{\s*flex: 0 0 auto !important/s,
  );
});

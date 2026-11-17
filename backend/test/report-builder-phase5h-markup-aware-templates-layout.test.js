import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(
  "src/modules/report-builder/styles/report-builder-command-layout.css",
  "utf8",
);

test("Phase 5H uses explicit markup-aware Templates groups", () => {
  assert.match(css, /> :is\(\.report-template-tools, \.template-tools\)/);
  assert.match(css, /display: flex !important/);
  assert.match(css, /align-items: center !important/);
});

test("template label owns its caption and select", () => {
  assert.match(css, /workspace-report-template-picker/);
  assert.match(css, /workspace-template-picker/);
  assert.match(css, /white-space: nowrap !important/);
});

test("template action buttons stay beside selectors", () => {
  assert.match(css, /> button/);
  assert.match(css, /> button/);
  assert.match(css, /flex: 0 0 auto !important/);
  assert.match(css, /height: 30px !important/);
});

test("template captions occupy their own lower row", () => {
  assert.match(css, /> small/);
  assert.match(css, /> small/);
  assert.match(css, /text-overflow: ellipsis !important/);
});

test("hidden import file input cannot consume ribbon space", () => {
  const workspace=fs.readFileSync("src/modules/assignments/components/TaskSectionWorkspace.tsx","utf8");
  assert.match(workspace, /type="file"[\s\S]{0,160}hidden/);
});

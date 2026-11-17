import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(
  "src/modules/report-builder/styles/report-builder.css",
  "utf8",
);

test("task outline suppresses horizontal overflow scrollbar", () => {
  assert.match(
    css,
    /\.task-report-builder-v1\s+\.workspace-section-outline\s*\{[\s\S]*?box-sizing:\s*border-box\s*!important;[\s\S]*?overflow-x:\s*hidden\s*!important;/,
  );
});

test("task outline children cannot force horizontal overflow", () => {
  assert.match(
    css,
    /\.task-report-builder-v1\s+\.workspace-section-outline\s*>\s*\*\s*\{[\s\S]*?max-width:\s*100%\s*!important;[\s\S]*?box-sizing:\s*border-box\s*!important;/,
  );
});

test("task footer disabled buttons stay fully opaque", () => {
  assert.match(
    css,
    /\.task-report-builder-v1[\s\S]*?\.task-report-footer[\s\S]*?button:disabled\s*\{[\s\S]*?opacity:\s*1\s*!important;[\s\S]*?background:\s*#d9e1ea\s*!important;/,
  );
});

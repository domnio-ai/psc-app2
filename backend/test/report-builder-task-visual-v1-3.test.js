import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workspace = fs.readFileSync(
  "src/modules/assignments/components/TaskSectionWorkspace.tsx",
  "utf8",
);

const css = fs.readFileSync(
  "src/modules/report-builder/styles/report-builder.css",
  "utf8",
);

test("task report workspace contains no known mojibake close glyphs", () => {
  assert.doesNotMatch(workspace, /Ã—|Â·|â†|â†’/);
  assert.match(workspace, />\s*×\s*<\/button>/);
});

test("task report outline is explicitly labelled as task report outline", () => {
  assert.match(
    workspace,
    /props\.workspaceVariant === "task-report" \? "TASK REPORT OUTLINE" : "REPORT OUTLINE"/,
  );
});

test("V1.2 task outline overflow protection remains present", () => {
  assert.match(
    css,
    /\.task-report-builder-v1\s+\.workspace-section-outline\s*\{[\s\S]*?overflow-x:\s*hidden\s*!important;/,
  );
});

test("V1.2 opaque disabled task footer remains present", () => {
  assert.match(
    css,
    /\.task-report-builder-v1[\s\S]*?\.task-report-footer[\s\S]*?button:disabled\s*\{[\s\S]*?opacity:\s*1\s*!important;[\s\S]*?background:\s*#d9e1ea\s*!important;/,
  );
});

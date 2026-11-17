import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const panel=fs.readFileSync("src/modules/tasks/TaskReportAccessPanel.tsx","utf8");
const css=fs.readFileSync("src/modules/tasks/task-report-work-v5.css","utf8");

test("Task V1.1.1 places the proceed action inside the visible Next Action panel",()=>{
  assert.match(panel,/task-report-next-action-button/);
  assert.match(panel,/onClick=\{onContinueReport\}/);
  assert.match(panel,/Continue Task Report/);
  assert.match(panel,/Start Task Report/);
});

test("Task V1.1.1 keeps one Continue/Start action in each mutually exclusive draft mode",()=>{
  const matches=panel.match(/onClick=\{onContinueReport\}/g)||[];
  assert.equal(matches.length,2);
  assert.match(panel,/if \(reportMode === "blank"\)[\s\S]*?onClick=\{onContinueReport\}/);
  assert.match(panel,/const percentage =[\s\S]*?onClick=\{onContinueReport\}/);
});

test("Task V1.1.1 keeps the proceed action prominent and visible",()=>{
  assert.match(css,/task-report-next-action-button/);
  assert.match(css,/width:\s*100%/);
  assert.match(css,/min-height:\s*40px/);
});

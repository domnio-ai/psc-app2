import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const landing=fs.readFileSync("src/modules/dashboard/dashboard-task-command-centre.css","utf8");
const drill=fs.readFileSync("src/modules/dashboard/dashboard-drilldown.css","utf8");
const ui=fs.readFileSync("src/modules/dashboard/ProgressiveDashboard.tsx","utf8");

test("Dashboard V3.1.1 retains V3 accessibility contracts in shared command-centre CSS",()=>{
  assert.match(landing,/@media \(prefers-reduced-motion: reduce\)/);
  assert.match(landing,/@media \(forced-colors: active\)/);
  assert.match(landing,/:focus-visible/);
});

test("Dashboard V3.1.1 keeps drilldown presentation modular",()=>{
  assert.match(ui,/dashboard-drilldown-home/);
  assert.match(ui,/DashboardRecordPickerModal/);
  assert.doesNotMatch(ui,/dashboard-drilldown-records|setBucket/);
  assert.match(drill,/APP2 Dashboard V3\.1/);
  assert.doesNotMatch(landing,/dashboard-task-subtree-kpis/);
  assert.doesNotMatch(landing,/dashboard-task-records/);
});

test("Dashboard V3.1.1 does not duplicate global accessibility ownership",()=>{
  assert.doesNotMatch(drill,/@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(drill,/@media \(forced-colors: active\)/);
});

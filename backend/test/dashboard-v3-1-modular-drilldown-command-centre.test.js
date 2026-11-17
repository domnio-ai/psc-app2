import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ui=fs.readFileSync("src/modules/dashboard/ProgressiveDashboard.tsx","utf8");
const landing=fs.readFileSync("src/modules/dashboard/dashboard-task-command-centre.css","utf8");
const drill=fs.readFileSync("src/modules/dashboard/dashboard-drilldown.css","utf8");

test("Dashboard V3.1 separates module overview from direct record selection",()=>{
  assert.match(ui,/import '\.\/dashboard-drilldown\.css'/);
  assert.match(ui,/dashboard-drilldown-home/);
  assert.match(ui,/DashboardRecordPickerModal/);
  assert.doesNotMatch(ui,/dashboard-drilldown-records/);
  assert.match(drill,/APP2 Dashboard V3\.1/);
  assert.doesNotMatch(drill,/dashboard-drilldown-records/);
});
test("Dashboard V3.1 sub-tree cards keep the Task command-centre contract",()=>{
  assert.match(ui,/dashboard-drilldown-kpis/);
  assert.match(drill,/repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(drill,/var\(--app2-blue-gradient\)/);
  assert.match(drill,/var\(--app2-amber-gradient\)/);
  assert.match(drill,/var\(--app2-violet-gradient\)/);
  assert.match(drill,/var\(--app2-green-gradient\)/);
});
test("Status cards open an action-and-record chooser instead of a generic matching-records page",()=>{
  assert.match(ui,/const openCard = \(\) =>/);
  assert.match(ui,/setRecordPicker\(\{/);
  assert.match(ui,/onSelect: \(\) => onOpen\(row\)/);
  assert.match(ui,/Open full workspace/);
  assert.doesNotMatch(ui,/View all matching records|View \`\$\{label\.toLowerCase\(\)\} records/);
  assert.doesNotMatch(ui,/setBucket|dashboard-drilldown-records|pulse-detail-open/);
  assert.match(ui,/data\.scope/);
});
test("Dashboard V3.1 removes generic record-page CSS while retaining responsive module overview styles",()=>{
  assert.doesNotMatch(landing,/SUB-TREES/);
  assert.doesNotMatch(landing,/RECORD \/ BUCKET/);
  assert.doesNotMatch(landing,/dashboard-task-subtree-kpis/);
  assert.doesNotMatch(landing,/dashboard-task-records/);
  assert.doesNotMatch(drill,/pulse-inline-preview|dashboard-drilldown-tools/);
  assert.match(drill,/@media \(max-width: 520px\)/);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css=fs.readFileSync("src/modules/dashboard/dashboard-drilldown.css","utf8");
const pulse=fs.readFileSync("src/modules/dashboard/pulse.css","utf8");
const ui=fs.readFileSync("src/modules/dashboard/ProgressiveDashboard.tsx","utf8");

test("retired duplicate record page and preview styles are removed",()=>{
  assert.doesNotMatch(ui,/pulse-inline-preview|pulse-detail-open|dashboard-drilldown-records|setBucket/);
  assert.doesNotMatch(css,/pulse-inline-preview|dashboard-drilldown-records|dashboard-drilldown-tools/);
  assert.doesNotMatch(pulse,/pulse-inline-preview|pulse-detail-card|pulse-list-tools|pulse-record-group|pulse-records/);
});
test("responsive module-overview styling and popup record selection remain",()=>{
  assert.match(css,/@media \(max-width: 760px\)/);
  assert.match(css,/@media \(max-width: 520px\)/);
  assert.match(ui,/DashboardRecordPickerModal/);
  assert.match(ui,/Choose a specific/);
});

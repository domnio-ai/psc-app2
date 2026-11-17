import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dashboard=fs.readFileSync("src/modules/dashboard/ProgressiveDashboard.tsx","utf8");
const picker=fs.readFileSync("src/modules/dashboard/DashboardRecordPickerModal.tsx","utf8");
const drill=fs.readFileSync("src/modules/dashboard/dashboard-drilldown.css","utf8");
const pulse=fs.readFileSync("src/modules/dashboard/pulse.css","utf8");
const memory=fs.readFileSync("src/modules/dashboard/dashboardNavigationMemory.ts","utf8");

test("generic matching-record page is removed from dashboard state and JSX",()=>{
  assert.doesNotMatch(dashboard,/setBucket|bucket=useState|pulse-records|pulse-detail-card|dashboard-drilldown-records|dashboardPreviewGuidance|DetailCard/);
  assert.doesNotMatch(dashboard,/View all matching records|View \$\{label\.toLowerCase\(\)\} records|setBucket\(label\)/);
});

test("dashboard cards keep scoped actions and direct record selection in one popup",()=>{
  assert.match(dashboard,/DashboardRecordPickerModal/);
  assert.match(dashboard,/actions:\[/);
  assert.match(dashboard,/key:'module-workspace'/);
  assert.match(dashboard,/items:recordItems/);
  assert.match(dashboard,/onSelect: \(\) => onOpen\(row\)/);
  assert.match(dashboard,/targetModule==='Team & Users'\?sourceRows\.filter\(row=>teamUserMatches/);
  assert.match(picker,/Choose an action above or select a specific authorised record below\./);
});

test("generic-page-only stylesheet rules and record-history state are removed",()=>{
  assert.doesNotMatch(drill,/dashboard-drilldown-records|dashboard-drilldown-tools|pulse-inline-preview/);
  assert.doesNotMatch(pulse,/pulse-records|pulse-detail-card|pulse-list-tools|pulse-inline-preview|pulse-record-group/);
  assert.doesNotMatch(memory,/sessionStorage|recent|pinnedRecords|rememberDashboardRecord|toggleDashboardRecordPin/);
  assert.match(memory,/toggleDashboardWorkspacePin/);
});

test("notification bell remains exported for the application shell",()=>{
  assert.match(dashboard,/export function PulseBell\(\{data,arrival,onOpen,onNavigate\}/);
  assert.match(dashboard,/onOpen:\(id:string\)=>void/);
});

test("Tasks, Assignments and Research preserve status-card selection and full workspace routes",()=>{
  assert.match(dashboard,/\["Tasks", "Assignments", "Research Repository"\]\.includes\(module\)/);
  assert.match(dashboard,/Open full workspace/);
  assert.match(dashboard,/Choose a specific/);
  assert.match(dashboard,/data\.scope/);
});

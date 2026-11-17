import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dashboard=fs.readFileSync("src/modules/dashboard/ProgressiveDashboard.tsx","utf8");
const baseCss=fs.readFileSync("src/modules/dashboard/pulse.css","utf8");
const commandCss=fs.readFileSync("src/modules/dashboard/dashboard-task-command-centre.css","utf8");
const app=fs.readFileSync("src/App.tsx","utf8");

test("Dashboard V3 uses one modular Task command-centre stylesheet",()=>{
  assert.match(dashboard,/import '\.\/dashboard-task-command-centre\.css'/);
  assert.match(dashboard,/dashboard-task-command-home/);
  assert.match(dashboard,/dashboard-task-subtree/);
  assert.match(commandCss,/Derived from the live Tasks Command Centre visual contract/);
});

test("Dashboard V3 removes old layered visual CSS from pulse.css",()=>{
  for(const marker of [
    "APP2 DASHBOARD MODERN LANDING V1",
    "APP2 DASHBOARD COMMAND CENTRE V2.0",
    "Dashboard V2 — card-first landing",
    "Dashboard V2.2 — compact gradient visual polish",
  ]) assert.equal(baseCss.includes(marker),false,marker);
});

test("Dashboard landing and sub-trees use Task command-centre contracts",()=>{
  assert.match(dashboard,/module-command-centre-head dashboard-task-command-head/);
  assert.match(dashboard,/module-kpi-strip dashboard-task-command-kpis/);
  assert.match(dashboard,/module-command-centre-head dashboard-task-subtree-head/);
  assert.match(dashboard,/module-kpi-strip dashboard-task-subtree-kpis/);
  assert.match(commandCss,/min-height:\s*118px/);
  for(const token of [
    "--app2-blue-gradient",
    "--app2-violet-gradient",
    "--app2-red-gradient",
    "--app2-amber-gradient",
    "--app2-green-gradient",
  ]) assert.match(commandCss,new RegExp(token));
});

test("Dashboard V3 preserves scope, counts and progressive drill-down logic",()=>{
  assert.match(dashboard,/managementView=data\.scope!==/);
  assert.match(dashboard,/data\.cardCounts\?\.\[m\]/);
  assert.match(dashboard,/onClick=\{\(\)=>m==='Meetings'\?onNavigate\('Meetings'\):\["Tasks", "Assignments", "Research Repository"\]\.includes\(m\)\?choose\(m\):openModuleActionPicker\(m,"All"\)\}/);
  assert.match(dashboard,/openModuleActionPicker\(m,"All"\)/);
  assert.match(dashboard,/actions:\[/);
  assert.match(dashboard,/setRecordPicker\(\{/);
  assert.doesNotMatch(dashboard,/setBucket|pulse-records|pulse-detail-open/);
  assert.match(dashboard,/data\.scope/);
});

test("Dashboard V3 cleans obsolete role command-centre imports",()=>{
  assert.doesNotMatch(app,/import ExecutiveCommandCentre/);
  assert.doesNotMatch(app,/import ResearcherCommandCentre/);
});

test("Dashboard V3 keeps accessibility and responsive contracts",()=>{
  assert.match(dashboard,/pulse-skip-link/);
  assert.match(commandCss,/:focus-visible/);
  assert.match(commandCss,/touch-action:\s*manipulation/);
  assert.match(commandCss,/@media \(max-width: 760px\)/);
  assert.match(commandCss,/@media \(max-width: 520px\)/);
  assert.match(commandCss,/@media \(prefers-reduced-motion: reduce\)/);
  assert.match(commandCss,/@media \(forced-colors: active\)/);
});

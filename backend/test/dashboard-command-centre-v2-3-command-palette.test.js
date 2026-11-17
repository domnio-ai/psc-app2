import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const dashboard=fs.readFileSync("src/modules/dashboard/ProgressiveDashboard.tsx","utf8");
const palette=fs.readFileSync("src/modules/dashboard/DashboardCommandPalette.tsx","utf8");
const css=fs.readFileSync("src/modules/dashboard/dashboardCommandPalette.css","utf8");

test("command palette is modular rather than embedded in ProgressiveDashboard",()=>{
  assert.match(dashboard,/import DashboardCommandPalette from '.\/DashboardCommandPalette'/);
  assert.match(palette,/export default function DashboardCommandPalette/);
  assert.match(palette,/dashboardCommandPalette\.css/);
});
test("palette is restricted to authorised workspaces and currently visible pulse rows",()=>{
  assert.match(dashboard,/authorisedWorkspaces=modules\.filter\(value=>value==='Needs My Attention'\|\|canSee\(value\)\)/);
  assert.match(dashboard,/commandRecords=dashboardRows\.map/);
  assert.match(dashboard,/rowByKey\.get\(key\)/);
});
test("palette reuses existing dashboard and workspace routing",()=>{
  assert.match(dashboard,/onInspectWorkspace=\{choose\}/);
  assert.match(dashboard,/onOpenWorkspace=\{openFullWorkspace\}/);
  assert.match(dashboard,/onNavigate\(value==='Needs My Attention'\?'Reviews & Approvals':value\)/);
});
test("palette supports keyboard access and escape handling",()=>{
  assert.match(palette,/ctrlKey\|\|event\.metaKey/);
  assert.match(palette,/toLocaleLowerCase\(\)==='k'/);
  assert.ok(palette.includes("event.key==='/'"));
  assert.match(palette,/event\.key==='Escape'/);
  assert.match(palette,/aria-modal="true"/);
});
test("palette searches workspaces and visible records while keeping results bounded",()=>{
  assert.match(palette,/matchingWorkspaces/);
  assert.match(palette,/slice\(0,10\)/);
  assert.match(palette,/matchingRecords/);
  assert.match(palette,/slice\(0,8\)/);
  assert.match(palette,/No authorised match/);
});
test("palette is compact responsive and theme-token based",()=>{
  assert.match(css,/APP2 DASHBOARD COMMAND PALETTE V2\.3/);
  assert.match(css,/max-height:min\(72vh,680px\)/);
  assert.match(css,/overflow-y:auto/);
  assert.match(css,/var\(--dash-accent\)/);
  assert.match(css,/@media\(max-width:620px\)/);
  assert.match(css,/@media\(forced-colors:active\)/);
});


test("launcher exposes an accessible keyboard-shortcut tooltip",()=>{
  assert.match(palette,/aria-describedby="pulse-command-shortcuts"/);
  assert.match(palette,/role="tooltip"/);
  assert.match(palette,/Keyboard shortcuts/);
  assert.match(palette,/open or close navigation/);
  assert.match(palette,/open search/);
  assert.match(palette,/Esc/);
  assert.match(css,/pulse-command-tooltip/);
  assert.match(css,/focus-within/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});

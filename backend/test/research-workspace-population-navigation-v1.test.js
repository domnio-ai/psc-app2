import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync("src/App.tsx","utf8");
const entry=fs.readFileSync("src/modules/research/ResearchWorkspaceEntry.tsx","utf8");
const summary=fs.readFileSync("src/modules/research/components/ResearchPortfolioSummary.tsx","utf8");
const status=fs.readFileSync("src/modules/research/researchStatus.ts","utf8");
const css=fs.readFileSync("src/modules/research/research-control-centre.css","utf8");

test("Research sidebar badge uses authoritative Pulse data rather than stale local rows",()=>{
  assert.match(app,/const navigationBadge =\s*Number\(pulse\.data\?\.badges\[label\] \|\| 0\)/);
  assert.doesNotMatch(app,/label === "Research Repository"\s*\?\s*researchRows\.filter/);
});

test("Research Workspace repopulates all authorised scopes after workflow changes and while visible",()=>{
  assert.match(entry,/window\.addEventListener\("app2:workflow-changed", scheduleRefresh\)/);
  assert.match(entry,/window\.addEventListener\("focus", scheduleRefresh\)/);
  assert.match(entry,/visibilitychange/);
  assert.match(entry,/10000/);
  assert.match(entry,/isManager\s*\?\s*\["my", "team", "reviews"\]\s*:\s*\["my", "reviews"\]/);
});

test("deadline attention derives from governed current research and one seven-day definition",()=>{
  assert.match(status,/RESEARCH_DUE_SOON_DAYS = 7/);
  assert.match(status,/currentResearchWorkflowStatuses\.has\(lifecycle\)/);
  assert.match(status,/return "overdue"/);
  assert.match(status,/return "due-soon"/);
});

test("Research summary exposes current lifecycle and deadline drill downs",()=>{
  for(const label of ["Current Research","Active","Planning","Awaiting Review","Changes Requested","Ready to Publish","Due Soon","Overdue"]){
    assert.ok(summary.includes(label),label);
  }
  assert.match(entry,/dueSoon=\{dueSoonCount\}/);
  assert.match(entry,/overdue=\{overdueCount\}/);
  assert.match(entry,/status === "Due Soon"/);
  assert.match(entry,/status === "Overdue"/);
  assert.match(entry,/createPortal\(/);
  assert.match(entry,/role="dialog"/);
  assert.match(entry,/openResearchCard\(title, filter\)/);
  assert.match(entry,/Open exact record/);
});

test("Research portfolio cards are full-card popup triggers",()=>{
  const card=fs.readFileSync("src/modules/research/components/ResearchPortfolioCard.tsx","utf8");
  assert.match(card,/<button[\s\S]*className=\{`research-control-card/);
  assert.match(card,/onClick=\{\(\) => onOpen\(project\)\}/);
});

test("Research presentation remains compact and responsive",()=>{
  assert.match(css,/grid-template-columns:\s*repeat\(4/);
  assert.match(css,/data-tone="overdue"/);
  assert.match(css,/@media \(max-width: 980px\)/);
});

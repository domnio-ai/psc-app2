import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const research = fs.readFileSync(
  "src/modules/research/ResearchWorkspaceEntry.tsx",
  "utf8",
);
const dashboardCss = fs.readFileSync(
  "src/modules/dashboard/dashboard-task-command-centre.css",
  "utf8",
);

test("manager research portfolio defaults to authorised scope", () => {
  assert.match(
    research,
    /useState<ResearchScopeView>\(isManager \? "team" : "my"\)/,
  );
});

test("director research scope is labelled as directorate research", () => {
  assert.match(research, /Directorate Research/);
  assert.match(research, /authorised directorate scope/);
});

test("ordinary researchers remain on My Research", () => {
  assert.match(research, /!isManager && scopeView === "team"/);
  assert.match(research, /setScopeView\("my"\)/);
});

test("dashboard command centre uses App2 theme variables", () => {
  for (const variable of [
    "--surface-primary",
    "--surface-secondary",
    "--text-primary",
    "--text-secondary",
    "--border-default",
    "--app2-blue",
  ]) {
    assert.match(dashboardCss, new RegExp(variable));
  }
});

test("dashboard command centre retains readable operational typography", () => {
  assert.match(dashboardCss, /font-size:\s*12px/);
  assert.match(dashboardCss, /font-size:\s*11px/);
  assert.doesNotMatch(dashboardCss, /font-size:\s*[0-9]px/);
});

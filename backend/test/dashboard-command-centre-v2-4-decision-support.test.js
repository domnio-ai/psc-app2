import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dashboard=fs.readFileSync("src/modules/dashboard/ProgressiveDashboard.tsx","utf8");
const decisionComponent="src/modules/dashboard/DashboardDecisionSupport.tsx";
const decisionStyles="src/modules/dashboard/dashboardDecisionSupport.css";

test("unused decision-support component and stylesheet are removed from the active source tree",()=>{
  assert.equal(fs.existsSync(decisionComponent),false);
  assert.equal(fs.existsSync(decisionStyles),false);
  assert.doesNotMatch(dashboard,/DashboardDecisionSupport|pulse-decision-support/);
});
test("primary review and calendar workspaces remain available",()=>{
  assert.match(dashboard,/'Reviews & Approvals'/);
  assert.match(dashboard,/'Calendar'/);
});

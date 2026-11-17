import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const dashboard=fs.readFileSync("src/modules/dashboard/ProgressiveDashboard.tsx","utf8");
test("card-first dashboard preserves established notification drilldown wording",()=>{
  assert.match(dashboard,/m==='Notifications'\?\`\$\{data\.unread\.length\} unread update/);
});
test("card-first dashboard preserves Research Workspace UI contract",()=>{
  assert.match(dashboard,/m==='Research Repository'\?'Research Workspace':m/);
});

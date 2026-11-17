import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const dashboard=fs.readFileSync("src/modules/dashboard/ProgressiveDashboard.tsx","utf8");

test("dashboard records open through the governed chooser, not a duplicate preview page",()=>{
  assert.match(dashboard,/DashboardRecordPickerModal/);
  assert.match(dashboard,/onSelect: \(\) => onOpen\(row\)/);
  assert.doesNotMatch(dashboard,/dashboardPreviewGuidance|pulse-inline-preview|pulse-detail-open|View all matching records/);
});
test("module-specific workspace navigation remains available",()=>{
  for(const label of ["Notifications","Reports & Analytics","Document Repository","Team & Users","Calendar"]) assert.ok(dashboard.includes(label),label);
  assert.match(dashboard,/Open full workspace/);
});

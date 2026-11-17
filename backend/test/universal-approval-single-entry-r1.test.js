import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (relative) => readFile(new URL(relative, import.meta.url), "utf8");

test("Users > Approvals is a navigation surface, not a second decision queue", async () => {
  const leaveWorkspace = await read("../../src/modules/users/UserLeaveManagement.tsx");
  const app = await read("../../src/App.tsx");
  const centralQueue = await read("../../src/modules/reviews/LeaveApprovalQueue.tsx");

  assert.match(leaveWorkspace, /onOpenApprovalCentre\?:\(\)=>void/);
  assert.match(leaveWorkspace, /Open Reviews &amp; Approvals/);
  assert.doesNotMatch(leaveWorkspace, /className="approval-queue"/);
  assert.doesNotMatch(leaveWorkspace, /const decide=async\(r:LeaveRequest/);
  assert.doesNotMatch(leaveWorkspace, /api\.decideLeaveRequest\(/);
  assert.match(app, /onOpenApprovalCentre=\{\(\) => setActive\("Reviews & Approvals"\)\}/);
  assert.match(centralQueue, /api\.decideLeaveRequest\(/);
});

test("My Leave still supports request submission, balances, cancellations and personal history", async () => {
  const leaveWorkspace = await read("../../src/modules/users/UserLeaveManagement.tsx");
  assert.match(leaveWorkspace, /api\.leaveTypes\(token\)/);
  assert.match(leaveWorkspace, /api\.leaveBalances\(token,currentUser\.id\)/);
  assert.match(leaveWorkspace, /api\.submitLeaveRequest\(token,form\)/);
  assert.match(leaveWorkspace, /api\.cancelLeaveRequest\(token,r\.id\)/);
  assert.match(leaveWorkspace, /My leave history/);
  assert.match(leaveWorkspace, /mode!=="leave"\)return/);
});

test("the cards and notifications integration remains installed", async () => {
  const pulseService = await read("../src/pulse-service.js");
  const pulseModel = await read("../src/pulse-model.js");
  const notificationCenter = await read("../../src/NotificationCenter.tsx");
  const workspace = await read("../../src/modules/reviews/ReviewsApprovalsWorkspace.tsx");
  const app = await read("../../src/App.tsx");

  assert.match(pulseService, /if\(canDecideLeaveRequests\(user\.role\)\)/);
  assert.match(pulseModel, /legacyLeaveReview/);
  assert.match(notificationCenter, /item\.entity_type === "leave_request"/);
  assert.match(workspace, /reviews\.length \+ leaveApprovalCount/);
  assert.match(app, /void refreshNotifications\(\)/);
});
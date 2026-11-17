import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildPulse, moduleForEntity } from "../src/pulse-model.js";

const read = (relative) => readFile(new URL(relative, import.meta.url), "utf8");

test("pending leave review rows populate the Reviews & Approvals card and drilldown", () => {
  const pulse = buildPulse([
    {
      id: "leave-request-r1",
      title: "Staff - Annual leave request",
      status: "Pending",
      type: "Review",
      module: "Reviews & Approvals",
      destination: "Reviews & Approvals",
      contextId: "leave-request-r1",
      reviewKind: "Leave Request",
      myReview: true,
      needsAction: true,
    },
  ], [], [], new Date("2026-10-22T07:00:00.000Z"));

  assert.equal(pulse.cardCounts["Reviews & Approvals"], 1);
  assert.equal(pulse.modules["Reviews & Approvals"].counts.All, 1);
  assert.equal(pulse.modules["Reviews & Approvals"].rows.length, 1);
});

test("leave review notifications populate the approval badge and unread Notifications card", () => {
  // Outcome notices must not inflate the approval badge merely because they concern leave.
  // Submission notifications are categorised as Review and are routed to the approvals badge.
  assert.equal(moduleForEntity("leave_request"), "Notifications");
  const pulse = buildPulse([], [
    {
      id: "leave-notification-r1",
      user_id: "manager-r1",
      entity_type: "leave_request",
      entity_id: "leave-request-r1",
      title: "Leave request awaiting review",
      body: "A leave request is waiting for your decision.",
      notification_category: "Review",
      priority: "High",
      created_at: "2026-10-22T07:00:00.000Z",
      read_at: null,
      archived_at: null,
    },
  ], [], new Date("2026-10-22T07:00:00.000Z"));

  assert.equal(pulse.cardCounts.Notifications, 1);
  assert.equal(pulse.badges["Reviews & Approvals"], 1);

  const legacyPulse = buildPulse([], [
    {
      id: "legacy-leave-notification-r1",
      user_id: "manager-r1",
      entity_type: "leave_request",
      entity_id: "leave-request-r2",
      title: "Leave request awaiting review",
      body: "A legacy leave request is waiting for your decision.",
      notification_category: "Action",
      priority: "High",
      created_at: "2026-10-22T07:00:00.000Z",
      read_at: null,
      archived_at: null,
    },
  ], [], new Date("2026-10-22T07:00:00.000Z"));
  assert.equal(legacyPulse.badges["Reviews & Approvals"], 1);

  const outcomePulse = buildPulse([], [
    {
      id: "leave-outcome-notification-r1",
      user_id: "staff-r1",
      entity_type: "leave_request",
      entity_id: "leave-request-r3",
      title: "Leave approved",
      body: "Your leave was approved.",
      notification_category: "Information",
      priority: "High",
      created_at: "2026-10-22T07:00:00.000Z",
      read_at: null,
      archived_at: null,
    },
  ], [], new Date("2026-10-22T07:00:00.000Z"));
  assert.equal(outcomePulse.badges["Reviews & Approvals"] || 0, 0);
});

test("leave pulse rows remain protected by the leave role policy and management scope", async () => {
  const [pulseService, leaveRoutes, leavePolicy] = await Promise.all([
    read("../src/pulse-service.js"),
    read("../src/users/leave-management.js"),
    read("../src/users/leave-policy.js"),
  ]);

  assert.match(leavePolicy, /export const canDecideLeaveRequests = role => managerRoles\.includes\(role\)/);
  assert.match(leaveRoutes, /import \{managerRoles\} from '\.\/leave-policy\.js'/);
  assert.match(leaveRoutes, /if\(!managerRoles\.includes\(req\.user\.role\)\)/);
  assert.match(pulseService, /if\(canDecideLeaveRequests\(user\.role\)\)/);
  assert.match(await read("../src/pulse-model.js"), /legacyLeaveReview/);
  assert.match(pulseService, /lr\.status='Pending'/);
  assert.match(pulseService, /lr\.user_id\s*<>\s*\$3/);
  assert.match(pulseService, /\(\$1 OR lr\.user_id=ANY\(\$2::uuid\[\]\)\)/);
  assert.match(leaveRoutes, /'High','Review'\)/);
});

test("leave notifications have approval labels, routing, and refresh wiring", async () => {
  const [notificationCenter, app, workspace, queue] = await Promise.all([
    read("../../src/NotificationCenter.tsx"),
    read("../../src/App.tsx"),
    read("../../src/modules/reviews/ReviewsApprovalsWorkspace.tsx"),
    read("../../src/modules/reviews/LeaveApprovalQueue.tsx"),
  ]);

  assert.match(notificationCenter, /item\.entity_type === "leave_request"/);
  assert.match(notificationCenter, /Open leave approval/);
  assert.match(app, /item\.entity_type === "leave_request" && item\.entity_id/);
  assert.match(app, /void refreshNotifications\(\)/);
  assert.match(workspace, /reviews\.length \+ leaveApprovalCount/);
  assert.match(queue, /onPendingCountChange/);
});
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = path => fs.readFileSync(path, "utf8");
const workspace = read("src/modules/meetings/MeetingsWorkspace.tsx");
const datePolicy = read("src/DateInputPolicy.tsx");
const routes = read("backend/src/meetings/meetings-routes.js");
const live = read("backend/src/meetings/live-conference.js");
const api = read("src/modules/meetings/meetingsApi.ts");
const approvals = read("src/modules/reviews/MeetingScheduleApprovalQueue.tsx");
const centre = read("src/modules/reviews/ReviewsApprovalsWorkspace.tsx");

test("meeting schedule date fields remain required and keyboard/paste usable", () => {
  assert.match(workspace, /type="datetime-local" required/);
  assert.match(workspace, /Meeting start date\/time must be in the future/);
  assert.match(workspace, /End date\/time must be later than start date\/time/);
  assert.match(workspace, /setForm\(\{ title: "", meetingType: "Departmental"/);
  assert.match(datePolicy, /meeting-schedule-workspace,\.meeting-approval-appointments/);
  assert.match(datePolicy, /!allowManualMeetingDate\(target\)/);
});

test("online and hybrid meetings require HTTPS join links and venues as applicable", () => {
  assert.match(workspace, /meetingMode === "Online" \|\| form\.meetingMode === "Hybrid"/);
  assert.match(workspace, /parsed\.protocol !== "https:"/);
  assert.match(workspace, /resourceLinks/);
  assert.match(routes, /normalizeMeetingResourceLinks/);
  assert.match(routes, /Online meeting link must be a valid HTTPS URL/);
  assert.match(routes, /meeting\.agenda\.map/);
  assert.match(workspace, /meeting-detail-resource-links/);
});

test("new meeting requests are pending and do not publish calendar events before approval", () => {
  assert.match(routes, /'Pending Approval',\$13,NOW\(\)/);
  assert.match(routes, /MEETING_SCHEDULE_SUBMITTED/);
  assert.match(routes, /Held until meeting schedule approval/);
  assert.match(workspace, /Meeting request submitted for approval/);
});

test("unapproved meeting schedule visibility is restricted at the API list and detail boundaries", () => {
  assert.match(routes, /m\.schedule_approval_status='Approved' OR m\.created_by=\$1 OR m\.schedule_approver_id=\$1/);
  assert.match(routes, /m\.schedule_approval_status='Approved' OR m\.created_by=\$2 OR m\.schedule_approver_id=\$2/);
  assert.match(routes, /base\.schedule_approver_id!==user\.id/);
  assert.match(routes, /OR m\.schedule_approver_id=\$3/);
  assert.match(live, /m\.schedule_approval_status='Approved' AND\(/);
});

test("only the assigned authorized approver can decide and self-approval is blocked", () => {
  assert.match(routes, /Only the assigned supervisor or appointed approver can decide/);
  assert.match(routes, /base\.schedule_approver_id!==user\.id/);
  assert.match(routes, /A requester cannot approve their own meeting schedule/);
  assert.match(routes, /assertScheduleApprover/);
  assert.match(routes, /meeting_schedule_approval_appointments/);
});

test("approval publishes the calendar record and only then sends attendee invitations", () => {
  assert.match(routes, /MEETING_SCHEDULE_APPROVED/);
  assert.match(routes, /INSERT INTO calendar_events/);
  assert.match(routes, /attendeeIds=\(await query/);
  assert.match(routes, /schedule_approval_status!=='Approved'/);
});

test("meeting schedule actions are inside the central Reviews & Approvals workspace", () => {
  assert.match(centre, /MeetingScheduleApprovalQueue/);
  assert.match(centre, /meetingApprovalCount/);
  assert.match(approvals, /Approve schedule/);
  assert.match(approvals, /Open full meeting record/);
  assert.match(approvals, /meetingsApi\.detail/);
  assert.match(api, /schedule-decision/);
});

test("meeting minutes review remains separate and retains Approved/Returned reviewer controls", () => {
  assert.match(routes, /minutes\/review/);
  assert.match(routes, /\['Approved','Returned'\]/);
  assert.match(routes, /Only the assigned reviewer can decide these minutes/);
  assert.match(routes, /MEETING_MINUTES_APPROVED/);
  assert.match(routes, /MEETING_MINUTES_RETURNED/);
});

test("appointed approver controls are scope checked, expiring and auditable", () => {
  assert.match(routes, /subject\.supervisor_id!==req\.user\.id/);
  assert.match(routes, /expires_at>NOW\(\)/);
  assert.match(routes, /MEETING_SCHEDULE_APPROVER_APPOINTED/);
  assert.match(routes, /MEETING_SCHEDULE_APPROVER_REVOKED/);
});
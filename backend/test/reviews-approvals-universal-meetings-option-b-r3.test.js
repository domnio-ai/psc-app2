import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");
const ui = read("src/modules/reviews/ReviewsApprovalsWorkspace.tsx");
const types = read("src/modules/meetings/types.ts");

test("unified history reads schedule decisions from existing authorised meeting list", () => {
  assert.match(ui, /meetingsApi\.list\(token\)/);
  assert.match(ui, /schedule_approval_decided_by === currentUserId/);
  assert.match(ui, /\["Approved", "Returned", "Rejected"\]/);
  assert.match(types, /schedule_approval_decided_by\?: string \| null/);
  assert.match(types, /schedule_approval_decided_at\?: string \| null/);
});

test("Option B finalisation shows completed meetings whose minutes are not approved", () => {
  assert.match(ui, /row\.status === "Completed" && row\.minutes_status !== "Approved"/);
  assert.match(ui, /destination: "Meetings"/);
  const app = read("src/App.tsx");
  assert.match(app, /APP2_UNIVERSAL_MEETING_OPEN_OPTION_B_R3/);
  assert.match(app, /setMeetingNotificationTarget\(\{/);
  assert.match(app, /tab: item\.type === "Finalization" \|\| item\.reviewKind === "Meeting Minutes" \? "Minutes" : "Overview"/);
  assert.match(ui, /items=\{combinedFinalisations\}/);
});

test("meeting rows are merged into existing workspace lists without replacing domain queues", () => {
  assert.match(ui, /items=\{combinedHistory\}/);
  assert.match(ui, /items=\{combinedFinalisations\}/);
  assert.match(ui, /<LeaveApprovalQueue/);
  assert.match(ui, /<MeetingScheduleApprovalQueue/);
  assert.match(ui, /meetingRowsError/);
});

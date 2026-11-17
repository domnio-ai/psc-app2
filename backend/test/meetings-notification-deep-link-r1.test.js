import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const load = (relative) => readFileSync(path.join(root, relative), "utf8");
const app = load("src/App.tsx");
const meetings = load("src/modules/meetings/MeetingsWorkspace.tsx");
const notifications = load("src/NotificationCenter.tsx");
const css = load("src/modules/meetings/meetings-command-centre.css");

test("meeting notifications route into the specific Meetings workspace record or approval queue", () => {
  assert.match(app, /notificationEntityType\.includes\("meeting"\)/);
  assert.match(app, /setMeetingNotificationTarget\(\{ id: item\.entity_id, tab: targetMeetingTab, nonce: Date\.now\(\) \}\)/);
  assert.match(app, /setActive\("Reviews & Approvals"\)/);
  assert.match(meetings, /meetingsApi\.detail\(token, initialTarget\.id\)/);
  assert.match(meetings, /setTab\(targetTab\)/);
});

test("notification metadata identifies meeting work and gives context-specific actions", () => {
  assert.match(notifications, /if \(type\.toLowerCase\(\)\.includes\("meeting"\)\) return "Meetings"/);
  assert.match(notifications, /Open meeting approval/);
  assert.match(notifications, /Open meeting minutes/);
  assert.match(notifications, /Open meeting transcript/);
});

test("Meetings page layout has responsive hierarchy and preserves existing minutes workflow", () => {
  assert.match(css, /APP2_MEETINGS_EXPERIENCE_REDESIGN_R1/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(meetings, /generateMinutes\(token, selected\.id\)/);
  assert.match(meetings, /meetingsApi\.saveMinutes\(token, selected\.id, contentAtStart\)/);
  assert.match(meetings, /meetingsApi\.submitMinutes\(token, selected\.id, selected\.reviewer_id\)/);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ui=fs.readFileSync("src/modules/meetings/MeetingsWorkspace.tsx","utf8");
const css=fs.readFileSync("src/modules/meetings/meetings.css","utf8");
const schedule=fs.readFileSync("src/modules/meetings/meetings-schedule.css","utf8");

test("Meetings V2.6.1 modularises Schedule Meeting presentation",()=>{
  assert.match(ui,/import "\.\/meetings-schedule\.css"/);
  assert.match(ui,/meeting-schedule-workspace/);
  assert.match(ui,/meeting-schedule-section/);
  assert.match(ui,/meeting-schedule-grid/);
});

test("Meetings V2.6.1 removes obsolete schedule visual classes from main CSS",()=>{
  assert.doesNotMatch(css,/meeting-modal-v24/);
  assert.doesNotMatch(css,/meeting-create-participants/);
  assert.doesNotMatch(css,/meeting-participant-picker-backdrop/);
});

test("Meetings V2.6.1 keeps schedule and invitation behaviour intact",()=>{
  assert.match(ui,/openParticipantPicker\("create"\)/);
  assert.match(ui,/Schedule & send invitations/);
  assert.match(ui,/createMeeting\(\)/);
  assert.match(ui,/createParticipantRoles/);
});

test("Meetings V2.6.1 uses App2 12px operational text",()=>{
  assert.match(schedule,/font-size: 12px/);
  assert.match(schedule,/meeting-participant-picker/);
  assert.match(schedule,/meeting-schedule-footer/);
});

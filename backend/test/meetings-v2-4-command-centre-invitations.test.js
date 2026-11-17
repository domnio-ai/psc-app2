import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workspace=fs.readFileSync("src/modules/meetings/MeetingsWorkspace.tsx","utf8");
const api=fs.readFileSync("src/modules/meetings/meetingsApi.ts","utf8");
const types=fs.readFileSync("src/modules/meetings/types.ts","utf8");
const css=fs.readFileSync("src/modules/meetings/meetings.css","utf8");
const scheduleCss=fs.readFileSync("src/modules/meetings/meetings-schedule.css","utf8");
const routes=fs.readFileSync("backend/src/meetings/meetings-routes.js","utf8");

test("Meetings V2.4 exposes participant picker and dual-channel invitations",()=>{
  assert.match(workspace,/PARTICIPANTS & INVITATIONS/);
  assert.match(workspace,/Schedule & send invitations/);
  assert.match(workspace,/Send invitations/);
  assert.match(workspace,/meeting-participant-picker/);
  assert.match(api,/participants\/bulk/);
  assert.match(api,/invitations\/send/);
  assert.match(types,/email\?: string \| null/);
});

test("Meetings V2.4 backend sends App2 notifications and normal email",()=>{
  assert.match(routes,/mailStatus,sendMail/);
  assert.match(routes,/MEETING_EMAIL_SENT/);
  assert.match(routes,/MEETING_INVITATIONS_SENT/);
  assert.match(routes,/target_workspace,notification_category/);
  assert.match(routes,/'Open meeting','Meetings','Information'/);
  assert.match(routes,/participants\/bulk/);
  assert.match(routes,/participants\/:participantId/);
});

test("Meetings V2.4 preserves command centre and participant visual hierarchy",()=>{
  assert.match(workspace,/Meetings Command Centre/);
  assert.match(css,/APP2 MEETINGS V2\.4/);
  assert.match(css,/meeting-participant-grid-v24/);
  assert.match(scheduleCss,/meeting-participant-picker-backdrop/);
  assert.match(scheduleCss,/meeting-participant-picker/);
  assert.match(workspace,/meetings-register-tools/);
});

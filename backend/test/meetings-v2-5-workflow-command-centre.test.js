import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workspace=fs.readFileSync("src/modules/meetings/MeetingsWorkspace.tsx","utf8");
const css=fs.readFileSync("src/modules/meetings/meetings.css","utf8");

test("Meetings V2.5 adds seven-stage lifecycle",()=>{
  assert.match(workspace,/meeting-lifecycle-v25/);
  for(const label of ["Prepare","Conduct","Transcribe","Minutes","Review","Actions","Close"]) assert.match(workspace,new RegExp(label));
});

test("Meetings V2.5 adds participant status summary and resend action",()=>{
  assert.match(workspace,/meeting-participant-stats-v25/);
  assert.match(workspace,/Send invitations \/ resend/);
  assert.match(workspace,/participantStats/);
  assert.match(workspace,/Present \/ Virtual/);
});

test("Meetings V2.5 adds register sorting",()=>{
  assert.match(workspace,/sortMode/);
  assert.match(workspace,/Soonest first/);
  assert.match(workspace,/Latest first/);
  assert.match(workspace,/Title A-Z/);
});

test("Meetings V2.5 styles remain scoped",()=>{
  assert.match(css,/APP2 MEETINGS V2\.5/);
  assert.match(css,/meeting-lifecycle-v25/);
  assert.match(css,/meeting-participant-stats-v25/);
});

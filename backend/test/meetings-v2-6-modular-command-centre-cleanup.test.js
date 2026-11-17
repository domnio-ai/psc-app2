import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ui=fs.readFileSync("src/modules/meetings/MeetingsWorkspace.tsx","utf8");
const css=fs.readFileSync("src/modules/meetings/meetings.css","utf8");
const commandCss=fs.readFileSync("src/modules/meetings/meetings-command-centre.css","utf8");

test("Meetings V2.6 uses one modular command-centre stylesheet",()=>{
  assert.match(ui,/import "\.\/meetings-command-centre\.css"/);
  assert.match(ui,/meetings-command-centre/);
  assert.match(ui,/module-kpi-strip/);
  assert.match(ui,/kpi-blue/);
  assert.match(ui,/kpi-green/);
});

test("Meetings V2.6 removes obsolete visual override layers",()=>{
  assert.doesNotMatch(css,/APP2 MEETINGS V2\.5\.1/);
  assert.doesNotMatch(css,/APP2 MEETINGS V2\.5\.2/);
  assert.doesNotMatch(css,/APP2 MEETINGS V2\.5\.3/);
  assert.doesNotMatch(ui,/meetings-task-theme-v253/);
  assert.doesNotMatch(ui,/meetings-command-cards-v252/);
});

test("Meetings V2.6 command centre follows the live Tasks contract",()=>{
  assert.match(commandCss,/grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(commandCss,/min-height: 92px/);
  assert.match(commandCss,/--command-blue: #2f6fb4/);
  assert.match(commandCss,/--command-amber: #e5a01c/);
  assert.match(commandCss,/--command-green: #2f9660/);
});

test("Meetings V2.6 preserves working meeting functions",()=>{
  assert.match(ui,/Schedule & send invitations/);
  assert.match(ui,/meeting-lifecycle-v25/);
  assert.match(ui,/participantStats/);
  assert.match(ui,/LiveMeetingRoom/);
  assert.match(ui,/generateMinutes/);
  assert.match(ui,/sendInvitations/);
});

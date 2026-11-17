import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ui=fs.readFileSync("src/modules/meetings/MeetingsWorkspace.tsx","utf8");
const css=fs.readFileSync("src/modules/meetings/meetings-schedule.css","utf8");

test("participant picker is rendered before Schedule Meeting in JSX",()=>{
  const picker=ui.indexOf("{participantPickerOpen &&");
  const schedule=ui.indexOf("{createOpen &&");
  assert.ok(picker >= 0 && schedule >= 0);
  assert.ok(picker < schedule, "captured DOM order changed; stacking contract must be reviewed");
});

test("participant picker is explicitly above Schedule Meeting",()=>{
  assert.match(css,/\.meeting-schedule-backdrop\s*\{\s*z-index:\s*4700;/s);
  assert.match(css,/\.meeting-participant-picker-backdrop\s*\{\s*z-index:\s*4820;/s);
});

test("participant picker interaction remains wired",()=>{
  assert.match(ui,/openParticipantPicker\("create"\)/);
  assert.match(ui,/setParticipantPickerOpen\(true\)/);
  assert.match(ui,/applyParticipantPicker/);
  assert.match(ui,/Select participants/);
});

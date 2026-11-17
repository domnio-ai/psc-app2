import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const chatCss=fs.readFileSync("src/modules/messages/messages.css","utf8");
const meetCss=fs.readFileSync("src/modules/meetings/meetings.css","utf8");
const meetings=fs.readFileSync("src/modules/meetings/MeetingsWorkspace.tsx","utf8");

test("V1.0.9 gives Team Chat a non-layered command-centre layout",()=>{
  assert.match(chatCss,/APP2 COLLABORATION V1\.0\.9/);
  assert.match(chatCss,/messages-workspace\.team-chat-workspace\{[\s\S]*height:auto!important/);
  assert.match(chatCss,/grid-template-columns:minmax\(260px,28%\) minmax\(0,1fr\)!important/);
  assert.match(chatCss,/messages-thread\{[\s\S]*grid-template-rows:auto minmax\(0,1fr\) auto!important/);
  assert.match(chatCss,/messages-composer\{[\s\S]*position:relative!important/);
});

test("V1.0.9 aligns Meetings with Task Command Centre visual language",()=>{
  assert.match(meetings,/Meetings Command Centre/);
  assert.match(meetCss,/APP2 COLLABORATION V1\.0\.9/);
  assert.match(meetCss,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)!important/);
  assert.match(meetCss,/nth-child\(6\)/);
  assert.match(meetCss,/radial-gradient/);
});

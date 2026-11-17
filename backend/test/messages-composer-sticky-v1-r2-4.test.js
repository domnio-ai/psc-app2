import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const ui=readFileSync("src/modules/messages/MessagesWorkspace.tsx","utf8");
const css=readFileSync("src/modules/messages/messages.css","utf8");

test("message composer exposes an explicit send action",()=>{
  assert.match(ui,/messages-send-button/);
  assert.match(ui,/aria-label="Send message"/);
  assert.match(ui,/Send message/);
  assert.match(ui,/disabled=\{!draft\.trim\(\)\|\|sending\}/);
});
test("typing area remains visible at bottom of conversation",()=>{
  assert.match(css,/APP2 MESSAGES V1 R2\.4 - STICKY MESSAGE COMPOSER/);
  assert.match(css,/\.messages-composer\{/);
  assert.match(css,/position:sticky/);
  assert.match(css,/bottom:0/);
  assert.match(css,/z-index:6/);
});
test("only conversation history scrolls",()=>{
  assert.match(css,/\.messages-thread-scroll\{/);
  assert.match(css,/overflow-y:auto/);
  assert.match(css,/\.messages-thread\{/);
  assert.match(css,/overflow:hidden/);
});
test("short screens retain compact composer",()=>{
  assert.match(css,/@media\(max-height:760px\)/);
  assert.match(css,/messages-composer textarea/);
  assert.match(css,/max-height:110px/);
});

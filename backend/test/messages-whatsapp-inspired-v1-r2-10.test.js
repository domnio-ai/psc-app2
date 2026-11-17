import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const ui=readFileSync("src/modules/messages/MessagesWorkspace.tsx","utf8");
const css=readFileSync("src/modules/messages/messages.css","utf8");

test("chat list owns its header and new-message action",()=>{
  assert.match(ui,/messages-chatlist-header/);
  assert.match(ui,/>Chats</);
  assert.match(ui,/aria-label="New message"/);
});

test("composer is a compact single-row chat control",()=>{
  assert.match(ui,/messages-composer-row/);
  assert.match(ui,/rows=\{1\}/);
  assert.match(ui,/placeholder="Type a message"/);
  assert.doesNotMatch(ui,/Enter to send · Shift\+Enter for new line<\/small>/);
  assert.match(css,/grid-template-columns:36px minmax\(0,1fr\) 74px/);
});

test("messages use readable twelve-pixel typography",()=>{
  assert.match(css,/messages-bubble p\{/);
  assert.match(css,/font-size:12px/);
  assert.match(css,/messages-conversation-copy strong/);
});

test("reaction actions behave as hover affordances rather than permanent emoji rows",()=>{
  assert.match(css,/position:absolute/);
  assert.match(css,/top:-15px/);
  assert.match(css,/opacity:0/);
  assert.match(css,/messages-bubble:hover \.messages-bubble-actions/);
});

test("chat shell uses a two-pane messaging layout",()=>{
  assert.match(css,/grid-template-columns:320px minmax\(0,1fr\)/);
  assert.match(css,/grid-template-rows:56px minmax\(0,1fr\) auto/);
});

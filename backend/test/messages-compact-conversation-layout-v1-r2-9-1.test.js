import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const css=readFileSync("src/modules/messages/messages.css","utf8");

test("messages chat shell is narrower and cannot create horizontal thread overflow",()=>{
  assert.match(css,/APP2 MESSAGES V1 R2\.9\.1 - COMPACT CONVERSATION LAYOUT/);
  assert.match(css,/width:min\(100%,1080px\)/);
  assert.match(css,/grid-template-columns:230px minmax\(0,1fr\)/);
  assert.match(css,/overflow-x:hidden/);
});

test("message stream is denser and sent messages retain stronger distinction",()=>{
  assert.match(css,/max-width:min\(500px,72%\)/);
  assert.match(css,/var\(--yellow\) 24%/);
  assert.match(css,/messages-receipt\{/);
});

test("rich actions no longer visually dominate every message",()=>{
  assert.match(css,/\.messages-bubble-actions\{[\s\S]*opacity:0/);
  assert.match(css,/pointer-events:none/);
  assert.match(css,/messages-bubble:hover \.messages-bubble-actions/);
});

test("composer stays compact and reserves Felix-safe right space",()=>{
  assert.match(css,/padding:8px 120px 8px 10px/);
  assert.match(css,/min-height:44px/);
  assert.match(css,/min-width:78px!important/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const css=readFileSync("src/modules/messages/messages.css","utf8");

test("desktop chat shell fits the viewport and reserves room for the composer",()=>{
  assert.match(css,/APP2 MESSAGES V1 R2\.10\.3 - VIEWPORT FIT \+ BELOW-MESSAGE REACTION BAR/);
  assert.match(css,/height:clamp\(420px,calc\(100dvh - 360px\),560px\)/);
  assert.match(css,/grid-template-rows:56px minmax\(0,1fr\) auto/);
  assert.match(css,/overscroll-behavior:contain/);
});

test("reaction hover bar appears below each message as a rectangle",()=>{
  assert.match(css,/top:calc\(100% \+ 5px\)/);
  assert.match(css,/border-radius:8px/);
  assert.match(css,/min-height:30px/);
  assert.match(css,/\.theirs \.messages-bubble-actions\{/);
  assert.match(css,/messages-bubble:hover \.messages-bubble-actions/);
});

test("composer remains compact and visible",()=>{
  assert.match(css,/min-height:56px/);
  assert.match(css,/max-height:84px/);
  assert.match(css,/grid-template-columns:34px minmax\(0,1fr\) 72px/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const css=readFileSync("src/modules/messages/messages.css","utf8");

test("composer remains pinned inside the visible chat surface",()=>{
  assert.match(css,/APP2 MESSAGES V1 R2\.9\.2 - ALWAYS-VISIBLE COMPOSER/);
  assert.match(css,/position:sticky/);
  assert.match(css,/bottom:0/);
  assert.match(css,/z-index:120/);
});

test("workspace height adapts to viewport so composer stays on screen",()=>{
  assert.match(css,/height:clamp\(430px,calc\(100dvh - 330px\),620px\)/);
  assert.match(css,/grid-template-rows:46px minmax\(0,1fr\) auto/);
});

test("message history owns the scroll above the composer",()=>{
  assert.match(css,/messages-thread-scroll\{/);
  assert.match(css,/overflow-y:auto/);
  assert.match(css,/overflow-x:hidden/);
});

test("composer keeps right-side safe room for floating UI",()=>{
  assert.match(css,/padding:8px 128px 8px 10px/);
});

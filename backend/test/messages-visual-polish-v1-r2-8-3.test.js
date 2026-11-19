import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const css=readFileSync("src/modules/messages/messages.css","utf8").replace(/\r\n/g,"\n");

test("messages layout is reduced and centered",()=>{
  assert.match(css,/APP2 MESSAGES V1 R2\.8\.3 - VISUAL POLISH \+ SAFE COMPOSER/);
  assert.match(css,/width:min\(100%,1220px\)/);
  assert.match(css,/grid-template-columns:260px minmax\(620px,860px\)/);
  assert.match(css,/width:min\(100%,860px\)/);
});

test("composer keeps a safe area clear of bottom-right overlays",()=>{
  assert.match(css,/padding:10px 120px 10px 14px/);
  assert.match(css,/justify-content:flex-start/);
});

test("sent and received messages are visually easier to distinguish",()=>{
  assert.match(css,/background:color-mix\(in srgb,var\(--yellow\) 18%,var\(--surface-primary\)\)/);
  assert.match(css,/messages-receipt\{\n  color:color-mix\(in srgb,var\(--yellow\) 82%,var\(--text-primary\)\)/);
});

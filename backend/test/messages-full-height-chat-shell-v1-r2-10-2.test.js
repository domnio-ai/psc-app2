import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const css=readFileSync("src/modules/messages/messages.css","utf8");
test("R2.10 chat shell owns the full workspace height",()=>{
  assert.match(css,/APP2 MESSAGES V1 R2\.10\.2 - FULL-HEIGHT CHAT SHELL FIX/);
  assert.match(css,/\.messages-workspace\{[\s\S]*display:block/);
  assert.match(css,/\.messages-layout,[\s\S]*height:100%/);
  assert.match(css,/min-height:500px/);
});
test("mobile keeps a natural stacked height",()=>{
  assert.match(css,/@media\(max-width:850px\)[\s\S]*height:auto/);
  assert.match(css,/min-height:620px/);
});

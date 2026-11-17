import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const composer=readFileSync("src/modules/notifications/InternalEmailComposer.tsx","utf8");
const css=readFileSync("src/notifications.css","utf8");

test("composer keeps header body and footer in separate layout regions",()=>{
  assert.match(composer,/internal-email-scroll-area/);
  assert.match(composer,/internal-email-footer/);
  assert.match(composer,/Send email/);
});

test("composer body scrolls without hiding footer",()=>{
  assert.match(css,/grid-template-rows:auto minmax\(0,1fr\) auto/);
  assert.match(css,/\.internal-email-scroll-area\{/);
  assert.match(css,/overflow-y:auto/);
  assert.match(css,/\.internal-email-footer\{/);
  assert.match(css,/position:sticky/);
  assert.match(css,/bottom:0/);
});

test("small-height screens retain a visible compact composer",()=>{
  assert.match(css,/@media\(max-height:760px\)/);
  assert.match(css,/height:94vh/);
  assert.match(css,/max-height:160px/);
});

test("mobile footer remains accessible",()=>{
  assert.match(css,/@media\(max-width:620px\)/);
  assert.match(css,/height:96vh/);
  assert.match(css,/internal-email-footer button/);
});

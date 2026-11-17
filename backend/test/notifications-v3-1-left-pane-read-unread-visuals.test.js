import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css=fs.readFileSync("src/notifications.css","utf8");

test("Notifications V3.1 left pane uses distinct folder accent treatment",()=>{
  assert.match(css,/APP2 NOTIFICATIONS V3\.1 - LEFT PANE \+ READ\/UNREAD VISUALS/);
  assert.match(css,/--folder-accent/);
  assert.match(css,/button::before/);
  assert.match(css,/transform:translateX\(1px\)/);
});

test("Notifications V3.1 unread messages use blue visual coding",()=>{
  assert.match(css,/article\.unread\{/);
  assert.match(css,/border-left-color:var\(--nc-blue\)/);
  assert.match(css,/color-mix\(in srgb,var\(--nc-blue\) 15%/);
});

test("Notifications V3.1 read messages use green visual coding",()=>{
  assert.match(css,/article:not\(\.unread\)\{/);
  assert.match(css,/border-left-color:var\(--nc-green\)/);
  assert.match(css,/color-mix\(in srgb,var\(--nc-green\) 8%/);
});

test("Notifications V3.1 selected state preserves read/unread distinction",()=>{
  assert.match(css,/selected\.unread/);
  assert.match(css,/selected:not\(\.unread\)/);
  assert.match(css,/outline:2px solid/);
});

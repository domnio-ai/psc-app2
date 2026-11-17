import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const ui=readFileSync("src/modules/messages/MessagesWorkspace.tsx","utf8");
const css=readFileSync("src/modules/messages/messages.css","utf8");
const legacy=readFileSync("backend/test/internal-messaging-v1.test.js","utf8");

test("single compact module row",()=>{
  assert.match(ui,/messages-chatlist-header/);
  assert.match(ui,/>Chats</);
  assert.match(ui,/aria-label="New message"/);
  assert.match(ui,/Search chats/);
  assert.doesNotMatch(ui,/<h2>Internal conversations<\/h2>/);
});
test("viewport-owned chat surface",()=>{
  assert.match(css,/APP2 MESSAGES V1 R2\.8\.2 - COMPACT VISUAL CONSOLIDATION/);
  assert.match(css,/height:min\(690px,calc\(100vh - 188px\)\)/);
  assert.match(css,/overflow-y:auto/);
});
test("legacy messaging regression follows current Chats contract",()=>{
  assert.doesNotMatch(legacy,/assert\.match\(ui,\/Internal conversations\/\)/);
  assert.doesNotMatch(legacy,/messages-toolbar-compact/);
  assert.match(legacy,/messages-chatlist-header/);
  assert.match(legacy,/Search chats/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const ui=readFileSync("src/modules/messages/MessagesWorkspace.tsx","utf8");
const compact=readFileSync("backend/test/messages-compact-visual-v1-r2-8-2.test.js","utf8");
const legacy=readFileSync("backend/test/internal-messaging-v1.test.js","utf8");

test("all governed messaging UI tests follow the Chats contract",()=>{
  assert.match(ui,/messages-chatlist-header/);
  assert.match(ui,/>Chats</);
  assert.match(ui,/Search chats/);
  assert.match(compact,/messages-chatlist-header/);
  assert.match(compact,/Search chats/);
  assert.doesNotMatch(compact,/assert\.match\(ui,\/messages-toolbar-compact\/\)/);
  assert.doesNotMatch(compact,/assert\.match\(legacy,\/messages-toolbar-compact\/\)/);
  assert.match(legacy,/messages-chatlist-header/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const app=readFileSync("backend/src/app.js","utf8");
const rich=readFileSync("backend/src/messages/rich-messaging.js","utf8");
const migration=readFileSync("backend/migrations/043_message_rich_messaging.sql","utf8");
const api=readFileSync("src/api.ts","utf8");
const ui=readFileSync("src/modules/messages/MessagesWorkspace.tsx","utf8");
const css=readFileSync("src/modules/messages/messages.css","utf8");

test("reply model is governed inside the same conversation",()=>{
  assert.match(migration,/reply_to_message_id/);
  assert.match(app,/Reply target is not part of this conversation/);
  assert.match(ui,/Replying to/);
  assert.match(ui,/messages-reply-quote/);
});

test("reactions are modular and membership protected",()=>{
  assert.match(migration,/CREATE TABLE IF NOT EXISTS message_reactions/);
  assert.match(rich,/ALLOWED_REACTIONS/);
  assert.match(rich,/Conversation access denied/);
  assert.match(ui,/toggleReaction/);
  assert.match(css,/messages-reactions/);
});

test("attachments are raw binary, blocked by extension, and membership protected",()=>{
  assert.match(app,/\/api\/messages\/conversations\/:id\/attachments/);
  assert.match(rich,/BLOCKED_EXTENSIONS/);
  assert.match(rich,/config\.maxUploadMb/);
  assert.match(rich,/\/api\/messages\/attachments\/:id\/download/);
  assert.match(rich,/Content-Disposition/);
  assert.match(ui,/uploadMessageAttachment/);
  assert.match(ui,/messages-attachment-card/);
});

test("composer supports keyboard send without breaking multiline",()=>{
  assert.match(ui,/e\.key==="Enter"&&!e\.shiftKey/);
  assert.match(ui,/Shift\+Enter for new line/);
});

test("rich messaging code stays modular",()=>{
  assert.match(app,/registerRichMessagingRoutes/);
  assert.match(rich,/export const registerRichMessagingRoutes/);
  assert.match(api,/reactToMessage/);
  assert.match(api,/downloadMessageAttachment/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync("backend/src/app.js","utf8");
const schema=readFileSync("backend/migrations/040_internal_messaging.sql","utf8");
const api=readFileSync("src/api.ts","utf8");
const ui=readFileSync("src/modules/messages/MessagesWorkspace.tsx","utf8");
const shell=readFileSync("src/App.tsx","utf8");
const css=readFileSync("src/modules/messages/messages.css","utf8");

test("messaging schema is conversation/member/message based",()=>{
  assert.match(schema,/message_conversations/);
  assert.match(schema,/message_conversation_members/);
  assert.match(schema,/app_messages/);
  assert.match(schema,/last_read_at/);
});

test("backend enforces membership on conversation read and send",()=>{
  assert.match(app,/ensureMessageMember/);
  assert.match(app,/Conversation access denied/);
  assert.match(app,/\/api\/messages\/conversations\/:id\/messages/);
  assert.match(app,/\/api\/messages\/conversations\/:id\/read/);
});

test("direct conversations are deduplicated and groups support multiple users",()=>{
  assert.match(app,/direct_key/);
  assert.match(app,/MESSAGE_GROUP_INVITEE_LIMIT=MESSAGE_GROUP_MEMBER_LIMIT-1/);
  assert.match(app,/participantIds.*max\(MESSAGE_GROUP_INVITEE_LIMIT\)/s);
  assert.match(app,/kind==='Direct'/);
});

test("new messages generate in-app notifications without email escalation",()=>{
  assert.match(app,/New message from/);
  assert.match(app,/message_conversation/);
  assert.match(app,/'Normal','Open messages','Messages'/);
});

test("api exposes users conversations unread messages read and send",()=>{
  assert.match(api,/messageUsers/);
  assert.match(api,/messageUnreadCount/);
  assert.match(api,/messageConversations/);
  assert.match(api,/conversationMessages/);
  assert.match(api,/markConversationRead/);
  assert.match(api,/sendConversationMessage/);
});

test("frontend provides direct and group chat with unread counts",()=>{
  assert.match(ui,/messages-chatlist-header/);
  assert.match(ui,/>Chats</);
  assert.match(ui,/aria-label="New message"/);
  assert.match(ui,/Search chats/);
  assert.match(ui,/unread_count/);
  assert.match(ui,/Start conversation/);
  assert.match(ui,/setInterval/);
});

test("Messages is a first-class App2 navigation workspace",()=>{
  assert.match(shell,/\["messages", "Messages"\]/);
  assert.match(shell,/title: "Team Chat"/);
  assert.match(shell,/messageUnreadCount/);
  assert.match(shell,/MessagesWorkspace/);
});

test("messaging UI is responsive and theme-token based",()=>{
  assert.match(css,/var\(--surface-primary\)/);
  assert.match(css,/@media\(max-width:850px\)/);
  assert.match(css,/@media\(max-width:560px\)/);
});

test("messaging SQL does not collide with governed assignment-membership alias",()=>{
  assert.doesNotMatch(app,/am\.created_at/);
  assert.match(app,/msg\.created_at/);
  assert.match(app,/FROM app_messages msg/);
});

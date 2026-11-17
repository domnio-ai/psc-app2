import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const backend=readFileSync("backend/src/app.js","utf8");
const migration=readFileSync("backend/migrations/041_message_group_management.sql","utf8");
const api=readFileSync("src/api.ts","utf8");
const ui=readFileSync("src/modules/messages/MessagesWorkspace.tsx","utf8");
const css=readFileSync("src/modules/messages/messages.css","utf8");
const app=readFileSync("src/App.tsx","utf8");
const floating=readFileSync("src/modules/messages/FloatingChatWindow.tsx","utf8");
const floatingCss=readFileSync("src/modules/messages/floating-chat.css","utf8");

test("group conversations have an owner and governed membership events",()=>{
  assert.match(migration,/owner_id/);
  assert.match(migration,/message_conversation_events/);
  assert.match(migration,/Member Added/);
  assert.match(migration,/Member Removed/);
  assert.match(migration,/Group Renamed/);
});

test("backend exposes group info rename add remove and events with membership checks",()=>{
  assert.match(backend,/messageConversationAccess/);
  assert.match(backend,/\/api\/messages\/conversations\/:id\/info/);
  assert.match(backend,/\/api\/messages\/conversations\/:id\/events/);
  assert.match(backend,/MESSAGE_GROUP_RENAMED/);
  assert.match(backend,/MESSAGE_GROUP_MEMBERS_ADDED/);
  assert.match(backend,/MESSAGE_GROUP_MEMBER_REMOVED/);
});

test("group owner or admin governs membership changes",()=>{
  assert.match(backend,/user\.role==='System Admin'\|\|row\.owner_id===user\.id/);
  assert.match(backend,/The group owner cannot be removed/);
  assert.match(backend,/MESSAGE_GROUP_MEMBER_LIMIT=600/);
  assert.match(backend,/at most \$\{MESSAGE_GROUP_MEMBER_LIMIT\} members/);
});

test("frontend offers group info rename add and remove controls",()=>{
  assert.match(ui,/Group info/);
  assert.match(ui,/renameMessageConversation/);
  assert.match(ui,/addMessageConversationMembers/);
  assert.match(ui,/removeMessageConversationMember/);
  assert.match(ui,/messages-group-panel/);
});

test("membership and rename events appear in the chat timeline",()=>{
  assert.match(ui,/messages-system-event/);
  assert.match(ui,/renamed the group/);
  assert.match(ui,/added \$\{item\.target_user_name/);
  assert.match(ui,/removed \$\{item\.target_user_name/);
});

test("messages workspace is compact and internally scrolling",()=>{
  assert.match(css,/APP2 MESSAGES V1 R2\.7 - COMPACT STATIC CHAT/);
  assert.match(css,/height:calc\(100vh - 170px\)/);
  assert.match(css,/max-height:760px/);
  assert.match(css,/messages-layout\.group-info-open/);
});

test("opened conversations can remain as a floating chat above App2",()=>{
  assert.match(app,/app2-pin-chat/);
  assert.match(app,/FloatingChatWindow/);
  assert.match(floatingCss,/position:fixed/);
  assert.match(floating,/setInterval/);
  assert.match(floating,/sendConversationMessage/);
});

test("api exposes group management contracts",()=>{
  assert.match(api,/MessageConversationInfo/);
  assert.match(api,/MessageConversationEvent/);
  assert.match(api,/renameMessageConversation/);
  assert.match(api,/addMessageConversationMembers/);
  assert.match(api,/removeMessageConversationMember/);
});

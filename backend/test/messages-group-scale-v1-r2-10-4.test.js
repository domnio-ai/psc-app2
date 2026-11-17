import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const backend=readFileSync("backend/src/app.js","utf8");
const ui=readFileSync("src/modules/messages/MessagesWorkspace.tsx","utf8");
const historical=readFileSync("backend/test/messages-group-management-compact-v1-r2-7.test.js","utf8");

test("backend group scale is governed at 600 total members",()=>{
  assert.ok(backend.includes("const MESSAGE_GROUP_MEMBER_LIMIT=600"));
  assert.ok(backend.includes("const MESSAGE_GROUP_INVITEE_LIMIT=MESSAGE_GROUP_MEMBER_LIMIT-1"));
  assert.ok(backend.includes(".max(MESSAGE_GROUP_INVITEE_LIMIT)"));
  assert.ok(backend.includes("additions.length>MESSAGE_GROUP_MEMBER_LIMIT"));
  assert.ok(backend.includes("at most ${MESSAGE_GROUP_MEMBER_LIMIT} members"));
});

test("frontend creation and member management honor the 600 member cap",()=>{
  assert.ok(ui.includes("const MESSAGE_GROUP_MEMBER_LIMIT=600;"));
  assert.ok(ui.includes("const MESSAGE_GROUP_INVITEE_LIMIT=MESSAGE_GROUP_MEMBER_LIMIT-1;"));
  assert.ok(ui.includes("{groupInfo.members.length}/{MESSAGE_GROUP_MEMBER_LIMIT}"));
  assert.ok(ui.includes("groupInfo.members.length<MESSAGE_GROUP_MEMBER_LIMIT"));
  assert.ok(ui.includes("MESSAGE_GROUP_MEMBER_LIMIT-groupInfo.members.length"));
  assert.ok(ui.includes("current.length>=MESSAGE_GROUP_INVITEE_LIMIT"));
});

test("historical group-governance regression is rebased from 20 to 600",()=>{
  assert.ok(!historical.includes("at most 20 members"));
  assert.ok(historical.includes("MESSAGE_GROUP_MEMBER_LIMIT=600"));
});

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const ui=readFileSync("src/modules/messages/MessagesWorkspace.tsx","utf8");
const backend=readFileSync("backend/src/app.js","utf8");

test("frontend allows multiple recipients without requiring a manual group name",()=>{
  assert.doesNotMatch(ui,/if\(selectedUsers\.length>1&&!groupTitle\.trim\(\)\)/);
  assert.match(ui,/title:selectedUsers\.length>1&&groupTitle\.trim\(\)\?groupTitle\.trim\(\):undefined/);
});

test("group name is optional and can be auto-generated",()=>{
  assert.match(ui,/Group name <small>\(optional\)<\/small>/);
  assert.match(ui,/Leave blank to use participant names/);
});

test("multiple recipients expose a group-specific start action",()=>{
  assert.match(ui,/Start group conversation/);
  assert.match(ui,/group conversation/);
});

test("backend supports auto-generated group title and multiple participants",()=>{
  assert.match(backend,/MESSAGE_GROUP_MEMBER_LIMIT=600/);
  assert.match(backend,/participantIds:z\.array\(z\.string\(\)\.uuid\(\)\)\.min\(1\)\.max\(MESSAGE_GROUP_INVITEE_LIMIT\)/);
  assert.match(backend,/req\.validated\.title\|\|available\.slice\(0,3\)\.map/);
  assert.match(backend,/participantIds\.length===1\?'Direct':'Group'/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync("backend/src/app.js","utf8");
const internal=readFileSync("backend/test/internal-messaging-v1.test.js","utf8");
const groups=readFileSync("backend/test/messages-group-conversations-v1-r2-5.test.js","utf8");

test("legacy messaging tests are aligned to the 600-member group contract",()=>{
  assert.match(app,/MESSAGE_GROUP_MEMBER_LIMIT=600/);
  assert.doesNotMatch(internal,/max\\\(19\\\)/);
  assert.doesNotMatch(groups,/max\\\(19\\\)/);
  assert.match(internal,/MESSAGE_GROUP_INVITEE_LIMIT/);
  assert.match(groups,/MESSAGE_GROUP_MEMBER_LIMIT=600/);
});

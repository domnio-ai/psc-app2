import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync("src/App.tsx","utf8");
const leave=readFileSync("src/modules/users/UserLeaveManagement.tsx","utf8");

test("leave workspace only requires authenticated user id from session User",()=>{
  assert.match(leave,/currentUser:\{id:string\}/);
  assert.doesNotMatch(leave,/currentUser:ApiUser/);
  assert.match(app,/currentUser=\{\{id:user\.id\}\}/);
  assert.match(app,/user\.id \? <UserLeaveManagement/);
});

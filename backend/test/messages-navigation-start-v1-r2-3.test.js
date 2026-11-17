import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const app=readFileSync("src/App.tsx","utf8");
const ui=readFileSync("src/modules/messages/MessagesWorkspace.tsx","utf8");
const css=readFileSync("src/modules/messages/messages.css","utf8");
const parity=readFileSync("backend/test/dashboard-sidebar-parity-v1.test.js","utf8");

test("Team Chat is visible in Collaboration",()=>assert.match(app,/label: "Collaboration"[\s\S]*items: \["Messages", "Meetings"\]/));
test("Messages remains dedicated",()=>{const shared=app.match(/const shared=\[([^\]]+)\]/)?.[1]||"";assert.doesNotMatch(shared,/'Messages'/);assert.match(app,/active === "Messages"/);assert.match(app,/MessagesWorkspace/)});
test("Start conversation stays visible",()=>{assert.match(ui,/messages-modal-body/);assert.match(ui,/messages-modal-footer/);assert.match(ui,/disabled=\{!selectedUsers\.length\}/);assert.match(css,/\.messages-modal-footer\{/);assert.match(css,/position:sticky/);assert.match(css,/bottom:0/)});
test("sidebar parity recognises dedicated Messages",()=>{assert.match(parity,/"Notifications", "Notice Board", "Calendar", "Reports & Analytics"/);assert.match(parity,/Team Chat is a dedicated collaboration workspace outside dashboard module parity/)});

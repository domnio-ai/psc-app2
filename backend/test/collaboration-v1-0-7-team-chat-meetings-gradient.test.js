import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const app = fs.readFileSync(path.join(root,"src","App.tsx"),"utf8");
const chat = fs.readFileSync(path.join(root,"src","modules","messages","MessagesWorkspace.tsx"),"utf8");
const chatCss = fs.readFileSync(path.join(root,"src","modules","messages","messages.css"),"utf8");
const meetCss = fs.readFileSync(path.join(root,"src","modules","meetings","meetings.css"),"utf8");

test("Team Chat is displayed under Collaboration without changing Messages routing",()=>{
  assert.match(app,/label: "Awareness"[\s\S]*items: \["Notifications", "Notice Board", "Calendar", "Reports & Analytics"\]/);
  assert.match(app,/label: "Collaboration"[\s\S]*items: \["Messages", "Meetings"\]/);
  assert.match(app,/label === "Messages" \? "Team Chat"/);
  assert.match(app,/active === "Messages"/);
  assert.match(app,/MessagesWorkspace/);
});

test("Team Chat keeps command-centre KPI and gradient surfaces",()=>{
  assert.match(chat,/team-chat-command-centre/);
  assert.match(chat,/Active chats/);
  assert.match(chat,/Unread/);
  assert.match(chat,/Online now/);
  assert.match(chatCss,/team-chat-kpis/);
  assert.match(chatCss,/linear-gradient/);
});

test("Meetings keeps strengthened Task Command Centre gradients",()=>{
  assert.match(meetCss,/stronger Task Command Centre gradient alignment/);
  assert.match(meetCss,/meetings-summary-cards\.meetings-command-cards>button:nth-child\(6\)/);
});

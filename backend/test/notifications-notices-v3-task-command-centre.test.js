import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const inbox=fs.readFileSync("src/NotificationCenter.tsx","utf8");
const notifCss=fs.readFileSync("src/notifications.css","utf8");
const notices=fs.readFileSync("src/NoticeBoardWorkspace.tsx","utf8");
const noticeCss=fs.readFileSync("src/notice-workspace.css","utf8");

test("Notifications V3 consolidates into Task Command Centre visual language",()=>{
  assert.match(notifCss,/APP2 NOTIFICATIONS V3 - TASK COMMAND CENTRE CONSOLIDATION/);
  assert.match(notifCss,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(notifCss,/var\(--app2-blue-gradient\)/);
  assert.match(notifCss,/var\(--app2-violet-gradient\)/);
  assert.match(notifCss,/var\(--app2-amber-gradient\)/);
  assert.match(inbox,/notification-v2-status-strip/);
  assert.match(inbox,/notification-reading-pane/);
});

test("Notifications preserve inbox state and workflow actions",()=>{
  for(const text of ["Assigned to me","Reviews & approvals","Notices","System","Mark all read","Archive read","Compose email"]){
    assert.match(inbox,new RegExp(text));
  }
  assert.match(inbox,/onStateChange/);
  assert.match(inbox,/openRelated/);
});

test("Notices V3 uses the same command-centre family",()=>{
  assert.match(noticeCss,/APP2 Notices V3 - Task Command Centre consolidation/);
  assert.match(noticeCss,/notice-overview/);
  assert.match(noticeCss,/notice-overview-stats/);
  assert.match(noticeCss,/var\(--app2-blue-gradient\)/);
  assert.match(noticeCss,/var\(--app2-amber-gradient\)/);
  assert.match(noticeCss,/var\(--app2-red-gradient\)/);
});

test("Notices preserve publishing management and discussion flows",()=>{
  assert.match(notices,/Published/);
  assert.match(notices,/Manage notices/);
  assert.match(notices,/View & comment/);
  assert.match(notices,/Post comment/);
  assert.match(notices,/onReview\(item\)/);
  assert.match(notices,/onDelete\(item\)/);
});

test("Both modules retain responsive and accessibility contracts",()=>{
  assert.match(notifCss,/@media\(max-width:900px\)/);
  assert.match(notifCss,/@media\(max-width:620px\)/);
  assert.match(notifCss,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(noticeCss,/@media\(max-width:700px\)/);
  assert.match(noticeCss,/@media\(prefers-reduced-motion:reduce\)/);
});

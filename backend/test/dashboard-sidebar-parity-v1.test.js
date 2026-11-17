import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync("src/App.tsx","utf8");
const dashboard=fs.readFileSync("src/modules/dashboard/ProgressiveDashboard.tsx","utf8");
const notifications=fs.readFileSync("src/notifications.css","utf8");

test("sidebar omits Needs My Attention while retaining the remaining module groups",()=>{
  assert.match(app,/label: "Immediate Work"[\s\S]*items: \["Assignments", "Tasks", "Research Repository", "Reviews & Approvals"\]/);
  assert.doesNotMatch(app,/\["warning", "Needs My Attention"\]/);
  assert.match(app,/label: "Awareness"[\s\S]*"Notifications", "Notice Board", "Calendar", "Reports & Analytics"/);
  assert.match(app,/label: "Tools & Knowledge"[\s\S]*"Document Repository", "Team & Users", "AI Researcher", "Felix Administration", "Audit Logs", "Settings"/);
});

test("main dashboard exposes every dashboard-backed grouped sidebar module including Felix Administration",()=>{
  for(const label of ["Needs My Attention","Assignments","Tasks","Research Repository","Reviews & Approvals","Notifications","Notice Board","Calendar","Reports & Analytics","Document Repository","Team & Users","AI Researcher","Felix Administration","Audit Logs","Settings"]){
    assert.ok(dashboard.includes(`'${label}'`)||dashboard.includes(`"${label}"`),label);
  }
});

test("Team Chat is a dedicated collaboration workspace outside dashboard module parity",()=>{
  assert.match(app,/\["messages", "Messages"\]/);
  assert.match(app,/label: "Collaboration"[\s\S]*"Messages", "Meetings"/);
  assert.match(app,/MessagesWorkspace/);
  assert.match(app,/active === "Messages"/);
});

test("sidebar numeric population uses the same authoritative card-count contract as dashboard",()=>{
  assert.match(app,/pulse\.data\?\.cardCounts\?\.\[label\]/);
  assert.match(dashboard,/m==='Needs My Attention'\?data\.attention\.length/);
  assert.match(app,/label === "Notifications"[\s\S]*pulse\.data\?\.unread\.length/);
  assert.match(app,/label === "Calendar"[\s\S]*pulse\.data\?\.calendar\.length/);
  assert.match(app,/pulse\.data\?\.modules\[label\]\?\.counts\?\.All/);
  assert.match(dashboard,/data\.cardCounts\?\.\[m\]/);
});

test("unread activity highlights remain separate from population totals",()=>{
  assert.match(app,/const navigationBadge =\s*Number\(pulse\.data\?\.badges\[label\] \|\| 0\)/);
  assert.match(app,/const navigationUnread =[\s\S]*label === "Notifications"[\s\S]*pulse\.data\?\.unread\.length[\s\S]*navigationBadge/);
  assert.match(app,/navigationHighlighted[\s\S]*navigationUnread > 0/);
  assert.match(app,/navigationCount[\s\S]*pulse-nav-badge/);
});

test("Notifications use the same full-width workspace layout across roles",()=>{
  assert.match(app,/active === "Notifications" \? "notifications-active"/);
  assert.match(notifications,/\.notifications-active>\.notification-management-view\{width:100%;max-width:none;min-width:0;box-sizing:border-box\}/);
  assert.match(notifications,/\.notification-management-view>\.notification-mailbox\{width:100%;max-width:none;min-width:0;box-sizing:border-box\}/);
  assert.match(notifications,/\.notification-mailbox-grid\{width:100%;max-width:none;box-sizing:border-box\}/);
});

test("Research label remains Research Workspace in the user interface",()=>{
  assert.match(app,/label === "Research Repository" \? "Research Workspace" : label/);
  assert.match(dashboard,/m==='Research Repository'\?'Research Workspace':m/);
});

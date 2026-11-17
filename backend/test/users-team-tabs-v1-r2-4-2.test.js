import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync('src/App.tsx','utf8');
const leave=fs.readFileSync('src/modules/users/UserLeaveManagement.tsx','utf8');
const css=fs.readFileSync('src/users.css','utf8');

test('Team & Users exposes the six governed workspace tabs',()=>{
  for(const label of ['Users','Teams','Leave','Approvals','Calendar','Administration']){
    assert.match(app,new RegExp(`\\["${label}", "${label}"`));
  }
  assert.match(app,/isManager \? \[\["Approvals", "Approvals", null\] as const\] : \[\]/);
  assert.match(app,/canAdministerUsers \? \[\["Administration", "Administration", null\] as const\] : \[\]/);
});

test('Leave and approvals are controlled by the parent workspace without nested tabs',()=>{
  assert.match(app,/mode=\{userWorkspaceTab === "Approvals" \? "approvals" : "leave"\}/);
  assert.match(leave,/mode\?:"leave"\|"approvals"/);
  assert.doesNotMatch(leave,/setTab\(/);
  assert.doesNotMatch(leave,/<nav>/);
});

test('Calendar tab summarizes current approved absences and links to full Calendar',()=>{
  assert.match(app,/userWorkspaceTab === "Calendar"/);
  assert.match(app,/availability_status === "On Leave"/);
  assert.match(app,/setActive\("Calendar"\)/);
});

test('Tabbed workspace styling remains theme-token based and responsive',()=>{
  assert.match(css,/\.user-workspace-tabs/);
  assert.match(css,/var\(--surface-secondary\)/);
  assert.match(css,/var\(--border-default\)/);
  assert.match(css,/@media\(max-width:820px\)/);
});


test("Team Approvals terminology remains compatible with established leave workflow",()=>{assert.match(leave,/Team Approvals/)});

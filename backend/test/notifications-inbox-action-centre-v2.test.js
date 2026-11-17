import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const inbox=fs.readFileSync('src/NotificationCenter.tsx','utf8');
const css=fs.readFileSync('src/notifications.css','utf8');

test('notification v2 provides inbox action centre primary folders',()=>{
  for(const label of ['Assigned to me','Reviews & approvals','Notices','System']) assert.match(inbox,new RegExp(label.replace(/[&]/g,'\\&')));
  assert.match(inbox,/primaryFolders/);
  assert.match(inbox,/secondaryFolders/);
});

test('primary folders are driven by authoritative notification category and entity type',()=>{
  assert.match(inbox,/const isAssignedNotification/);
  assert.match(inbox,/categoryOf\(item\) !== "Action"/);
  assert.match(inbox,/const isApprovalNotification/);
  assert.match(inbox,/categoryOf\(item\) === "Review"/);
  assert.match(inbox,/const isNoticeNotification/);
  assert.match(inbox,/item\.entity_type === "notice"/);
  assert.match(inbox,/const isSystemNotification/);
});

test('inbox preserves existing workflow folders and direct action navigation',()=>{
  for(const name of ['"Inbox"','"Unread"','"Action"','"Reviews"','"Reminders"','"Important"','"Email"','"Sent"','"Archived"']) assert.match(inbox,new RegExp(name));
  assert.match(inbox,/openRelated/);
  assert.match(inbox,/actionLabel/);
  assert.match(inbox,/onMarkAll/);
  assert.match(inbox,/onArchiveRead/);
});

test('rows expose workflow context and unread emphasis without weakening state controls',()=>{
  assert.match(inbox,/workflowLabel\(item\)/);
  assert.match(inbox,/workflowLabel\(selected\)/);
  assert.match(inbox,/Mark unread/);
  assert.match(inbox,/Mark read/);
  assert.match(inbox,/Mark important/);
  assert.match(inbox,/Archive/);
});

test('notification v2 is compact responsive and gradient polished',()=>{
  assert.match(css,/APP2 NOTIFICATIONS V2 - INBOX & ACTION CENTRE/);
  assert.match(css,/notification-v2-status-strip/);
  assert.match(css,/linear-gradient/);
  assert.match(css,/notification-folder-group/);
  assert.match(css,/@media\(max-width:900px\)/);
  assert.match(css,/@media\(max-width:620px\)/);
});

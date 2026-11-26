import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const inbox=fs.readFileSync("src/NotificationCenter.tsx","utf8");
const notifCss=fs.readFileSync("src/notifications.css","utf8");
const notices=fs.readFileSync("src/NoticeBoardWorkspace.tsx","utf8");
const noticeCss=fs.readFileSync("src/notice-workspace.css","utf8");
const noticeComposer=fs.readFileSync("src/NoticeComposer.tsx","utf8");
const backendApp=fs.readFileSync("backend/src/app.js","utf8");
const calendarService=fs.readFileSync("backend/src/calendar-service.js","utf8");
const noticeMigration=fs.readFileSync("backend/migrations/20261125_02_notice_audience_acknowledgements.sql","utf8");

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


test("opening a notice marks its linked recipient notifications as read",()=>{
  const app=fs.readFileSync("src/App.tsx","utf8");
  assert.match(app,/const markNoticeNotificationsRead = async \(noticeId: string\)/);
  assert.match(app,/item\.entity_type === "notice" && item\.entity_id === noticeId/);
  assert.match(app,/matches\.map\(\(item\) => api\.readNotification\(token, item\.id\)\)/);
  assert.match(app,/onRead=\{markNoticeNotificationsRead\}/);
  assert.match(notices,/void onRead\?\.\(item\.id\)/);
});

test("notice audiences are stored as immutable recipient records and scoped on reads",()=>{
  for(const value of ["ORGANISATION","ROLE","DIRECTORATE","USER"])assert.match(backendApp,new RegExp(value));
  assert.match(backendApp,/INSERT INTO alert_audience_rules/);
  assert.match(backendApp,/INSERT INTO alert_recipients/);
  assert.match(backendApp,/jsonb_to_recordset/);
  assert.match(backendApp,/recipient\.user_id IS NOT NULL/);
  assert.match(backendApp,/Only organisation-scope management can target a directorate or individual accounts/);
  assert.match(backendApp,/SELECT 1 FROM alert_recipients ar WHERE ar\.alert_id=a\.id AND ar\.user_id=\$2/);
  assert.match(calendarService,/LEFT JOIN alert_recipients recipient/);
  assert.match(noticeMigration,/CREATE TABLE IF NOT EXISTS alert_audience_rules/);
  assert.match(noticeMigration,/CREATE TABLE IF NOT EXISTS alert_recipients/);
});

test("formal notice acknowledgement is explicit, recipient-only and idempotent",()=>{
  assert.match(backendApp,/app\.post\('\/api\/alerts\/:id\/acknowledge'/);
  assert.match(backendApp,/acknowledgement_required/);
  assert.match(backendApp,/SELECT acknowledged_at FROM alert_recipients WHERE alert_id=\$1 AND user_id=\$2 FOR UPDATE/);
  assert.match(backendApp,/UPDATE alert_recipients SET acknowledged_at=NOW\(\)/);
  assert.match(backendApp,/NOTICE_ACKNOWLEDGED/);
  assert.match(backendApp,/notice-published:/);
  assert.match(backendApp,/ON CONFLICT\(user_id,event_key\)/);
  assert.match(noticeMigration,/acknowledged_at TIMESTAMPTZ/);
  assert.match(noticeMigration,/PRIMARY KEY\(alert_id,user_id\)/);
});

test("notice composer and detail distinguish recipient targeting, reads and acknowledgements",()=>{
  for(const value of ["ORGANISATION","ROLE","DIRECTORATE","USER"])assert.match(noticeComposer,new RegExp(value));
  assert.match(noticeComposer,/acknowledgementRequired/);
  assert.match(noticeComposer,/Opening it or marking its notification as read does not count/);
  assert.match(notices,/api\.acknowledgeNotice/);
  assert.match(notices,/Formal acknowledgement required/);
  assert.match(notices,/Acknowledged /);
  assert.match(notices,/onRead/);
});

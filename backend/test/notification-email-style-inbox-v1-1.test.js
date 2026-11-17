import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const inbox=fs.readFileSync("src/NotificationCenter.tsx","utf8");
const css=fs.readFileSync("src/notifications.css","utf8");

test("notifications render as a mailbox with folders list and reading pane",()=>{
  assert.match(inbox,/notification-mailbox-grid/);
  assert.match(inbox,/notification-folder-rail/);
  assert.match(inbox,/notification-message-column/);
  assert.match(inbox,/notification-reading-pane/);
});

test("mailbox folders include workflow action review reminder email and archive views",()=>{
  for(const name of ["Inbox","Unread","Action","Reviews","Reminders","Important","Email","Archived"]){
    assert.match(inbox,new RegExp(`"${name}"`));
  }
});

test("search and priority filtering are first-class inbox controls",()=>{
  assert.match(inbox,/Search title, message or workflow/);
  assert.match(inbox,/PriorityFilter/);
  assert.match(inbox,/Critical/);
  assert.match(inbox,/Informational/);
});

test("mailbox preserves read important archive and direct workflow actions",()=>{
  assert.match(inbox,/Mark unread/);
  assert.match(inbox,/Mark read/);
  assert.match(inbox,/Mark important/);
  assert.match(inbox,/Archive/);
  assert.match(inbox,/openRelated/);
  assert.match(inbox,/actionLabel/);
  assert.match(inbox,/notification-reading-actions/);
});

test("reading pane shows priority reminder and email delivery state",()=>{
  assert.match(inbox,/emailStateLabel/);
  assert.match(inbox,/Email sent/);
  assert.match(inbox,/Email retry scheduled/);
  assert.match(inbox,/selected\.reminder_kind/);
  assert.match(inbox,/selected\.email_sent_at/);
});

test("layout is compact responsive accessible and theme aware",()=>{
  assert.match(css,/APP2 NOTIFICATIONS EMAIL-STYLE INBOX V1\.1/);
  assert.match(css,/grid-template-columns:170px minmax\(340px,.9fr\) minmax\(330px,1.1fr\)/);
  assert.match(css,/@media\(max-width:900px\)/);
  assert.match(css,/@media\(max-width:620px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/@media\(forced-colors:active\)/);
  assert.match(css,/:focus-visible/);
});

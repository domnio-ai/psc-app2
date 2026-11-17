import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const schema=readFileSync(new URL('../src/schema.sql',import.meta.url),'utf8')
const service=readFileSync(new URL('../src/notification-email-service.js',import.meta.url),'utf8')
const migration=readFileSync(new URL('../migrations/037_notification_priority_email_reminders.sql',import.meta.url),'utf8')
const api=readFileSync(new URL('../../src/api.ts',import.meta.url),'utf8')
const inbox=readFileSync(new URL('../../src/NotificationCenter.tsx',import.meta.url),'utf8')
const appUi=readFileSync(new URL('../../src/App.tsx',import.meta.url),'utf8')

test('priority model adds Critical without removing existing priorities',()=>{
  assert.match(schema,/Critical','High','Normal','Informational/)
  assert.match(migration,/Critical','High','Normal','Informational/)
  assert.match(api,/"Critical" \| "High" \| "Normal" \| "Informational"/)
})

test('notification inserts are centrally classified for important email',()=>{
  assert.match(migration,/CREATE OR REPLACE FUNCTION app2_classify_notification/)
  assert.match(migration,/BEFORE INSERT ON notifications/)
  assert.match(migration,/email_eligible := TRUE/)
  assert.match(migration,/email_status := 'Pending'/)
})

test('important email queue is reliable and preference-aware',()=>{
  assert.match(service,/deliverPendingNotificationEmails/)
  assert.match(service,/email_attempts<3/)
  assert.match(service,/INTERVAL '15 minutes'/)
  assert.match(service,/important_email_notifications/)
  assert.match(service,/deadline_reminders/)
  assert.match(service,/System email delivery disabled/)
})

test('deadline reminders cover assignments tasks and research without duplicates',()=>{
  assert.match(service,/email-reminder:assignment:/)
  assert.match(service,/email-reminder:task:/)
  assert.match(service,/email-reminder:research:/)
  assert.match(service,/ON CONFLICT\(user_id,event_key\).*DO NOTHING/s)
})

test('mail delivery runs asynchronously after workflow requests',()=>{
  assert.match(app,/scheduleNotificationMaintenance/)
  assert.match(app,/res\.on\('finish'/)
  assert.match(app,/void deliverPendingNotificationEmails\(\)\.catch/)
})

test('settings expose important email and deadline reminder controls',()=>{
  assert.match(app,/importantEmailNotifications/)
  assert.match(app,/deadlineReminders/)
  assert.match(api,/importantEmailNotifications/)
  assert.match(api,/deadlineReminders/)
  assert.match(appUi,/Immediate important emails/)
  assert.match(appUi,/Deadline reminder emails/)
})

test('inbox exposes priority and email delivery state',()=>{
  assert.match(inbox,/Critical/)
  assert.match(inbox,/High/)
  assert.match(inbox,/emailStateLabel/)
  assert.match(inbox,/email_status/)
  assert.match(inbox,/notification-reading-pane/)
})

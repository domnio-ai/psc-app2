import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const migration=readFileSync('backend/migrations/038_notification_smart_accuracy_population.sql','utf8')
const inbox=readFileSync('src/NotificationCenter.tsx','utf8')
const pulse=readFileSync('backend/src/pulse-model.js','utf8')
const api=readFileSync('src/api.ts','utf8')
const css=readFileSync('src/notifications.css','utf8')

test('notification category is an authoritative persisted taxonomy',()=>{
  assert.match(migration,/notification_category VARCHAR\(24\)/)
  assert.match(migration,/Action','Review','Reminder','Information/)
  assert.match(migration,/app2_notification_category/)
  assert.match(api,/notification_category\?: "Action" \| "Review" \| "Reminder" \| "Information"/)
})

test('historical approval notice is information not review',()=>{
  assert.match(migration,/Previously approved notice[\s\S]*Informational/)
  assert.match(migration,/ELSE 'Information'/)
})

test('final research publication is an action and high priority',()=>{
  assert.match(migration,/Research final report ready to publish/)
  assert.match(migration,/category IN\('Action','Review','Reminder'\)/)
})

test('inbox folders use authoritative category rather than broad review text inference',()=>{
  assert.match(inbox,/const categoryOf/)
  assert.match(inbox,/categoryOf\(item\) === "Review"/)
  assert.match(inbox,/categoryOf\(item\) === "Reminder"/)
  assert.doesNotMatch(inbox,/\/review\|approve\|approval\|changes requested/)
})

test('action folder contains only action review and reminder categories',()=>{
  assert.match(inbox,/categoryOf\(item\) === "Action"/)
  assert.match(inbox,/categoryOf\(item\) === "Review"/)
  assert.match(inbox,/categoryOf\(item\) === "Reminder"/)
})

test('review dashboard badge uses category not title regex',()=>{
  assert.match(pulse,/n\.notification_category==='Review'/)
  assert.doesNotMatch(pulse,/\/review\|approval\|decision\/i/)
})

test('visual polish removes permanent per-row action stack and enriches reading pane',()=>{
  assert.doesNotMatch(inbox,/notification-message-actions/)
  assert.match(inbox,/Why you are seeing this/)
  assert.match(css,/SMART ACCURACY \+ VISUAL POLISH/)
})

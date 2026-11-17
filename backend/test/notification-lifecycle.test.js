import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const lifecycle=readFileSync(new URL('../src/notifications/notification-lifecycle.js',import.meta.url),'utf8')
const pulse=readFileSync(new URL('../src/pulse-service.js',import.meta.url),'utf8')
const schema=readFileSync(new URL('../src/schema.sql',import.meta.url),'utf8')
const migration=readFileSync(new URL('../migrations/043_notification_lifecycle.sql',import.meta.url),'utf8')

test('completion closes linked non-review notification cards and preserves them in archive history',()=>{
  for(const type of ['assignment_status','assignment_due','assignment_overdue','assignment_task','research','meeting'])assert.match(lifecycle,new RegExp(`entity_type[^\\n]*${type}`))
  assert.ok(lifecycle.includes("COALESCE(n.notification_category,'')<>'Review'"))
  assert.match(lifecycle,/k\.document_type='Research Final Report' AND k\.status='Published'/)
  assert.match(lifecycle,/k\.document_type='Assignment Final Report' AND k\.status='Published'/)
  assert.match(lifecycle,/k\.document_type='Task Final Report' AND k\.status='Published'/)
  assert.match(lifecycle,/n\.entity_type IN\('knowledge','document'\)/)
  assert.match(lifecycle,/archived_at=COALESCE\(n\.archived_at,NOW\(\)\)/)
  assert.match(lifecycle,/closed_at=COALESCE\(n\.closed_at,NOW\(\)\)/)
  assert.match(lifecycle,/close_reason='Work completed'/)
})

test('inbox returns distinct notification cards without collapsing separate events',()=>{
  assert.match(pulse,/closeCompletedWorkNotifications\(run,user\.id\)/)
  assert.match(pulse,/SELECT n\.\* FROM notifications n WHERE n\.user_id=\$1/)
  assert.doesNotMatch(pulse,/SELECT DISTINCT ON\(/)
})

test('notification lifecycle fields are installed by both fresh schema and additive migration',()=>{
  for(const field of ['closed_at','close_reason']){
    assert.match(schema,new RegExp(`notifications ADD COLUMN IF NOT EXISTS ${field}`))
    assert.match(migration,new RegExp(`notifications ADD COLUMN IF NOT EXISTS ${field}`))
  }
})

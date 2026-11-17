import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const schema=readFileSync(new URL('../src/schema.sql',import.meta.url),'utf8')
const migration=readFileSync(new URL('../migrations/029_notification_inbox_state.sql',import.meta.url),'utf8')
const api=readFileSync(new URL('../../src/api.ts',import.meta.url),'utf8')
const inbox=readFileSync(new URL('../../src/NotificationCenter.tsx',import.meta.url),'utf8')

test('notification inbox state is persistent and backward compatible',()=>{
  for(const column of ['archived_at','important_at','priority','action','target_workspace','target_tab','event_key']){
    assert.match(schema,new RegExp(`notifications ADD COLUMN IF NOT EXISTS ${column}`))
    assert.match(migration,new RegExp(`notifications ADD COLUMN IF NOT EXISTS ${column}`))
  }
  assert.match(migration,/notifications_event_key_idx/)
  assert.match(migration,/WHERE event_key IS NOT NULL/)
})

test('notification state routes remain user scoped',()=>{
  assert.match(app,/\/api\/notifications\/:id\/state/)
  assert.match(app,/WHERE id=\$4 AND user_id=\$5 RETURNING/)
  assert.match(app,/\/api\/notifications\/archive-read/)
  assert.match(app,/WHERE user_id=\$1 AND read_at IS NOT NULL/)
})

test('notification inbox exposes familiar persisted actions',()=>{
  assert.match(api,/updateNotificationState/)
  assert.match(api,/archiveReadNotifications/)
  for(const label of ['Inbox','Unread','Important','Archived','Mark unread','Mark important','Archive','Restore']){
    assert.match(inbox,new RegExp(`"${label}"`))
  }
})

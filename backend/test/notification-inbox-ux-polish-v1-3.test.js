import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const inbox=readFileSync('src/NotificationCenter.tsx','utf8')
const css=readFileSync('src/notifications.css','utf8')

test('mailbox header reflects active folder and summary shortcuts are present',()=>{
  assert.match(inbox,/<h2>\{folder\}<\/h2>/)
  assert.match(inbox,/notification-status-strip/)
  assert.match(inbox,/Need action/)
  assert.match(inbox,/Reviews/)
  assert.match(inbox,/Reminders/)
  assert.match(inbox,/Unread/)
})

test('message rows use compact hover or focus quick actions',()=>{
  assert.match(inbox,/notification-row-quick-actions/)
  assert.match(inbox,/Unstar/)
  assert.match(inbox,/Archive/)
  assert.match(css,/article:hover \.notification-row-quick-actions/)
  assert.match(css,/article:focus-within \.notification-row-quick-actions/)
})

test('reading pane exposes clear category priority and read state summary',()=>{
  assert.match(inbox,/notification-reading-summary/)
  assert.match(inbox,/Category/)
  assert.match(inbox,/Priority/)
  assert.match(inbox,/State/)
})

test('empty states explain action review and reminder queues',()=>{
  assert.match(inbox,/no notifications that currently require action/)
  assert.match(inbox,/no review or approval notifications/)
  assert.match(inbox,/no active reminder notifications/)
})

test('desktop panes are bounded and sticky while mobile remains responsive',()=>{
  assert.match(css,/max-height:calc\(100vh - 250px\)/)
  assert.match(css,/position:sticky/)
  assert.match(css,/@media\(max-width:900px\)/)
  assert.match(css,/@media\(max-width:620px\)/)
})

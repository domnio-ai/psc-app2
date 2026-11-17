import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app=fs.readFileSync('src/App.tsx','utf8')
const css=fs.readFileSync('src/documents.css','utf8')

test('record rows no longer repeat draft type version and active chips',()=>{
  assert.doesNotMatch(app,/repository-private-draft-facts/)
  assert.match(app,/repository-row-meta/)
  assert.match(app,/repository-draft-signals-compact/)
})

test('archived secondary actions are not permanently visible',()=>{
  assert.doesNotMatch(app,/className="approve repository-archived-final-primary"/)
  assert.doesNotMatch(app,/className="repository-archived-history-action"/)
  assert.match(app,/Open final record/)
  assert.match(app,/Draft version history/)
  assert.match(app,/repository-more-actions/)
})

test('private draft source navigation moves into More',()=>{
  assert.doesNotMatch(app,/className="repository-private-draft-source"/)
  assert.match(app,/privateDraftSourceLabel\(item\)/)
})

test('calm row styling reduces permanent visual density',()=>{
  assert.match(css,/APP2 REPOSITORY CALM ROWS V1\.4/)
  assert.match(css,/min-height:60px/)
  assert.match(css,/repository-final-record-indicator/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app=fs.readFileSync('src/App.tsx','utf8')
const css=fs.readFileSync('src/documents.css','utf8')

test('add record wizard exposes a named close button in the sticky header',()=>{
  assert.match(app,/repository-add-record-close/)
  assert.match(app,/Close add record window/)
  assert.match(app,/>\s*Close\s*<\/button>/)
})

test('close control remains visible while wizard content scrolls',()=>{
  assert.match(css,/repository-add-record-heading\{\s*position:sticky/s)
  assert.match(css,/repository-add-record-heading-actions/)
  assert.match(css,/repository-add-record-close/)
})

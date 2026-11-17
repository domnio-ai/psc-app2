import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app=fs.readFileSync('src/App.tsx','utf8')
const css=fs.readFileSync('src/documents.css','utf8')

test('Felix gets Repository-specific clearance wrapper',()=>{
  assert.match(app,/repository-felix-clearance/)
  assert.match(app,/active === "Document Repository" \|\| active === "Documents"/)
  assert.match(app,/<FelixAssistant/)
})

test('Repository Felix launcher is lifted away from bottom paging controls',()=>{
  assert.match(css,/repository-felix-clearance \.felix-launcher\{/)
  assert.match(css,/bottom:104px !important/)
  assert.match(css,/width:54px !important/)
})

test('Repository paging stays above floating assistant controls',()=>{
  assert.match(css,/documents-active \.repository-pagination/)
  assert.match(css,/z-index:60/)
  assert.match(css,/documents-active \.repository-pagination-top\{\s*position:sticky/s)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app=fs.readFileSync('src/App.tsx','utf8')
const css=fs.readFileSync('src/documents.css','utf8')

test('repository exposes next and previous controls above the record list',()=>{
  const topPager=app.indexOf('repository-pagination repository-pagination-top')
  const table=app.indexOf('document-table repository-table')
  assert.ok(topPager>=0)
  assert.ok(table>topPager)
  assert.match(app,/Next →/)
  assert.match(app,/← Previous/)
  assert.match(app,/Page \{repositorySafePage\} \/ \{repositoryTotalPages\}/)
})

test('top pager shows the visible record range',()=>{
  assert.match(app,/repositorySafePage - 1/)
  assert.match(app,/repositoryPageSize/)
  assert.match(app,/filteredDocuments\.length/)
})

test('top pager remains visible during desktop scrolling',()=>{
  assert.match(css,/repository-pagination-top\{\s*position:sticky/s)
  assert.match(css,/repository-pagination-controls/)
})

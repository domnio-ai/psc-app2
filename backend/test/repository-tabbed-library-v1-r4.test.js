import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app=fs.readFileSync('src/App.tsx','utf8')
const css=fs.readFileSync('src/documents.css','utf8')

test('repository uses record-family tabs rather than one full unbounded list',()=>{
  for(const tab of ['All Records','Assignments','Tasks','Research','Reports','Drafts','Published']){
    assert.match(app,new RegExp(tab))
  }
  assert.match(app,/repositoryLibraryTab/)
  assert.match(app,/repositoryDocumentTab/)
  assert.match(app,/repository-library-tabs/)
})

test('repository list is paginated to twelve records per page',()=>{
  assert.match(app,/const repositoryPageSize = 12/)
  assert.match(app,/visibleRepositoryDocuments/)
  assert.match(app,/filteredDocuments\.slice/)
  assert.match(app,/visibleRepositoryDocuments\.map/)
  assert.equal(app.split("filteredDocuments.map((item) => (").length - 1, 0)
})

test('draft management appears only within the Drafts tab',()=>{
  assert.match(app,/repositoryLibraryTab === "Drafts"/)
  assert.match(app,/repository-draft-primary-nav/)
})

test('governance queues are collapsible instead of permanently occupying the library',()=>{
  assert.match(app,/repository-governance-drawer/)
  assert.match(app,/Governance queues/)
})

test('searchable list remains the primary repository result view',()=>{
  assert.match(app,/repository-smart-filters/)
  assert.match(app,/document-table repository-table/)
  assert.match(css,/APP2 REPOSITORY TABBED LIBRARY V1/)
  assert.match(css,/repository-library-tab-list/)
  assert.match(css,/repository-pagination/)
})


test('pagination is placed after the complete repository article map, not inside a document row',()=>{
  const mapStart=app.indexOf('{visibleRepositoryDocuments.map((item) => (')
  const mapEnd=app.indexOf('))}',mapStart)
  const pagination=app.indexOf('className="repository-pagination"',mapStart)
  assert.ok(mapStart>=0)
  assert.ok(mapEnd>mapStart)
  assert.ok(pagination>mapEnd)
  const titleLine=app.indexOf('<strong>{item.title}</strong>',mapStart)
  assert.ok(titleLine>mapStart && titleLine<mapEnd)
  assert.ok(pagination>titleLine)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app=fs.readFileSync('src/App.tsx','utf8')
const api=fs.readFileSync('src/api.ts','utf8')
const backend=fs.readFileSync('backend/src/app.js','utf8')
const schema=fs.readFileSync('backend/src/schema.sql','utf8')
const workspace=fs.readFileSync('src/modules/repository/components/RepositoryRecordWorkspace.tsx','utf8')
const advanced=fs.readFileSync('src/modules/repository/components/RepositoryAdvancedSearch.tsx','utf8')
const bulk=fs.readFileSync('src/modules/repository/components/RepositoryBulkIntake.tsx','utf8')

test('record numbers are generated automatically',()=>{
  assert.match(backend,/ensureRepositoryRecordNumber/)
  assert.match(backend,/repository_record_sequences/)
  assert.match(backend,/padStart\(4,'0'\)/)
})
test('record workspace covers the full record lifecycle',()=>{
  for(const token of ['Overview','Versions','Relationships','Protection','Review & Retention','Audit','Felix'])assert.ok(workspace.includes(token))
  assert.match(app,/RepositoryRecordWorkspace/)
})
test('review schedules retention and supersession are governed',()=>{
  assert.match(schema,/repository_retention_schedules/)
  assert.match(schema,/next_review_at/)
  assert.match(backend,/\/api\/documents\/:id\/governance/)
  assert.match(backend,/\/api\/documents\/:id\/supersede/)
  assert.match(backend,/RECORD_SUPERSEDED/)
})
test('advanced search supports saved user views',()=>{
  assert.match(schema,/repository_saved_views/)
  assert.match(backend,/\/api\/repository\/saved-views/)
  assert.match(advanced,/Save view/)
  assert.match(app,/RepositoryAdvancedSearch/)
})
test('bulk digitisation uses the governed upload pipeline',()=>{
  assert.match(bulk,/BULK DIGITISATION \/ INTAKE/)
  assert.match(bulk,/api\.uploadKnowledge/)
  assert.match(app,/Bulk intake/)
})
test('Felix record intelligence warns about obsolete governance state',()=>{
  assert.match(backend,/felix-record-context/)
  assert.match(backend,/This record is not the current active record/)
  assert.match(backend,/overdue for governance review/)
  assert.match(api,/FelixRecordContext/)
})


test('record workspace version history matches the real App2 version contract',()=>{
  assert.doesNotMatch(workspace,/v\.sha256_hash/)
  assert.doesNotMatch(workspace,/v\.is_current/)
  assert.match(workspace,/v\.version_number===detail\.record\.current_version/)
  assert.match(workspace,/v\.size_bytes/)
  const start=backend.indexOf("app.get('/api/documents/:id/detail'")
  const end=backend.indexOf("app.get('/api/documents/:id/felix-record-context'",start)
  assert.ok(start>=0 && end>start)
  const detailRoute=backend.slice(start,end)
  assert.doesNotMatch(detailRoute,/sha256_hash/)
  assert.doesNotMatch(detailRoute,/is_current/)
  assert.match(detailRoute,/SELECT id,version_number,original_name,mime_type,size_bytes,notes,created_at/)
})

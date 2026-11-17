import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app=fs.readFileSync('backend/src/app.js','utf8')
const schema=fs.readFileSync('backend/src/schema.sql','utf8')
const migration=fs.readFileSync('backend/migrations/033_records_management_foundation.sql','utf8')
const api=fs.readFileSync('src/api.ts','utf8')
const ui=fs.readFileSync('src/App.tsx','utf8')
const command=fs.readFileSync('src/modules/repository/components/RepositoryRecordsCommandCentre.tsx','utf8')
const header=fs.readFileSync('src/modules/repository/components/RepositoryHeaderPanel.tsx','utf8')

test('records foundation stores lifecycle review hold disposition and improvement assignments',()=>{
  for(const token of ['record_number','record_class','records_lifecycle_state','review_due_at','legal_hold','disposition_action','document_improvement_assignments']){
    assert.match(migration,new RegExp(token))
    assert.match(schema,new RegExp(token))
  }
})

test('improvement workflow is manager governed and version gated',()=>{
  assert.match(app,/\/api\/documents\/:id\/improvements/)
  assert.match(app,/\/api\/document-improvements\/:id\/status/)
  assert.match(app,/Only an authorised manager can assign a document improvement/)
  assert.match(app,/Upload a new document version before submitting the improvement/)
  assert.match(app,/DOCUMENT_IMPROVEMENT_ASSIGNED/)
})

test('records metadata and declaration are governed backend actions',()=>{
  assert.match(app,/\/api\/documents\/:id\/records-metadata/)
  assert.match(app,/\/api\/documents\/:id\/declare-record/)
  assert.match(app,/Only an approved Published document can be declared as an official record/)
})

test('frontend exposes records command centre and keeps searchable list view',()=>{
  assert.match(ui,/RepositoryRecordsCommandCentre/)
  assert.match(ui,/Improve \/ update/)
  assert.match(ui,/repository-table/)
  assert.match(header,/Search title, record number, class, owner, source or description/)
  assert.match(command,/LIFECYCLE ATTENTION/)
  assert.match(command,/Records needing action/)
  assert.doesNotMatch(command,/<small>RECORDS<\/small>/)
  assert.doesNotMatch(command,/<small>OFFICIAL<\/small>/)
})

test('api provides typed improvement and records-management actions',()=>{
  assert.match(api,/DocumentImprovementAssignment/)
  assert.match(api,/documentImprovements/)
  assert.match(api,/createDocumentImprovement/)
  assert.match(api,/updateDocumentImprovementStatus/)
  assert.match(api,/updateDocumentRecordsMetadata/)
  assert.match(api,/declareDocumentRecord/)
})

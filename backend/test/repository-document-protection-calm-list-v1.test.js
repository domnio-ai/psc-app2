import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app=fs.readFileSync('src/App.tsx','utf8')
const api=fs.readFileSync('src/api.ts','utf8')
const backend=fs.readFileSync('backend/src/app.js','utf8')
const schema=fs.readFileSync('backend/src/schema.sql','utf8')
const css=fs.readFileSync('src/documents.css','utf8')

test('repository rows are simplified to five calm columns',()=>{
  for(const heading of ['Record','Context','Status','Governance','Actions'])assert.match(app,new RegExp(`<span>${heading}</span>`))
  assert.doesNotMatch(app,/<span>Version<\/span>/)
  assert.match(app,/repository-row-meta/)
  assert.match(app,/repository-accountability-compact/)
})

test('secondary actions move into More menu',()=>{
  assert.match(app,/Protection & access/)
  assert.match(app,/Relationships \/ evidence/)
  assert.match(app,/Improve \/ update/)
  assert.match(app,/Felix not ready/)
})

test('protection policy supports assigned readers and capability controls',()=>{
  for(const token of ['document_access_policies','document_access_grants','allow_download','allow_copy','allow_print','allow_link','watermark'])assert.match(schema,new RegExp(token))
  assert.match(api,/DocumentProtectionPolicy/)
  assert.match(api,/documentProtection/)
  assert.match(api,/updateDocumentProtection/)
})

test('backend enforces view download copy and link protection',()=>{
  assert.match(backend,/documentProtectionAllowsView/)
  assert.match(backend,/documentProtectionCapability/)
  assert.match(backend,/Copying is disabled for this protected document/)
  assert.match(backend,/Linking is disabled for this protected Repository record/)
  assert.match(backend,/You do not have download permission for this document/)
})

test('protection changes are manager-scoped and audited',()=>{
  assert.match(backend,/DOCUMENT_PROTECTION_UPDATED/)
  assert.match(backend,/This document is outside your management scope/)
  assert.match(app,/Named readers/)
  assert.match(app,/Save protection/)
  assert.match(css,/APP2 DOCUMENT PROTECTION \+ CALM REPOSITORY LIST V1/)
})

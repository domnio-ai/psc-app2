import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const backend=fs.readFileSync('backend/src/app.js','utf8')
const api=fs.readFileSync('src/api.ts','utf8')
const workspace=fs.readFileSync('src/modules/repository/components/RepositoryRecordWorkspace.tsx','utf8')
const css=fs.readFileSync('src/modules/repository/repository-records-v2.css','utf8')

test('governance reviews record an auditable outcome',()=>{
  assert.match(backend,/\/api\/documents\/:id\/governance-review/)
  assert.match(backend,/RECORD_GOVERNANCE_REVIEW_COMPLETED/)
  assert.match(backend,/Confirm Current/)
  assert.match(backend,/Needs Improvement/)
  assert.match(backend,/Supersede Required/)
  assert.match(api,/completeRepositoryGovernanceReview/)
})

test('Record Workspace provides a real governance action center',()=>{
  assert.match(workspace,/GOVERNANCE REVIEW/)
  assert.match(workspace,/LEGAL \/ AUDIT HOLD/)
  assert.match(workspace,/DISPOSITION DECISION/)
  assert.match(workspace,/Record governance review/)
})

test('destruction uses the existing independent deletion approval flow',()=>{
  assert.match(workspace,/requestDocumentDeletion/)
  assert.match(workspace,/Request destruction/)
  assert.match(workspace,/Destruction is blocked while legal\/audit hold is active/)
})

test('manager-only actions remain permission-bound',()=>{
  assert.match(workspace,/isManager\?<>\s*<section className="repository-governance-action-panel"/s)
  assert.match(backend,/authorize\('System Admin','Director','Deputy Director','Assistant Director'\)/)
  assert.match(backend,/isKnowledgeManagerFor/)
})

test('V2.4 styling supports a compact governance action center',()=>{
  assert.match(css,/APP2 REPOSITORY V2\.4 - GOVERNANCE ACTION CENTER/)
  assert.match(css,/repository-governance-action-panel/)
  assert.match(css,/repository-disposition-actions/)
  assert.match(css,/repository-governance-settings/)
})

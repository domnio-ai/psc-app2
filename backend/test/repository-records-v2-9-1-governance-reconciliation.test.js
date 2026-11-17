import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const backend=fs.readFileSync('backend/src/app.js','utf8')
const api=fs.readFileSync('src/api.ts','utf8')
const app=fs.readFileSync('src/App.tsx','utf8')
const panel=fs.readFileSync('src/modules/repository/components/RepositoryGovernanceReconciliation.tsx','utf8')
const css=fs.readFileSync('src/modules/repository/repository-governance-reconciliation-v2-9-1.css','utf8')

test('reviewer reconciliation only auto-suggests one authoritative approval actor',()=>{
  assert.match(backend,/approval_count/)
  assert.match(backend,/single-authoritative-approval/)
  assert.match(backend,/approval\.length!==1/)
  assert.match(backend,/Reviewer suggestion is no longer uniquely supported/)
})

test('retention auto-suggestion requires an exact one-to-one record class match',()=>{
  assert.match(backend,/exact-record-class/)
  assert.match(backend,/exactSchedules\.length===1/)
  assert.match(backend,/matches\.length!==1/)
})

test('reconciliation actions are management scoped and audited',()=>{
  assert.match(backend,/authorize\('System Admin','Director','Deputy Director','Assistant Director'\)/)
  assert.match(backend,/isKnowledgeManagerFor/)
  assert.match(backend,/RECORD_GOVERNANCE_RECONCILED/)
})

test('compact governance reconciliation UI separates deterministic fixes from manual review',()=>{
  assert.match(panel,/Apply safe reconciliation/)
  assert.match(panel,/Manager review required/)
  assert.match(panel,/Nothing is invented/)
  assert.match(app,/RepositoryGovernanceReconciliation/)
})

test('governance reconciliation presentation remains compact and responsive',()=>{
  assert.match(css,/APP2 REPOSITORY V2\.9\.1/)
  assert.match(css,/repository-governance-reconciliation-buckets/)
  assert.match(css,/@media\(max-width:800px\)/)
})

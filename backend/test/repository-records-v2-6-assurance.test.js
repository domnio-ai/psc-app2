import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const backend=fs.readFileSync('backend/src/app.js','utf8')
const api=fs.readFileSync('src/api.ts','utf8')
const workspace=fs.readFileSync('src/modules/repository/components/RepositoryRecordWorkspace.tsx','utf8')
const css=fs.readFileSync('src/modules/repository/repository-records-v2.css','utf8')

test('record assurance is deterministic and read-scope protected',()=>{
  assert.match(backend,/\/api\/documents\/:id\/assurance/)
  assert.match(backend,/canReadKnowledge/)
  assert.match(backend,/SIGNIFICANT GAPS/)
  assert.match(backend,/NEEDS REVISION/)
  assert.match(backend,/READY WITH MINOR ISSUES/)
  assert.match(backend,/READY/)
})

test('assurance checks cover identity governance integrity protection traceability and knowledge',()=>{
  for(const area of ['Identity','Governance','Integrity','Protection','Traceability','Knowledge']){
    assert.ok(backend.includes(`area:'${area}'`),area)
  }
  assert.match(backend,/currentVersionExists/)
  assert.match(backend,/retention_schedule_id/)
  assert.match(backend,/repository_entity_links/)
})

test('API exposes a typed RepositoryRecordAssurance contract',()=>{
  assert.match(api,/export type RepositoryRecordAssurance/)
  assert.match(api,/RepositoryAssuranceCheck/)
  assert.match(api,/repositoryRecordAssurance/)
})

test('Record Workspace adds a compact Assurance tab with navigation to fixes',()=>{
  assert.match(workspace,/type Tab="Overview"\|"Assurance"/)
  assert.match(workspace,/RECORD ASSURANCE/)
  assert.match(workspace,/This is not a staff score/)
  assert.match(workspace,/setTab\(check\.actionTab\)/)
})

test('assurance presentation is compact and status-driven',()=>{
  assert.match(css,/APP2 REPOSITORY V2\.6 - RECORD ASSURANCE/)
  assert.match(css,/repository-assurance-checks/)
  assert.match(css,/repository-assurance-check\.pass/)
  assert.match(css,/repository-assurance-check\.gap/)
})


test('Assurance tab closes its workspace div before the conditional expression',()=>{
  assert.match(workspace,/\{tab==="Assurance"&&<div className="repository-assurance-workspace">/)
  assert.match(workspace,/<\/>\}\s*<\/div>\}\s*\{tab==="Versions"/s)
  assert.doesNotMatch(workspace,/<\/>\}\s*<\/>\}/s)
})

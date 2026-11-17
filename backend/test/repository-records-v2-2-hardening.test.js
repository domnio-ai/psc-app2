import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const workspace=fs.readFileSync('src/modules/repository/components/RepositoryRecordWorkspace.tsx','utf8')
const advanced=fs.readFileSync('src/modules/repository/components/RepositoryAdvancedSearch.tsx','utf8')
const bulk=fs.readFileSync('src/modules/repository/components/RepositoryBulkIntake.tsx','utf8')
const css=fs.readFileSync('src/modules/repository/repository-records-v2.css','utf8')

test('record workspace gives clear next-action and review-due guidance',()=>{
  assert.match(workspace,/NEXT ACTION/)
  assert.match(workspace,/Review overdue/)
  assert.match(workspace,/Review approaching/)
  assert.match(workspace,/Active record/)
  assert.match(workspace,/repository-record-decision-strip/)
})

test('manager and ordinary-user governance remain visibly separated',()=>{
  assert.match(workspace,/Manager-controlled governance/)
  assert.match(workspace,/isManager&&detail\.record\.status!=="Archived"/)
  assert.match(workspace,/Protection is controlled by authorised management/)
})

test('advanced search exposes active filters and removable saved views',()=>{
  assert.match(advanced,/active\.length/)
  assert.match(advanced,/repository-active-filter-chips/)
  assert.match(advanced,/deleteRepositoryView/)
  assert.match(advanced,/Clear all/)
})

test('bulk intake shows a governance summary before upload',()=>{
  assert.match(bulk,/repository-bulk-intake-summary/)
  assert.match(bulk,/Upload governed batch/)
  assert.match(bulk,/Reviewer/)
})

test('v2.2 styling supports decision strip, governance state and saved filters',()=>{
  assert.match(css,/APP2 REPOSITORY V2\.2 WORKFLOW \+ UX HARDENING/)
  assert.match(css,/repository-record-decision-strip/)
  assert.match(css,/repository-governance-status-row/)
  assert.match(css,/repository-active-filter-chips/)
})

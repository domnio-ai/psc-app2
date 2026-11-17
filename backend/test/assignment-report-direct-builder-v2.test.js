import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd().endsWith(`${path.sep}backend`)?path.resolve(process.cwd(),'..'):process.cwd()
const read=(rel)=>fs.readFileSync(path.join(root,rel),'utf8')
const surfaces=read('src/modules/assignments/components/AssignmentReportSurfaces.tsx')
const reportsPanel=read('src/modules/assignments/components/AssignmentReportsPanel.tsx')
const app=read('src/App.tsx')
const entry=read('src/modules/assignments/AssignmentWorkspaceEntry.tsx')

test('Reports tab exposes the latest editable Final Assignment Report draft',()=>{
  assert.match(reportsPanel,/const draftStage = Boolean\(/)
  assert.match(reportsPanel,/\["Draft", "Revised", "Changes Requested", "Rejected"\]\.includes\(primaryReport\.status\)/)
  assert.match(reportsPanel,/onClick=\{\(\) => onOpen\(primaryReport\.id\)\}/)
  assert.match(reportsPanel,/Continue Editing/)
})

test('draft actions preserve imported report handoff and role-based editing restrictions',()=>{
  assert.match(reportsPanel,/const importedDraft = Boolean\(draftStage && primaryReport\?\.external_import_id\)/)
  assert.match(reportsPanel,/canManage \|\| \(primaryReport\?\.created_by && primaryReport\.created_by === currentUserId\)/)
  assert.match(reportsPanel,/draftStage && canAuthorReport && \(/)
  assert.match(surfaces,/<AssignmentReportsPanel \{\.\.\.panelProps\} \/>/)
})

test('closing the Assignment Report Builder returns to Reports without reopening it',()=>{
  assert.match(app,/const returnTab = "Reports"/)
  assert.doesNotMatch(app,/assignmentWorkspaceTab === "Review" \? "Review" : "Reports"/)
})

test('direct-entry visual layer is loaded by the Assignment workspace',()=>{
  assert.match(entry,/assignment-report-direct-entry-v2\.css/)
})

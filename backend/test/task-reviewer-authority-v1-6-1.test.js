import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd().endsWith(`${path.sep}backend`)?path.resolve(process.cwd(),'..'):process.cwd()
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8')

test('Task Report reviewer options come from the authoritative assignment reviewer endpoint',()=>{
  const hook=read('src/modules/tasks/useTaskReportReviewerOptions.ts')
  assert.match(hook,/api\s*\.\s*assignmentReviewerCandidates\(token, assignmentId, ownerId\)/)
  assert.match(hook,/row\.role !== "System Admin"/)
  assert.match(hook,/row\.id !== ownerId/)
})

test('App consumes the modular reviewer authority instead of rebuilding Task Report reviewer scope from userRows',()=>{
  const app=read('src/App.tsx')
  assert.match(app,/useTaskReportReviewerOptions\(\{/)
  assert.match(app,/const taskReportReviewerCandidates = taskReportReviewerAuthority\.options/)
  assert.doesNotMatch(app,/const taskReportReviewerCandidates = selectedAssignmentTask\s*\?\s*deriveTaskReviewerOptions/)
})

test('backend reviewer-candidates endpoint reuses the same reviewer eligibility authority used when saving',()=>{
  const backend=read('backend/src/app.js')
  assert.match(backend,/app\.get\('\/api\/assignments\/:id\/reviewer-candidates'/)
  assert.match(backend,/if\(await isEligibleAssignmentTaskReviewer\(req\.params\.id,owner\.id,candidate\.id\)\)eligible\.push\(candidate\)/)
  assert.match(backend,/role<>'System Admin'/)
})

test('Task Report reviewer picker remains presentation-only',()=>{
  const picker=read('src/modules/tasks/TaskReportReviewerPicker.tsx')
  assert.doesNotMatch(picker,/api\./)
  assert.match(picker,/options\.map\(\(reviewer\)/)
  assert.match(picker,/Self-review is not permitted/)
})

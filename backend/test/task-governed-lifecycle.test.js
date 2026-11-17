import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const workflow=readFileSync(new URL('../../src/modules/tasks/taskWorkspaceWorkflow.ts',import.meta.url),'utf8')
const footer=readFileSync(new URL('../../src/modules/tasks/TaskWorkspaceFooter.tsx',import.meta.url),'utf8')
const mainApp=readFileSync(new URL('../../src/App.tsx',import.meta.url),'utf8')

test('generic task workspace cannot complete a task',()=>{
  assert.match(workflow,/TaskWorkspaceAction = "save" \| "start"/)
  assert.doesNotMatch(workflow,/action === "complete"/)
  assert.doesNotMatch(workflow,/Task completed successfully/)
  assert.match(mainApp,/action: TaskWorkspaceAction = "save"/)
  assert.doesNotMatch(mainApp,/"save" \| "start" \| "complete"/)
  assert.match(app,/if\(v\.status==='Completed'\)return res\.status\(409\).*Task completion is governed by final report publication/)
  assert.doesNotMatch(app,/Completed task ready for assignment review/)
})

test('task submission remains a reviewer-controlled immutable stage',()=>{
  assert.match(app,/contribution_status!=='Draft'/)
  assert.match(app,/contribution_status='Integrated'/)
  assert.match(app,/TASK_REPORT_SUBMITTED_TO_REVIEWER/)
  assert.match(app,/INSERT INTO task_report_versions\(task_id,version_number,report_snapshot,html_snapshot,snapshot_sha256,status,submitted_by,reviewer_id\)/)
})

test('repository publication is the task completion gate',()=>{
  const publishIndex=app.indexOf("finalizationStage='publish-repository'")
  const completeIndex=app.indexOf("finalizationStage='complete-task'")
  assert.ok(publishIndex >= 0, 'final task report must publish to Repository')
  assert.ok(completeIndex > publishIndex, 'Task completion must occur after Repository publication')
  assert.match(app,/contribution_status='Accepted',[\s\S]*status='Completed',[\s\S]*progress=100/)
  assert.match(app,/finalDocumentType:'Task Final Report'/)
  assert.match(footer,/approved final report is generated[\s\S]*published to the Repository/)
})

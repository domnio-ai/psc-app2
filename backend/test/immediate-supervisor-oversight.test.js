import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

const backend=readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const scope=readFileSync(new URL('../src/scope.js',import.meta.url),'utf8')
const frontend=readFileSync(new URL('../../src/App.tsx',import.meta.url),'utf8')
const researchWizard=readFileSync(new URL('../../src/modules/research/components/ResearchCreationWizard.tsx',import.meta.url),'utf8')
const assignmentTasks=readFileSync(new URL('../../src/modules/assignments/components/AssignmentTasksPanel.tsx',import.meta.url),'utf8')

test('review oversight is derived from the immediate reporting line',()=>{
  assert.match(scope,/export async function immediateSupervisorForUser/)
  assert.match(scope,/candidate\.id=supervisor\.id OR candidate\.supervisor_id=supervisor\.id/)
  assert.match(scope,/candidate\.role<>'System Admin'/)
  assert.match(backend,/oversight_manager_name/)
  assert.match(backend,/oversight_manager_role/)
})

test('immediate supervisors can change research reviewers within their team',()=>{
  assert.match(backend,/Only the Research Lead or an authorised research manager can change formal reviewers/)
  assert.match(backend,/await immediateOversightReviewers\(project\.lead_id\)/)
  assert.match(frontend,/selectedResearch\.oversight_manager_id === user\?\.id/)
})

test('system administrators are excluded from operational reviewer choices',()=>{
  assert.match(researchWizard,/member\.role !== "System Admin"/)
  assert.match(frontend,/candidate\.role !== "System Admin"/)
  assert.match(scope,/candidate\.role<>'System Admin'/)
})

test('assignment task reviewers are limited to the assignee team scope',()=>{
  assert.match(backend,/\/api\/assignments\/:id\/reviewer-candidates/)
  assert.match(backend,/await immediateOversightReviewers\(owner\.id\)/)
  assert.match(backend,/FROM assignment_members am/)
  assert.match(backend,/Choose a reviewer from the assignee's assignment or immediate reporting team/)
  assert.match(backend,/isEligibleAssignmentTaskReviewer/)
  assert.match(frontend,/api\.assignmentReviewerCandidates/)
  assert.match(frontend,/<option value="">Select reviewer<\/option>/)
  assert.match(frontend,/assignmentReportReviewerCandidates/)
  assert.match(assignmentTasks,/Workstream ·/)
})

import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

const frontend=readFileSync(new URL('../../src/App.tsx',import.meta.url),'utf8')
const workspaceShell=readFileSync(new URL('../../src/modules/assignments/components/AssignmentWorkspaceShell.tsx',import.meta.url),'utf8')
const assignmentEditor=readFileSync(new URL('../../src/modules/assignments/components/AssignmentEditorModal.tsx',import.meta.url),'utf8')
const assignmentReview=readFileSync(new URL('../../src/modules/assignments/components/AssignmentReviewPanel.tsx',import.meta.url),'utf8')
const assignmentReports=readFileSync(new URL('../../src/modules/assignments/components/AssignmentReportsPanel.tsx',import.meta.url),'utf8')
const assignmentOverviewState=readFileSync(new URL('../../src/modules/assignments/utils/deriveAssignmentOverview.ts',import.meta.url),'utf8')
const api=readFileSync(new URL('../../src/api.ts',import.meta.url),'utf8')
const backend=readFileSync(new URL('../src/app.js',import.meta.url),'utf8')

test('assignment workspace exposes the focused primary navigation tabs',()=>{
  for(const label of ['Overview','Evidence','Reports','Activity'])assert.match(workspaceShell,new RegExp(`label: "${label}"`))
  for(const legacy of ['Task Reports','Structure & Plan','Discussion','Contributions'])assert.doesNotMatch(workspaceShell,new RegExp(`label: "${legacy}"`))
})

test('assignment workspace reuses existing APIs for quick add and resources',()=>{
  for(const action of ['Report','Note','Document','Comment'])assert.match(workspaceShell,new RegExp(`>\\s*${action}\\s*<`))
  assert.match(frontend,/linkKnowledgeToAssignment/)
  assert.match(api,/\/knowledge\/\$\{id\}\/assignments/)
  assert.match(frontend,/Assignment context: ID/)
})

test('assignment deadlines normalize API timestamps before calculating remaining days',()=>{
  assert.match(frontend,/String\(dateValue\)\.match\(\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\//)
  assert.match(frontend,/new Date\(`\$\{dateOnly\}T23:59:59`\)/)
})

test('assignment status and progress follow active task work',()=>{
  assert.match(backend,/const syncAssignmentStatusFromTasks=/)
  assert.match(backend,/summary\.total>0&&summary\.active>0\?'In Progress':'Not Started'/)
  assert.match(assignmentOverviewState,/const taskExecutionPercent = tasks\.length/)
})

test('assignment creation names one accountable lead and opens the created overview',()=>{
  assert.match(assignmentEditor,/Accountable lead and team/)
  assert.match(assignmentEditor,/value=\{assignmentForm\.leadId \|\| ""\}/)
  assert.match(assignmentEditor,/Tasks are optional/)
  assert.match(frontend,/Select one accountable Assignment Lead before creating the assignment\./)
  assert.match(frontend,/await openAssignmentDetails\(created\)/)
  assert.match(frontend,/setAssignmentWorkspaceTab\("Overview"\)/)
})

test('assignment creation honours the management hierarchy and validates active members',()=>{
  assert.match(backend,/authorize\('System Admin','Director','Deputy Director','Deputy Director','Assistant Director'\)/)
  assert.match(backend,/Choose only active REDESY users for the assignment team\./)
  assert.match(backend,/id===leadId\?'Lead':'Contributor'/)
  assert.match(backend,/directAssignment:memberIds\.length===0/)
})

test('the assigned reviewer controls approval and final publication',()=>{
  assert.match(backend,/Only the reviewer assigned to this Final Assignment Report can record the formal review decision/)
  assert.match(backend,/if\(document\.reviewer_id!==req\.user\.id\)return res\.status\(403\).*assigned reviewer.*generate the approved final report/)
  assert.match(assignmentReview,/const reviewerCanDecide = Boolean\([\s\S]*report && report\.reviewer_id === currentUserId/)
  assert.match(assignmentReports,/Waiting for \{primaryReport\.reviewer_name \|\| "reviewer"\}/)
})

test('rejection is a terminal assignment report state with an accurate notification',()=>{
  assert.match(backend,/SET status='Rejected',version=version\+1,approved_by=NULL,approved_at=NULL/)
  assert.match(backend,/UPDATE assignment_report_imports SET status='Rejected'/)
  assert.match(backend,/'Assignment report rejected'/)
})

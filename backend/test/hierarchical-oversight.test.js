import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

const backend=readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const scope=readFileSync(new URL('../src/scope.js',import.meta.url),'utf8')
const meetings=readFileSync(new URL('../src/meetings/meetings-routes.js',import.meta.url),'utf8')
const inbox=readFileSync(new URL('../../src/NotificationCenter.tsx',import.meta.url),'utf8')

const route=(start,end)=>backend.slice(backend.indexOf(start),backend.indexOf(end,backend.indexOf(start)))

test('operational oversight roles exclude System Admin from business approvals',()=>{
  assert.match(scope,/operationalOversightRoles=\['Director','Deputy Director','Assistant Director'\]/)
  assert.match(scope,/isOperationalOversightRole=role=>operationalOversightRoles\.includes\(role\)/)
  assert.match(scope,/export async function canOverseeUser\(user,targetId\)/)
  assert.match(scope,/if\(user\.role==='Director'\)return true/)
  assert.match(scope,/const ids=await managedUserIds\(user\)/)
})

test('reporting-chain manager lookup is recursive and cycle guarded',()=>{
  assert.match(scope,/export async function reportingOversightManagerIds\(userId\)/)
  assert.match(scope,/WITH RECURSIVE reporting_chain AS/)
  assert.match(scope,/chain\.depth<50/)
  assert.match(scope,/NOT supervisor\.supervisor_id=ANY\(chain\.path\)/)
  assert.match(scope,/manager\.role IN\('Director','Deputy Director','Assistant Director'\)/)
})

test('task request queue includes authorised descendants and only eligible managers can decide',()=>{
  const r=route("app.get('/api/task-requests'","app.post('/api/task-requests'")
  assert.match(r,/const scoped=await managedUserIds\(req\.user\)/)
  assert.match(r,/r\.requested_by=ANY\(\$3::uuid\[\]\)/)
  assert.match(r,/const organisationWide=req\.user\.role==='Director'/)
  assert.match(r,/can_decide:row\.status==='Pending'&&row\.requested_by!==req\.user\.id&&isOperationalOversightRole\(req\.user\.role\)/)
})

test('all three request approval routes accept authorised higher managers in the reporting chain',()=>{
  assert.match(backend,/if\(!await canOverseeUser\(req\.user,pending\.requested_by\)\)/)
  assert.match(backend,/if\(!await canOverseeUser\(req\.user,oversightRequest\.requested_by\)\)/)
  assert.match(backend,/const canView=request\.requested_by===req\.user\.id\|\|await canOverseeUser\(req\.user,request\.requested_by\)/)
})

test('new Task Requests notify immediate supervisor and higher manager ancestors',()=>{
  assert.match(backend,/const oversightManagerIds=await reportingOversightManagerIds\(req\.user\.id\)/)
  assert.match(backend,/for\(const managerId of oversightManagerIds\)/)
  assert.match(backend,/managerId===supervisor\.id\)continue/)
  assert.match(backend,/Task request awaiting approval/)
})

test('existing pending Task Requests are backfilled into eligible manager notifications',()=>{
  const r=route("app.get('/api/notifications'","app.patch('/api/notifications/:id/read'")
  assert.match(r,/if\(isOperationalOversightRole\(req\.user\.role\)\)/)
  assert.match(r,/INSERT INTO notifications\(user_id,title,body,entity_type,entity_id,priority,action,target_workspace,notification_category,email_eligible,next_email_attempt_at\)[\s\S]*?FROM assignment_task_requests r/)
  assert.match(r,/r\.status='Pending'/)
  assert.match(r,/r\.requested_by=ANY\(\$3::uuid\[\]\)/)
  assert.match(r,/NOT EXISTS\(SELECT 1 FROM notifications n WHERE n\.user_id=\$1/)
})

test('assignment report manager capability includes scoped Assistant and Deputy Directors',()=>{
  assert.match(backend,/const assignmentDocumentRole=async\(user,document\)=>\{\s*if\(document\?\.context==='Assignment'&&document\?\.context_id&&await canManageAssignment\(user,document\.context_id\)\)return 'Manager'/)
})

test('line managers can manage Research only through their reporting subtree',()=>{
  assert.match(scope,/export async function canManageResearch\(user,researchId\)[\s\S]*?p\.lead_id IN\(SELECT id FROM managed\)[\s\S]*?research_collaborators rc WHERE rc\.project_id=p\.id AND rc\.user_id IN\(SELECT id FROM managed\)[\s\S]*?research_reviewers rr WHERE rr\.project_id=p\.id AND rr\.reviewer_id IN\(SELECT id FROM managed\)[\s\S]*?research_milestones rm WHERE rm\.project_id=p\.id AND rm\.owner_id IN\(SELECT id FROM managed\)/)
  assert.match(backend,/const canEdit=isOrganisationScopeRole\(req\.user\.role\)\|\|\(isTeamScopeRole\(req\.user\.role\)&&await canManageResearch\(req\.user,req\.params\.id\)\)/)
  assert.match(backend,/const isResearchManager=isOrganisationScopeRole\(req\.user\.role\)\|\|\(isTeamScopeRole\(req\.user\.role\)&&await canManageResearch\(req\.user,req\.params\.id\)\)/)
  assert.match(backend,/selected\.some\(id=>!allowed\.includes\(id\)\)/)
  assert.match(backend,/AND\(\$1::boolean OR u\.id=ANY\(\$2::uuid\[\]\)\)/)
})

test('line manager User Management remains reporting-tree scoped and keeps role controls protected',()=>{
  assert.match(scope,/export async function canManageUser\(user,targetId\)[\s\S]*?const ids=await managedUserIds\(user\)[\s\S]*?return ids\.includes\(targetId\)/)
  assert.match(backend,/if\(!await canManageUser\(req\.user,req\.params\.id\)\)return res\.status\(403\)\.json\(\{error:'You may edit only users inside your authorised reporting scope\.'/)
  assert.match(backend,/const admin=req\.user\.role==='System Admin'/)
})

test('team managers can edit meetings that include members of their reporting subtree',()=>{
  const start=meetings.indexOf('const meetingManage=')
  const end=meetings.indexOf('const requireAccess=',start)
  const policy=meetings.slice(start,end)
  assert.match(policy,/const ids=await getScopeIds\(user\)/)
  assert.match(policy,/EXISTS\(SELECT 1 FROM meeting_participants p WHERE p\.meeting_id=m\.id AND p\.user_id=ANY\(\$2::uuid\[\]\)\)/)
})

test('team managers can grant named document access only inside their reporting subtree',()=>{
  const start=backend.indexOf("app.put('/api/documents/:id/protection'")
  const end=backend.indexOf("app.post('/api/documents/:id/print-event'",start)
  const route=backend.slice(start,end)
  assert.match(route,/if\(isTeamScopeRole\(req\.user\.role\)\)/)
  assert.match(route,/const allowed=await managedUserIds\(req\.user\)/)
  assert.match(route,/activeUsers\.some\(id=>!allowed\.includes\(id\)\)/)
})

test('assignment managers must pass object-level reporting scope before editing assignment details',()=>{
  const start=backend.indexOf("app.patch('/api/assignments/:id',")
  const end=backend.indexOf("app.delete('/api/assignments/:id',",start)
  assert.match(backend.slice(start,end),/if\(!await canManageAssignment\(req\.user,req\.params\.id\)\)return res\.status\(403\)/)
})

test('assignment managers must pass object-level scope before deleting an assignment',()=>{
  const start=backend.indexOf("app.delete('/api/assignments/:id',")
  const end=backend.indexOf("app.patch('/api/assignments/:id/status',",start)
  const route=backend.slice(start,end)
  assert.match(route,/authorize\('System Admin','Deputy Director','Assistant Director'\)/)
  assert.match(route,/if\(!await canManageAssignment\(req\.user,req\.params\.id\)\)return res\.status\(403\)/)
})

test('generated document list rejects a report context outside the caller scope before querying records',()=>{
  const r=route("app.get('/api/generated-documents'","app.get('/api/generated-documents/:id'")
  assert.match(r,/const baseAccess=context==='Assignment'\?await canAccessAssignment\(req\.user,contextId\):await canAccessResearch\(req\.user,contextId\)/)
  assert.match(r,/if\(!baseAccess\)return res\.status\(403\)/)
})

test('generated report access respects assignment and research hierarchy rather than Deputy-only global bypass',()=>{
  assert.match(backend,/let allowed=user\.role==='System Admin'\|\|document\.created_by===user\.id\|\|document\.reviewer_id===user\.id/)
  assert.match(backend,/if\(!allowed&&document\.context==='Assignment'\)allowed=await canAccessAssignment\(user,document\.context_id\)/)
  assert.match(backend,/if\(!allowed&&document\.context==='Research'\)allowed=await canAccessResearch\(user,document\.context_id\)/)
})

test('formal assignment and research report decisions remain restricted to appointed reviewers',()=>{
  assert.match(backend,/if\(document\.reviewer_id!==req\.user\.id\)return res\.status\(403\)\.json\(\{error:'Only the reviewer assigned to this Final Assignment Report can record the formal review decision\.'/)
  assert.match(backend,/if\(version\.reviewer_id!==req\.user\.id\)return res\.status\(403\)\.json\(\{error:'Only the reviewer appointed to this submitted research report can record the review decision\.'/)
})

test('assignment team-request approval notifications are classified as Reviews',()=>{
  assert.match(inbox,/item\.entity_type === "assignment_member_request" &&\s*\/assignment team request awaiting approval\/i\.test\(item\.title \|\| ""\)\s*\) return "Review"/)
})

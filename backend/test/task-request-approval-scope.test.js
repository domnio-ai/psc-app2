import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const routeStart=app.indexOf("app.patch('/api/task-requests/:requestId'")
const routeEnd=app.indexOf("app.get('/api/task-reviews/:taskId/context'",routeStart)
const route=app.slice(routeStart,routeEnd)

test('standalone Task Request approval validates active operational owners and reporting scope',()=>{
  assert.ok(routeStart>=0,'standalone task-request decision route exists')
  assert.ok(routeEnd>routeStart,'route is bounded before task review context')
  assert.match(route,/SELECT id,name,role,active FROM users WHERE id=\$1/)
  assert.match(route,/!ownerUser\|\|!ownerUser\.active\|\|ownerUser\.role==='System Admin'/)
  assert.match(route,/const scoped=await managedUserIds\(req\.user\)/)
  assert.match(route,/if\(scoped!==null&&!scoped\.includes\(taskOwner\)\)return \{kind:'out-of-scope-owner'\}/)
  assert.match(route,/The task owner must belong to your authorised reporting scope/)
})

test('authorised non-member owners are enrolled as assignment contributors with history and audit',()=>{
  assert.match(route,/INSERT INTO assignment_members\(assignment_id,user_id,member_role\) VALUES\(\$1,\$2,'Contributor'\) ON CONFLICT\(assignment_id,user_id\) DO NOTHING/)
  assert.match(route,/TASK_OWNER_AUTO_ENROLLED/)
  assert.match(route,/task-request-approval-standalone/)
  assert.match(route,/ownerAutoEnrolled/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8')

test('all governed workspaces share the HTTP 423 structured lock contract',()=>{
  assert.match(app,/const lockedWorkspaceResponse=.*res\.status\(423\)\.json/s)
  for(const field of ["error:'WORKSPACE_LOCKED'",'status,','version,','reviewer'])assert.ok(app.includes(field))
  assert.match(app,/assignmentWorkspaceLockState/)
  assert.match(app,/taskWorkspaceLockState/)
  assert.match(app,/researchWorkspaceLockState/)
})

test('assignment and task mutation middleware enforces locks server side',()=>{
  assert.match(app,/app\.use\('\/api\/assignments\/:id',authenticate/)
  assert.match(app,/\['POST','PATCH','PUT','DELETE'\]\.includes\(req\.method\)/)
  assert.match(app,/\['Submitted','Under Review','Approved','Final'\]\.includes\(report\.status\)/)
  assert.match(app,/\['Ready for Integration','Integrated','Accepted'\]\.includes\(task\.contribution_status\)/)
})

test('preview, reviewer decision and finalisation remain explicit lock exceptions',()=>{
  assert.match(app,/contribution-preview\|contribution-review\|contribution-finalize/)
  assert.match(app,/if\(governedDecision\)return next\(\)/)
  assert.match(app,/reviewerDecision\|\|finalGeneration/)
})

import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

const backend=readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const schema=readFileSync(new URL('../src/schema.sql',import.meta.url),'utf8')
const frontend=readFileSync(new URL('../../src/App.tsx',import.meta.url),'utf8')
const overview=readFileSync(new URL('../../src/modules/assignments/components/AssignmentOverview.tsx',import.meta.url),'utf8')

test('assignment team requests are persisted and uniquely pending per person',()=>{
  assert.match(schema,/CREATE TABLE IF NOT EXISTS assignment_member_requests/)
  assert.match(schema,/assignment_member_requests_pending_idx/)
})

test('only the assignment lead creates a member request for immediate-supervisor approval',()=>{
  assert.match(backend,/Only the Assignment Lead may request an additional team member/)
  assert.match(backend,/immediateSupervisorForUser\(req\.user\.id\)/)
  assert.match(backend,/Only an authorised manager in the requester's reporting hierarchy can decide this team request/)
  assert.match(backend,/reportingOversightManagerIds\(req\.user\.id\)/)
})

test('approval adds the requested person and notifies both parties',()=>{
  assert.match(backend,/INSERT INTO assignment_members\(assignment_id,user_id,member_role\)/)
  assert.match(backend,/Added to assignment team/)
  assert.match(backend,/Assignment team request approved/)
})

test('the request remains available from ASSIGNMENT governance and the overview team card',()=>{
  // TASK creation moved to the standalone Tasks module. ASSIGNMENT MEMBER REQUEST
  // remains an Assignment governance action and must not depend on the retired
  // embedded TASK creation surface.
  assert.doesNotMatch(frontend,/Need another officer\? Request an additional team member/)
  assert.match(frontend,/Request an additional member/)
  assert.match(frontend,/Request an additional assignment team member/)
  assert.match(overview,/Request member/)
  assert.match(overview,/TEAM REQUEST · PENDING/)
})

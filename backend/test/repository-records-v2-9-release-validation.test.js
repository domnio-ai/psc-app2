import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const validator=fs.readFileSync('backend/scripts/repository-release-validation-v2-9.mjs','utf8')
const checklist=fs.readFileSync('backend/scripts/repository-ui-acceptance-v2-9.md','utf8')

test('release validator checks Repository foundation and core integrity',()=>{
  for(const expected of [
    'Repository database foundation',
    'Duplicate official record numbers',
    'Broken current-version pointers',
    'Multiple current immutable versions',
    'Orphan immutable versions',
    'Self-superseding records'
  ]) assert.ok(validator.includes(expected),expected)
})

test('release validator includes security-critical data checks',()=>{
  assert.match(validator,/Legal hold conflicting with destruction/)
  assert.match(validator,/Named-reader policies without readers/)
  assert.match(validator,/Restricted records without explicit protection policy/)
})

test('release validator distinguishes critical failures from governance actions',()=>{
  assert.match(validator,/criticalFailures/)
  assert.match(validator,/READY FOR RELEASE/)
  assert.match(validator,/READY WITH ACTIONS/)
  assert.match(validator,/NOT READY/)
  assert.match(validator,/process\.exitCode=2/)
})

test('release validator writes both machine-readable and human-readable reports',()=>{
  assert.match(validator,/repository-release-validation-v2-9-/)
  assert.match(validator,/JSON\.stringify\(report,null,2\)/)
  assert.match(validator,/Markdown report:/)
  assert.match(validator,/JSON report:/)
})

test('UI acceptance checklist covers end-to-end governance and deployment',()=>{
  for(const expected of [
    'Intake and approval',
    'Version integrity',
    'Supersession',
    'Retention, review and disposition',
    'Protection and secure reader',
    'Scope and RBAC',
    'Operational queues',
    'Assurance',
    'Notifications and calendar',
    'Deployment readiness'
  ]) assert.ok(checklist.includes(expected),expected)
})

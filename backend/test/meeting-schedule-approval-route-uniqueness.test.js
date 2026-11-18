import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('meeting schedule approval routes are each registered exactly once', async () => {
  const source = await readFile(new URL('../src/meetings/meetings-routes.js', import.meta.url), 'utf8')
  const registrations = [...source.matchAll(/\bapp\.(get|post|patch|put|delete)\('([^']+)'/g)]
    .map(match => `${match[1]} ${match[2]}`)
  const expected = [
    'get /api/meetings/schedule-approval/eligible-approvers',
    'get /api/meetings/schedule-approval/delegable-users',
    'get /api/meetings/schedule-approval/appointments',
    'post /api/meetings/schedule-approval/appointments',
    'post /api/meetings/schedule-approval/appointments/:id/revoke',
    'get /api/meetings/schedule-approvals/pending',
    'post /api/meetings/:id/schedule-decision',
  ]
  for (const route of expected) {
    assert.equal(registrations.filter(item => item === route).length, 1, `${route} must be registered once`)
  }
})

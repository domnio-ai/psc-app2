import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const serverSource = await readFile(new URL('../src/server.js', import.meta.url), 'utf8')
const composeSource = await readFile(new URL('../../docker-compose.yml', import.meta.url), 'utf8')

test('research lifecycle reconciliation has an explicit false startup gate', () => {
  assert.match(serverSource, /RESEARCH_LIFECYCLE_RECONCILIATION_ENABLED\s*!==\s*'false'/)
  assert.match(composeSource, /RESEARCH_LIFECYCLE_RECONCILIATION_ENABLED:\s*["']false["']/)
})

test('notice expiry worker has an explicit false startup gate', () => {
  assert.match(serverSource, /NOTICE_EXPIRY_WORKER_ENABLED\s*!==\s*'false'/)
  assert.match(composeSource, /NOTICE_EXPIRY_WORKER_ENABLED:\s*["']false["']/)
})

test('training Compose pins PostgreSQL to the validated immutable digest', () => {
  assert.match(composeSource, /image:\s*postgres@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b/)
  assert.match(composeSource, /FELIX_INDEX_WORKER_ENABLED:\s*["']false["']/)
  assert.match(composeSource, /REPORT_SCHEDULER_ENABLED:\s*["']false["']/)
  assert.match(composeSource, /SMTP_ENABLED:\s*["']false["']/)
})
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const schema=readFileSync(new URL('../src/schema.sql',import.meta.url),'utf8')
const migration=readFileSync(new URL('../migrations/030_task_report_versions.sql',import.meta.url),'utf8')

test('task submissions create immutable checksummed versions',()=>{
  assert.match(schema,/CREATE TABLE IF NOT EXISTS task_report_versions/)
  assert.match(migration,/UNIQUE\(task_id,version_number\)/)
  assert.match(migration,/snapshot_sha256/)
  assert.match(migration,/Backfilled from the governed pre-versioning task report state/)
  assert.match(migration,/ON CONFLICT\(task_id,version_number\) DO NOTHING/)
  assert.match(app,/INSERT INTO task_report_versions\(task_id,version_number,report_snapshot,html_snapshot,snapshot_sha256,status,submitted_by,reviewer_id\)/)
  assert.match(app,/digest\(convert_to\(\$3::jsonb::text,'UTF8'\),'sha256'\)/)
})

test('task review decisions update the submitted version without overwriting its snapshot',()=>{
  assert.match(app,/UPDATE task_report_versions SET status=\$1,reviewed_by=\$2,reviewed_at=NOW\(\),review_comments=\$3/)
  assert.doesNotMatch(app,/UPDATE task_report_versions SET[^\n]*(?:report_snapshot|html_snapshot)/)
})

test('task finalisation requires and consumes the approved immutable snapshot',()=>{
  assert.match(app,/task_report_versions WHERE task_id=\$1 AND version_number=\$2 AND status='Approved'/)
  assert.match(app,/const approvedTask=\{\.\.\.current,\.\.\.approvedSnapshot\}/)
  assert.match(app,/buildTaskContributionReport\(\{task:approvedTask/)
  assert.match(app,/UPDATE task_report_versions SET status='Finalised'/)
})

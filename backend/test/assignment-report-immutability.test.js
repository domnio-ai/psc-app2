import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const migration=readFileSync(new URL('../migrations/031_assignment_report_snapshot_checksums.sql',import.meta.url),'utf8')

test('assignment report versions are checksummed and legacy current states are reconciled',()=>{
  assert.match(migration,/snapshot_sha256 VARCHAR\(64\)/)
  assert.match(migration,/digest\(convert_to\(sections::text,'UTF8'\),'sha256'\)/)
  assert.match(migration,/v\.version_number=d\.version/)
  assert.match(app,/generated_document_versions[\s\S]*digest\(convert_to\(\$3::jsonb::text,'UTF8'\),'sha256'\)/)
})

test('assignment review decision governs the immutable submitted version',()=>{
  assert.match(app,/UPDATE generated_document_versions SET status=\$1 WHERE document_id=\$2 AND version_number=\$3/)
  assert.match(app,/req\.validated\.decision,document\.id,document\.version/)
})

test('assignment finalisation consumes only the approved immutable snapshot',()=>{
  assert.match(app,/generated_document_versions WHERE document_id=\$1 AND version_number=\$2 AND status='Approved'/)
  assert.match(app,/const approvedSections=Array\.isArray\(approvedSnapshot\)/)
  assert.match(app,/const finalSections=\[\.\.\.approvedSections\.filter/)
  assert.match(app,/UPDATE generated_document_versions SET status='Final'/)
})

test('assignment finalisation coordinates task creation and rechecks every active task under row locks',()=>{
  const finalise=app.slice(app.indexOf("app.post('/api/assignment-reports/:id/finalize'"),app.indexOf("app.get('/api/research/:id/comments'"))
  const createTask=app.slice(app.indexOf("app.post('/api/assignments/:id/tasks'"),app.indexOf("app.patch('/api/assignments/:id/tasks/:taskId'"))
  const advisoryLock=/pg_advisory_xact_lock\(hashtextextended\('assignment-task-set:' \|\| \$1::text,0\)\)/
  assert.match(finalise,advisoryLock)
  assert.match(createTask,advisoryLock)
  assert.match(finalise,/SELECT id,contribution_status FROM assignment_tasks WHERE assignment_id=\$1::uuid AND archived_at IS NULL ORDER BY id FOR UPDATE/)
  assert.match(finalise,/lockedTasks\.some\(task=>task\.contribution_status!=='Accepted'\)/)
  assert.ok(finalise.indexOf('pg_advisory_xact_lock') < finalise.indexOf('lockedTasks.some'))
})

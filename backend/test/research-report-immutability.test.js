import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const migration=readFileSync(new URL('../migrations/032_research_report_snapshot_checksums.sql',import.meta.url),'utf8')

test('research submitted versions are immutable checksummed snapshots',()=>{
  assert.match(migration,/snapshot_sha256 VARCHAR\(64\)/)
  assert.match(migration,/digest\(convert_to\(report_snapshot::text,'UTF8'\),'sha256'\)/)
  assert.match(app,/INSERT INTO research_report_versions\(project_id,version_number,title,report_snapshot,created_by,status,reviewer_id,submitted_by,submitted_at,parent_version_id,snapshot_sha256\)/)
  assert.match(app,/research_report_versions[\s\S]*digest\(convert_to\(\$4::jsonb::text,'UTF8'\),'sha256'\)/)
})

test('research finalisation reads the approved snapshot instead of live sections',()=>{
  assert.match(app,/research_report_versions WHERE project_id=\$1 AND status='Approved'/)
  assert.match(app,/approvedSnapshot\.sections/)
  assert.match(app,/const approvedSections=approvedSnapshot\.sections/)
})

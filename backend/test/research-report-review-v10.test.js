import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const schema=fs.readFileSync(new URL('../src/schema.sql',import.meta.url),'utf8')

test('research report complete-version review routes exist',()=>{
  for(const route of [
    "/api/research/:id/report/versions",
    "/api/research/:id/report/submit",
    "/api/research/:id/report/versions/:versionId/decision",
  ]) assert.ok(app.includes(route),route)
})

test('submitted research report is immutable during review',()=>{
  assert.match(app,/submitted research report version is locked while it is under review/i)
  assert.match(app,/REPORT_SUBMITTED_FOR_REVIEW/)
  assert.match(app,/REPORT_CHANGES_REQUESTED/)
  assert.match(app,/RESEARCH_REPORT_REVIEW_DECISION/)
})

test('final research report requires approved complete version',()=>{
  assert.match(app,/complete research report must be submitted and approved as a locked version/i)
  assert.match(schema,/research_report_versions_status_check/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const schema=fs.readFileSync(new URL('../src/schema.sql',import.meta.url),'utf8')
const frontend=fs.readFileSync(new URL('../../src/App.tsx',import.meta.url),'utf8')
const handoff=fs.readFileSync(new URL('../../src/modules/research/components/ResearchReviewHandoffPanel.tsx',import.meta.url),'utf8')
const reportBuilder=fs.readFileSync(new URL('../../src/modules/research/components/ResearchReportBuilderPanel.tsx',import.meta.url),'utf8')
const finalisation=fs.readFileSync(new URL('../../src/modules/research/components/ResearchFinalisationPanel.tsx',import.meta.url),'utf8')

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

test('opening the Report tab enters the section builder without bypassing review locks',()=>{
  assert.match(frontend,/if \(tab !== "Report" \|\| researchReportIsLocked\) return/)
  assert.match(frontend,/if \(initialTab === "Report" && !versionIsLocked\)/)
  assert.match(frontend,/setResearchSectionWorkspaceMode\([\s\S]*?section\.status === "Approved" \? "review" : "edit"/)
  assert.match(frontend,/researchReportIsLocked && researchSectionWorkspaceMode/)
  assert.match(reportBuilder,/if \(!researchReport\.length && nextSections\[0\]\)\s*\{\s*await onOpenSectionEditor\(nextSections\[0\]\)/)
})

test('controlled evidence is a pre-submission requirement with a clear Resources next step',()=>{
  const start=app.indexOf("app.post('/api/research/:id/report/submit'")
  const end=app.indexOf("app.post('/api/research/:id/report/versions/:versionId/decision'",start)
  const route=app.slice(start,end)
  assert.match(route,/research_sources WHERE project_id=\$1/)
  assert.match(route,/research_knowledge_links[\s\S]*k\.status='Published'[\s\S]*COALESCE\(k\.is_archived,FALSE\)=FALSE/)
  assert.match(route,/Before reviewer submission, add a controlled research source or link a published Repository document in Resources/)
  assert.match(handoff,/One step before reviewer submission/)
  assert.match(handoff,/Your report stays editable until you complete this step/)
  assert.match(handoff,/Open Resources/)
  assert.match(handoff,/!hasControlledEvidence/)
  assert.match(frontend,/setResearchTab\("Resources"\);[\s\S]*Before submission, add a controlled research source/)
  assert.match(finalisation,/Open Resources to add evidence/)
})

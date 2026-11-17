import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const app=fs.readFileSync('src/App.tsx','utf8')
const css=fs.readFileSync('src/documents.css','utf8')

test('Repository V3 makes work-source tabs primary without deleting legacy collections',()=>{
  assert.match(app,/repositoryPrimaryTabs = \["Tasks", "Assignments", "Research", "Published"\]/)
  assert.match(app,/Published \/ Final/)
  assert.match(app,/repositorySecondaryTabs = \["All Records", "Reports", "Drafts"\]/)
  for(const tab of ['All Records','Assignments','Tasks','Research','Reports','Drafts','Published'])assert.match(app,new RegExp(tab))
})

test('Repository V3 search and dates cover reviewer and updated activity',()=>{
  assert.match(app,/item\.reviewer_name \|\| ""/)
  assert.match(app,/item\.reviewed_by_name \|\| ""/)
  assert.match(app,/repositoryDateMs = new Date\(item\.updated_at \|\| item\.created_at\)/)
  assert.match(app,/Updated \{new Date\(item\.updated_at \|\| item\.created_at\)/)
})

test('Repository V3 surfaces reviewer governance without changing enforcement',()=>{
  assert.match(app,/repositoryReviewerRequiredCount/)
  assert.match(app,/Reviewer required/)
  assert.match(app,/repository-reviewer-gap-summary/)
  assert.match(css,/repository-reviewer-required/)
})

test('Repository V3 preserves the calm five-column record list and compact actions',()=>{
  for(const heading of ['Record','Context','Status','Governance','Actions'])assert.match(app,new RegExp(`<span>${heading}</span>`))
  assert.match(app,/Source: \{item\.source_type \|\| "App2 Upload"\}/)
  assert.match(app,/repository-accountability-compact/)
  assert.match(app,/canonical-document-actions/)
})

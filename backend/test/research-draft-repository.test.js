import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const api=fs.readFileSync(new URL('../../src/api.ts',import.meta.url),'utf8')
const ui=fs.readFileSync(new URL('../../src/App.tsx',import.meta.url),'utf8')
const repositoryModule=fs.readFileSync(new URL('../src/research-draft-repository.js',import.meta.url),'utf8')

test('explicit research Save Draft creates a governed repository version',()=>{
  assert.match(api,/persistDraft\?: boolean/)
  assert.match(ui,/saveResearchSectionDraft\(contentToSave, true\)/)
  assert.match(repositoryModule,/RESEARCH_DRAFT_SAVED_TO_REPOSITORY/)
  assert.match(repositoryModule,/document_type='Research Report Draft'/)
  assert.match(repositoryModule,/INSERT INTO knowledge_versions/)
  assert.match(repositoryModule,/repository_entity_links/)
})

test('research report workflow has progressive review and completion states',()=>{
  assert.match(app,/UPDATE research_projects SET status='Under Review'/)
  assert.match(app,/UPDATE research_projects SET status='Active'/)
  assert.match(app,/Only the approver who recorded the approval decision can generate this final research report/)
  assert.match(app,/UPDATE research_projects SET status='Completed'/)
  assert.match(app,/RESEARCH_DRAFT_ARCHIVED_AFTER_FINAL_PUBLICATION/)
})

test('repository draft is private working material and grants project-scoped access',()=>{
  assert.match(repositoryModule,/CURRENT_DATE,'Draft'/)
  assert.match(repositoryModule,/felix_enabled/)
  assert.match(repositoryModule,/FALSE,FALSE/)
  assert.match(repositoryModule,/document_permissions/)
  assert.match(app,/permission\.permission IN\('READ','WRITE'\)/)
})

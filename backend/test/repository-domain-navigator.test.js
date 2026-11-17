import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const component=readFileSync(new URL('../../src/modules/repository/RepositoryDomainNavigator.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../../src/modules/repository/repository-domain-navigator.css',import.meta.url),'utf8')
const app=readFileSync(new URL('../../src/App.tsx',import.meta.url),'utf8')

test('legacy repository navigator module remains available for compatibility',()=>{
  for(const label of ['Research','Assignments','Tasks','Other documents'])assert.match(component,new RegExp(`label: "${label}"`))
  assert.match(component,/api\.repositoryGroups\(token, domain\)/)
  assert.match(component,/final_report_available/)
  assert.match(component,/onOpenDocument\(document\.id\)/)
})

test('tabbed searchable Record Library replaces the permanently expanded navigator',()=>{
  assert.doesNotMatch(app,/<RepositoryDomainNavigator/)
  assert.match(app,/repository-library-tabs/)
  assert.match(app,/All Records/)
  assert.match(app,/Assignments/)
  assert.match(app,/Tasks/)
  assert.match(app,/Research/)
  assert.match(app,/Reports/)
  assert.match(app,/Drafts/)
  assert.match(app,/Published/)
})

test('repository governance controls remain integrated after navigator replacement',()=>{
  assert.match(app,/<RepositoryDeletionApprovalQueue/)
  assert.match(app,/<RepositoryReviewQueue/)
  assert.match(app,/repository-governance-drawer/)
})

test('legacy navigator stylesheet remains theme-safe for compatibility',()=>{
  assert.match(css,/var\(--surface-primary\)/)
  assert.match(css,/var\(--text-primary\)/)
  assert.match(css,/var\(--border-default\)/)
  assert.match(css,/@media\(max-width:760px\)/)
  assert.doesNotMatch(css,/font-size:(?:[0-9]|1[01])px/)
})

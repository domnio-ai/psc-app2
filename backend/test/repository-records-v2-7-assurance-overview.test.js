import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const backend=fs.readFileSync('backend/src/app.js','utf8')
const api=fs.readFileSync('src/api.ts','utf8')
const app=fs.readFileSync('src/App.tsx','utf8')
const panel=fs.readFileSync('src/modules/repository/components/RepositoryAssuranceOverview.tsx','utf8')
const css=fs.readFileSync('src/modules/repository/repository-assurance-overview-v2-7.css','utf8')

test('scoped assurance summary uses deterministic institutional labels',()=>{
  assert.match(backend,/\/api\/documents\/assurance-summary/)
  assert.match(backend,/managedUserIds/)
  assert.match(backend,/READY WITH MINOR ISSUES/)
  assert.match(backend,/SIGNIFICANT GAPS/)
})

test('overview API is typed',()=>{
  assert.match(api,/RepositoryAssuranceOverview/)
  assert.match(api,/repositoryAssuranceOverview/)
})

test('overview is collapsed until opened',()=>{
  assert.match(panel,/aria-expanded/)
  assert.match(panel,/\{open&&<div className="repository-assurance-overview-body">/)
})

test('assurance buckets filter the existing Record Library',()=>{
  assert.match(app,/repositoryAssuranceIds\.includes\(item\.id\)/)
  assert.match(app,/setRepositoryLibraryTab\("All Records"\)/)
  assert.match(app,/setRepositoryOperationalQueue\("All"\)/)
})

test('overview remains non-scoring and responsive',()=>{
  assert.match(panel,/not employee performance/)
  assert.match(css,/APP2 REPOSITORY V2\.7 - ASSURANCE OVERVIEW/)
  assert.match(css,/@media\(max-width:800px\)/)
})

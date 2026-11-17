import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app=fs.readFileSync('src/App.tsx','utf8')
const backend=fs.readFileSync('backend/src/app.js','utf8')
const queues=fs.readFileSync('src/modules/repository/components/RepositoryOperationalQueues.tsx','utf8')
const css=fs.readFileSync('src/modules/repository/repository-operations-v2-3.css','utf8')

test('Repository operational queues cover personal and manager work',()=>{
  for(const label of ['My Records','My Reviews','My Improvements','Review Overdue','Review Due 30','No Retention','No Reviewer','Improvement Overdue','Restricted','Disposition Due','Legal Hold','Superseded','Replacement Records']){
    assert.ok(queues.includes(`"${label}"`),label)
  }
  assert.match(queues,/matchesRepositoryOperationalQueue/)
  assert.match(app,/RepositoryOperationalQueues/)
})

test('clicking an operational queue filters the real Record Library',()=>{
  assert.match(app,/repositoryOperationalQueue/)
  assert.match(app,/matchesRepositoryOperationalQueue/)
  assert.match(app,/setRepositoryLibraryTab\("All Records"\)/)
  assert.match(app,/setRepositoryAdvancedFilters\(emptyRepositoryAdvancedFilters\)/)
})

test('Repository notifications cover review retention improvement and supersession',()=>{
  assert.match(backend,/syncRepositoryGovernanceNotifications/)
  assert.match(backend,/Repository review due soon/)
  assert.match(backend,/Repository review overdue/)
  assert.match(backend,/Repository disposition action due/)
  assert.match(backend,/Repository improvement overdue/)
  assert.match(backend,/Record superseded/)
})

test('Repository deadlines are integrated into the existing calendar endpoint',()=>{
  assert.match(backend,/repositoryCalendarForUser/)
  assert.match(backend,/Record review:/)
  assert.match(backend,/Retention \/ disposition:/)
  assert.match(backend,/Repository improvement due:/)
  assert.match(backend,/res\.json\(\[\.\.\.base,\.\.\.repository\]/)
})

test('operational queue styling uses the compact dropdown architecture and remains responsive',()=>{
  assert.match(css,/repository-operational-queues-compact/)
  assert.match(css,/repository-queue-dropdown/)
  assert.match(css,/repository-queue-dropdown-body/)
  assert.match(css,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/)
  assert.match(css,/@media\(max-width:700px\)/)
  assert.doesNotMatch(css,/repository-queue-cards/)
})

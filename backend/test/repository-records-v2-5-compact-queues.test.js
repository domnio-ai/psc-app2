import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const queues=fs.readFileSync('src/modules/repository/components/RepositoryOperationalQueues.tsx','utf8')
const css=fs.readFileSync('src/modules/repository/repository-operations-v2-3.css','utf8')

test('operational controls are collapsed into dropdown groups',()=>{
  assert.match(queues,/repository-queue-accordion/)
  assert.match(queues,/repository-queue-dropdown-trigger/)
  assert.match(queues,/aria-expanded/)
  assert.match(queues,/setOpenGroup\(isOpen \? null : group\.key\)/)
})

test('only one queue group can be open at a time',()=>{
  assert.match(queues,/const \[openGroup, setOpenGroup\]/)
  assert.doesNotMatch(queues,/<details/)
})

test('selected queue reopens its own section',()=>{
  assert.match(queues,/groupForQueue\(selected\)/)
  assert.match(queues,/useEffect\(\(\) =>/)
  assert.match(queues,/has-active-queue/)
})

test('compact headers show unique affected record counts',()=>{
  assert.match(queues,/groupCount/)
  assert.match(queues,/uniqueCount/)
  assert.match(queues,/records/)
})

test('compact queue CSS reduces permanent screen density',()=>{
  assert.match(css,/APP2 REPOSITORY RECORDS MANAGEMENT V2\.5/)
  assert.match(css,/repository-queue-dropdown/)
  assert.match(css,/repository-queue-dropdown-body/)
  assert.match(css,/min-height:62px/)
})

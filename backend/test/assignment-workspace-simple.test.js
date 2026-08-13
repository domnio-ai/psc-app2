import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

const frontend=readFileSync(new URL('../../src/App.tsx',import.meta.url),'utf8')
const api=readFileSync(new URL('../../src/api.ts',import.meta.url),'utf8')

test('assignment workspace exposes only the four primary navigation tabs',()=>{
  const start=frontend.indexOf('aria-label="Assignment workspace sections"')
  const workspace=frontend.slice(start,start+4500)
  for(const label of ['Overview','Tasks','Research & Documents','Activity'])assert.match(workspace,new RegExp(label.replace('&','&amp;|&')))
  for(const legacy of ['Task Reports','Structure & Plan','Discussion','Review'])assert.doesNotMatch(workspace,new RegExp(`label: "${legacy}"`))
})

test('assignment workspace reuses existing APIs for quick add and resources',()=>{
  for(const action of ['Task','Note','Document','Comment'])assert.match(frontend,new RegExp(`>${action}<`))
  assert.match(frontend,/linkKnowledgeToAssignment/)
  assert.match(api,/\/knowledge\/\$\{id\}\/assignments/)
  assert.match(frontend,/Assignment context: ID/)
})

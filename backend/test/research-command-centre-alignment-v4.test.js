import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd().endsWith(`${path.sep}backend`)?path.resolve(process.cwd(),'..'):process.cwd()
const read=(rel)=>fs.readFileSync(path.join(root,rel),'utf8')
const entry=read('src/modules/research/ResearchWorkspaceEntry.tsx')
const summary=read('src/modules/research/components/ResearchPortfolioSummary.tsx')
const css=read('src/modules/research/research-control-centre.css')
const app=read('src/App.tsx')

test('Research command centre keeps a compact operational hierarchy with deadline attention',()=>{
  assert.match(entry,/Research workspace/)
  assert.match(entry,/\$\{scopedResearch\.length\} in scope · \$\{currentScopeCount\} current · \$\{dueSoonCount\} due soon · \$\{overdueCount\} overdue/)
  assert.match(css,/grid-template-columns:\s*repeat\(4/)
  assert.match(css,/@media \(max-width: 980px\)/)
})

test('Research operational summary exposes eight governed clickable states',()=>{
  for(const label of ['Current Research','Active','Planning','Awaiting Review','Changes Requested','Ready to Publish','Due Soon','Overdue']){
    assert.match(summary,new RegExp(label))
  }
  assert.match(summary,/onClick=\{\(\) => onSelectFilter\(item\.filter, item\.label\)\}/)
})

test('Research sidebar badge uses authoritative live Pulse data',()=>{
  assert.match(app,/const navigationBadge =\s*Number\(pulse\.data\?\.badges\[label\] \|\| 0\)/)
  assert.match(app,/navigationBadge/)
  assert.doesNotMatch(app,/label === "Research Repository"\s*\?\s*researchRows\.filter/)
})

test('Research portfolio keeps authoritative scope counts and RBAC-backed scopes',()=>{
  assert.match(entry,/const myResearchCurrentCount = \(scopeRows\.my \|\| \[\]\)/)
  assert.match(entry,/const myReviewRows = scopeRows\.reviews \|\| \[\]/)
  assert.match(entry,/isManager\s*\?\s*\["my",\s*"team",\s*"reviews"\]\s*:\s*\["my",\s*"reviews"\]/)
})

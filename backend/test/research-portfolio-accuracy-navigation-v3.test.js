import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd().endsWith(`${path.sep}backend`)?path.resolve(process.cwd(),'..'):process.cwd()
const read=(rel)=>fs.readFileSync(path.join(root,rel),'utf8')
const entry=read('src/modules/research/ResearchWorkspaceEntry.tsx')
const summary=read('src/modules/research/components/ResearchPortfolioSummary.tsx')
const css=read('src/modules/research/research-control-centre.css')

test('current research card counts only governed current lifecycle states',()=>{
  assert.match(entry,/totalWorkspaces=\{currentScopeCount\}/)
  assert.match(entry,/currentResearchWorkflowStatuses\.has\(researchStatusOf\(item\)\)/)
  assert.doesNotMatch(entry,/totalWorkspaces=\{scopedResearch\.length\}/)
})

test('portfolio summary cards are actual accessible buttons and apply filters',()=>{
  assert.match(summary,/<button/)
  assert.doesNotMatch(summary,/App2Tooltip|title=/)
  assert.match(summary,/onSelectFilter\(item\.filter, item\.label\)/)
  assert.match(summary,/aria-pressed=/)
  assert.match(entry,/onSelectFilter=\{\(filter, title\) =>/)
  assert.match(entry,/setStatus\(filter\)/)
})

test('current filter maps to all current research lifecycle states',()=>{
  assert.match(entry,/status === "Current" && !currentResearchWorkflowStatuses\.has\(lifecycleStatus\)/)
  assert.match(entry,/item === "Current" \? "Current research"/)
})

test('scope tabs display authoritative counts instead of placeholder bullets',()=>{
  assert.match(entry,/const myResearchCurrentCount = \(scopeRows\.my \|\| \[\]\)/)
  assert.match(entry,/const myReviewRows = scopeRows\.reviews \|\| \[\]/)
  assert.match(entry,/\{myResearchCurrentCount\}/)
  assert.match(entry,/\{myReviewRows\.length\}/)
  assert.doesNotMatch(entry,/currentScopeCount : "•"/)
})

test('portfolio summary has interactive visual treatment',()=>{
  assert.match(css,/research-summary-card/)
  assert.match(css,/cursor:\s*pointer/)
  assert.doesNotMatch(css,/\.research-control-centre \.research-summary-card:hover\s*\{[^}]*transform:/s)
})

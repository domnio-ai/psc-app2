import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd().endsWith(`${path.sep}backend`)?path.resolve(process.cwd(),'..'):process.cwd()
const read=(rel)=>fs.readFileSync(path.join(root,rel),'utf8')
const entry=read('src/modules/research/ResearchWorkspaceEntry.tsx')
const row=read('src/modules/research/components/ResearchPortfolioListRow.tsx')
const css=read('src/modules/research/research-control-centre.css')

test('Research Workspaces opens on Current rather than All lifecycle records',()=>{
  assert.match(entry,/const \[status, setStatus\] = useState\("Current"\)/)
  assert.match(entry,/setStatus\(requestedMode === "Workspace" \? "Current" : "All"\)/)
  assert.match(entry,/setStatus\(next === "Workspace" \? "Current" : "All"\)/)
  assert.match(entry,/const changeScope = \(next: ResearchScopeView\) => \{[\s\S]*?setStatus\("Current"\)/)
})

test('existing App2Tabs source and scope controls receive the segmented visual hook',()=>{
  assert.match(entry,/className="research-control-mode research-control-mode-pro research-segmented-group"/)
  assert.match(entry,/className="research-scope-tabs research-scope-tabs-pro research-segmented-group"/)
  assert.match(entry,/ariaLabel="Research record type"/)
  assert.match(entry,/ariaLabel="Research access scope"/)
  assert.match(css,/Research Command Centre Final Polish V6 R3/)
})

test('actual V5 list-row markup receives stronger title and quieter status hooks',()=>{
  assert.match(row,/className="research-record-title"/)
  assert.match(row,/research-list-status-pill research-status-pill-compact/)
  assert.match(css,/\.research-control-centre \.research-record-title/)
  assert.match(css,/\.research-control-centre \.research-status-pill-compact/)
})

test('V5 unified-list architecture remains intact',()=>{
  assert.match(entry,/research-control-group-unified/)
  assert.match(entry,/records in this scope/)
  assert.doesNotMatch(entry,/groupedResearch/)
})

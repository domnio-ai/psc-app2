import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd().endsWith(`${path.sep}backend`)?path.resolve(process.cwd(),'..'):process.cwd()
const read=(rel)=>fs.readFileSync(path.join(root,rel),'utf8')
const entry=read('src/modules/research/ResearchWorkspaceEntry.tsx')
const row=read('src/modules/research/components/ResearchPortfolioListRow.tsx')
const css=read('src/modules/research/research-control-centre.css')

test('Research workspace uses one unified list instead of duplicate status sections',()=>{
  assert.match(entry,/research-control-group-unified/)
  assert.match(entry,/visibleResearch\.map\(\(project\) =>/)
  assert.doesNotMatch(entry,/groupedResearch/)
  assert.doesNotMatch(entry,/\$\{group\.status\} Research/)
})

test('operational cards remain the status drill-down mechanism',()=>{
  assert.match(entry,/onSelectFilter=\{\(filter, title\) =>/)
  assert.match(entry,/setStatus\(filter\)/)
  assert.match(entry,/status === "Current" \? "Current research"/)
})

test('result count explains that all visible records belong to the selected scope',()=>{
  assert.match(entry,/records in this scope/)
  assert.doesNotMatch(entry,/<span> results<\/span>/)
})

test('research row no longer displays Open to Open when dates are absent',()=>{
  assert.match(row,/Dates not set/)
  assert.match(row,/if \(!value\) return "Not set"/)
  assert.doesNotMatch(row,/if \(!value\) return "Open"/)
})

test('final visual layer keeps a compact Assignment-style hierarchy',()=>{
  assert.match(css,/Research Command Centre Final Cleanup V5/)
  assert.match(css,/research-command-centre-navigation/)
  assert.match(css,/research-control-group-unified/)
  assert.match(css,/research-portfolio-list-row-pro/)
})

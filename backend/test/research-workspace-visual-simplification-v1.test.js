import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd().endsWith(`${path.sep}backend`)?path.resolve(process.cwd(),'..'):process.cwd()
const read=(rel)=>fs.readFileSync(path.join(root,rel),'utf8')
const shell=read('src/modules/research/components/ResearchWorkspaceShell.tsx')
const overview=read('src/modules/research/overview/ResearchOverviewHome.tsx')
const activity=read('src/modules/research/components/ResearchActivityPanel.tsx')
const entry=read('src/modules/research/ResearchProjectWorkspaceEntry.tsx')
const css=read('src/modules/research/styles/research-workspace-visual-v1.css')

test('Research workspace shell is compact and keeps the six governed destinations',()=>{
  for(const label of ['Overview','Work','Resources','Report','Review','Activity']) {
    assert.match(shell,new RegExp(`"${label}"`))
  }
  assert.doesNotMatch(shell,/STEP \{currentIndex \+ 1\} OF/)
  assert.doesNotMatch(shell,/research-workflow-strip/)
  assert.match(shell,/research-workspace-tabs-compact/)
  assert.match(shell,/research-context-strip/)
})

test('Overview keeps essential research facts without the former teaching and repetition blocks',()=>{
  assert.match(overview,/research-overview-essentials/)
  assert.match(overview,/RESEARCH QUESTION/)
  assert.match(overview,/OBJECTIVES/)
  assert.match(overview,/METHODOLOGY/)
  assert.match(overview,/ACCOUNTABILITY/)
  assert.match(overview,/Team & responsibilities/)
  assert.match(overview,/Research brief/)
  assert.match(overview,/Felix research advice/)
  assert.doesNotMatch(overview,/What this means:/)
  assert.doesNotMatch(overview,/BEFORE YOU CONTINUE/)
  assert.doesNotMatch(overview,/Example:/)
})

test('Activity is timeline-first rather than repeating workspace dashboard metrics',()=>{
  assert.match(activity,/Project history/)
  assert.match(activity,/research-activity-timeline/)
  assert.doesNotMatch(activity,/research-activity-summary/)
  assert.doesNotMatch(activity,/TOTAL RECORDED EVENTS/)
  assert.doesNotMatch(activity,/Audit integrity/)
})

test('Visual layer is loaded by the Research workspace entry and remains presentation-only',()=>{
  assert.match(entry,/research-workspace-visual-v1\.css/)
  assert.match(css,/Presentation only: no workflow, API, RBAC, review or persistence rules/)
})

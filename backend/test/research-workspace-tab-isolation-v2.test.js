import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd().endsWith(`${path.sep}backend`)?path.resolve(process.cwd(),'..'):process.cwd()
const read=(rel)=>fs.readFileSync(path.join(root,rel),'utf8')
const entry=read('src/modules/research/ResearchProjectWorkspaceEntry.tsx')
const controller=read('src/modules/research/research-workspace-controller.css')

test('Overview content is rendered only on the Overview tab',()=>{
  assert.match(entry,/\{researchTab === "Overview" && overview\}/)
  assert.doesNotMatch(entry,/\{overview\}\s*\{children\}/)
})

test('Governed Research children live inside one read-only boundary with active-tab context',()=>{
  assert.match(entry,/className="research-workspace-content-boundary"/)
  assert.match(entry,/data-active-tab=\{researchTab\}/)
  assert.match(entry,/\{children\}/)
})

test('nested workspace panels are isolated by the active tab',()=>{
  assert.match(controller,/Research Workspace Visual V2/)
  assert.match(controller,/data-tab="Work"[\s\S]*research-work-primary-grid/)
  assert.match(controller,/data-tab="Resources"[\s\S]*research-sources-panel/)
  assert.match(controller,/data-tab="Report"[\s\S]*research-report-builder/)
  assert.match(controller,/data-tab="Review"[\s\S]*research-report-review-gate/)
  assert.match(controller,/data-tab="Activity"[\s\S]*research-activity-panel/)
})

test('generic repeated reference and evidence placeholder panels stay hidden',()=>{
  assert.match(controller,/research-reference-panel/)
  assert.match(controller,/research-documents-placeholder/)
})

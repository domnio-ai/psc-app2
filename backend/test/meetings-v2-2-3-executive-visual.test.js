import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root=path.resolve(process.cwd())
const workspace=fs.readFileSync(path.join(root,'src/modules/meetings/MeetingsWorkspace.tsx'),'utf8')
const css=fs.readFileSync(path.join(root,'src/modules/meetings/meetings.css'),'utf8')

test('Meetings V2.2.3 gives all six command cards an explicit executive gradient identity',()=>{
  assert.match(css,/Meetings V2\.2\.3 - Executive visual refinement/)
  assert.match(css,/\.meetings-summary-cards\.meetings-command-cards\{grid-template-columns:repeat\(3/)
  for(let i=1;i<=6;i++) assert.match(css,new RegExp(`button:nth-child\\(${i}\\)`))
})

test('Meetings V2.2.3 register has complete action heading and governed empty-state CTA',()=>{
  assert.match(workspace,/<span>Action<\/span>/)
  assert.match(workspace,/No meetings scheduled yet/)
  assert.match(workspace,/\+ Schedule meeting/)
  assert.match(workspace,/Clear filters/)
})

test('Meetings V2.2.3 keeps responsive command-centre layout inside Meetings scope',()=>{
  assert.match(css,/@media\(max-width:1040px\)/)
  assert.match(css,/\.meetings-empty-v223/)
  assert.doesNotMatch(css,/\.dashboard(?!-content\.meetings-active)/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd().endsWith(`${path.sep}backend`)?path.resolve(process.cwd(),'..'):process.cwd()
const read=(rel)=>fs.readFileSync(path.join(root,rel),'utf8')
const command=read('src/modules/assignments/AssignmentsCommandCentre.tsx')
const portfolio=read('src/modules/assignments/AssignmentsPortfolio.tsx')
const entry=read('src/modules/assignments/AssignmentsControlCentreEntry.tsx')
const css=read('src/modules/assignments/assignment-portfolio-visual-v1.css')

test('assignment command centre exposes one compact operational KPI layer',()=>{
  assert.match(command,/assignments-command-centre-compact/)
  assert.match(command,/module-kpi-strip-compact/)
  for(const label of ['Active Assignments','Active Tasks','Due Soon','Overdue','Awaiting Review','Final Report Pending']){
    assert.match(command,new RegExp(label))
  }
  assert.doesNotMatch(command,/What needs intervention now/)
  assert.doesNotMatch(command,/Current delivery pressure/)
})

test('KPI cards retain drill-down behaviour',()=>{
  assert.match(command,/openFocusPopup\("Active"\)/)
  assert.match(command,/openFocusPopup\("Due Soon"\)/)
  assert.match(command,/openFocusPopup\("Overdue"\)/)
  assert.match(command,/openFocusPopup\("Awaiting Review"\)/)
  assert.match(command,/openFocusPopup\("Final Report Pending"\)/)
  assert.match(command,/Show in portfolio/)
})

test('portfolio keeps working views and collapses secondary filters',()=>{
  for(const view of ['List','Cards','Board','Calendar','Workload']){
    assert.match(portfolio,new RegExp(`"${view}"`))
  }
  assert.match(portfolio,/assignment-filters-compact/)
  assert.match(portfolio,/assignment-advanced-filters/)
  assert.match(portfolio,/advancedFilterCount/)
  assert.doesNotMatch(portfolio,/Institutional work portfolio/)
})

test('visual layer is presentation-only and loaded after existing assignment styles',()=>{
  assert.match(entry,/assignment-portfolio-visual-v1\.css/)
  assert.match(css,/Presentation only: workflow, API, RBAC, review and persistence contracts are unchanged/)
  assert.match(css,/module-command-grid/)
  assert.match(css,/assignment-advanced-filter-grid/)
})

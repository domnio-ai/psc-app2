import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8')
const backend=read('../src/app.js')
const app=read('../../src/App.tsx')
const researchWizard=read('../../src/modules/research/components/ResearchCreationWizard.tsx')
const researchCreation=`${app}\n${researchWizard}`
const policy=read('../../src/DateInputPolicy.tsx')

test('App2 mounts one shared policy for current and dynamically opened date controls',()=>{
  assert.match(app,/import DateInputPolicy from "\.\/DateInputPolicy"/)
  assert.match(app,/<DateInputPolicy \/>/)
  assert.match(policy,/MutationObserver/)
  assert.match(policy,/input\[type="date"\],input\[type="datetime-local"\]/)
})

test('operational dates cannot precede today and end dates inherit start minimum',()=>{
  assert.match(policy,/operationalPattern/)
  assert.match(policy,/input\.min=minimum/)
  assert.match(policy,/start\?\.value&&start\.value>minimum/)
  assert.match(backend,/refine\(value=>value>=nairobiToday\(\),'Date cannot be before today\.'/)
  assert.match(backend,/Due date cannot be before the start date\./)
  assert.match(backend,/Completion date cannot be before the start date\./)
})

test('date text entry paste and drop are blocked while native picker remains available',()=>{
  assert.match(policy,/keydown[\s\S]*preventDefault/)
  assert.match(policy,/addEventListener\('paste',preventManual,true\)/)
  assert.match(policy,/addEventListener\('drop',preventManual,true\)/)
  assert.match(policy,/showPicker\(\)/)
})

test('historical analytical filters remain available without weakening operational dates',()=>{
  assert.match(policy,/dataset\.datePolicy==='historical'/)
  assert.match(policy,/!operationalPattern\.test\(text\)/)
})

test('backend date governance covers assignments tasks sections research milestones reviews notices and calendar events',()=>{
  for(const marker of ['assignmentSchema','assignmentTaskSchema','assignmentSectionBaseSchema','researchSchema','researchPlanSchema','researchMilestoneSchema','reviewDueDate:governedDate','noticeSchema','calendarEventSchema'])assert.match(backend,new RegExp(marker))
})

test('research creation reports failures and opens the successfully created workspace',()=>{
  assert.match(app,/setResearchCreateNotice\(error instanceof Error \? error\.message/)
  assert.match(app,/await openResearchWorkspace\(created\)/)
  assert.match(researchCreation,/researchCreating \? "Creating project\.\.\."/)
  assert.match(backend,/timeZone:'Africa\/Nairobi'/)
})

test('research creation and activation require a complete brief with start and finish dates',()=>{
  assert.match(backend,/startDate:governedDate\.unwrap\(\),endDate:governedDate\.unwrap\(\)/)
  assert.match(backend,/Complete the Research Brief, including valid start and finish dates, before starting the project\./)
  assert.match(researchCreation,/Complete the research brief, accountable lead, start date and finish date before creating the project\./)
  assert.match(researchCreation,/const researchTimelineComplete =/)
  assert.match(researchCreation,/researchForm\.endDate >= researchForm\.startDate/)
  assert.match(researchCreation,/researchCreating \|\| !researchBriefComplete \|\| !researchForm\.leadId \|\| !researchTimelineComplete/)
})

test('research wizard explains incomplete fields instead of silently disabling Continue',()=>{
  assert.match(researchCreation,/const researchBriefMissing =/)
  assert.match(researchCreation,/Needs: \$\{researchBriefMissing\.join\(", "\)\}/)
  assert.match(researchCreation,/Complete these fields before continuing:/)
  assert.doesNotMatch(researchCreation,/className="primary"\s+type="button"\s+disabled=\{\s*researchFormStep === 1/)
})

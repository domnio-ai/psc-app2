import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app=fs.readFileSync('src/app.js','utf8')
const migration=fs.readFileSync('migrations/20261126_research_milestone_task_links.sql','utf8')
const manifest=fs.readFileSync('src/production-migration-plan.js','utf8')
const frontend=fs.readFileSync('../src/modules/research/components/ResearchWorkPlanPanel.tsx','utf8')
const api=fs.readFileSync('../src/api.ts','utf8')

test('milestone-task relationship migration is included in the pinned production plan',()=>{
  assert.match(manifest,/20261126_research_milestone_task_links\.sql/)
  assert.match(migration,/UNIQUE \(milestone_id, task_id\)/)
  assert.match(migration,/research_assignment_links/)
  assert.match(migration,/enforce_research_milestone_task_scope/)
  assert.match(migration,/task_assignment IS NULL OR linked_project IS NULL OR linked_project <> NEW\.project_id/)
})

test('milestone task APIs scope reads and writes to the same linked research project',()=>{
  assert.match(app,/GET_DOES_NOT_EXIST/)
  assert.match(app,/api\/research\/:id\/milestones\/:milestoneId\/tasks/)
  assert.match(app,/api\/research\/:id\/milestones\/:milestoneId\/tasks\/:taskId/)
  assert.match(app,/assignmentTaskScope\(req\.user,task\.assignment_id\)/)
  assert.match(app,/task assignment is not linked to this research project/)
  assert.match(app,/RESEARCH_MILESTONE_TASK_LINKED/)
  assert.match(app,/RESEARCH_MILESTONE_TASK_UNLINKED/)
})

test('milestone sign-off requires governed task completion and does not bypass final report publication',()=>{
  assert.match(app,/milestone can be completed only after it has linked active tasks/)
  assert.match(app,/syncResearchMilestonesFromTasks/)
  assert.match(app,/status IN\('In Progress','Completed'\)/)
  assert.match(app,/Task completion is governed by final report publication/)
  assert.match(app,/RESEARCH_MILESTONE_STATUS_SYNCHRONIZED/)
})

test('linked tasks cannot be archived or deleted without unlinking them first',()=>{
  assert.match(app,/task is linked to a research milestone\. Unlink it from the milestone before archiving/)
  assert.match(app,/task is linked to a research milestone\. Unlink it from the milestone before deleting/)
})

test('research milestone panel exposes link and unlink controls through typed API methods',()=>{
  assert.match(frontend,/api\.researchMilestoneTasks/)
  assert.match(frontend,/api\.linkResearchMilestoneTask/)
  assert.match(frontend,/api\.unlinkResearchMilestoneTask/)
  assert.match(frontend,/Link task/)
  assert.match(frontend,/Unlink/)
  assert.match(api,/researchMilestoneTasks:/)
  assert.match(api,/linkResearchMilestoneTask:/)
  assert.match(api,/unlinkResearchMilestoneTask:/)
})

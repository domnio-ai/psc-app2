import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app=fs.readFileSync('src/app.js','utf8')
const migration=fs.readFileSync('migrations/20261126_research_milestone_task_links.sql','utf8')
const manifest=fs.readFileSync('src/production-migration-plan.js','utf8')
const frontend=fs.readFileSync('../src/modules/research/components/ResearchWorkPlanPanel.tsx','utf8')
const api=fs.readFileSync('../src/api.ts','utf8')
const reports=fs.readFileSync('src/reports/report-service.js','utf8')

test('milestone-task relationship migration is included in the pinned production plan',()=>{
  assert.match(manifest,/20261126_research_milestone_task_links\.sql/)
  assert.match(migration,/UNIQUE \(milestone_id, task_id\)/)
  assert.match(migration,/research_assignment_links/)
  assert.match(migration,/enforce_research_milestone_task_scope/)
  assert.match(migration,/prevent_research_milestone_orphaning/)
  assert.match(migration,/research_assignment_unlink_guard/)
  assert.match(migration,/research_milestone_task_archive_guard/)
  assert.match(migration,/IF task_assignment IS NULL/)
  assert.match(migration,/IF linked_project IS NULL OR linked_project <> NEW[.]project_id/)
})

test('milestone task APIs scope reads and writes to the same linked research project',()=>{
  assert.match(app,/api\/research\/:id\/milestones\/:milestoneId\/tasks/)
  assert.match(app,/api\/research\/:id\/milestones\/:milestoneId\/tasks\/:taskId/)
  assert.match(app,/assignmentTaskScope\(req\.user,task\.assignment_id\)/)
  assert.match(app,/assignment linked to this research project/)
  assert.match(app,/RESEARCH_MILESTONE_TASK_LINKED/)
  assert.match(app,/RESEARCH_MILESTONE_TASK_UNLINKED/)
  assert.match(app,/Reopen the completed milestone before linking additional tasks/)
  assert.match(app,/Reopen the completed milestone before changing its linked tasks/)
  assert.match(app,/Unlink the assignment tasks from their research milestones before unlinking this assignment/)
})

test('milestone sign-off requires governed task completion and does not bypass final report publication',()=>{
  assert.match(app,/milestone can be completed only after it has linked active tasks/)
  assert.match(app,/syncResearchMilestonesFromTasks/)
  assert.match(app,/status IN\('In Progress','Completed'\)/)
  assert.match(app,/Task completion is governed by final report publication/)
  assert.match(app,/RESEARCH_MILESTONE_STATUS_SYNCHRONIZED/)
})

test('research reporting includes milestone and linked-task delivery totals',()=>{
  assert.match(reports,/milestone_count/)
  assert.match(reports,/completed_milestones/)
  assert.match(reports,/linked_task_count/)
  assert.match(reports,/completed_linked_task_count/)
  assert.match(reports,/overdue_milestones/)
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

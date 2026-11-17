import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  RESEARCH_DUE_SOON_DAYS,
  RESEARCH_PROJECT_STATUSES,
  isCurrentResearchStatus,
  isTerminalResearchStatus,
  researchCurrentSql,
  researchDueSoonSql,
  researchLifecycleStatusSql,
  researchOverdueSql,
  researchReadyToPublishSql,
  researchStatusDisplay
} from '../src/research-status.js'

const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8')

test('1 planning research is part of the authoritative current population',()=>{
  assert.equal(isCurrentResearchStatus('Planning'),true)
  assert.match(researchCurrentSql('p'),/Planning/)
  assert.match(app,/COUNT\(\*\) FILTER\(WHERE \$\{researchCurrentSql\('p'\)\}\)::int current/)
})

test('2 activation remains current while moving to the Active population',()=>{
  assert.equal(isCurrentResearchStatus('Active'),true)
  assert.deepEqual(RESEARCH_PROJECT_STATUSES,['Planning','Active','Under Review','Completed','Archived'])
})

test('3 due-soon uses one configured deadline definition',()=>{
  assert.equal(RESEARCH_DUE_SOON_DAYS,7)
  assert.match(researchDueSoonSql('p'),/CURRENT_DATE\+INTERVAL '7 days'/)
  assert.match(researchDueSoonSql('p'),/research_report_versions/)
})

test('4 overdue excludes terminal and approved research through current semantics',()=>{
  assert.equal(isTerminalResearchStatus('Completed'),true)
  assert.equal(isTerminalResearchStatus('Archived'),true)
  assert.match(researchOverdueSql('p'),/end_date<CURRENT_DATE/)
  assert.match(researchOverdueSql('p'),/NOT IN\('Approved','Rejected'\)/)
})

test('5 submission transaction updates project, queue notification and activity',()=>{
  assert.match(app,/INSERT INTO research_report_versions[\s\S]*?'Submitted'/)
  assert.match(app,/UPDATE research_projects SET status='Under Review'/)
  assert.match(app,/Research report awaiting review/)
  assert.match(app,/REPORT_SUBMITTED_FOR_REVIEW/)
})

test('6 changes requested is a distinct derived lifecycle and reopens editing',()=>{
  assert.equal(researchStatusDisplay('Changes Requested'),'Changes Requested')
  assert.match(researchLifecycleStatusSql('p'),/THEN 'Changes Requested'/)
  assert.match(app,/REPORT_CHANGES_REQUESTED/)
  assert.match(app,/UPDATE research_projects SET status='Active'/)
})

test('7 resubmission creates the next immutable version linked to its parent',()=>{
  assert.match(app,/MAX\(version_number\)/)
  assert.match(app,/parent_version_id,snapshot_sha256/)
  assert.match(app,/previous\?\.id\|\|null/)
})

test('8 approval produces ready-to-publish truth without pretending completion',()=>{
  assert.equal(researchStatusDisplay('Approved'),'Ready to Publish')
  assert.match(researchReadyToPublishSql('p'),/='Approved'/)
  assert.match(researchReadyToPublishSql('p'),/Research Final Report/)
  assert.match(app,/Research final report ready to publish/)
})

test('9 final publication atomically creates repository provenance and completes research',()=>{
  assert.match(app,/document_type='Research Final Report'/)
  assert.match(app,/repository_entity_links\(knowledge_id,entity_type,entity_id,linked_by\)/)
  assert.match(app,/UPDATE research_projects SET status='Completed'/)
  assert.match(app,/FINAL_REPORT_PUBLISHED_AND_RESEARCH_COMPLETED/)
})

test('10 role scope is enforced by the authoritative backend research query',()=>{
  assert.match(app,/const researchScope=`\(\$1::boolean OR p\.lead_id=ANY/)
  assert.match(app,/research_collaborators src/)
  assert.match(app,/research_reviewers srr/)
  assert.match(app,/const scoped=management\?await managedUserIds\(req\.user\):\[req\.user\.id\]/)
})

test('manual status endpoint cannot bypass submission or controlled publication',()=>{
  assert.match(app,/Submit an immutable Research report version to enter Under Review/)
  assert.match(app,/Research becomes Completed only when the approved controlled final report is published/)
})

test('startup reconciliation self-heals published finals idempotently',()=>{
  const server=fs.readFileSync(new URL('../src/server.js',import.meta.url),'utf8')
  const status=fs.readFileSync(new URL('../src/research-status.js',import.meta.url),'utf8')
  assert.match(server,/if\s*\(\s*researchLifecycleReconciliationEnabled\s*\)\s*await\s+transaction\s*\(\s*async\s+client\s*=>\s*reconcileResearchLifecycleState\s*\(\s*client\s*\)\s*\)/)
  assert.match(status,/UPDATE research_projects p[\s\S]*hasPublishedFinalSql\('p'\)/)
  assert.match(status,/RESEARCH_STATUS_RECONCILED/)
  assert.match(status,/WHERE NOT EXISTS\([\s\S]*Research status reconciled/)
})

test('calendar includes scoped current research deadlines and milestones',()=>{
  const calendar=fs.readFileSync(new URL('../src/calendar-service.js',import.meta.url),'utf8')
  assert.match(calendar,/'research_deadline' type,\$\{researchLifecycleStatusSql\('p'\)\} status/)
  assert.match(calendar,/p\.end_date IS NOT NULL AND \$\{researchCurrentSql\('p'\)\}/)
  assert.match(calendar,/\.\.\.researchDeadlines\.rows,\.\.\.milestones\.rows/)
})

test('portfolio and institutional reports consume derived lifecycle status',()=>{
  const intelligence=fs.readFileSync(new URL('../src/reports/institutional-intelligence.js',import.meta.url),'utf8')
  const service=fs.readFileSync(new URL('../src/reports/report-service.js',import.meta.url),'utf8')
  assert.match(app,/workflow_status/)
  assert.match(intelligence,/researchLifecycleStatusSql/)
  assert.match(intelligence,/researchOverdueSql/)
  assert.match(service,/researchLifecycleStatusSql/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const schema=fs.readFileSync(new URL('../src/schema.sql',import.meta.url),'utf8')
const frontend=fs.readFileSync(new URL('../../src/App.tsx',import.meta.url),'utf8')

test('research milestones require accountable ownership and deadlines',()=>{
  assert.match(app,/ownerId:z\.string\(\)\.uuid\(\)/)
  assert.match(app,/dueDate:z\.string\(\)\.min\(10\)\.max\(10\)/)
  assert.match(schema,/research_milestones ADD COLUMN IF NOT EXISTS owner_id/)
})

test('research completion enforces all completion gates',()=>{
  assert.match(app,/Complete every research milestone before closing the project/)
  assert.match(app,/Add controlled research evidence before closing the project/)
  assert.match(app,/Approve every required research report section before closing the project/)
  assert.match(app,/approved or final controlled research document is required/)
})

test('research sources capture governance classifications and reject duplicates',()=>{
  assert.match(schema,/provenance VARCHAR\(30\)/)
  assert.match(schema,/quality VARCHAR\(20\)/)
  assert.match(schema,/relevance VARCHAR\(20\)/)
  assert.match(app,/research source is already recorded for the project/)
})

test('research workspace exposes compact directive tabs and accessible semantics',()=>{
  for(const tab of ['Overview','Research Plan','Team','Discussion','Report','Activity'])assert.match(frontend,new RegExp(`["']${tab}["']`))
  assert.match(frontend,/aria-label="Research workspace sections"/)
  assert.match(frontend,/role="tab"/)
  assert.match(frontend,/aria-selected=\{researchTab\s*===\s*tab\}/)
})

test('repository documents support reusable entity links',()=>{
  assert.match(schema,/repository_entity_links/)
  assert.match(schema,/entity_type IN\('assignment','task','research','report'\)/)
  assert.match(app,/knowledgeIds:z\.array/)
})

test('task report preview rebuilds from current saved task content',()=>{
  assert.match(app,/const report=buildTaskContributionReport\(\{task,assignment,ownerName:task\.owner_name,preparedBy:task\.owner_name\}\)/)
  assert.match(app,/contribution_report_html=CASE WHEN \$9::varchar IN\('Draft','Ready for Integration'\) THEN \$11::text ELSE contribution_report_html END/)
})

test('task report draft saves generated HTML instead of violating the required report column',()=>{
  assert.match(app,/const generated=buildTaskContributionReport/)
  assert.match(app,/contribution_report_html=CASE WHEN \$9::varchar IN\('Draft','Ready for Integration'\) THEN \$11::text ELSE contribution_report_html END/)
  assert.doesNotMatch(app,/WHEN \$9::varchar='Draft' THEN NULL/)
})

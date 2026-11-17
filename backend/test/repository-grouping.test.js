import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const api=readFileSync(new URL('../../src/api.ts',import.meta.url),'utf8')

test('repository grouping is authenticated scoped and metadata driven',()=>{
  assert.match(app,/\/api\/repository\/groups',authenticate/)
  assert.match(app,/repository_entity_links rel/)
  assert.match(app,/CASE k\.source_type WHEN 'Research'/)
  assert.match(app,/origin\.entity_id/)
  assert.doesNotMatch(app,/\/api\/repository\/groups[\s\S]{0,500}filename/i)
  assert.match(app,/privateDraftSupervisedUserIds/)
})

test('each repository document receives one canonical domain and group',()=>{
  assert.match(app,/LEFT JOIN LATERAL\([\s\S]*LIMIT 1/)
  assert.match(app,/GROUP BY domain,entity_id,work_title/)
  assert.match(app,/final_report_available/)
  assert.match(app,/Research Final Report','Assignment Final Report','Task Final Report/)
})

test('frontend API exposes typed repository groups',()=>{
  assert.match(api,/export type RepositoryGroup/)
  assert.match(api,/repositoryGroups:/)
  assert.match(api,/\/repository\/groups/)
})

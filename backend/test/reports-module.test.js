import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {getReportDefinition,reportCategories,reportRegistry} from '../src/reports/report-registry.js'
import {canAccessReport,reportPermissions,reportScope} from '../src/reports/report-service.js'

const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const service=fs.readFileSync(new URL('../src/reports/report-service.js',import.meta.url),'utf8')
const schema=fs.readFileSync(new URL('../src/schema.sql',import.meta.url),'utf8')
const frontend=fs.readFileSync(new URL('../../src/ReportsModule.tsx',import.meta.url),'utf8')
const user=(role,division='Research & Policy',id='11111111-1111-1111-1111-111111111111')=>({id,role,division})

test('report catalogue uses a centralized registry with required categories',()=>{
  assert.ok(reportRegistry.size>=50)
  for(const category of ['Assignments','Performance','Workload','Strategic','Research','Knowledge & Documents','Felix / AI','Audit & Compliance','Management'])assert.ok(reportCategories.includes(category))
  for(const key of ['assignment-status','overdue-ageing','workload-distribution','directorate-performance','executive-performance-overview','research-outputs','document-repository-activity','felix-usage-quality'])assert.equal(getReportDefinition(key)?.available,true)
})

test('operational and executive visibility follows role permissions',()=>{
  assert.ok(canAccessReport(user('Research Officer'),getReportDefinition('assignment-status')))
  assert.equal(canAccessReport(user('Research Officer'),getReportDefinition('executive-performance-overview')),false)
  assert.ok(canAccessReport(user('Research Manager'),getReportDefinition('executive-performance-overview')))
  assert.ok(reportPermissions(user('Administrator')).includes('VIEW_AUDIT_REPORTS'))
  assert.equal(reportPermissions(user('Reviewer')).includes('VIEW_AUDIT_REPORTS'),false)
})

test('data scope separates organisation, directorate and own work',()=>{
  assert.equal(reportScope(user('Administrator')).type,'ORGANISATION')
  assert.deepEqual(reportScope(user('Reviewer','Quality Assurance')),{type:'DIRECTORATE',division:'Quality Assurance',userId:null})
  assert.equal(reportScope(user('Research Officer')).type,'OWN')
  assert.match(service,/Requested directorate is outside your permitted scope/)
  assert.match(service,/EXISTS\(SELECT 1 FROM assignment_members/)
})

test('KPI definitions use actual assignment lifecycle fields',()=>{
  assert.match(service,/status\s*=\s*["'`]Completed/)
  assert.match(service,/status<>["'`]Completed["'`] AND due_date<CURRENT_DATE/)
  assert.match(service,/Average turnaround/)
  assert.match(service,/completed_at-created_at/)
  assert.match(service,/CURRENT_DATE-due_date/)
})

test('report APIs, pagination, favourites and invalid report handling are wired',()=>{
  for(const route of ['/api/reports','/api/reports/categories','/api/reports/:key/data','/api/reports/:key/favourite'])assert.ok(app.includes(route))
  assert.match(schema,/user_report_favourites/)
  assert.match(service,/Report not found/)
  assert.match(service,/pageSize\s*=\s*Math\.min\(100/)
})

test('frontend supplies list, card, filters, graphs, drill-down and detailed table',()=>{
  for(const marker of ['report-catalogue-${view.toLowerCase()}','Apply filters','ReportVisual','drill(','ReportTable','Favourites'])assert.ok(frontend.includes(marker))
})

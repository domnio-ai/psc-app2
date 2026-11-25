import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import dotenv from 'dotenv'
import {getReportDefinition,reportCategories,reportRegistry} from '../src/reports/report-registry.js'
dotenv.config({path:'backend/.env'})
const {canAccessReport,reportPermissions,reportScope}=await import('../src/reports/report-service.js')

const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const routes=fs.readFileSync(new URL('../src/reports/report-routes.js',import.meta.url),'utf8')
const service=fs.readFileSync(new URL('../src/reports/report-service.js',import.meta.url),'utf8')
const schema=fs.readFileSync(new URL('../src/schema.sql',import.meta.url),'utf8')
const frontend=fs.readFileSync(new URL('../../src/modules/reports/ReportsModule.tsx',import.meta.url),'utf8')
const user=(role,division='Research & Policy',id='11111111-1111-1111-1111-111111111111')=>({id,role,division})

test('report catalogue uses a centralized registry with required categories',()=>{
  assert.ok(reportRegistry.size>=50)
  for(const category of ['Assignments','Performance','Workload','Strategic','Research','Knowledge & Documents','Felix / AI','Audit & Compliance','Management'])assert.ok(reportCategories.includes(category))
  for(const key of ['assignment-status','overdue-ageing','workload-distribution','directorate-performance','executive-performance-overview','research-outputs','document-repository-activity','felix-usage-quality'])assert.equal(getReportDefinition(key)?.available,true)
})

test('operational and executive visibility follows role permissions',()=>{
  assert.ok(canAccessReport(user('Researcher'),getReportDefinition('assignment-status')))
  assert.equal(canAccessReport(user('Researcher'),getReportDefinition('executive-performance-overview')),false)
  assert.ok(canAccessReport(user('Deputy Director'),getReportDefinition('executive-performance-overview')))
  assert.ok(reportPermissions(user('System Admin')).includes('VIEW_AUDIT_REPORTS'))
  assert.equal(reportPermissions(user('Reviewer')).includes('VIEW_AUDIT_REPORTS'),false)
})

test('data scope separates organisation, directorate and own work',()=>{
  assert.equal(reportScope(user('System Admin')).type,'ORGANISATION')
  assert.deepEqual(reportScope(user('Reviewer','Quality Assurance')),{type:'OWN',division:'Quality Assurance',userId:'11111111-1111-1111-1111-111111111111'})
  assert.equal(reportScope(user('Researcher')).type,'OWN')
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
  assert.match(app,/registerReportRoutes\(app/)
  for(const route of ['/api/reports','/api/reports/categories','/api/reports/:key/data','/api/reports/:key/favourite'])assert.ok(routes.includes(route))
  assert.match(schema,/user_report_favourites/)
  assert.match(service,/Report not found/)
  assert.match(service,/pageSize\s*=\s*Math\.min\(100/)
})

test('frontend supplies list, card, filters, graphs, drill-down and detailed table',()=>{
  const catalogue=fs.readFileSync(new URL('../../src/modules/reports/components/ReportCataloguePanel.tsx',import.meta.url),'utf8')
  const table=fs.readFileSync(new URL('../../src/modules/reports/components/ReportTable.tsx',import.meta.url),'utf8')
  const visual=fs.readFileSync(new URL('../../src/modules/reports/components/ReportVisual.tsx',import.meta.url),'utf8')
  for(const marker of ['ReportCataloguePanel','ReportVisual','ReportTable','drill(','Apply filters'])assert.ok(frontend.includes(marker),marker)
  assert.match(catalogue,/Favourites/)
  assert.match(table,/<table/)
  assert.match(visual,/<svg/)
})

test('leave, meetings and notice readership reports use their authoritative workflow records',()=>{
  for(const category of ['Workforce','Meetings','Notices'])assert.ok(reportCategories.includes(category));
  for(const key of ['leave-utilisation','meeting-delivery','notice-readership'])assert.equal(getReportDefinition(key)?.available,true);
  for(const key of ['leave-utilisation','meeting-delivery','notice-readership'])assert.ok(canAccessReport(user('Researcher'),getReportDefinition(key)));
  for(const source of ['FROM leave_requests lr JOIN users u','FROM meetings m JOIN users creator','meeting_minutes','meeting_decisions','meeting_actions',"entity_type='notice'",'BOOL_OR(read_at IS NOT NULL)'])assert.ok(service.includes(source),source);
  assert.ok(service.includes('per-user notice notification read receipts'));
  assert.ok(service.includes('does not provide an acknowledgement register'));
});

test('new operational reports enforce own and managed-team record scope in SQL',()=>{
  assert.ok(service.includes('AND lr.user_id=$'));
  assert.ok(service.includes('AND lr.user_id IN " + teamUserIds'));
  assert.ok(service.includes('m.created_by IN " + managed'));
  assert.ok(service.includes('ns.user_id IN " + managed'));
  assert.ok(service.includes('Requested directorate is outside your permitted scope'));
});

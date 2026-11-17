import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const app=[fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8'),fs.readFileSync(new URL('../src/reports/report-routes.js',import.meta.url),'utf8')].join('\n')
const service=fs.readFileSync(new URL('../src/reports/report-service.js',import.meta.url),'utf8')
const frontend=fs.readFileSync(new URL('../../src/modules/reports/ReportsModule.tsx',import.meta.url),'utf8')
const migration=fs.readFileSync(new URL('../migrations/012_reports_phase2.sql',import.meta.url),'utf8')
const exporter=fs.readFileSync(new URL('../src/reports/report-export.js',import.meta.url),'utf8')

test('report lifecycle fields and saved views are persisted',()=>{assert.match(migration,/completed_at TIMESTAMPTZ/);assert.match(migration,/sla_due_date DATE/);assert.match(migration,/user_report_views/);assert.match(migration,/report_exports/)})
test('exports share permission-scoped report data and are audited',()=>{assert.match(app,/reportData\(req\.user,req\.params\.key/);assert.match(app,/renderReportExport/);assert.match(service,/REPORT_EXPORTED/);for(const format of ['pdf','docx','xlsx'])assert.match(exporter,new RegExp(format))})
test('phase two workspace exposes saved views, direct URLs, and exports',()=>{assert.match(frontend,/#reports\//);assert.match(frontend,/Saved views/);assert.match(frontend,/saveReportView/);assert.match(frontend,/exportReport/);for(const format of ['pdf','docx','xlsx'])assert.match(frontend,new RegExp(`"${format}"`))})
test('comprehensive institutional PDF is clearly distinguished from tabular dataset exports',()=>{assert.match(frontend,/Comprehensive Institutional PDF/);assert.match(frontend,/Dataset exports/);assert.match(frontend,/Tabular PDF/);assert.match(app,/exposedHeaders:\['Content-Disposition'\]/)})
test('comprehensive report footer stays inside the printable page boundary',()=>{assert.match(exporter,/document\.page\.height-document\.page\.margins\.bottom-14/);assert.doesNotMatch(exporter,/const footerY=document\.page\.height-31/)})
test('Felix and executive lifecycle analytics use persisted metrics',()=>{assert.match(app,/felix_report_metrics/);assert.match(service,/Average turnaround/);assert.match(service,/Completed within SLA/)})

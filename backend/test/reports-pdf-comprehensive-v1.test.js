import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'

const service=fs.readFileSync(new URL('../src/reports/report-service.js',import.meta.url),'utf8')
const routes=fs.readFileSync(new URL('../src/reports/report-routes.js',import.meta.url),'utf8')
const exporter=fs.readFileSync(new URL('../src/reports/report-export.js',import.meta.url),'utf8')
const studio=fs.readFileSync(new URL('../../src/modules/reports/components/ReportPdfStudio.tsx',import.meta.url),'utf8')
const dashboard=fs.readFileSync(new URL('../../src/modules/reports/pages/InstitutionalReportsDashboard.tsx',import.meta.url),'utf8')
const reportsModule=fs.readFileSync(new URL('../../src/modules/reports/ReportsModule.tsx',import.meta.url),'utf8')

test('report exports request the full bounded dataset instead of the dashboard page',()=>{
  assert.match(service,/REPORT_EXPORT_MAX_ROWS = 25_000/)
  assert.match(service,/pageSize = Math\.min\(100, Math\.max\(10, Number\(input\.pageSize\) \|\| 25\)\)/)
  assert.match(service,/if \(maxPageSize > 100\)/)
  assert.match(service,/Math\.min\(allowedPageSize, Math\.max\(10, Number\(input\.pageSize\) \|\| 25\)\)/)
  assert.match(routes,/rowLimit=profile==='brief'\?100:REPORT_EXPORT_MAX_ROWS/)
  assert.match(routes,/pageSize:rowLimit/)
  assert.match(routes,/\{maxPageSize:rowLimit\}/)
})

test('oversized exports fail clearly and the comprehensive PDF appends every allowed selected-report row',()=>{
  assert.match(routes,/totalRows>REPORT_EXPORT_MAX_ROWS/)
  assert.match(routes,/status\(413\)/)
  assert.match(routes,/Narrow the reporting period or filters to create a complete export/)
  assert.match(exporter,/Underlying governed records'[\s\S]*maxRows:MAX_EXPORT_ROWS/)
  assert.doesNotMatch(exporter,/Appendix limited to the first 1,000 governed records/)
})

test('PDF Studio exposes report customization and passes bounded title and paper options to the PDF renderer',()=>{
  assert.match(reportsModule,/id:"Reports & Exports",label:"Reports & Exports"/)
  assert.match(dashboard,/reportCentreView==='PDF Studio & Packs'&&<><div className="report-studio-pack-grid"><ReportPdfStudio/)
  assert.match(dashboard,/idPrefix="reports-centre"/)
  assert.match(studio,/Document title/)
  assert.match(studio,/Management brief/)
  assert.match(studio,/Comprehensive institutional report/)
  assert.match(studio,/Paper size/)
  assert.match(studio,/Generate and download PDF/)
  assert.match(routes,/req\.query\.title\.replace/)
  assert.match(routes,/\['A4','Letter'\]/)
  assert.match(exporter,/model\.paperSize==='Letter'\?'LETTER':'A4'/)
})

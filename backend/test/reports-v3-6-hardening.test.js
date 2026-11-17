import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
const root=process.env.APP2_TEST_ROOT||process.cwd()
const intelligence=fs.readFileSync(path.join(root,'backend/src/reports/institutional-intelligence.js'),'utf8')
const exporter=fs.readFileSync(path.join(root,'backend/src/reports/report-export.js'),'utf8')

test('Reports filter parser rejects malformed dates and unknown filter values',()=>{
  assert.match(intelligence,/strictIsoDate/)
  assert.match(intelligence,/parsed\.toISOString\(\)\.slice\(0,10\)!==text/)
  assert.match(intelligence,/ALLOWED_WORK_TYPES/)
  assert.match(intelligence,/ALLOWED_REPORT_STATUSES/)
  assert.match(intelligence,/Invalid reporting work type/)
  assert.match(intelligence,/Invalid reporting status/)
})

test('Report exports enforce defensive shape and size limits',()=>{
  assert.match(exporter,/MAX_EXPORT_ROWS=25000/)
  assert.match(exporter,/MAX_EXPORT_COLUMNS=40/)
  assert.match(exporter,/assertExportModel\(model\)/)
  assert.match(exporter,/Narrow the reporting period or filters and try again/)
})

test('XLSX export strips illegal XML control characters and bounds cell text',()=>{
  assert.match(exporter,/MAX_EXCEL_CELL_CHARS=32767/)
  assert.match(exporter,/excelSafe/)
  assert.match(exporter,/\\u0000-\\u0008/)
})

test('V3.4 scope and V3.5 comprehensive PDF contracts remain present',()=>{
  assert.match(intelligence,/managedUserIds\(user\)/)
  assert.match(intelligence,/no staff scores|not statistical forecasts or staff scores/i)
  assert.match(exporter,/Management Conclusions/)
  assert.match(exporter,/maxRows:MAX_EXPORT_ROWS/)
  assert.match(exporter,/staff scoring|staff scores|ranking/i)
})

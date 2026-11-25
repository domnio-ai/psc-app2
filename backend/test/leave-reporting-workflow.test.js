import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8')
const registry=read('../src/reports/report-registry.js')
const service=read('../src/reports/report-service.js')
const ui=read('../../src/modules/reports/ReportsModule.tsx')
const migrationPlan=read('../src/production-migration-plan.js')
const providerStart=service.indexOf('async function leaveUtilisation(')
const providerEnd=service.indexOf('\nconst providers = {',providerStart)
const provider=service.slice(providerStart,providerEnd)

test('leave register and utilisation is registered as a live Workforce report',()=>{
  assert.match(registry,/"Workforce"/)
  assert.match(registry,/["']leave-register-utilisation["']\s*:\s*\{/)
  assert.match(registry,/title:\s*"Leave Register & Utilisation"/)
  assert.match(registry,/permission:\s*"VIEW_OPERATIONAL_REPORTS"/)
  assert.match(registry,/provider:\s*"leaveUtilisation"/)
  assert.match(service,/leaveUtilisation,\s*\}/)
})

test('leave report uses the existing organisation, team and self reporting scope',()=>{
  assert.ok(providerStart>=0,'leaveUtilisation provider must exist')
  assert.match(provider,/userScopeSql\(scope,\s*"u"\)/)
  assert.match(provider,/JOIN users u ON u\.id=lr\.user_id/)
  assert.match(provider,/LEFT JOIN users approver ON approver\.id=lr\.approver_id/)
  assert.match(provider,/filters\.division/)
  assert.match(provider,/filters\.status/)
  assert.match(provider,/filters\.category/)
})

test('leave utilisation allocates cross-year requests to weekdays in the selected date range',()=>{
  assert.match(provider,/lr\.end_date >= \$" \+ fromIndex/)
  assert.match(provider,/lr\.start_date <= \$" \+ toIndex/)
  assert.match(provider,/GREATEST\(lr\.start_date,COALESCE\(\$/)
  assert.match(provider,/LEAST\(lr\.end_date,COALESCE\(\$/)
  assert.match(provider,/generate_series/)
  assert.match(provider,/EXTRACT\(ISODOW FROM leave_day\.day\)<6/)
  assert.match(provider,/SUM\(period_working_days\) FILTER\(WHERE status='Approved'\)/)
})

test('leave reporting keeps private reasons and supporting-document metadata out of report rows',()=>{
  assert.doesNotMatch(provider,/lr\.reason|lr\.decision_note|stored_path|original_filename|sha256/)
  assert.match(provider,/Leave reasons and supporting-document details are intentionally excluded/)
  assert.match(provider,/Public holidays are not deducted/)
})

test('leave report returns paginated source records and status/type charts for existing exporters',()=>{
  assert.match(provider,/paginate\(/)
  assert.match(provider,/chart\("leave-status"/)
  assert.match(provider,/chart\("leave-type"/)
  assert.match(provider,/request_working_days/)
  assert.match(provider,/period_working_days/)
  assert.match(service,/providers\[definition\.provider\]/)
})

test('Reports UI exposes leave type and leave-specific status filters',()=>{
  assert.match(ui,/selected\.filters\.includes\("leave_type"\)/)
  assert.match(ui,/Search by leave type name or code/)
  assert.match(ui,/selected\.key === "leave-register-utilisation"/)
  assert.match(ui,/Cancelled/)
  assert.match(ui,/Approved/)
})

test('the leave source schema is pinned in the production migration plan',()=>{
  assert.match(migrationPlan,/\['044_users_leave_management\.sql'/)
})

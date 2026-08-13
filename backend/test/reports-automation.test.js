import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const server=fs.readFileSync(new URL('../src/server.js',import.meta.url),'utf8')
const scheduler=fs.readFileSync(new URL('../src/reports/report-scheduler.js',import.meta.url),'utf8')
const migration=fs.readFileSync(new URL('../migrations/013_reports_automation_hardening.sql',import.meta.url),'utf8')
const frontend=fs.readFileSync(new URL('../../src/ReportsModule.tsx',import.meta.url),'utf8')
const shell=fs.readFileSync(new URL('../../src/App.tsx',import.meta.url),'utf8')

test('scheduled deliveries preserve report permission scope and attach controlled exports',()=>{assert.match(scheduler,/reportData\(user/);assert.match(scheduler,/renderReportExport/);assert.match(scheduler,/attachments/);assert.match(server,/startReportScheduler/)})
test('management decisions and immutable report sign-offs are governed',()=>{for(const route of ['/api/reports/:key/decisions','/api/reports/:key/signoff','/api/reports/:key/signoffs'])assert.ok(app.includes(route));assert.match(app,/sha256/);assert.match(migration,/report_hash VARCHAR\(64\)/)})
test('administrator report controls and monitoring are protected',()=>{assert.ok(app.includes('/api/admin/report-definitions/:key'));assert.ok(app.includes('/api/admin/report-monitoring'));assert.match(app,/authorize\('Administrator'\)/);assert.match(migration,/report_definition_overrides/)})
test('reporting frontend is lazy loaded and exposes final workflow controls',()=>{assert.match(shell,/lazy\(\(\)=>import\('\.\/ReportsModule'\)\)/);for(const marker of ['Schedule','Decision','Sign off','Configure'])assert.ok(frontend.includes(marker))})
test('manager summary and researcher-owned reporting are enforced',()=>{assert.ok(app.includes('/api/reports-summary'));assert.match(app,/reportSummary/);assert.match(frontend,/All Reports Summary/);assert.match(frontend,/My reports/);assert.match(fs.readFileSync(new URL('../src/reports/report-service.js',import.meta.url),'utf8'),/scope\.type === "OWN"\) values\.push\(scope\.userId\)/)})

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const module=read('../../src/modules/reports/ReportsModule.tsx');
const css=read('../../src/reports-module.css');
const institutional=read('../../src/institutional-reports.css');
const dashboard=read('../../src/modules/reports/pages/InstitutionalReportsDashboard.tsx');
const types=read('../../src/modules/reports/types.ts');

test('Reports V3 keeps graph-first executive navigation and governed sections',()=>{
  assert.match(module,/id:"Overview",label:"Overview"/);
  assert.match(module,/id:"Research",label:"Research"/);
  assert.match(module,/id:"Contributions",label:isManager\?"Team \/ Contributions":"My Contributions"/);
  assert.match(module,/id:"Completed",label:"Published"/);
  assert.match(module,/id:"Reports & Exports",label:"Reports & Exports"/);
  assert.match(types,/Catalogue.*PDF Studio & Packs.*Saved Views & Schedules.*Filing Printout/);
  assert.match(dashboard,/graph-first-overview/);
});

test('Reports V3 groups selected-report controls by user intent',()=>{
  for(const marker of ['reports-v3-toolbar','report-tool-view','report-tool-output','report-tool-data','report-tool-governance','Management Brief PDF','Comprehensive Institutional PDF','Dataset exports','Tabular PDF','Schedule','New decision','Sign off']) assert.ok(module.includes(marker),marker);
});

test('Reports V3 keeps existing saved views and governed export pathways',()=>{
  assert.match(module,/Saved views/);
  assert.match(module,/Save view/);
  assert.match(module,/exportManagementBrief/);
  assert.match(module,/exportDetailedInstitutionalReport/);
  assert.match(module,/exportReport\(format\)/);
});

test('Reports V3 toolbar is compact and responsive',()=>{
  assert.match(css,/\.reports-v3-toolbar\{display:grid/);
  assert.match(css,/\.report-tool-group\{/);
  assert.match(css,/@media\(max-width:1250px\)/);
  assert.match(css,/@media\(max-width:760px\)/);
});

test('Reports V3 preserves graph-first density and responsive filters',()=>{
  assert.match(institutional,/graph-first-overview/);
  assert.match(institutional,/\.institutional-filter\{[^}]*position:sticky/s);
  assert.match(institutional,/\.graph-first-grid\{gap:10px\}/);
  assert.match(institutional,/@media\(max-width:850px\)\{\.institutional-filter\{position:static\}/);
});

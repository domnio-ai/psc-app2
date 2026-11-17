import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildPulse} from '../src/pulse-model.js';

const source=fs.readFileSync(new URL('../../src/modules/dashboard/ProgressiveDashboard.tsx',import.meta.url),'utf8');

function row(overrides={}){
  return {id:'1',title:'Work item',status:'In Progress',module:'Tasks',type:'Task',destination:'Tasks',owned:true,...overrides};
}

test('explicit backend needsAction becomes first-class dashboard attention',()=>{
  const pulse=buildPulse([row({id:'report-1',module:'Reports & Analytics',type:'Report',destination:'Reports & Analytics',status:'In Progress',needsAction:true})],[],[],new Date('2026-09-13T12:00:00+03:00'));
  assert.equal(pulse.attention.length,1);
  assert.ok(pulse.attention[0].buckets.includes('Action Required'));
  assert.ok(pulse.attention[0].buckets.includes('Needs Attention'));
  assert.equal(pulse.cardCounts['Needs My Attention'],1);
});

test('approved item without explicit next action remains out of attention',()=>{
  const pulse=buildPulse([row({id:'report-2',module:'Reports & Analytics',type:'Report',destination:'Reports & Analytics',status:'Approved',needsAction:false})],[],[],new Date('2026-09-13T12:00:00+03:00'));
  assert.equal(pulse.attention.length,0);
});

test('owned ready-to-publish research stays actionable until publication',()=>{
  const pulse=buildPulse([row({id:'research-1',module:'Research Repository',type:'Research Project',destination:'Research Repository',status:'Ready to Publish'})],[],[],new Date('2026-09-13T12:00:00+03:00'));
  assert.equal(pulse.attention.length,1);
  assert.ok(pulse.attention[0].buckets.includes('Ready to Publish'));
  assert.ok(pulse.attention[0].buckets.includes('Needs Attention'));
});

test('manager-visible research not owned by current user is not personal attention',()=>{
  const pulse=buildPulse([row({id:'research-2',module:'Research Repository',type:'Research Project',destination:'Research Repository',status:'Ready to Publish',owned:false})],[],[],new Date('2026-09-13T12:00:00+03:00'));
  assert.equal(pulse.attention.length,0);
});

test('attention UI exposes actionable buckets through the scoped chooser',()=>{
  assert.match(source,/Needs My Attention'\s*:\s*\['All','Newly Assigned','Overdue','Due Soon','Returned to Me','My Reviews'\]/);
  assert.match(source,/attentionFilterLabels=module==='Needs My Attention'\?\[\.\.\.\(filters\[module\]\|\|\['All'\]\),'Action Required','Ready to Publish'\]/);
  assert.match(source,/openModuleActionPicker/);
  assert.match(source,/items:recordItems/);
  assert.doesNotMatch(source,/dashboardPreviewGuidance|complete publication|pulse-inline-preview/);
});

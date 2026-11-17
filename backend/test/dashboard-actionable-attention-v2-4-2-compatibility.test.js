import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPulse} from '../src/pulse-model.js';

const row=(module,id,status,extra={})=>({id,title:`${module}-${id}`,status,dueDate:'2026-09-10',module,type:module,destination:module,...extra});

test('terminal and approved records cannot re-enter Needs My Attention through stale needsAction flags',()=>{
  const now=new Date('2026-09-13T09:00:00+03:00');
  const pulse=buildPulse([
    row('Reports & Analytics','approved','Approved',{owned:true,needsAction:true}),
    row('Tasks','done','Completed',{owned:true,needsAction:true}),
    row('Document Repository','published','Published',{owned:true,needsAction:true}),
    row('Assignments','closed','Closed',{owned:true,needsAction:true}),
  ],[],[],now);
  assert.equal(pulse.attention.length,0);
  for(const item of pulse.attention){
    assert.ok(!item.buckets.includes('Action Required'));
  }
});

test('needsAction still promotes genuinely open work into Action Required',()=>{
  const now=new Date('2026-09-13T09:00:00+03:00');
  const pulse=buildPulse([row('Tasks','open','In Progress',{owned:true,needsAction:true})],[],[],now);
  assert.equal(pulse.attention.length,1);
  assert.ok(pulse.attention[0].buckets.includes('Action Required'));
  assert.ok(pulse.attention[0].buckets.includes('Needs Attention'));
});

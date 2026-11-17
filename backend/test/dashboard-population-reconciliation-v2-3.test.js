import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildPulse} from '../src/pulse-model.js';

const dashboard=fs.readFileSync('src/modules/dashboard/ProgressiveDashboard.tsx','utf8');
const app=fs.readFileSync('src/App.tsx','utf8');
const service=fs.readFileSync('backend/src/pulse-service.js','utf8');
const model=fs.readFileSync('backend/src/pulse-model.js','utf8');

test('card counts are generated once from the exact scoped pulse snapshot',()=>{
  const records=[
    {id:'a1',title:'Assignment 1',status:'In Progress',module:'Assignments',type:'Assignment',destination:'Assignments',owned:true},
    {id:'t1',title:'Task 1',status:'Assigned',module:'Tasks',type:'Task',destination:'Tasks',owned:true},
    {id:'r1',title:'Research 1',status:'Ready to Publish',module:'Research Repository',type:'Research Project',destination:'Research Repository',owned:true},
    {id:'rv1',title:'Review 1',status:'Under Review',module:'Reviews & Approvals',type:'Review',destination:'Research Repository',myReview:true,needsAction:true},
    {id:'u1',title:'User 1',status:'Researcher',module:'Team & Users',type:'User',destination:'Team & Users'},
  ];
  const notifications=[
    {id:'n1',title:'Unread',body:'x',entity_type:'task',entity_id:'t1',created_at:'2026-09-13T10:00:00Z',read_at:null,archived_at:null},
    {id:'n2',title:'Read',body:'x',entity_type:'task',entity_id:'t2',created_at:'2026-09-13T09:00:00Z',read_at:'2026-09-13T09:30:00Z',archived_at:null},
  ];
  const calendar=[{id:'c1',title:'Future',type:'task',status:'In Progress',start_at:'2026-09-20T08:00:00Z'}];
  const pulse=buildPulse(records,notifications,calendar,new Date('2026-09-13T12:00:00Z'));
  assert.equal(pulse.cardCounts.Assignments,pulse.modules.Assignments.counts.All);
  assert.equal(pulse.cardCounts.Tasks,pulse.modules.Tasks.counts.All);
  assert.equal(pulse.cardCounts['Research Repository'],pulse.modules['Research Repository'].counts.All);
  assert.equal(pulse.cardCounts['Reviews & Approvals'],pulse.modules['Reviews & Approvals'].counts.All);
  assert.equal(pulse.cardCounts.Notifications,pulse.unread.length);
  assert.equal(pulse.cardCounts.Calendar,pulse.calendar.length);
  assert.equal(pulse.cardCounts['Team & Users'],pulse.modules['Team & Users'].counts.All);
});

test('dashboard landing consumes the authoritative card count contract',()=>{
  assert.match(dashboard,/data\.cardCounts\?\.\[m\]/);
  assert.match(dashboard,/Current governed research, including ready to publish/);
  assert.match(dashboard,/scheduled ·/);
});

test('sidebar consumes the same authoritative card count contract',()=>{
  assert.match(app,/pulse\.data\?\.cardCounts\?\.\[label\]/);
  assert.match(app,/label === "Notifications"[\s\S]*pulse\.data\?\.unread\.length/);
});

test('ready-to-publish research remains populated on the operational dashboard',()=>{
  assert.match(service,/researchReadyToPublishSql/);
  assert.match(service,/researchCurrentSql\('p'\)[\s\S]*researchReadyToPublishSql\('p'\)/);
});

test('model exposes the canonical count contract in the pulse payload',()=>{
  for(const label of ['Needs My Attention','Assignments','Tasks','Research Repository','Reviews & Approvals','Notifications','Calendar','Reports & Analytics','Team & Users']){
    assert.ok(model.includes(`'${label}'`)||model.includes(`${label}:`),label);
  }
});

import test from 'node:test';import assert from 'node:assert/strict';
import {buildPulse,unreadNotifications} from '../src/pulse-model.js';
const now=new Date('2026-09-12T08:00:00Z');
const task=(id,status='In Progress',dueDate='2026-09-11')=>({id,module:'Tasks',type:'Task',status,dueDate});
test('counts reconcile with all drilldown records beyond the former 40/60 row limits',()=>{
 const p=buildPulse(Array.from({length:125},(_,i)=>task(String(i))),[],[],now);
 assert.equal(p.modules.Tasks.counts.All,125);assert.equal(p.modules.Tasks.counts.Overdue,125);
 for(const [bucket,count] of Object.entries(p.modules.Tasks.counts))assert.equal(count,p.modules.Tasks.rows.filter(r=>r.buckets.includes(bucket)).length);
});
test('closed work never becomes overdue and deadline boundaries use Nairobi days',()=>{
 const p=buildPulse([task('a','Completed'),task('b','In Progress','2026-09-11T22:00:00Z'),task('c','In Progress','2026-09-19'),task('d','In Progress','2026-09-20')],[],[],now);
 assert.equal(p.modules.Tasks.counts.Overdue,0);assert.equal(p.modules.Tasks.counts['Almost Due'],2);
});
test('unread emphasis collapses repeated entity updates and excludes archived/read items',()=>{
 const ns=[{id:'1',entity_type:'task',entity_id:'x'},{id:'2',entity_type:'task',entity_id:'x'},{id:'3',entity_type:'notice',entity_id:'x',read_at:'y'},{id:'4',entity_type:'task',entity_id:'z',archived_at:'y'}];
 assert.equal(unreadNotifications(ns).length,1);const p=buildPulse([],ns,[],now);assert.equal(p.badges.Tasks,1);assert.equal(p.badges.Notifications,1);
});
test('calendar Today and Next 7 days are disjoint; past meetings are not overdue work',()=>{
 const c=[{id:'1',type:'task',status:'In Progress',start_at:'2026-09-12'},{id:'2',type:'custom_event',status:'Meeting',start_at:'2026-09-11'},{id:'3',type:'task',status:'In Progress',start_at:'2026-09-19'},{id:'4',type:'task',status:'Completed',start_at:'2026-09-11'},{id:'5',type:'task',status:'In Progress',start_at:'2026-09-10'}];
 assert.deepEqual(buildPulse([],[],c,now).calendarCounts,{Today:1,'Next 7 days':1,'Past Due':1});
});

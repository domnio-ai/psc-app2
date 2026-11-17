import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const view=fs.readFileSync(path.join(root,'src','CalendarView.tsx'),'utf8');
const css=fs.readFileSync(path.join(root,'src','calendar.css'),'utf8');

test('calendar exposes operational filter groups',()=>{
  for(const label of ['All','Delivery','Research','Reviews','Notices','Leave','Events']) assert.match(view,new RegExp(`['\"]${label}['\"]`));
  assert.match(view,/calendar-filter-chips/);
  assert.match(view,/Search calendar/);
});

test('calendar planning summary includes workload and leave awareness',()=>{
  assert.match(view,/MONTH ACTIVITY/);
  assert.match(view,/NEXT 7 DAYS/);
  assert.match(view,/ON LEAVE NOW/);
  assert.match(view,/UPCOMING LEAVE/);
});

test('approved leave remains read-only calendar information',()=>{
  assert.match(view,/type!==['\"]leave['\"]/);
  assert.match(view,/Approved leave/);
  assert.match(view,/working_days/);
  assert.match(view,/Ends /);
});

test('calendar keeps existing governed create and edit event flow',()=>{
  assert.match(view,/api\.createCalendarEvent/);
  assert.match(view,/api\.updateCalendarEvent/);
  assert.match(view,/api\.deleteCalendarEvent/);
  assert.match(view,/can_manage/);
});

test('calendar visual system supports leave and responsive planning controls',()=>{
  assert.match(css,/calendar-planning-summary/);
  assert.match(css,/calendar-filter-bar/);
  assert.match(css,/calendar-legend \.leave:before/);
  assert.match(css,/calendar-grid>button small\.leave/);
  assert.match(css,/calendar-upcoming-panel/);
});

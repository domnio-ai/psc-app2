import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const leave=readFileSync('backend/src/users/leave-management.js','utf8');
const calendar=readFileSync('backend/src/calendar-service.js','utf8');
const pulse=readFileSync('backend/src/pulse-service.js','utf8');
const dashboard=readFileSync('src/modules/dashboard/ProgressiveDashboard.tsx','utf8');

test('team dashboard keeps role identity while exposing authoritative leave availability',()=>{
  assert.match(pulse,/u\.role status,u\.role,CASE WHEN current_leave\.id IS NOT NULL THEN 'On Leave' ELSE u\.status END "availabilityStatus"/);
  assert.match(pulse,/lr\.status='Approved' AND CURRENT_DATE BETWEEN lr\.start_date AND lr\.end_date/);
  assert.match(pulse,/"currentlyOnLeave"/);
  assert.match(dashboard,/'Team & Users':\['All','On Leave','Available','Busy','Away','Researcher','Assistant Director','Deputy Director','Director','System Admin'\]/);
  assert.match(dashboard,/const teamUserMatches=/);
  assert.match(dashboard,/person\.availabilityStatus===label\|\|person\.role===label/);
  assert.match(dashboard,/module==='Team & Users'\?teamUserCounts:counts/);
  assert.match(dashboard,/targetModule==='Team & Users'\?sourceRows\.filter\(row=>teamUserMatches/);
  assert.doesNotMatch(dashboard,/setBucket|dashboard-drilldown-records/);
});

test('calendar leave rows carry employee, type, duration and current-state metadata',()=>{
  assert.match(calendar,/lr\.user_id,lt\.name leave_type_name,u\.name user_name,lr\.working_days/);
  assert.match(calendar,/CURRENT_DATE BETWEEN lr\.start_date AND lr\.end_date THEN TRUE ELSE FALSE END currently_on_leave/);
  assert.match(calendar,/CASE WHEN lr\.user_id=\$3 THEN 'My approved leave' ELSE 'Approved team absence' END description/);
});

test('leave cancellation notifies the other side of the workflow and remains audited',()=>{
  assert.match(leave,/Leave request cancelled'/);
  assert.match(leave,/employee\.supervisor_id/);
  assert.match(leave,/Leave request cancelled by manager/);
  assert.match(leave,/await notify\(client,row\.user_id/);
  assert.match(leave,/LEAVE_REQUEST_CANCELLED/);
});

test('R2.3 introduces no new leave migration or alternate leave state source',()=>{
  assert.doesNotMatch(pulse,/UPDATE leave_requests/);
  assert.doesNotMatch(calendar,/UPDATE leave_requests/);
  assert.match(pulse,/FROM leave_requests lr JOIN leave_types lt/);
});

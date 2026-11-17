import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const panel=fs.readFileSync('src/modules/reviews/ReviewsApprovalsWorkspace.tsx','utf8');
const queue=fs.readFileSync('src/modules/reviews/LeaveApprovalQueue.tsx','utf8');
const css=fs.readFileSync('src/modules/reviews/leave-approval-queue.css','utf8');

test('Reviews and Approvals owns the single actionable leave decision queue',()=>{
  assert.match(panel,/<LeaveApprovalQueue/);
  assert.match(queue,/UNIVERSAL APPROVAL QUEUE/);
  assert.match(queue,/Leave requests awaiting my decision/);
  assert.match(queue,/isManager/);
});
test('manager action center counts pending decisions and keeps review history visible',()=>{
  assert.match(panel,/reviews\.length \+ leaveApprovalCount \+ meetingApprovalCount/);
  assert.match(panel,/MY REVIEW HISTORY/);
  assert.match(panel,/FINALISATION PENDING/);
  assert.match(panel,/combinedHistory/);
});
test('pending leave decisions expose the established approve, return and reject actions',()=>{
  assert.match(queue,/decide\(row, "Approved"\)/);
  assert.match(queue,/decide\(row, "Returned"\)/);
  assert.match(queue,/decide\(row, "Rejected"\)/);
  assert.match(queue,/await api\.decideLeaveRequest/);
});
test('leave approval queue limits decisions to requests in the manager feed and excludes self',()=>{
  assert.match(queue,/rows\.filter\(\(row\) => row\.status === "Pending" && row\.user_id !== currentUserId\)/);
  assert.match(queue,/api\.leaveRequests\(token\)/);
  assert.doesNotMatch(queue,/fetch\(/);
});
test('approval decision queue remains responsive and compact',()=>{
  assert.match(css,/\.universal-leave-queue/);
  assert.match(css,/@media\s*\(max-width:\s*760px\)/);
});

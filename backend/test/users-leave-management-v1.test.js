import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const app=readFileSync("backend/src/app.js","utf8"),scope=readFileSync("backend/src/scope.js","utf8"),calendar=readFileSync("backend/src/calendar-service.js","utf8"),migration=readFileSync("backend/migrations/044_users_leave_management.sql","utf8"),attachmentMigration=readFileSync("backend/migrations/20261125_01_leave_request_attachments.sql","utf8"),leave=readFileSync("backend/src/users/leave-management.js","utf8"),api=readFileSync("src/api.ts","utf8"),ui=readFileSync("src/App.tsx","utf8"),panel=readFileSync("src/modules/users/UserLeaveManagement.tsx","utf8");
test("leave governance schema and policy foundation exist",()=>{assert.match(migration,/leave_types/);assert.match(migration,/leave_requests/);assert.match(migration,/Annual Leave',30/);assert.match(migration,/Pending','Approved','Returned','Rejected','Cancelled/)});
test("manager team editing and password reset are scope protected",()=>{assert.match(app,/You may edit only users inside your authorised reporting scope/);assert.match(app,/You may reset passwords only for users inside your authorised reporting scope/);assert.match(app,/const admin=req\.user\.role==='System Admin'/);assert.match(app,/Use Change Password for your own account/)});
test("leave approval forbids self approval and emits audits",()=>{assert.match(leave,/A manager cannot approve or reject their own leave request/);assert.match(leave,/LEAVE_REQUEST_SUBMITTED/);assert.match(leave,/LEAVE_REQUEST_DECIDED/);assert.match(leave,/canManageUser/)});
test("approved leave changes availability, calendar and assignment allocation",()=>{assert.match(app,/availability_status/);assert.match(calendar,/'leave' type/);assert.match(scope,/userApprovedLeaveConflict/);assert.match(app,/await userApprovedLeaveConflict\(memberId,startDate,dueDate\)/)});
test("frontend provides leave balances, requests and team approvals",()=>{assert.match(api,/leaveRequests:/);assert.match(api,/decideLeaveRequest:/);assert.match(panel,/Team Approvals/);assert.match(panel,/Request leave/);assert.match(ui,/Team management enabled/);assert.match(ui,/UserLeaveManagement/)});

test("leave balances allocate cross-year approved leave to each calendar year by working day",()=>{
 const route=readFileSync("backend/src/users/leave-management.js","utf8");
 assert.match(route,/GREATEST\(lr\.start_date,make_date\(\$2,1,1\)\)/);
 assert.match(route,/LEAST\(lr\.end_date,make_date\(\$2,12,31\)\)/);
 assert.match(route,/EXTRACT\(ISODOW FROM leave_day\.day\)<6/);
 assert.match(route,/lr\.start_date<=make_date\(\$2,12,31\) AND lr\.end_date>=make_date\(\$2,1,1\)/);
 assert.doesNotMatch(route,/SUM\(working_days\) used_days/);
 assert.match(route,/Choose a valid leave-balance year/);
});

test("leave types requiring evidence enforce private attachment upload and scoped download",()=>{
 assert.match(attachmentMigration,/leave_request_attachments/);
 assert.match(attachmentMigration,/leave_request_id UUID NOT NULL UNIQUE REFERENCES leave_requests/);
 assert.match(leave,/type\.requires_document&&!stored/);
 assert.match(leave,/validateDocumentUpload\(req\.body/);
 assert.match(leave,/storeDocument\(req\.body/);
 assert.match(leave,/deleteStoredDocument\(stored\.storagePath\)/);
 assert.match(leave,/canManageUser\(req\.user,row\.user_id\)/);
 assert.match(leave,/resolveDocumentPath\(row\.stored_path\)/);
 assert.match(leave,/has_attachment/);
 assert.match(panel,/Supporting document/);
 assert.match(panel,/selectedType\?\.requires_document/);
 assert.match(api,/downloadLeaveAttachment/);
});

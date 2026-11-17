import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('backend/migrations/039_task_request_notification_review_category.sql', 'utf8');
const backend = readFileSync('backend/src/app.js', 'utf8');
const inbox = readFileSync('src/NotificationCenter.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const pulse = readFileSync('backend/src/pulse-service.js', 'utf8');

test('pending Task Request notifications are classified as Reviews & Approvals', () => {
  const reviewRule = migration.match(/WHEN COALESCE\(p_title,''\) IN \(([\s\S]*?)\) THEN 'Review'/);
  assert.ok(reviewRule, 'Review category rule must exist in the incremental migration');
  assert.match(reviewRule[1], /'Task request awaiting approval'/);
});

test('Task Request notification classification stays high-priority without retroactive email', () => {
  assert.match(migration, /notification_category='Review'/);
  assert.match(migration, /priority=CASE WHEN priority='Critical' THEN 'Critical' ELSE 'High' END/);
  assert.match(migration, /email_eligible=FALSE/);
  assert.match(migration, /next_email_attempt_at=NULL/);
});

test('Task Request creation resolves the requester immediate supervisor and creates an approval notification', () => {
  const supervisorResolutionCount = [...backend.matchAll(/immediateSupervisorForUser\(req\.user\.id\)/g)].length;
  assert.ok(supervisorResolutionCount >= 2, 'Both supported Task Request creation paths must resolve the immediate supervisor');
  assert.match(backend, /'Task request awaiting approval'[\s\S]{0,240}\[supervisor\.id,/);
  assert.match(backend, /VALUES\(\$1,'Task request awaiting approval',\$2,'assignment_task_request',\$3\)/);
});

test('supervisor-scoped notification feed returns notifications only to their recipient', () => {
  assert.match(pulse, /export async function visibleNotifications\(user,run=query\)/);
  assert.match(pulse, /FROM notifications n WHERE n\.user_id=\$1/);
  assert.match(backend, /app\.get\('\/api\/notifications'[\s\S]{0,12000}res\.json\(await visibleNotifications\(req\.user\)\)/);
});

test('management task-request queue includes the authorised reporting subtree', () => {
  assert.match(backend, /app\.get\('\/api\/task-requests'[\s\S]{0,2500}const scoped=await managedUserIds\(req\.user\)/);
  assert.match(backend, /r\.requested_by=ANY\(\$3::uuid\[\]\)/);
  assert.match(backend, /can_decide:row\.status==='Pending'[\s\S]{0,180}isOperationalOversightRole\(req\.user\.role\)/);
  assert.match(backend, /const organisationWide=req\.user\.role==='Director'/);
});

test('notification inbox provides an approvals folder for Review category and labels Task Requests', () => {
  assert.match(inbox, /const isApprovalNotification = \(item: ApiNotification\) =>\s*categoryOf\(item\) === "Review"/);
  assert.match(inbox, /if \(type === "assignment_task_request"\) return "Task request"/);
  assert.match(inbox, /if \(item\.entity_type === "assignment_task_request"\) return "Open task request"/);
});

test('opening a Task Request notification navigates to the Tasks workspace', () => {
  assert.match(app, /item\.entity_type === "assignment_task_request" && item\.entity_id[\s\S]{0,300}setActive\("Tasks"\)/);
});

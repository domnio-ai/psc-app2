import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = rel => readFileSync(path.join(root, rel), 'utf8');
const reviewCss = read('src/modules/reviews/reviews-approvals.css');
const reviewUi = read('src/modules/reviews/ReviewsApprovalsWorkspace.tsx');
const queueCss = read('src/modules/reviews/meeting-schedule-approval-queue.css');
const queueUi = read('src/modules/reviews/MeetingScheduleApprovalQueue.tsx');
test('R2 compresses the Reviews & Approvals first viewport without changing content contracts', () => {
  assert.match(reviewCss, /APP2_REVIEWS_APPROVALS_VISUAL_R2_BEGIN/);
  assert.match(reviewCss, /\.reviews-workspace-grid\s*\{[^}]*align-items:\s*start/s);
  assert.match(reviewCss, /\.reviews-workspace-grid\s*>\s*\.reviews-workspace-card\s*\{[^}]*height:\s*fit-content/s);
  assert.match(reviewUi, /title="Needs My Decision"/);
  assert.match(reviewUi, /title="My Review History"/);
});
test('Empty meeting approvals render a compact horizontal governance strip', () => {
  assert.match(queueUi, /className=\{`meeting-schedule-approval-queue \$\{items\.length === 0 \? "is-empty" : "has-pending"\}`\}/);
  assert.match(queueCss, /\.meeting-schedule-approval-queue\.is-empty\s*\{/);
  assert.match(queueCss, /\.meeting-schedule-approval-queue\.is-empty\s*>\s*\.meeting-schedule-approval-empty/);
  assert.match(queueCss, /@media\s*\(max-width:\s*720px\)/);
});
test('Active meeting decisions keep the same governed decision API and required comments', () => {
  assert.match(queueUi, /meetingsApi\.decideScheduleApproval\(token, item\.id, decision/);
  assert.match(queueUi, /comments\[item\.id\].*trim\(\)/s);
  assert.match(queueUi, /"Approved" \| "Returned" \| "Rejected"/);
});
test('R2 is presentation-only and adds no API route, database field, or review decision handler', () => {
  assert.doesNotMatch(reviewCss, /fetch\s*\(|XMLHttpRequest|window\.location/);
  assert.doesNotMatch(queueCss, /fetch\s*\(|XMLHttpRequest|window\.location/);
  assert.match(reviewUi, /onOpenRepositoryReview/);
});
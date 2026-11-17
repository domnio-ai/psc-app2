import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pulse-service.js', import.meta.url), 'utf8');
const start = source.indexOf("'Research Report' \"reviewKind\"");
const end = source.indexOf("'Research Repository')", start);
assert.ok(start >= 0 && end > start, 'The Research Report review-queue source contract must exist.');
const queryContext = source.slice(Math.max(0, start - 260), end + 40);

test('Research review queue is based on the latest submitted version explicitly assigned to the signed-in reviewer', () => {
  assert.match(queryContext, /JOIN LATERAL\(SELECT v\.status,v\.reviewer_id FROM research_report_versions v WHERE v\.project_id=p\.id ORDER BY v\.version_number DESC LIMIT 1\) assigned_version/);
  assert.match(queryContext, /assigned_version\.status='Submitted' AND assigned_version\.reviewer_id=\$1/);
});

test('Research reviewer queue is not incorrectly gated by the managed-user hierarchy array', () => {
  assert.doesNotMatch(queryContext, /\$3::uuid=ANY\(\$2::uuid\[\]\)/);
  assert.doesNotMatch(queryContext, /\(\$1 OR TRUE\)/);
  assert.match(queryContext, /\[user\.id\]\)/);
});

test('Research reviewer queue remains routed to Reviews & Approvals and the Research Repository', () => {
  assert.match(queryContext, /Reviews & Approvals/);
  assert.match(queryContext, /Research Repository/);
});
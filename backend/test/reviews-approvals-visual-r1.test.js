import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const cssPath = path.join(root, 'src/modules/reviews/reviews-approvals.css');
const tsxPath = path.join(root, 'src/modules/reviews/ReviewsApprovalsWorkspace.tsx');
const css = readFileSync(cssPath, 'utf8');
const tsx = readFileSync(tsxPath, 'utf8');

test('Reviews & Approvals visual refinement is isolated to its existing stylesheet', () => {
  assert.match(tsx, /reviews-approvals\.css/);
  assert.match(css, /APP2_REVIEWS_APPROVALS_VISUAL_R1_BEGIN/);
  assert.match(css, /APP2_REVIEWS_APPROVALS_VISUAL_R1_END/);
  assert.match(css, /\.reviews-workspace-card/);
  assert.match(css, /\.reviews-workspace-list/);
});

test('Review item affordances retain keyboard focus and responsive layout', () => {
  assert.match(css, /\.reviews-workspace-list\s*>\s*button:focus-visible/);
  assert.match(css, /@media\s*\(max-width:\s*720px\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test('Review urgency styling only decorates existing overdue/urgent/due-soon classes', () => {
  assert.match(css, /\.reviews-workspace-list\s*>\s*button\.overdue/);
  assert.match(css, /\.reviews-workspace-list\s*>\s*button\.urgent/);
  assert.match(css, /\.reviews-workspace-list\s*>\s*button\.due-soon/);
  assert.match(tsx, /reviewTimingClass/);
});

test('Visual refinement does not add approval decisions, API calls, or new workflow states', () => {
  assert.doesNotMatch(css, /fetch\s*\(|XMLHttpRequest|Approved\s*=>|Submitted\s*=>/);
});
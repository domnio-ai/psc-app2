import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx','utf8');
const queue = fs.readFileSync('src/modules/repository/components/RepositoryReviewQueue.tsx','utf8');
const css = fs.readFileSync('src/documents.css','utf8');

test('repository intake still requires an explicit reviewer and blocks self-review',()=>{
  assert.match(app,/if \(!knowledgeForm\.reviewerId\)/);
  assert.match(app,/Select the reviewer who will be responsible for this document/);
  assert.match(app,/knowledgeForm\.reviewerId === user\?\.id/);
  assert.match(app,/You cannot review your own repository document/);
});

test('review queue makes reviewer assignment mandatory before a decision',()=>{
  assert.match(queue,/disabled=\{!canReview \|\| !item\.reviewer_id\}/);
  assert.match(queue,/Assign reviewer first/);
  assert.match(queue,/Reviewer required before decision/);
  assert.match(queue,/Under review by/);
});

test('reviewer selection cannot be cleared back to unassigned',()=>{
  assert.match(queue,/<option value="" disabled>Choose reviewer<\/option>/);
  assert.doesNotMatch(queue,/<option value="">Unassigned<\/option>/);
  assert.match(app,/Reviewer assignment cannot be cleared/);
});

test('review open and decision handlers independently enforce reviewer presence',()=>{
  assert.match(app,/Assign an explicit reviewer before a review decision can be recorded/);
  assert.match(app,/Reviewer required\. Assign an explicit reviewer before opening the review decision/);
});

test('reviewer governance states are visibly distinguished',()=>{
  assert.match(css,/APP2 REPOSITORY V3\.1 - REVIEWER GOVERNANCE ENFORCEMENT/);
  assert.match(css,/repository-reviewer-state\.assigned/);
  assert.match(css,/repository-reviewer-state\.required/);
});

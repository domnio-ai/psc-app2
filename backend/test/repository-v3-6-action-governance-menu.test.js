import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../../src/documents.css', import.meta.url), 'utf8');

test('V3.6 keeps stable direct record actions', () => {
  assert.match(app, />\s*Record workspace\s*</);
  assert.match(app, />\s*Versions\s*</);
  assert.match(app, />\s*Audit trail\s*</);
});

test('V3.6.1 keeps legacy Draft version history contract without a duplicate action', () => {
  assert.match(app, /Open source workspace/);
  assert.match(app, /Relationships \/ evidence/);
  assert.match(app, /Ask Felix/);
  assert.match(app, /title="Draft version history"/);
  assert.doesNotMatch(app, />\s*Draft version history\s*<\/button>/);
});

test('V3.6 manager governance actions are grouped behind Governance', () => {
  assert.match(app, /repository-governance-actions/);
  assert.match(app, /<summary>Governance<\/summary>/);
  assert.match(app, /Protection & access/);
  assert.match(app, /Improve \/ update/);
  assert.match(app, /Re-index Felix/);
  assert.match(app, />\s*Retention\s*</);
});

test('V3.6 preserves automatic lock status and manager gate', () => {
  assert.match(app, /Locks automatically when Workspace opens/);
  assert.match(app, /\{isManager && \(\s*<details className="repository-governance-actions">/);
});

test('V3.6 governance submenu is compact and theme-aware', () => {
  assert.match(css, /APP2 REPOSITORY V3\.6 - ACTION GOVERNANCE & MENU RATIONALISATION/);
  assert.match(css, /repository-governance-actions/);
  assert.match(css, /var\(--surface-hover/);
});

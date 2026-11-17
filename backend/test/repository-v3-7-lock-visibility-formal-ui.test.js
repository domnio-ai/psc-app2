import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../../src/documents.css', import.meta.url), 'utf8');

test('V3.7 preserves direct record actions and visual lock states', () => {
  assert.match(app, />\s*Record workspace\s*</);
  assert.match(app, />\s*Versions\s*</);
  assert.match(app, />\s*Audit trail\s*</);
  assert.match(app, /repository-state-stack/);
  assert.match(app, /repository-lock-pill/);
  assert.match(app, /Available for work/);
  assert.match(app, /You are editing/);
});

test('V3.7 blocks conflicting workspace entry when another user owns the lock', () => {
  assert.match(app, /if \(item\.locked_by_name !== currentUserName\) \{/);
  assert.match(app, /is already locked by \$\{item\.locked_by_name\}/);
  assert.match(app, /disabled=\{!!item\.locked_by_name && item\.locked_by_name !== user\?\.name\}/);
});

test('V3.7 keeps source, traceability and governance actions available', () => {
  assert.match(app, /Open source workspace/);
  assert.match(app, /Relationships \/ evidence/);
  assert.match(app, /Ask Felix/);
  assert.match(app, /<summary>Governance<\/summary>/);
  assert.match(app, /title="Draft version history"/);
});

test('V3.7 formal visuals stay theme-aware and compact', () => {
  assert.match(css, /APP2 REPOSITORY V3\.7 - LOCK VISIBILITY & FORMAL VISUAL SIMPLIFICATION/);
  assert.match(css, /repository-lock-pill\.other/);
  assert.match(css, /repository-workspace-action:disabled/);
  assert.match(css, /linear-gradient/);
});

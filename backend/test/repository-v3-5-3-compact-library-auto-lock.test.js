import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx','utf8');
const css = fs.readFileSync('src/documents.css','utf8');

test('V3.5 collapses secondary governance panels behind progressive disclosure', () => {
  assert.match(app, /repository-progressive-panel/);
  assert.match(app, /Lifecycle & attention/);
  assert.match(app, /Operational records control/);
  assert.match(app, />Assurance</);
  assert.match(app, /Governance reconciliation/);
});

test('V3.5 keeps row traceability compact instead of permanently expanded', () => {
  assert.match(app, /repository-origin-compact/);
  assert.doesNotMatch(app, /className="repository-traceability-inline"/);
});

test('V3.5 removes duplicate More actions while preserving direct primary actions', () => {
  assert.match(app, /Record workspace\s*<\/button>/);
  assert.match(app, /Versions\s*<\/button>/);
  assert.match(app, /Audit trail\s*<\/button>/);
  const moreStart = app.indexOf('<details className="repository-more-actions">');
  assert.ok(moreStart >= 0);
  const moreEnd = app.indexOf('</details>', moreStart);
  const more = app.slice(moreStart, moreEnd);
  assert.doesNotMatch(more, /Record workspace/);
  assert.doesNotMatch(more, /Version history/);
  assert.doesNotMatch(more, />Audit trail</);
  assert.doesNotMatch(more, /Check out|Check in/);
  assert.match(more, /Open source workspace/);
  assert.match(more, /Relationships \/ evidence/);
});

test('V3.5 automatically acquires and releases the existing repository lock for workspace editing', () => {
  assert.match(app, /const openRepositoryWorkspace = async/);
  assert.match(app, /await api\.checkoutDocument\(token, item\.id\)/);
  assert.match(app, /setRepositoryAutoLockedDocumentId\(item\.id\)/);
  assert.match(app, /const closeRepositoryWorkspace = async/);
  assert.match(app, /await api\.checkinDocument\(token, item\.id\)/);
  assert.match(app, /onClose=\{\(\) => void closeRepositoryWorkspace\(\)\}/);
  assert.match(app, /Locks automatically when Workspace opens/);
});

test('V3.5 compact styles preserve theme-aware responsive layout', () => {
  assert.match(css, /APP2 REPOSITORY V3\.5 - COMPACT LIBRARY & AUTOMATIC WORK LOCK/);
  assert.match(css, /repository-progressive-panel/);
  assert.match(css, /repository-lock-status/);
  assert.match(css, /@media \(max-width: 980px\)/);
});

test('V3.5.3 preserves collapsed traceability accessibility contract', () => {
  assert.ok(app.includes('aria-label={`Traceability for ${item.title}`}'));
  assert.match(app, /<b>Origin:<\/b>/);
  assert.match(app, /<b>Trace:<\/b>/);
});


test('V3.5.3 automatic locking is null-safe across async boundaries', () => {
  assert.match(app, /const currentUserName = user\?\.name\?\.trim\(\)/);
  assert.match(app, /if \(!currentUserName\)/);
  assert.match(app, /locked_by_name: currentUserName/);
  assert.match(app, /item\.locked_by_name !== currentUserName/);
  const workspaceStart = app.indexOf('const openRepositoryWorkspace = async');
  const workspaceEnd = app.indexOf('const closeRepositoryWorkspace = async', workspaceStart);
  const workspace = app.slice(workspaceStart, workspaceEnd);
  assert.doesNotMatch(workspace, /user\.name/);
});


test('V3.5.3 preserves legacy Record workspace action without reintroducing More-menu duplication', () => {
  assert.match(app, /Record workspace/);
  const moreStart = app.indexOf('<details className="repository-more-actions">');
  const moreEnd = app.indexOf('</details>', moreStart);
  const more = app.slice(moreStart, moreEnd);
  assert.doesNotMatch(more, /Record workspace/);
});

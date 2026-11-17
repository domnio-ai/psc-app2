import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../../src/documents.css', import.meta.url), 'utf8');

test('V3.7.1 preserves the governed five-column repository contract', () => {
  for (const heading of ['Record', 'Context', 'Status', 'Governance', 'Actions']) {
    assert.match(app, new RegExp(`<span>${heading}</span>`));
  }
  assert.match(app, />\s*Record workspace\s*</);
  assert.match(app, />\s*Versions\s*</);
  assert.match(app, />\s*Audit trail\s*</);
  assert.match(app, />\s*More\s*<\/summary>/);
});

test('V3.7.1 allocates a formal fixed action zone and quiet secondary actions', () => {
  assert.match(css, /APP2 REPOSITORY V3\.7\.1 - FORMAL TABLE LAYOUT & VISUAL HIERARCHY/);
  assert.match(css, /minmax\(300px,1\.5fr\)/);
  assert.match(css, /grid-template-columns:max-content max-content max-content/);
  assert.match(css, /button\[title="Draft version history"\]/);
  assert.match(css, /repository-audit-action/);
});

test('V3.7.1 reduces visual noise without weakening lock visibility', () => {
  assert.match(css, /repository-lock-pill\.ready/);
  assert.match(css, /background:transparent/);
  assert.match(css, /repository-lock-pill\.mine/);
  assert.match(css, /repository-lock-pill\.other/);
  assert.match(app, /Available for work/);
  assert.match(app, /You are editing/);
  assert.match(app, /Locked by/);
});

test('V3.7.1 prevents repository shell and floating assistant from obscuring records', () => {
  assert.match(css, /main:has\(> \.documents-active\) > \.topbar \.title/);
  assert.match(css, /repository-felix-clearance \.felix-launcher/);
  assert.match(css, /display:none!important/);
  assert.match(css, /repository-canonical-search > :not\(input\)/);
});

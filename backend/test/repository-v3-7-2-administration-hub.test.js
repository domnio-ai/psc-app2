import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../../src/documents.css', import.meta.url), 'utf8');

test('V3.7.2 separates administration from the everyday record library', () => {
  assert.match(app, /repository-administration-hub/);
  assert.match(app, /REPOSITORY ADMINISTRATION/);
  assert.match(app, /Management, assurance and governance tools/);
  assert.match(app, /RECORD LIBRARY/);
  assert.match(app, /Browse by record family/);
});

test('V3.7.2 keeps governance capabilities inside the administration hub', () => {
  assert.match(app, /Lifecycle & attention/);
  assert.match(app, /Operational records control/);
  assert.match(app, /Assurance/);
  assert.match(app, /Governance reconciliation/);
  assert.match(app, /Bulk intake/);
});

test('V3.7.2 keeps the library focused and preserves established record collections', () => {
  assert.match(app, /repositoryPrimaryTabs/);
  assert.match(app, /Published \/ Final/);
  assert.match(app, /All Records/);
  assert.match(app, /Reports/);
  assert.match(app, /Drafts/);
});

test('V3.7.2 administration hub uses formal theme-aware progressive disclosure', () => {
  assert.match(css, /APP2 REPOSITORY V3\.7\.2 - SEPARATE ADMINISTRATION HUB/);
  assert.match(css, /repository-administration-hub/);
  assert.match(css, /repository-administration-hub-body/);
  assert.match(css, /linear-gradient/);
});

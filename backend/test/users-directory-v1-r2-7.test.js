import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../src/users.css', import.meta.url), 'utf8');

test('Users directory has account summary cards and dedicated filters', () => {
  assert.match(app, /USER DIRECTORY/);
  assert.match(app, /Accounts and access/);
  assert.match(app, /Total users/);
  assert.match(app, /On leave/);
  assert.match(app, /Inactive/);
  assert.match(app, /userStatusFilter/);
  assert.match(app, /userDivisionFilter/);
});

test('Users filters apply only to Users tab and do not leak into Teams', () => {
  assert.match(app, /userWorkspaceTab !== "Users" \|\| userStatusFilter === "All"/);
  assert.match(app, /userWorkspaceTab !== "Users" \|\| userDivisionFilter === "All"/);
});

test('Users table is account-centric while Teams keeps workload', () => {
  assert.match(app, /userWorkspaceTab === "Users" \? "Reporting line" : "Workload"/);
  assert.match(app, /Top-level \/ unassigned/);
  assert.match(app, /No reporting manager recorded/);
});

test('Directory styling is responsive and theme-token based', () => {
  assert.match(css, /user-directory-summary/);
  assert.match(css, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /var\(--surface-primary\)/);
  assert.match(css, /var\(--border-default\)/);
  assert.match(css, /@media\(max-width:680px\)/);
});

test('Existing team operational workspace remains present', () => {
  assert.match(app, /TEAM OVERVIEW/);
  assert.match(app, /People, availability and workload/);
  assert.match(app, /team-summary-cards/);
});

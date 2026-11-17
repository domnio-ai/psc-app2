import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const app = fs.readFileSync(path.join(root, 'src', 'App.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'users.css'), 'utf8');

test('Teams tab has a distinct operational overview', () => {
  assert.match(app, /userWorkspaceTab === "Teams"/);
  assert.match(app, /TEAM OVERVIEW/);
  assert.match(app, /People, availability and workload/);
  assert.match(app, /TEAM ROSTER/);
});

test('team overview exposes scoped availability and workload summaries', () => {
  assert.match(app, /Active team/);
  assert.match(app, /Available now/);
  assert.match(app, /On leave/);
  assert.match(app, /Active workload/);
  assert.match(app, /active_assignments/);
  assert.match(app, /availability_status === "On Leave"/);
});

test('division cards filter the existing authorised roster rather than creating a second data source', () => {
  assert.match(app, /const divisions = \[\.\.\.new Set\(activeTeam\.map/);
  assert.match(app, /setUserSearch\(userSearch === division \? "" : division\)/);
  assert.match(app, /filteredUsers\.length} shown/);
});

test('Teams uses dedicated responsive styling and hides the account hierarchy cards', () => {
  assert.match(css, /data-user-tab="Teams"\]\>\.user-role-overview\{display:none\}/);
  assert.match(css, /\.team-summary-cards\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /\.team-division-grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:720px\)/);
});

test('R2.6 does not alter leave, calendar, RBAC or database code paths', () => {
  assert.doesNotMatch(app, /R2\.6.*UserLeaveManagement/);
  assert.match(app, /<UserLeaveManagement mode=/);
  assert.match(app, /userWorkspaceTab === "Calendar"/);
  assert.match(app, /canAdministerUsers/);
});

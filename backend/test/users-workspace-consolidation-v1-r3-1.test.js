import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');

test('Users/Teams alone render the directory toolbar', () => {
  assert.match(app, /\(userWorkspaceTab === "Users" \|\| userWorkspaceTab === "Teams"\) && \(\s*<div className="assignment-toolbar">/);
});

test('role filter uses account terminology', () => {
  assert.match(app, /value === "All" \? "All roles" : value/);
  assert.doesNotMatch(app, /\? "Active assignments"/);
});

test('permission matrix is confined to Administration', () => {
  assert.match(app, /canAdministerUsers && userWorkspaceTab === "Administration" && \(\s*<section className="permission-matrix">/);
});

test('Leave and Approvals retain dedicated workspace rendering', () => {
  assert.match(app, /userWorkspaceTab === "Leave" \|\| userWorkspaceTab === "Approvals"/);
  assert.match(app, /mode=\{userWorkspaceTab === "Approvals" \? "approvals" : "leave"\}/);
});

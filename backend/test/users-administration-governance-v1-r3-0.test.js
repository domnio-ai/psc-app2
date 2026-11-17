import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync('src/App.tsx','utf8');
const css=fs.readFileSync('src/users.css','utf8');

test('administration stays System Admin only and reuses existing account editor',()=>{
  assert.match(app,/canAdministerUsers && userWorkspaceTab === "Administration"/);
  assert.match(app,/\+ Create account/);
  assert.match(app,/openUserEditor\(\)/);
  assert.match(app,/openUserEditor\(member\)/);
});

test('administration surfaces governance health without new backend feeds',()=>{
  assert.match(app,/Active accounts/);
  assert.match(app,/Disabled accounts/);
  assert.match(app,/Reporting gaps/);
  assert.match(app,/System admins/);
  assert.match(app,/parentRoleByRole/);
  assert.doesNotMatch(app,/administrationApi|governanceApi|fetch\([^)]*administration/i);
});

test('administration provides role governance and security controls',()=>{
  assert.match(app,/ROLE GOVERNANCE/);
  assert.match(app,/SECURITY CONTROLS/);
  assert.match(app,/Password reset/);
  assert.match(app,/Activation state/);
  assert.match(app,/Role and reporting line/);
});

test('administration links to existing directory and audit logs',()=>{
  assert.match(app,/setUserWorkspaceTab\("Users"\)/);
  assert.match(app,/setActive\("Audit Logs"\)/);
  assert.match(app,/Review security audit/);
});

test('administration workspace is responsive and visually scoped',()=>{
  assert.match(css,/\.user-administration-workspace\{/);
  assert.match(css,/\.user-administration-summary\{/);
  assert.match(css,/\.user-administration-grid\{/);
  assert.match(css,/\.user-security-control-list\{/);
  assert.match(css,/@media\(max-width:680px\)/);
});

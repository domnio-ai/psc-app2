import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const usersCss = fs.readFileSync(new URL('../../src/users.css', import.meta.url), 'utf8');
const leaveCss = fs.readFileSync(new URL('../../src/modules/users/user-leave-management.css', import.meta.url), 'utf8');

test('R2.5 keeps the workspace tabs compact and horizontally accessible', () => {
  assert.match(usersCss, /Users \+ Team Management R2\.5/);
  assert.match(usersCss, /\.user-workspace-tabs\{[\s\S]*min-height:50px/);
  assert.match(usersCss, /\.user-workspace-tabs button\{[\s\S]*min-height:38px/);
});

test('R2.5 leave summary uses compact bounded cards', () => {
  assert.match(leaveCss, /Users \+ Team Management R2\.5/);
  assert.match(leaveCss, /grid-template-columns:repeat\(3,minmax\(180px,260px\)\)/);
  assert.match(leaveCss, /min-height:82px/);
});

test('R2.5 keeps leave balances responsive without stretching cards across the page', () => {
  assert.match(leaveCss, /repeat\(auto-fit,minmax\(190px,260px\)\)/);
  assert.match(leaveCss, /@media\(max-width:820px\)/);
});

test('R2.5 moves request and history content upward with a tighter two-column workspace', () => {
  assert.match(leaveCss, /\.leave-columns\{[\s\S]*padding:12px 14px 14px/);
  assert.match(leaveCss, /grid-template-columns:minmax\(300px,\.72fr\) minmax\(420px,1\.28fr\)/);
});

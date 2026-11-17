import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const usersCss = fs.readFileSync(new URL('../../src/users.css', import.meta.url), 'utf8');
const leaveCss = fs.readFileSync(new URL('../../src/modules/users/user-leave-management.css', import.meta.url), 'utf8');

test('R2.5.1 gives the active workspace tab a stronger filled state', () => {
  assert.match(usersCss, /Users \+ Team Management R2\.5\.1/);
  assert.match(usersCss, /background:color-mix\(in srgb,var\(--yellow\) 20%,var\(--surface-primary\)\)/);
});

test('R2.5.1 balances the three leave status cards across available width', () => {
  assert.match(leaveCss, /Users \+ Team Management R2\.5\.1/);
  assert.match(leaveCss, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(leaveCss, /min-height:78px/);
});

test('R2.5.1 presents leave balances as compact strips rather than isolated large cards', () => {
  assert.match(leaveCss, /\.leave-balances\{[\s\S]*display:flex/);
  assert.match(leaveCss, /grid-template-areas:"name value" "meta meta"/);
  assert.match(leaveCss, /max-width:320px/);
});

test('R2.5.1 creates a matching forty-sixty request and history workspace', () => {
  assert.match(leaveCss, /grid-template-columns:minmax\(320px,2fr\) minmax\(0,3fr\)/);
  assert.match(leaveCss, /\.leave-columns form,\.leave-history\{[\s\S]*background:var\(--surface-secondary\)/);
});

test('R2.5.1 shortens the leave heading block without changing workflow selectors', () => {
  assert.match(leaveCss, /\.leave-management>header\{[\s\S]*padding:10px 14px/);
  assert.match(leaveCss, /\.leave-management>header h3\{[\s\S]*font-size:16px/);
});

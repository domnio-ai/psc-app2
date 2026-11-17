import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync('src/App.tsx','utf8');
const css=fs.readFileSync('src/documents.css','utf8');

test('Repository exposes compact primary document actions',()=>{
  assert.match(app,/repository-action-secondary/);
  assert.match(app,/>\s*Versions\s*</);
  assert.match(app,/>\s*Audit trail\s*</);
  assert.match(app,/repository-read-primary/);
});

test('Repository surfaces protection state without replacing governed controls',()=>{
  assert.match(app,/repository-protection-chip/);
  assert.match(app,/<b>Protection:<\/b>/);
  assert.match(app,/Protection & access/);
  assert.match(app,/Record workspace/);
});

test('Audit trail summarises access and governance evidence',()=>{
  assert.match(app,/access events/);
  assert.match(app,/governance events/);
  assert.match(app,/Read only · auditable/);
  assert.match(app,/Downloads, protected access, copy controls, reviewer changes and governance actions/);
});

test('V3.2 styling keeps actions compact and responsive',()=>{
  assert.match(css,/APP2 REPOSITORY V3\.2 - DOCUMENT ACTIONS & AUDIT HARDENING/);
  assert.match(css,/repository-action-secondary/);
  assert.match(css,/repository-activity-summary/);
  assert.match(css,/repository-protection-chip/);
});

import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const d=fs.readFileSync('src/modules/dashboard/ProgressiveDashboard.tsx','utf8');
test('team risk no longer duplicates the landing dashboard',()=>{assert.doesNotMatch(d,/pulse-team-attention/);assert.doesNotMatch(d,/Team assignment risk/);assert.doesNotMatch(d,/Team task risk/);});
test('managers retain Team & Users access through the primary card grid',()=>{assert.match(d,/managementView&&canSee\('Team & Users'\)/);assert.match(d,/People in authorised scope/);});

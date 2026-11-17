import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../../src/modules/dashboard/ProgressiveDashboard.tsx',import.meta.url),'utf8');

test('legacy Needs My Attention filter contract remains byte-recognisable',()=>{
  assert.match(source,/'Needs My Attention':\['All','Newly Assigned','Overdue','Due Soon','Returned to Me','My Reviews'\]/);
});

test('new actionable states extend the protected filter contract dynamically',()=>{
  assert.match(source,/attentionFilterLabels=module==='Needs My Attention'\?\[\.\.\.\(filters\[module\]\|\|\['All'\]\),'Action Required','Ready to Publish'\]/);
  assert.match(source,/openModuleActionPicker/);
  assert.match(source,/items:recordItems/);
  assert.doesNotMatch(source,/dashboardPreviewGuidance|pulse-inline-preview/);
});

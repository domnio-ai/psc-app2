import test from 'node:test';
import assert from 'node:assert/strict';
import {repairDisplayText} from '../../src/utils/repairDisplayText.ts';
test('dashboard display repairs single and repeated encoding corruption',()=>{
 assert.equal(repairDisplayText('Report \u00e2\u20ac\u0153ready\u00e2\u20ac\u009d \u00e2\u2020\u2019'), 'Report “ready” →');
 assert.equal(repairDisplayText('\u00c3\u0192\u00c2\u00a2\u00c3\u00a2\u00e2\u201a\u00ac\u00c2\u00a0\u00c3\u201a\u00c2\u0090 Back'), '← Back');
 assert.equal(repairDisplayText('Fran\u00c3\u00a7ois'), 'François');
 assert.equal(repairDisplayText('Waiting\u00e2\u20ac\u00a6'), 'Waiting…');
});
test('display repair preserves correct Unicode, names, markup and ordinary text',()=>{
 for(const value of ['François, João, Zoë, Αθήνα, 中文','Correct “quotes” • → 🔔','<b>Report</b>','Draft 2026 / 12'])assert.equal(repairDisplayText(value),value);
});
test('repair is idempotent',()=>{const value=repairDisplayText('Ready\u00c2\u00b7 Done');assert.equal(repairDisplayText(value),value)});

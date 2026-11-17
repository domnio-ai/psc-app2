import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync(new URL('../../src/calendar.css',import.meta.url),'utf8');

test('calendar desktop layout gives planning rail deliberate width',()=>{
  assert.match(css,/grid-template-columns:minmax\(0,72fr\) minmax\(360px,28fr\)/);
});

test('calendar planning rail prevents horizontal overflow',()=>{
  assert.match(css,/\.calendar-agenda\{overflow-x:hidden!important\}/);
  assert.match(css,/\.calendar-upcoming-panel\{overflow-x:hidden!important\}/);
});

test('calendar long upcoming titles use bounded ellipsis',()=>{
  assert.match(css,/\.calendar-upcoming-panel>button span strong,\.calendar-upcoming-panel>button span small\{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/);
});

test('calendar empty selected-date state is compact',()=>{
  assert.match(css,/\.calendar-empty\{padding:20px 14px\}/);
});

test('calendar month event bars are denser but remain visible',()=>{
  assert.match(css,/\.calendar-grid>button small\{min-width:0;margin-top:4px;padding:3px 5px;font-size:11px;line-height:1\.25\}/);
});

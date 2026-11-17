import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const d=fs.readFileSync('src/modules/dashboard/ProgressiveDashboard.tsx','utf8');
test('landing is role aware and scope explicit',()=>{assert.match(d,/managementView=data\.scope!==/);assert.match(d,/Authorised view/);assert.match(d,/Management overview/);assert.match(d,/My work/);});
test('crowded legacy landing sections are retired',()=>{for(const s of ['pulse-management-overview','pulse-team-attention','pulse-navigation-memory pulse-navigation-memory-compact','landingGroups.map'])assert.doesNotMatch(d,new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));});
test('card selection uses module-specific popup navigation without a generic matching-records page',()=>{assert.match(d,/openModuleActionPicker\(m,"All"\)/);assert.match(d,/DashboardRecordPickerModal/);assert.doesNotMatch(d,/setBucket|View all matching records|pulse-records|pulse-detail-open/);});

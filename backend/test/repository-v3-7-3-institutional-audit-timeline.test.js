import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const css = fs.readFileSync('src/documents.css', 'utf8');

test('V3.7.3 presents institutional audit language before technical evidence', () => {
  assert.match(app, /INSTITUTIONAL AUDIT TRAIL/);
  assert.match(app, /Working draft archived/);
  assert.match(app, /Final governed report published and working draft archived\./);
  assert.match(app, /Technical details/);
  assert.match(app, /repository-activity-human-summary/);
});

test('V3.7.3 groups repeated document views without deleting source audit rows', () => {
  assert.match(app, /groupedRepositoryActivityRows/);
  assert.match(app, /repeat_count/);
  assert.match(app, /Document viewed/);
  assert.match(app, /repositoryActivityDayLabel/);
  assert.match(app, /Today/);
  assert.match(app, /Yesterday/);
});

test('V3.7.3 uses an institutional event taxonomy', () => {
  for (const category of ['Access', 'Edit', 'Review', 'Approval', 'Publication', 'Governance', 'Security']) {
    assert.match(app, new RegExp(`"${category}"`));
  }
});

test('V3.7.3 preserves V3.2 audit compatibility wording', () => {
  assert.match(app, /access events/);
  assert.match(app, /governance events/);
  assert.match(app, /Read only · auditable/);
  assert.match(app, /Downloads, protected access, copy controls, reviewer changes and governance actions/);
});

test('V3.7.3 audit styling is compact, formal and technical details are secondary', () => {
  assert.match(css, /APP2 REPOSITORY V3\.7\.3 - INSTITUTIONAL AUDIT TIMELINE/);
  assert.match(css, /institutional-audit-timeline/);
  assert.match(css, /repository-activity-technical-details/);
  assert.match(css, /repository-activity-day/);
});

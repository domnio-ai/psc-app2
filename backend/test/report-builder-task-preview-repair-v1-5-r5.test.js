import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root = fs.existsSync('src/App.tsx') ? '.' : '..';
const app = fs.readFileSync(`${root}/src/App.tsx`, 'utf8');

test('draft task preview uses dedicated preview endpoint', () => {
  assert.match(app, /shouldUseDraftTaskPreview\(selectedAssignmentTask, user\?\.id\)/);
  assert.match(app, /api\.previewAssignmentTaskContribution/);
});

test('locked task preview still uses immutable saved-report route', () => {
  assert.match(app, /else \{[\s\S]*loadTaskContributionReport\(/);
});

test('preview passes the just-saved section override', () => {
  assert.match(app, /openAssignmentTaskContributionPreview\(\{[\s\S]*?key: taskReportSectionModal\.key,[\s\S]*?value,[\s\S]*?\}\)/);
});

test('preview payload excludes workflow-only contributionStatus', () => {
  assert.match(app, /const \{ contributionStatus: _contributionStatus, \.\.\.previewPayload \} = payload/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const frontend = fs.readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
const backend = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

test('Research finalisation depends on the latest approved version', () => {
  const latestStart = frontend.indexOf('const latestResearchReportVersion = researchReportVersions[0] || null;');
  const lockStart = frontend.indexOf('const researchReportIsLocked = Boolean(', latestStart);
  assert.ok(latestStart >= 0 && lockStart > latestStart);
  assert.match(frontend.slice(latestStart, lockStart), /latestResearchReportVersion\?\.status === "Approved"/);
});

test('Rejected report versions reopen editing and use draft preview content', () => {
  const lockStart = frontend.indexOf('const researchReportIsLocked = Boolean(');
  const lockEnd = frontend.indexOf('const researchReportLockReviewerName', lockStart);
  assert.ok(lockStart >= 0 && lockEnd > lockStart);
  const lock = frontend.slice(lockStart, lockEnd);
  assert.match(lock, /\["Submitted", "Approved"\]\.includes\(latestResearchReportVersion\.status\)/);
  assert.match(lock, /!\["Changes Requested", "Rejected"\]\.includes/);

  const previewStart = frontend.indexOf('const researchPreviewUsesVersionSnapshot = Boolean(');
  const previewEnd = frontend.indexOf('const researchPreviewSections', previewStart);
  assert.ok(previewStart >= 0 && previewEnd > previewStart);
  assert.match(frontend.slice(previewStart, previewEnd), /\["Submitted", "Approved"\]\.includes\(/);
});

test('Research resubmission retains rejection lineage and checks state under lock', () => {
  const start = backend.indexOf("app.post('/api/research/:id/report/submit'");
  const end = backend.indexOf("app.post('/api/research/:id/report/versions/:versionId/decision'", start);
  assert.ok(start >= 0 && end > start);
  const route = backend.slice(start, end);
  const lock = route.indexOf('FOR UPDATE');
  assert.ok(lock >= 0);
  assert.ok(route.indexOf("latestVersion?.status==='Submitted'") > lock);
  assert.ok(route.indexOf("latestVersion?.status==='Approved'") > lock);
  assert.match(route, /status IN\('Changes Requested','Rejected'\)/);
});

test('Research final generation rejects a historical approval when a newer version exists', () => {
  assert.match(
    backend,
    /status='Approved' AND version_number=\(SELECT MAX\(version_number\) FROM research_report_versions WHERE project_id=\$1\) LIMIT 1/
  );
  assert.match(backend, /lockedLatestVersion\.id!==approvedVersion\.id/);
});
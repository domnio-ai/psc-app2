import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const backend = fs.readFileSync(path.join(root, 'backend/src/meetings/meetings-routes.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/modules/meetings/meetingsApi.ts'), 'utf8');
const workspace = fs.readFileSync(path.join(root, 'src/modules/meetings/MeetingsWorkspace.tsx'), 'utf8');
const mainApi = fs.readFileSync(path.join(root, 'src/api.ts'), 'utf8');

test('Research report still uses the authenticated PDF-download endpoint', () => {
  assert.match(mainApi, /downloadResearchReportPdf/);
  assert.match(mainApi, /\/research\/\$\{id\}\/report\/export\.pdf/);
});

test('Meeting Minutes PDF endpoint enforces meeting access and streams an attachment', () => {
  assert.match(backend, /app\.get\('\/api\/meetings\/:id\/minutes\/export\.pdf',\s*authenticate/);
  assert.match(backend, /await requireAccess\(req, req\.params\.id\)/);
  assert.match(backend, /Content-Type',\s*'application\/pdf'/);
  assert.match(backend, /Content-Disposition',\s*`attachment; filename=/);
  assert.match(backend, /MEETING_MINUTES_PDF_DOWNLOADED/);
});

test('Draft exports do not store or claim approval and identify the workflow status', () => {
  assert.match(backend, /options\.store === false \? null : await storeDocument/);
  assert.match(backend, /'Approved by': approvedRecord \? .*'NOT APPROVED'/);
  assert.match(backend, /'Workflow status': approvedRecord \? 'APPROVED OFFICIAL RECORD'/);
  assert.match(backend, /governmentIdentity: options\.downloadOnly \? false : true/);
});

test('Minutes workspace exposes a saved-version PDF download without bypassing save state', () => {
  assert.match(api, /downloadMinutesPdf: async/);
  assert.match(api, /minutes\/export\.pdf/);
  assert.match(workspace, /onClick=\{\(\) => void downloadMinutesPdf\(\)\}/);
  assert.match(workspace, /Save the latest minutes draft successfully before downloading its PDF\./);
});
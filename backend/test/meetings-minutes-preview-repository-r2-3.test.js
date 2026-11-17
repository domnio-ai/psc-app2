import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const workspace = read('src/modules/meetings/MeetingsWorkspace.tsx');
const routes = read('backend/src/meetings/meetings-routes.js');
const api = read('src/modules/meetings/meetingsApi.ts');
const css = read('src/modules/meetings/minutes-workspace.css');

test('Preview A4 opens a separate, formatted, sanitized document from the live editor content', () => {
  assert.match(workspace, /const openMinutesPreviewWindow = \(\) =>/);
  assert.match(workspace, /window\.open\("", "_blank", "popup=yes,width=1100,height=900,resizable=yes,scrollbars=yes"\)/);
  assert.match(workspace, /minutesEditorRef\.current\?\.getHTML\(\) \|\| minutesText/);
  assert.match(workspace, /previewWindow\.document\.write\(buildMinutesPreviewDocument\(currentHtml/);
  assert.match(workspace, /sanitizeReportHtmlForEditor\(minutesContentToEditorHtml\(content \|\| ""\)\)/);
  assert.match(workspace, /@page\{size:A4 portrait;margin:0\}/);
  assert.match(workspace, /Print \/ Save PDF/);
  assert.match(workspace, /app2-minutes-preview-close/);
  assert.match(workspace, /browser blocked the A4 preview window/);
  assert.match(workspace, /Preview A4 ↗/);
  assert.match(workspace, /Inline preview/);
});

test('The preview styles create a formal PSC document with readable hierarchy and A4 print sizing', () => {
  assert.match(workspace, /PUBLIC SERVICE COMMISSION/);
  assert.match(workspace, /MEETING MINUTES · OFFICIAL RECORD FORMAT/);
  assert.match(workspace, /minutes-document-content h1/);
  assert.match(workspace, /minutes-document-content h2/);
  assert.match(workspace, /minutes-document-content table/);
  assert.match(workspace, /WORKING DRAFT ·/);
  assert.match(workspace, /APPROVED OFFICIAL RECORD/);
  assert.match(css, /meeting-minutes-formatting-toolbar/);
});

test('Only already-approved minutes can be reconciled into Repository, with authorisation checks', () => {
  assert.match(api, /publishApprovedMinutesToRepository:[\s\S]*?\/minutes\/publish-approved/);
  assert.match(workspace, /Retry approved publication/);
  assert.match(workspace, /Verify Repository listing/);
  assert.match(workspace, /canReconcileApprovedMinutes/);
  assert.match(routes, /app\.post\('\/api\/meetings\/:id\/minutes\/publish-approved'/);
  assert.match(routes, /latest\.status !== 'Approved' \|\| !latest\.approved_by \|\| !latest\.approved_at/);
  assert.match(routes, /Only the recorded approver or an authorised meeting manager/);
  assert.match(routes, /meetingMinutesId=\$\{minute\.id\};/);
  assert.match(routes, /meetingMinutesVersion=\$\{minute\.version_no\}/);
  assert.match(routes, /MEETING_MINUTES_REPOSITORY_PUBLICATION_RECONCILED/);
});

test('Repository publication is idempotent and categorised for Repository filtering', () => {
  assert.match(routes, /findCurrentMeetingMinutesPublication\(client, meeting, minute\)/);
  assert.match(routes, /if \(priorPublication\) return priorPublication/);
  assert.match(routes, /document_categories WHERE name='Meeting & Workshop Reports' AND is_active=TRUE/);
  assert.match(routes, /categoryMatches = row\.category === 'Meeting & Workshop Reports'/);
  assert.match(routes, /metadataNeedsRepair/);
  assert.match(routes, /record_number: recordNumber/);
  assert.match(routes, /category_id=\$10/);
  assert.match(routes, /category='Meeting & Workshop Reports'/);
  assert.match(routes, /ensureMeetingRepositoryRecordNumber\(client, item\)/);
  assert.match(routes, /repository_document_status:'Published'/);
  assert.match(routes, /UPDATE knowledge_items SET felix_enabled=FALSE WHERE id=\$1/);
});

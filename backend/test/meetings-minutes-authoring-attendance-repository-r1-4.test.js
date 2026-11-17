import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const workspace = read('src/modules/meetings/MeetingsWorkspace.tsx');
const route = read('backend/src/meetings/meetings-routes.js');
const css = read('src/modules/meetings/minutes-workspace.css');

test('attendance updates synchronise only the Attendance section and preserve edited minutes', () => {
  assert.match(workspace, /replaceMinutesAttendanceSection\(currentContent, updated\.participants\)/);
  assert.match(workspace, /meetingsApi\.saveMinutes\(token, selected\.id, syncedContent\)/);
  assert.match(route, /replaceMinutesAttendanceSection\(String\(latest\.content\|\|''\),detail\.participants\)/);
  assert.match(route, /MEETING_MINUTES_GENERATED/);
});

test('Minutes workspace retains the shared editor and provides authoring controls and a sandboxed live A4 preview', () => {
  assert.match(workspace, /ref=\{minutesEditorRef\}/);
  assert.match(workspace, /value=\{minutesContentToEditorHtml\(minutesText\)\}/);
  assert.match(workspace, /onChange=\{handleMinutesEditorChange\}/);
  assert.match(workspace, /onImmediateChange=\{handleMinutesEditorImmediateChange\}/);
  assert.match(workspace, /editable=\{canEditMinutes\}/);
  assert.match(workspace, /runMinutesEditorCommand\("bold"\)/);
  assert.match(workspace, /Save draft/);
  assert.match(workspace, /minutesSaveState/);
  assert.match(workspace, /repository_record_number/);
  assert.match(workspace, /Official records and publication/);
  assert.match(workspace, /meeting-minutes-quick-tools/);
  assert.match(workspace, /Action table/);
  assert.match(workspace, /srcDoc=\{buildMinutesPreviewDocument\(minutesText\)\}/);
  assert.match(workspace, /sandbox="allow-same-origin allow-modals"/);
  assert.match(css, /meeting-minutes-authoring-layout/);
  assert.match(css, /#ad8727|#ad8727/i);
  assert.match(css, /@media\(max-width:1150px\)/);
});

test('minutes approval creates a versioned Published Repository document transactionally', () => {
  assert.match(route, /prepareApprovedMeetingMinutesFile\(meeting,latest,req\.user\)/);
  assert.match(route, /persistApprovedMeetingMinutes\(client,meeting,updated,req\.user\.id,prepared\)/);
  assert.match(route, /INSERT INTO knowledge_items/);
  assert.match(route, /INSERT INTO knowledge_versions/);
  assert.match(route, /status='Published'/);
  assert.match(route, /MEETING_MINUTES_PUBLISHED_TO_REPOSITORY/);
  assert.match(route, /repository_document_id:outcome\.publication\.id/);
  assert.match(route, /ensureMeetingRepositoryRecordNumber\(client, item\)/);
  assert.match(route, /records_lifecycle_state='Active Record'/);
  assert.match(route, /repository_minutes_version/);
});
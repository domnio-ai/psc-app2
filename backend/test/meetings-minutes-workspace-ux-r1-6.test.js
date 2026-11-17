import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const workspace = read('src/modules/meetings/MeetingsWorkspace.tsx');
const css = read('src/modules/meetings/minutes-workspace.css');
const route = read('backend/src/meetings/meetings-routes.js');

test('minutes use a writing-first canvas with an explicit preview toggle and print action', () => {
  assert.match(workspace, /meeting-minutes-editor-canvas/);
  assert.match(workspace, /showMinutesPreview/);
  assert.match(workspace, /Preview A4/);
  assert.match(workspace, /meeting-minutes-live-preview/);
  assert.match(workspace, /srcDoc=\{buildMinutesPreviewDocument\(minutesText\)\}/);
  assert.match(workspace, /sandbox="allow-same-origin allow-modals"/);
  assert.match(workspace, /printMinutesPreview/);
  assert.match(workspace, /@page\{size:A4 portrait;margin:0\}/);
  assert.doesNotMatch(workspace, /meeting-minutes-preview-column/);
});

test('minute canvas has a centered document surface, functional formatting controls and responsive sizing', () => {
  assert.match(css, /\.meeting-minutes-authoring-layout\{display:block/);
  assert.match(css, /max-width:850px/);
  assert.match(css, /font-size:13px;line-height:1\.66/);
  assert.match(css, /meeting-minutes-quick-tools button:hover/);
  assert.match(css, /meeting-minutes-formatting-toolbar/);
  assert.match(css, /@media\(max-width:760px\)/);
});

test('R1.6 keeps attendance synchronisation and approval-to-Repository routes present', () => {
  assert.match(workspace, /replaceMinutesAttendanceSection\(currentContent, updated\.participants\)/);
  assert.match(workspace, /meetingsApi\.saveMinutes\(token, selected\.id, syncedContent\)/);
  assert.match(route, /replaceMinutesAttendanceSection\(String\(latest\.content\|\|''\),detail\.participants\)/);
  assert.match(route, /persistApprovedMeetingMinutes\(client,meeting,updated,req\.user\.id,prepared\)/);
});
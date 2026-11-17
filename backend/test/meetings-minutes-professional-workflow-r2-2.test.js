import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const workspace = read('src/modules/meetings/MeetingsWorkspace.tsx');
const editor = read('src/modules/report-editor/App2LexicalReportEditor.tsx');
const routes = read('backend/src/meetings/meetings-routes.js');
const api = read('src/modules/meetings/meetingsApi.ts');
const types = read('src/modules/meetings/types.ts');
const repositoryApp = read('backend/src/app.js');

test('Minutes exposes genuine shared Lexical commands and a visible save state', () => {
  assert.match(workspace, /App2LexicalReportEditor[\s\S]*?ref=\{minutesEditorRef\}/);
  for (const command of ['undo', 'redo', 'bold', 'italic', 'underline', 'formatBlock', 'fontSize', 'fontName', 'insertUnorderedList', 'insertOrderedList', 'justifyLeft', 'justifyCenter', 'justifyRight', 'insertTable', 'createLink']) {
    const takesArgument = ['formatBlock', 'fontSize', 'fontName', 'createLink'].includes(command);
    const invocation = takesArgument
      ? `runMinutesEditorCommand("${command}",`
      : `runMinutesEditorCommand("${command}")`;
    assert.ok(workspace.includes(invocation), `Minutes toolbar wires ${command}`);
    assert.ok(editor.includes(`name === "${command}"`) || editor.includes(`case "${command}"`), `Shared editor supports ${command}`);
  }
  assert.match(workspace, /Unsaved changes/);
  assert.match(workspace, /Saving to meeting record/);
  assert.match(workspace, /Last saved/);
  assert.match(workspace, /onImmediateChange=\{handleMinutesEditorImmediateChange\}/);
  assert.match(workspace, /Save failed/);
});

test('Preview is explicit, live, A4-oriented and printable', () => {
  assert.match(workspace, /Preview A4/);
  assert.match(workspace, /meeting-minutes-live-preview/);
  assert.match(workspace, /srcDoc=\{buildMinutesPreviewDocument\(minutesText\)\}/);
  assert.match(workspace, /frame\.contentWindow\.print\(\)/);
  assert.match(workspace, /Official records and publication/);
  assert.doesNotMatch(workspace, /Repository publication are reserved for the next governed integration stage/);
  assert.match(workspace, /sandbox="allow-same-origin allow-modals"/);
});

test('Saving without an existing minutes row creates a governed Draft instead of returning a conflict', () => {
  assert.match(routes, /app\.patch\('\/api\/meetings\/:id\/minutes'/);
  assert.match(routes, /if\(!latest\)\s*\{\s*const created=\(await client\.query\(`INSERT INTO meeting_minutes/);
  assert.match(routes, /MEETING_MINUTES_DRAFT_SAVED/);
  assert.match(routes, /Only draft or returned minutes can be edited/);
});

test('Approved minutes become a formally classified and versioned Repository record with a return receipt', () => {
  assert.match(routes, /ensureMeetingRepositoryRecordNumber\(client, item\)/);
  assert.match(routes, /record_class='Meeting Records'/);
  assert.match(routes, /records_lifecycle_state='Active Record'/);
  assert.match(routes, /retention_schedule_id=\$9/);
  assert.match(routes, /INSERT INTO knowledge_versions/);
  assert.match(routes, /MEETING_MINUTES_PUBLISHED_TO_REPOSITORY/);
  assert.match(routes, /repository_record_number:outcome\.publication\.record_number/);
  assert.match(routes, /published_repo\.id repository_document_id/);
  assert.match(routes, /repository_minutes_version/);
  assert.match(api, /repository_record_number\?: string/);
  assert.match(types, /repository_document_id\?: string \| null/);
  assert.match(repositoryApp, /app\.get\('\/api\/repository\/groups'/);
  assert.match(repositoryApp, /ELSE 'other'/);
});

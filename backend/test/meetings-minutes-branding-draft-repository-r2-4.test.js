import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'../..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('A4 popup preview presents both official identities in the document header',()=>{
  const ui=read('src/modules/meetings/MeetingsWorkspace.tsx');
  assert.match(ui,/src="\/kenya-coat-of-arms\.png" alt="Coat of Arms of Kenya"/);
  assert.match(ui,/src="\/psc-logo\.png" alt="Public Service Commission logo"/);
  assert.match(ui,/Preview A4 ↗/);
  assert.match(ui,/@media print/);
});
test('Approved meeting PDF uses paired coat of arms and PSC logo without changing other PDF defaults',()=>{
  const pdf=read('backend/src/task-report-pdf.js');
  const routes=read('backend/src/meetings/meetings-routes.js');
  assert.match(pdf,/governmentIdentity = false/);
  assert.match(pdf,/kenya-coat-of-arms\.png/);
  assert.match(pdf,/psc-logo\.png/);
  assert.match(routes,/layout: 'portrait', governmentIdentity: options\.downloadOnly \? false : true/);
});
test('Draft snapshot is conspicuously marked not approved and includes both inline logo assets',()=>{
  const routes=read('backend/src/meetings/meetings-routes.js');
  assert.match(routes,/buildMeetingMinutesDraftRepositoryHtml/);
  assert.match(routes,/WORKING DRAFT — \$\{workflowStatus\.toUpperCase\(\)\} — NOT APPROVED — NOT AN OFFICIAL RECORD/);
  assert.match(routes,/data:image\/png;base64/);
  assert.match(routes,/Public Service Commission logo/);
});
test('Manual save, generate and submit maintain a Repository draft snapshot',()=>{
  const routes=read('backend/src/meetings/meetings-routes.js');
  assert.match(routes,/savePrivateDraftRepositoryVersion/);
  assert.match(routes,/app\.patch\('\/api\/meetings\/:id\/minutes'/);
  assert.match(routes,/app\.post\('\/api\/meetings\/:id\/minutes\/generate'/);
  assert.match(routes,/app\.post\('\/api\/meetings\/:id\/minutes\/submit'/);
  assert.match(routes,/\/minutes\/sync-draft/);
  assert.match(routes,/repository_draft_document_id/);
});
test('Repository listing filters include governed Meeting Minutes Drafts and protect them as private drafts',()=>{
  const app=read('backend/src/app.js');
  assert.match(app,/privateRepositoryDraftTypes=new Set\([\s\S]*?'Meeting Minutes Draft'/);
  assert.equal((app.match(/IN\('Assignment Draft','Task Draft','Task Report Draft','Assignment Report Draft','Meeting Minutes Draft'\)/g)||[]).length,3);
});
test('Approval promotes the same linked draft into a Published official Meeting Minutes record',()=>{
  const routes=read('backend/src/meetings/meetings-routes.js');
  assert.match(routes,/document_type IN\('Meeting Minutes','Meeting Minutes Draft'\)/);
  assert.match(routes,/document_type='Meeting Minutes',subject=\$8,classification='INTERNAL'/);
  assert.match(routes,/status='Published'/);
});
test('Minutes UI explains draft status, Repository link and manual recovery action',()=>{
  const ui=read('src/modules/meetings/MeetingsWorkspace.tsx');
  const api=read('src/modules/meetings/meetingsApi.ts');
  const types=read('src/modules/meetings/types.ts');
  assert.match(ui,/WORKING DRAFT · NOT APPROVED/);
  assert.match(ui,/Make draft visible in Repository/);
  assert.match(ui,/Sync draft to Repository/);
  assert.match(api,/\/minutes\/sync-draft/);
  assert.match(types,/repository_draft_document_id\?: string \| null/);
});

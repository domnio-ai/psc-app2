import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.cwd().endsWith(`${join('backend')}`)
  ? process.cwd()
  : join(process.cwd(), 'backend');
const app = readFileSync(join(root,'src','app.js'),'utf8');
const schema = readFileSync(join(root,'src','schema.sql'),'utf8');
const privateDraftRepository = readFileSync(join(root,'src','private-draft-repository.js'),'utf8');
const researchDraftRepository = readFileSync(join(root,'src','research-draft-repository.js'),'utf8');
const migration = readFileSync(join(root,'migrations','20261024_02_repository_sync_queue.sql'),'utf8');
const api = readFileSync(join(root,'..','src','api.ts'),'utf8');
const appTsx = readFileSync(join(root,'..','src','App.tsx'),'utf8');
const assignmentBuilder = readFileSync(join(root,'..','src','modules','assignments','components','AssignmentReportBuilder.tsx'),'utf8');
const researchBuilder = readFileSync(join(root,'..','src','modules','research','components','ResearchReportWorkspace.tsx'),'utf8');

test('outbox migration creates retryable Repository sync jobs',()=>{
  assert.match(migration,/CREATE TABLE IF NOT EXISTS repository_sync_queue/);
  assert.ok(migration.includes("status IN ('pending', 'processing', 'retry', 'done', 'dead')"));
  assert.match(migration,/idx_repository_sync_queue_ready/);
});
test('canonical schema includes the same additive sync queue contract',()=>{
  assert.match(schema,/CREATE TABLE IF NOT EXISTS repository_sync_queue/);
  assert.match(schema,/idx_repository_sync_queue_entity/);
});
test('primary workflow routes enqueue sync jobs rather than mirroring inside the main transaction',()=>{
  for (const kind of ['assignment_draft','task_draft','task_report_draft','assignment_report_draft','research_report_draft']) assert.ok(app.includes("jobKind:'"+kind+"'"), 'missing job kind '+kind);
  assert.ok(app.includes('async function enqueueRepositorySyncJob(client,'));
  assert.ok(app.includes('async function runAndReadRepositorySync(jobId)'));
});
test('Task Report Repository snapshot timestamp is stable for one persisted row',()=>{
  assert.ok(privateDraftRepository.includes('task.contribution_updated_at || task.updated_at || task.created_at || Date.now()'));
  assert.ok(privateDraftRepository.includes('assignment.updated_at || assignment.created_at || Date.now()'));
  assert.ok(privateDraftRepository.includes('task.updated_at || task.created_at || Date.now()'));
  assert.ok(privateDraftRepository.includes('`Saved: ${savedAt}`'));
});
test('worker rebuilds all affected repository artifacts from committed source records',()=>{
  for (const token of ['buildAssignmentDraftSnapshot','buildTaskDraftSnapshot','buildTaskReportDraftSnapshot','buildGeneratedReportDraftSnapshot','buildResearchDraftArtifact']) assert.ok(app.includes(token), 'missing renderer '+token);
  assert.ok(app.includes('async function drainRepositorySyncQueue()'));
  assert.ok(app.includes('async function saveRepositorySyncAndCompleteJob(job, saveWithClient)'));
  assert.ok(app.includes('savedAt: job.created_at'));
  assert.ok(researchDraftRepository.includes('sourceSavedAt||Date.now()')); 
  assert.ok(app.includes('RESEARCH_SECTION_NOTIFICATION_WRITE_FAILED'));
  assert.ok(app.includes('TASK_REPORT_SAVE_READBACK_FAILED'));
});
test('Task Report Draft sync is queued transactionally without blocking the save response',()=>{
  const start=app.indexOf("app.patch('/api/assignments/:id/tasks/:taskId/contribution',authenticate");
  const end=app.indexOf("app.post('/api/assignments/:id/tasks/:taskId/contribution-review',authenticate",start);
  assert.ok(start>=0&&end>start);
  const route=app.slice(start,end);
  assert.ok(route.includes("enqueueRepositorySyncJob(client,{jobKind:'task_report_draft'"));
  assert.ok(route.includes("v.contributionStatus==='Draft'"), 'confirmed Draft saves enqueue the Repository working copy');
  assert.ok(!route.includes('isAutoSave'));
  assert.ok(!route.includes('await runAndReadRepositorySync(row.repository_sync_job_id)'), 'Save Draft must not wait for Repository rendering');
  assert.ok(route.includes("repository_sync_status:row.repository_sync_job_id?'pending':'unavailable'"));
  assert.ok(route.includes('Repository synchronization is queued and will finish in the background.'));
  assert.ok(!route.includes('savePrivateDraftRepositoryVersion('));
});
test('Research primary save route enqueues a draft sync without calling the renderer inside its transaction',()=>{
  const start=app.indexOf("'/api/research/:id/report/:sectionId'");
  const end=app.indexOf("app.get('/api/research/:id/report/versions',authenticate",start);
  assert.ok(start>=0&&end>start);
  const route=app.slice(start,end);
  assert.ok(route.includes("enqueueRepositorySyncJob(client,{jobKind:'research_report_draft'"));
  assert.ok(!route.includes('saveResearchDraftRepositoryVersion('));
  assert.ok(route.includes('await runAndReadRepositorySync(repositorySyncJobId)'));
});
test('Assignment create and update enqueue outbox jobs inside the primary transaction',()=>{
  const createStart=app.indexOf("app.post('/api/assignments',authenticate");
  const createEnd=app.indexOf("app.use('/api/assignments/:id',authenticate",createStart);
  assert.ok(createStart>=0&&createEnd>createStart);
  const create=app.slice(createStart,createEnd);
  assert.ok(create.includes("jobKind:'assignment_draft'"));
  assert.ok(!create.includes('savePrivateDraftRepositoryVersion('));
  const updateStart=app.indexOf("app.patch('/api/assignments/:id',authenticate",createEnd);
  const updateEnd=app.indexOf("app.delete('/api/assignments/:id',authenticate",updateStart);
  assert.ok(updateStart>=0&&updateEnd>updateStart);
  const update=app.slice(updateStart,updateEnd);
  assert.ok(update.includes("jobKind:'assignment_draft'"));
  assert.ok(!update.includes('savePrivateDraftRepositoryVersion('));
});
test('Task metadata save enqueues a draft sync with the authoritative task update',()=>{
  const createStart=app.indexOf("app.post('/api/assignments/:id/tasks',authenticate");
  const createEnd=app.indexOf("app.patch('/api/assignments/:id/tasks/:taskId',authenticate",createStart);
  assert.ok(createStart>=0&&createEnd>createStart);
  const create=app.slice(createStart,createEnd);
  assert.ok(create.includes("jobKind:'task_draft'"));
  assert.ok(!create.includes('savePrivateDraftRepositoryVersion('));
  const updateStart=createEnd;
  const updateEnd=app.indexOf("app.patch('/api/assignments/:id/tasks/:taskId/reviewer',authenticate",updateStart);
  assert.ok(updateEnd>updateStart);
  const update=app.slice(updateStart,updateEnd);
  assert.ok(update.includes("jobKind:'task_draft'"));
  assert.ok(!update.includes('savePrivateDraftRepositoryVersion('));
});
test('Assignment report section persistence commits section data and queues sync in the same transaction',()=>{
  const start=app.indexOf("app.patch('/api/generated-documents/:id/sections/:sectionId',authenticate");
  const end=app.indexOf("app.post('/api/generated-documents/:id/sections/:sectionId/lock',authenticate",start);
  assert.ok(start>=0&&end>start);
  const route=app.slice(start,end);
  assert.ok(route.includes('UPDATE generated_document_sections'));
  assert.ok(route.includes("jobKind:'assignment_report_draft'"));
  assert.ok(!route.includes('savePrivateDraftRepositoryVersion('));
});
test('Task list reads default to the main API rather than the unavailable Shadow API',()=>{
  assert.ok(api.includes('import.meta.env.VITE_TASKS_READ_SOURCE || "node"'));
});
test('Assignment Report preview remains available from saved content if refresh fails',()=>{
  assert.ok(assignmentBuilder.includes('Preview is using the saved content; the live report refresh is temporarily unavailable.'));
  assert.ok(assignmentBuilder.includes('const saved = await save(false, latestValue)'));
});
test('Research preview falls back to the successfully saved local section when refresh fails',()=>{
  assert.ok(appTsx.includes('PREVIEW ONLY — this section was not saved to APP2. The preview uses the current editor content. Save error:'));
  assert.ok(appTsx.includes('Unsaved content has been kept open; navigation was cancelled.'));
  assert.ok(appTsx.includes('setResearchReportPreviewOpen(true)'));
});
test('Research Save Draft differentiates primary save success from Repository sync status',()=>{
  assert.ok(researchBuilder.includes('saved?: boolean; message?: string'));
  assert.ok(researchBuilder.includes('result.saved === false'));
  assert.ok(researchBuilder.includes('setMessage(result.message)'));
});
test('Outbox worker marks a job done in the same transaction as Repository artifact creation',()=>{
  assert.ok(app.includes('async function saveRepositorySyncAndCompleteJob(job, saveWithClient)'));
  assert.ok(app.includes('savedAt: job.created_at'));
  assert.ok(researchDraftRepository.includes('sourceSavedAt||Date.now()')); 
  assert.ok(app.includes("status='done',repository_document_id=$1,repository_version=$2"));
});

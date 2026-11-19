import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const auth=fs.readFileSync(new URL('../src/auth.js',import.meta.url),'utf8')
const scope=fs.readFileSync(new URL('../src/scope.js',import.meta.url),'utf8')
const worker=fs.readFileSync(new URL('../src/felix-index-worker.js',import.meta.url),'utf8')
const frontend=fs.readFileSync(new URL('../../src/App.tsx',import.meta.url),'utf8')
const externalReader=fs.readFileSync(new URL('../../src/ExternalResearchReader.tsx',import.meta.url),'utf8')
const theme=fs.readFileSync(new URL('../../src/theme-preferences.ts',import.meta.url),'utf8')
const felixAdmin=fs.readFileSync(new URL('../../src/FelixAdmin.tsx',import.meta.url),'utf8')
const felixMainPath=new URL('../../../ai-research-service/app/main.py',import.meta.url)
const repositoryIndexPath=new URL('../../../ai-research-service/app/services/repository_index.py',import.meta.url)
const felixUnavailable='Felix intentionally disabled; restoration deferred to a separately authorized phase'


test('Director, Deputy Director and Assistant Director use explicit management scope',()=>{
  assert.match(scope,/organisationScopeRoles=\['System Admin','Director'\]/)
  assert.match(scope,/teamScopeRoles=\['Deputy Director','Assistant Director'\]/)
  assert.match(scope,/WITH RECURSIVE managed/)
  assert.match(app,/const management=isManagementRole\(req\.user\.role\)/)
  assert.match(app,/scope:\{type:all\?'ORGANISATION':'TEAM_SUBTREE'/)
  assert.match(auth,/This record is outside your permitted team scope/)
  assert.match(app,/You may allocate assignments only within your reporting subtree/)
  assert.match(app,/You may add only members from your reporting subtree/)
  assert.match(app,/Task owners and reviewers must belong to your reporting subtree/)
})


test('repository decisions require the current document version to be read',()=>{
  assert.match(app,/DOCUMENT_VIEWED/)
  assert.match(app,/requireDocumentReadBeforeDecision/)
  assert.match(app,/Open and read the current document version before recording a review decision/)
  assert.match(frontend,/Read before decision/)
  assert.match(frontend,/Open current document/)
})


test('imported external research has the same read-before-decision gate',()=>{
  assert.match(app,/research-imports\/:id\/start-review[\s\S]*requireDocumentReadBeforeDecision/)
  assert.match(app,/research-imports\/:id\/decision[\s\S]*requireDocumentReadBeforeDecision/)
  assert.match(externalReader,/currentVersionRead/)
  assert.match(externalReader,/Read current version first/)
  assert.match(externalReader,/All decisions require the current version to have been read/)
})


test('Felix publication indexing is background-only and preserves publication identity',{skip:!fs.existsSync(felixMainPath)?felixUnavailable:false},()=>{
  const felixMain=fs.readFileSync(felixMainPath,'utf8')
  assert.match(worker,/Indexing is a background publication service/)
  assert.match(worker,/COALESCE\(k\.approved_by,k\.created_by\)/)
  assert.match(worker,/k\.status='Published' AND k\.felix_enabled=TRUE AND k\.is_archived=FALSE/)
  assert.match(worker,/\/api\/documents\/\$\{job\.knowledge_id\}\/index/)
  assert.match(app,/enqueueFelixDocumentIndex/)
  assert.match(felixMain,/\/api\/admin\/index-app2/)
  assert.match(felixAdmin,/Refresh App2 index/)
  assert.match(felixAdmin,/felixIndexApp2Source/)
})


test('PSC Executive is the default fallback without removing other themes',()=>{
  assert.match(theme,/themeMode: "Executive Gold"/)
  assert.match(frontend,/theme === "Executive Gold" \? "PSC Executive" : theme/)
  assert.match(frontend,/preferences\.theme_mode \|\| "Executive Gold"/)
})


test('Felix refreshes App2 system knowledge at startup/change and published documents at startup',{skip:!fs.existsSync(felixMainPath)||!fs.existsSync(repositoryIndexPath)?felixUnavailable:false},()=>{
  const felixMain=fs.readFileSync(felixMainPath,'utf8')
  const repositoryIndex=fs.readFileSync(repositoryIndexPath,'utf8')
  assert.match(worker,/reconcilePublishedDocuments\(\)\.then\(pump\)/)
  assert.match(worker,/status='Pending',attempts=0,next_attempt_at=NOW\(\)/)
  assert.match(felixMain,/app2_source_index_watch_loop/)
  assert.match(felixMain,/repository_fingerprint/)
  assert.match(felixMain,/source_index_task = asyncio\.create_task\(app2_source_index_watch_loop\(\)\)/)
  assert.match(repositoryIndex,/\.app2-guard/)
  assert.match(repositoryIndex,/def repository_fingerprint/)
})

test('Felix uses live RBAC-filtered App2 users instead of embedding a stale directory',{skip:!fs.existsSync(felixMainPath)?felixUnavailable:false},()=>{
  const felixMain=fs.readFileSync(felixMainPath,'utf8')
  assert.match(app,/app\.get\('\/api\/users',authenticate,authorize\('System Admin','Director','Deputy Director','Deputy Director','Assistant Director'\)/)
  assert.match(auth,/allowed\.includes\('Deputy Director'\)&&isManagementRole\(req\.user\.role\)/)
  assert.match(felixMain,/paths\.append\("users"\)/)
  assert.match(felixMain,/USER DIRECTORY ACCESS/)
  assert.match(felixMain,/USER: \{compact\(item\.get\('name'\)\)\}/)
  assert.match(felixMain,/is_live_user_directory_request/)
  assert.match(felixMain,/what role does/)
  assert.match(felixMain,/APP2 USER MATCHES/)
  assert.match(felixMain,/App2 live operational retrieval/)
  assert.doesNotMatch(felixMain,/password_hash.*USER:/)
})

test('Felix preserves the selected App2 document scope from the chat UI',{skip:!fs.existsSync(felixMainPath)?felixUnavailable:false},()=>{
  const felixMain=fs.readFileSync(felixMainPath,'utf8')
  assert.match(felixMain,/document_id: str \| None = None/)
  assert.match(felixMain,/retrieval_mode: Literal\["document", "all"\] \| None = None/)
  assert.match(felixMain,/allowed_document_ids = \[UUID\(body\.document_id\)\]/)
  assert.match(felixMain,/allowed_document_ids=allowed_document_ids/)
})

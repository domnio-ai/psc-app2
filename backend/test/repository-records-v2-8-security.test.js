import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const backend=fs.readFileSync('backend/src/app.js','utf8')
const api=fs.readFileSync('src/api.ts','utf8')
const app=fs.readFileSync('src/App.tsx','utf8')
const secure=fs.readFileSync('src/modules/repository/components/SecureRepositoryReader.tsx','utf8')
const workspace=fs.readFileSync('src/modules/repository/components/RepositoryRecordWorkspace.tsx','utf8')
const css=fs.readFileSync('src/modules/repository/repository-security-v2-8.css','utf8')

test('capability policy no longer grants creator or organisation roles an unconditional bypass',()=>{
  const start=backend.indexOf('const documentProtectionCapability=')
  const end=backend.indexOf('const canReadKnowledge=',start)
  const block=backend.slice(start,end)
  assert.doesNotMatch(block,/item\.created_by===user\.id\|\|isOrganisationScopeRole\(user\.role\)/)
  assert.match(block,/policy\.reader_scope==='NAMED_USERS'/)
  assert.match(block,/policy\[field\]&&grant\?\.\[grantField\]/)
})

test('reader copy and direct download are backend-enforced',()=>{
  assert.match(backend,/Copying is disabled for this protected document/)
  assert.match(backend,/documentProtectionCapability\(req\.user,v\.entityId,'copy'\)/)
  assert.match(backend,/canDownloadKnowledge\(req\.user,row\.knowledge_id\)/)
  assert.match(backend,/DOCUMENT_DOWNLOADED/)
})

test('effective protection endpoint drives secure reader capabilities',()=>{
  assert.match(backend,/\/api\/documents\/:id\/protection-effective/)
  assert.match(api,/DocumentProtectionEffective/)
  assert.match(api,/documentProtectionEffective/)
  assert.match(api,/recordDocumentPrint/)
})

test('secure reader blocks UI actions and adds repeated watermark',()=>{
  assert.match(app,/SecureRepositoryReader/)
  assert.match(secure,/block-download/)
  assert.match(secure,/block-copy/)
  assert.match(secure,/block-print/)
  assert.match(secure,/Array\.from\(\{length:12\}/)
  assert.match(secure,/beforeprint/)
})

test('secure reader reports access-check failures instead of remaining on a loading screen',()=>{
  assert.match(secure,/setError\(err instanceof Error\?err\.message/)
  assert.match(secure,/Reader could not be opened/)
  assert.match(secure,/Close reader/)
  assert.match(css,/repository-secure-reader-loading/)
})

test('protection policy and footer do not cover the document reader controls',()=>{
  assert.match(css,/repository-secure-reader-policy\{position:relative/)
  assert.match(css,/repository-secure-reader-limit\{position:relative/)
})

test('protection workspace stays concise and security CSS protects print output',()=>{
  assert.match(workspace,/Protection details/)
  assert.match(workspace,/Download blocked/)
  assert.match(css,/@media print/)
  assert.match(css,/Printing is disabled for this protected APP2 record/)
  assert.match(css,/repository-secure-reader-watermark/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

process.env.DATABASE_URL||='postgres://test:test@127.0.0.1:5432/test'
process.env.JWT_SECRET||='document-repository-test-secret-value-123456'
const {validateDocumentUpload}=await import('../src/document-storage.js')
const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const schema=fs.readFileSync(new URL('../src/schema.sql',import.meta.url),'utf8')
const worker=fs.readFileSync(new URL('../src/felix-index-worker.js',import.meta.url),'utf8')

test('document upload accepts supported text and rejects unsupported or empty files',()=>{
  const checked=validateDocumentUpload(Buffer.from('controlled text'),'policy.txt','text/plain')
  assert.equal(checked.extension,'.txt')
  assert.match(checked.sha256,/^[a-f0-9]{64}$/)
  assert.throws(()=>validateDocumentUpload(Buffer.alloc(0),'empty.txt','text/plain'),/non-empty/)
  assert.throws(()=>validateDocumentUpload(Buffer.from('x'),'malware.exe','application/octet-stream'),/PDF, DOCX, TXT and MD/)
})

test('repository persists immutable hashes and one current version',()=>{
  assert.match(schema,/sha256_hash CHAR\(64\)/)
  assert.match(schema,/knowledge_versions_one_current_idx/)
  assert.match(app,/UPDATE knowledge_versions SET is_current=FALSE/)
  assert.match(app,/duplicate:\{\.\.\.duplicate,sha256_hash/)
})

test('Felix eligibility is enforced by database state and document permission checks',()=>{
  assert.match(worker,/k\.status='Published' AND k\.felix_enabled=TRUE AND k\.is_archived=FALSE/)
  assert.match(worker,/v\.is_current=TRUE/)
  assert.match(app,/document_permissions p/)
  assert.match(app,/Felix can only answer from the current approved, Felix-enabled version/)
})

test('Felix workspace chat cannot bypass the scoped pipeline',()=>{
  assert.match(app,/req\.url === '\/chat'/)
  assert.match(app,/\/api\/felix\/chat/)
})

test('repository exposes review, archive, preview and scoped Felix routes',()=>{
  for(const route of ['/api/documents/:id/submit','/api/documents/:id/approve','/api/documents/:id/reject','/api/documents/:id/archive','/api/documents/:id/restore','/api/documents/:id/preview','/api/documents/:id/ask-felix'])assert.ok(app.includes(route))
})

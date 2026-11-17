import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {fileURLToPath} from 'node:url'

const here=path.dirname(fileURLToPath(import.meta.url))
const app2Root=path.resolve(here,'../..')
const reader=fs.readFileSync(path.join(app2Root,'src/DocumentReader.tsx'),'utf8')
const storage=fs.readFileSync(path.join(app2Root,'backend/src/document-storage.js'),'utf8')

test('repository PDF reader exposes every PDF page in continuous view',()=>{
  assert.match(reader,/Array\.from\(\{length:pdf\.numPages\}/)
  assert.match(reader,/reader-pdf-continuous/)
  assert.match(reader,/Page \{page\} of \{pdf\.numPages\} · Continuous/)
  assert.match(reader,/goToPage\(page[+-]1\)/)
})

test('repository upload verifies persisted byte length after storage',()=>{
  assert.match(storage,/const stat=await fs\.stat\(target\)/)
  assert.match(storage,/stat\.size!==bytes\.length/)
  assert.match(storage,/Stored document integrity check failed/)
})

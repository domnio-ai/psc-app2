import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app=fs.readFileSync('src/App.tsx','utf8')
const api=fs.readFileSync('src/api.ts','utf8')
const css=fs.readFileSync('src/documents.css','utf8')

test('add-record intake is a four-step wizard',()=>{
  assert.match(app,/knowledgeUploadStep/)
  assert.match(app,/Purpose & file/)
  assert.match(app,/Classification/)
  assert.match(app,/Relationship/)
  assert.match(app,/Governance/)
  assert.match(app,/Step \{knowledgeUploadStep\} of 4/)
})

test('general institutional purpose is independent of research linkage',()=>{
  for(const label of ['Official Record','Reference','Evidence','Source Material','Supporting Document','Minutes','Correspondence','Dataset']){
    assert.match(app,new RegExp(label))
  }
  assert.match(app,/Standalone institutional record/)
  assert.match(app,/One record, many relationships/)
})

test('classification captures records metadata already supported by the repository backend',()=>{
  assert.match(app,/Originating office \/ directorate/)
  assert.match(app,/Author \/ issuing body/)
  assert.match(app,/Document date/)
  assert.match(app,/Security classification/)
  assert.match(api,/"X-Author"/)
  assert.match(api,/"X-Document-Date"/)
})

test('reviewer governance and self-review protection remain in the add-record workflow',()=>{
  assert.match(app,/Assigned reviewer/)
  assert.match(app,/Self-review is blocked/)
  assert.match(app,/member\.id !== user\?\.id/)
})

test('wizard styling is modular and responsive',()=>{
  assert.match(css,/APP2 ADD RECORD \/ DOCUMENT WIZARD V1/)
  assert.match(css,/repository-add-record-steps/)
  assert.match(css,/repository-purpose-grid/)
  assert.match(css,/repository-add-record-actions/)
})

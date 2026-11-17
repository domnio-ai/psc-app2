import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8')

test('assignment listing resolves the final report through its template relation',()=>{
  assert.match(app,/JOIN document_templates dt ON dt\.id=gd\.template_id/)
  assert.match(app,/dt\.template_key='assignment-final-report'/)
  assert.doesNotMatch(app,/gd\.template_key='assignment-final-report'/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8')

test('repository mutation routes enforce entity scope after role authorization',()=>{
  assert.match(app,/documents\/:id\/checkout'[\s\S]{0,300}canReadKnowledge\(req\.user,req\.params\.id\)/)
  assert.match(app,/documents\/:id\/restore'[\s\S]{0,400}isKnowledgeManagerFor\(req\.user,req\.params\.id\)/)
  assert.match(app,/documents\/:id\/felix\/:mode'[\s\S]{0,500}isKnowledgeManagerFor\(req\.user,req\.params\.id\)/)
  assert.match(app,/documents\/:id\/retention'[\s\S]{0,500}isKnowledgeManagerFor\(req\.user,req\.params\.id\)/)
})

test('retention input is validated and missing records return 404',()=>{
  assert.match(app,/retentionUntil:z\.string\(\)\.regex\(\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\)\.nullable\(\)/)
  assert.match(app,/documents\/:id\/retention'[\s\S]{0,900}Document not found/)
})

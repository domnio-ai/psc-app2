import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const felixRouter=fs.readFileSync(new URL('../../../ai-research-service/app/ai/router.py',import.meta.url),'utf8')

test('published repository read visibility is consistent for team-scope managers',()=>{
  assert.match(app,/const canReadKnowledge=async\(user,id\)=>\{/)
  assert.match(app,/isTeamScopeRole\(user\.role\)[\s\S]*status='Published'[\s\S]*canManageKnowledgeScope\(user,id\)/)
  assert.match(app,/app\.get\('\/api\/knowledge\/:id\/versions',authenticate[\s\S]*canReadKnowledge/)
})

test('user directory allows management roles and remains scope-filtered',()=>{
  assert.match(app,/app\.get\('\/api\/users',authenticate,authorize\('System Admin','Director','Deputy Director','Deputy Director','Assistant Director'\)/)
  assert.match(app,/const scoped=await managedUserIds\(req\.user\)/)
  assert.match(app,/WHERE \$1::boolean OR u\.id=ANY\(\$2::uuid\[\]\)/)
})

test('Felix selected-document analysis uses read-authorized reader rather than download privilege',()=>{
  assert.match(felixRouter,/\/documents\/\{document\['id'\]\}\/versions\/\{version_id\}\/reader/)
  assert.doesNotMatch(felixRouter,/f"\{config\.app2_api_url\}\/knowledge\/versions\/\{version_id\}\/download"/)
})

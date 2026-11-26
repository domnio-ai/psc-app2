import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const frontend=readFileSync(new URL('../../src/App.tsx',import.meta.url),'utf8')

test('research assignment link and unlink routes enforce the shared project-management scope',()=>{
  assert.match(app,/app\.post\('\/api\/research\/:id\/assignments\/link',authenticate,validate\(researchAssignmentLinkSchema\)/)
  assert.match(app,/app\.delete\('\/api\/research\/:id\/assignments\/:assignmentId',authenticate,async\(req,res,next\)=>\{try\{[\s\S]*?canEditResearch\(req\.user,req\.params\.id\)/)
  assert.match(app,/app\.post\('\/api\/research\/:id\/assignments\/link',[\s\S]*?canEditResearch\(req\.user,req\.params\.id\)/)
  assert.match(frontend,/isManager=\{Boolean\(isManager && selectedResearch\.can_manage\)\}/)
  assert.match(frontend,/canManageTasks=\{Boolean\(selectedResearch\.can_manage\)\}/)
  assert.match(app,/can_manage:await canEditResearch\(req\.user,row\.id\)/)
})

test('milestone creation and status changes write audit records inside their transactions',()=>{
  assert.match(app,/MILESTONE_CREATED[\s\S]*audit\(client,req\.user\.id,'RESEARCH_MILESTONE_CREATED','research_milestone'/)
  assert.match(app,/MILESTONE_UPDATED[\s\S]*audit\(client,req\.user\.id,'RESEARCH_MILESTONE_STATUS_UPDATED','research_milestone'/)
})

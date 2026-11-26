import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const frontend=readFileSync(new URL('../../src/App.tsx',import.meta.url),'utf8')

test('research assignment link and unlink API permissions match the manager roles exposed by the frontend',()=>{
  const allowed="authorize('System Admin','Director','Deputy Director','Assistant Director')"
  assert.match(app,new RegExp("app\\.post\\('/api/research/:id/assignments/:assignmentId',authenticate,"+allowed.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')))
  assert.match(app,new RegExp("app\\.delete\\('/api/research/:id/assignments/:assignmentId',authenticate,"+allowed.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')))
  assert.match(frontend,/\["System Admin", "Director", "Deputy Director", "Assistant Director"\]\.includes\(user\.role\)/)
})

test('milestone creation and status changes write audit records inside their transactions',()=>{
  assert.match(app,/MILESTONE_CREATED[\s\S]*audit\(client,req\.user\.id,'RESEARCH_MILESTONE_CREATED','research_milestone'/)
  assert.match(app,/MILESTONE_UPDATED[\s\S]*audit\(client,req\.user\.id,'RESEARCH_MILESTONE_STATUS_UPDATED','research_milestone'/)
})

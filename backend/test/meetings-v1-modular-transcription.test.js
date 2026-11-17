import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const routes=fs.readFileSync(new URL('../src/meetings/meetings-routes.js',import.meta.url),'utf8')
const schema=fs.readFileSync(new URL('../src/meetings/schema.sql',import.meta.url),'utf8')
const front=fs.readFileSync(new URL('../../src/App.tsx',import.meta.url),'utf8')
const workspace=fs.readFileSync(new URL('../../src/modules/meetings/MeetingsWorkspace.tsx',import.meta.url),'utf8')

test('Meetings V1 is registered as a backend module rather than embedded route logic',()=>{
  assert.match(app,/registerMeetingsRoutes/)
  assert.match(app,/\.\/meetings\/meetings-routes\.js/)
  assert.match(routes,/export function registerMeetingsRoutes\(app\)/)
})

test('Meetings V1 persists governed lifecycle entities',()=>{
  for(const table of ['meetings','meeting_participants','meeting_agenda_items','meeting_transcripts','meeting_transcript_segments','meeting_minutes','meeting_decisions','meeting_actions']) assert.match(schema,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`))
})

test('Meetings V1 transcription stays in a dedicated local adapter',()=>{
  assert.match(routes,/runTranscription/)
  assert.match(routes,/transcribe\.py/)
  assert.match(routes,/\/api\/meetings\/:id\/transcription\/audio/)
  assert.match(routes,/MEETING_TRANSCRIPT_CORRECTED/)
})

test('Meetings V1 integrates Calendar notifications reviewer governance and audit',()=>{
  assert.match(routes,/calendar_events/)
  assert.match(routes,/notifications/)
  assert.match(routes,/Minutes cannot be self-reviewed/)
  assert.match(routes,/MEETING_MINUTES_APPROVED/)
  assert.match(routes,/audit_logs/)
})

test('Meetings V1 frontend is lazy-mounted and modular',()=>{
  assert.match(front,/MeetingsWorkspace = lazy/)
  assert.match(front,/active === "Meetings"/)
  assert.match(front,/"Meetings"/)
  assert.match(workspace,/Agenda/)
  assert.match(workspace,/Transcript/)
  assert.match(workspace,/Decisions & Actions/)
  assert.match(workspace,/Start recording/)
})


test('Meetings V1.0.1 guards the modular mount on a resolved signed-in user id',()=>{
  assert.match(front,/active === "Meetings"/)
  assert.match(front,/user\.id \? \(/)
  assert.match(front,/currentUser=\{\{ id: user\.id, name: user\.name, role: user\.role \}\}/)
  assert.match(front,/Signed-in account ID is unavailable/)
})


test('Meetings preserves the protected Awareness and Collaboration navigation contracts',()=>{
  assert.match(front,/label: "Awareness"[\s\S]*items: \["Notifications", "Notice Board", "Calendar", "Reports & Analytics"\]/)
  assert.match(front,/label: "Collaboration"[\s\S]*items: \["Messages", "Meetings"\]/)
  assert.match(front,/label: "Collaboration", items: \["Messages", "Meetings"\]/)
})

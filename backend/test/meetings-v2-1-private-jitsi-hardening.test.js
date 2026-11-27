import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root=path.resolve(process.cwd())
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8')

test('Meetings V2.1 disables public Jitsi fallback',()=>{
  const source=read('backend/src/meetings/live-conference.js')
  assert.doesNotMatch(source,/APP2_CONFERENCE_URL\|\|'https:\/\/meet\.jit\.si'/)
  assert.match(source,/Public meet\.jit\.si is disabled for APP2/)
  assert.match(source,/requireConferenceConfig/)
  assert.match(source,/provider:'jitsi-self-hosted'/)
})

test('Meetings V2.1 requires HTTPS for private Jitsi',()=>{
  const source=read('backend/src/meetings/live-conference.js')
  assert.match(source,/parsed\.protocol!==['"]https:['"]/)
  assert.match(source,/APP2_CONFERENCE_ALLOW_INSECURE_LOCAL/)
})

test('Meetings V2.1 creates opaque random conference room identifiers',()=>{
  const source=read('backend/src/meetings/live-conference.js')
  assert.match(source,/crypto\.randomBytes\(18\)/)
  assert.match(source,/app2-private-/)
  assert.doesNotMatch(source,/createHash\('sha256'\).*meetingId/)
})

test('Meetings V2.1 exposes authenticated private provider health',()=>{
  const source=read('backend/src/meetings/live-conference.js')
  assert.match(source,/\/api\/meetings-live\/provider-status/)
  assert.match(source,/Private Jitsi is reachable/)
  assert.match(source,/AbortController/)
})

test('Meetings V2.1 frontend visibly reports private provider state',()=>{
  const room=read('src/modules/meetings/live/LiveMeetingRoom.tsx')
  const api=read('src/modules/meetings/meetingsApi.ts')
  assert.match(api,/conferenceProviderStatus/)
  assert.match(room,/PRIVATE LIVE/)
  assert.match(room,/Private Jitsi/)
  assert.match(room,/Private conference service not configured/)
  assert.doesNotMatch(room,/public Jitsi service/)
})

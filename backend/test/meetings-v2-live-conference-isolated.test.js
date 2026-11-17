import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root=path.resolve(process.cwd())
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8')

test('Meetings V2 live conference stays inside the Meetings module',()=>{
  const workspace=read('src/modules/meetings/MeetingsWorkspace.tsx')
  const live=read('src/modules/meetings/live/LiveMeetingRoom.tsx')
  const routes=read('backend/src/meetings/meetings-routes.js')
  assert.match(workspace,/\.\/live\/LiveMeetingRoom/)
  assert.match(routes,/\.\/live-conference\.js/)
  assert.match(live,/live-room-shell/)
  assert.doesNotMatch(live,/src\/App\.tsx|AssignmentsWorkspace|ResearchWorkspace|Repository/)
})

test('live room provides Zoom-style media surface and App2 governed sidecar',()=>{
  const live=read('src/modules/meetings/live/LiveMeetingRoom.tsx')
  assert.match(live,/allow="camera; microphone; display-capture; fullscreen; autoplay; clipboard-write"/)
  assert.match(live,/People.*Agenda.*Transcript.*Actions/s)
  assert.match(live,/End for all/)
  assert.match(live,/Record decision/)
  assert.match(live,/Assign action/)
})

test('conference backend enforces access, management, audit and presence',()=>{
  const source=read('backend/src/meetings/live-conference.js')
  for(const marker of [
    "conference/start","conference/join","conference/leave","conference/end","conference/presence",
    'requireAccess','requireManage','managedUserIds','MEETING_CONFERENCE_STARTED','MEETING_CONFERENCE_JOINED','MEETING_CONFERENCE_ENDED'
  ]) assert.match(source,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')))
})

test('conference provider remains isolated and is now private-self-hosted only',()=>{
  const backend=read('backend/src/meetings/live-conference.js')
  const frontend=read('src/modules/meetings/live/LiveMeetingRoom.tsx')
  assert.match(backend,/APP2_CONFERENCE_URL/)
  assert.match(backend,/private-self-hosted/)
  assert.match(backend,/meet\.jit\.si is disabled/)
  assert.match(frontend,/Private Jitsi/)
  assert.doesNotMatch(frontend,/public Jitsi service/)
})

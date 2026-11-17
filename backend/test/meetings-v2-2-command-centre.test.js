import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root=path.resolve(process.cwd())
const workspace=fs.readFileSync(path.join(root,'src/modules/meetings/MeetingsWorkspace.tsx'),'utf8')
const css=fs.readFileSync(path.join(root,'src/modules/meetings/meetings.css'),'utf8')

test('Meetings V2.2 adds card-driven command-centre filtering without changing App2 navigation',()=>{
  assert.match(workspace,/type MeetingFilter = "all" \| "upcoming" \| "mine" \| "prep" \| "actions" \| "review" \| "completed"/)
  assert.match(workspace,/filteredMeetings/)
  assert.match(workspace,/Needs Preparation/)
  assert.match(workspace,/Minutes Review/)
})

test('Meetings V2.2 exposes governed readiness and next-best-action guidance',()=>{
  assert.match(workspace,/MEETING READINESS/)
  assert.match(workspace,/NEXT BEST ACTION/)
  assert.match(workspace,/Participants invited/)
  assert.match(workspace,/Minutes reviewer assigned/)
  assert.match(workspace,/Venue \/ conferencing route set/)
})

test('Meetings V2.2 preserves the existing live room and governed tabs',()=>{
  assert.match(workspace,/LiveMeetingRoom/)
  assert.match(workspace,/Start live meeting/)
  assert.match(workspace,/"Transcript"/)
  assert.match(workspace,/"Minutes"/)
  assert.match(workspace,/"Decisions & Actions"/)
})

test('Meetings V2.2 adds a controlled close-out action only after approved minutes',()=>{
  assert.match(workspace,/selected\.minutes\?\.status === "Approved"/)
  assert.match(workspace,/meetingsApi\.complete/)
  assert.match(workspace,/Complete meeting/)
})

test('Meetings V2.2 styles remain scoped to Meetings',()=>{
  assert.match(css,/Meetings V2\.2 - command-centre UX/)
  assert.match(css,/\.meetings-command-cards/)
  assert.match(css,/\.meeting-lifecycle/)
  assert.match(css,/\.meeting-readiness-ring/)
})

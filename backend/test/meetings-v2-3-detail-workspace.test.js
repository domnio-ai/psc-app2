import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.cwd())
const front = fs.readFileSync(path.join(root, 'src/modules/meetings/MeetingsWorkspace.tsx'), 'utf8')
const css = fs.readFileSync(path.join(root, 'src/modules/meetings/meetings.css'), 'utf8')

test('Meetings V2.3.1 adds a compact detail summary without changing meeting logic', () => {
  assert.match(front, /meeting-detail-metrics/)
  assert.match(front, /PARTICIPANTS/)
  assert.match(front, /OPEN ACTIONS/)
  assert.match(front, /MINUTES/)
})

test('Meetings V2.3.1 keeps governed workspace tabs and adds contextual counts or state', () => {
  assert.match(front, /meeting-tabs-v23/)
  assert.match(front, /selected\.agenda\.length/)
  assert.match(front, /selected\.participants\.length/)
  assert.match(front, /selected\.transcript\?\.status/)
  assert.match(front, /selected\.minutes\?\.status/)
})

test('Meetings V2.3.1 uses theme-aware gradient refinement and responsive detail layout', () => {
  assert.match(css, /Meetings V2\.3 - detail workspace refinement/)
  assert.match(css, /meeting-detail-head-v23/)
  assert.match(css, /meeting-detail-metrics/)
  assert.match(css, /linear-gradient/)
  assert.match(css, /@media\(max-width:980px\)/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {isResearchTaskOverdue} from '../../src/modules/research/researchTaskDates.js'

test('date-only task deadline is not overdue during its due calendar day',()=>{
  const now=new Date(2026,10,26,9,0,0)
  assert.equal(isResearchTaskOverdue('2026-11-26',now),false)
})

test('date-only task deadline becomes overdue on the following local calendar day',()=>{
  const now=new Date(2026,10,27,0,1,0)
  assert.equal(isResearchTaskOverdue('2026-11-26',now),true)
})

test('future and missing task deadlines are not overdue',()=>{
  const now=new Date(2026,10,26,23,59,0)
  assert.equal(isResearchTaskOverdue('2026-11-27',now),false)
  assert.equal(isResearchTaskOverdue(null,now),false)
  assert.equal(isResearchTaskOverdue('',now),false)
})

test('invalid date-only deadlines are not treated as overdue',()=>{
  assert.equal(isResearchTaskOverdue('2026-13-40',new Date(2026,11,31)),false)
})

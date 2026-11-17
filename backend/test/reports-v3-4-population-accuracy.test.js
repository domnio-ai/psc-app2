import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const service=fs.readFileSync(new URL('../src/reports/institutional-intelligence.js',import.meta.url),'utf8')

test('V3.4 manager people population is period-aware and retains authorised zero-work users',()=>{
  assert.match(service,/FROM users u\s+LEFT JOIN LATERAL\(/)
  assert.match(service,/\(\$4='' OR a\.created_at::date>=\$4::date\)/)
  assert.match(service,/\(\$5='' OR a\.created_at::date<=\$5::date\)/)
  assert.match(service,/WHERE u\.active=TRUE AND\(\$1::boolean OR u\.id=ANY\(\$2::uuid\[\]\)\)/)
})

test('V3.4 active work combines assignment and owned-task evidence without staff scoring',()=>{
  assert.match(service,/COALESCE\(aw\.active_assignments,0\)\+COALESCE\(tw\.active_tasks,0\)/)
  assert.match(service,/t\.owner_id=u\.id AND t\.archived_at IS NULL/)
  assert.doesNotMatch(service,/staffScore|performanceScore|productivityScore/)
})

test('V3.4 research participation includes collaborators as well as research leads',()=>{
  assert.match(service,/rp\.lead_id=u\.id OR EXISTS\(SELECT 1 FROM research_collaborators prc/)
  assert.match(service,/researchCurrentSql\('rp'\)/)
})

test('V3.4 awaiting-review population is attributed to the actual reviewer',()=>{
  assert.match(service,/FROM research_report_versions v\s+WHERE v\.reviewer_id=u\.id/)
  assert.doesNotMatch(service,/LEFT JOIN research_report_versions v ON v\.submitted_by=u\.id/)
})

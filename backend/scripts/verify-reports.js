import {db,query} from '../src/db.js'
import {reportData} from '../src/reports/report-service.js'

const users=(await query("SELECT id,name,role,division FROM users WHERE role IN('Research Manager','Research Officer') ORDER BY role")).rows
const manager=users.find(user=>user.role==='Research Manager')
const officer=users.find(user=>user.role==='Research Officer')
if(!manager||!officer)throw new Error('Seeded manager and officer accounts are required for report verification.')
for(const key of ['assignment-status','overdue-ageing','workload-distribution','directorate-performance','executive-performance-overview','research-outputs','document-repository-activity','felix-usage-quality']){
  const result=await reportData(manager,key,{page:1,pageSize:25})
  console.log(`${key}: ${result.kpis.length} KPIs, ${result.rows.length} rows`)
}
const scoped=await reportData(officer,'assignment-status',{page:1,pageSize:25})
console.log(`officer-scope: ${scoped.scope.type}, ${scoped.pagination.total} records`)
await db.end()

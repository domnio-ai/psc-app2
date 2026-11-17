import fs from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'
import 'dotenv/config'

const {Pool}=pg
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required in backend/.env or the process environment.')
const pool=new Pool({
  connectionString:process.env.DATABASE_URL,
  ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:true}:false,
  max:1,
})
const files=[
  '033_records_management_foundation.sql',
  '034_repository_relationships_evidence.sql',
  '035_repository_document_protection.sql',
  '036_repository_records_completion_v2.sql',
]
try{
  for(const file of files){
    const sql=await fs.readFile(path.resolve('migrations',file),'utf8')
    await pool.query(sql)
    console.log(`MIGRATION APPLIED: ${file}`)
  }
  const {rows:[check]}=await pool.query(`SELECT
    to_regclass('public.document_access_policies') protection,
    to_regclass('public.repository_entity_links') relationships,
    to_regclass('public.repository_saved_views') saved_views,
    to_regclass('public.repository_retention_schedules') retention`)
  if(!check.protection||!check.relationships||!check.saved_views||!check.retention)
    throw new Error(`Repository database verification failed: ${JSON.stringify(check)}`)
  console.log('REPOSITORY DATABASE FOUNDATION VERIFIED')
}finally{
  await pool.end()
}

import fs from 'node:fs/promises'
import {db,transaction} from './db.js'

try {
  const sql=await fs.readFile(new URL('../migrations/20261030_03_meeting_supporting_documents.sql',import.meta.url),'utf8')
  await transaction(async client=>{
    await client.query(sql)
    const result=await client.query("SELECT to_regclass('public.meeting_attachments') AS table_name")
    if(!result.rows[0]?.table_name)throw new Error('The meeting_attachments table was not created.')
  })
  console.log('Meeting supporting documents database upgrade applied successfully.')
} catch(error) {
  console.error(`Meeting supporting documents database upgrade failed: ${error instanceof Error?error.message:String(error)}`)
  process.exitCode=1
} finally {
  await db.end()
}

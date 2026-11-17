import fs from 'node:fs/promises'
import {db} from '../src/db.js'
const sql=await fs.readFile(new URL('../migrations/040_internal_messaging.sql',import.meta.url),'utf8')
const client=await db.connect()
try{
  await client.query('BEGIN')
  await client.query(sql)
  await client.query('COMMIT')
  console.log('INTERNAL MESSAGING MIGRATION APPLIED')
}catch(error){
  await client.query('ROLLBACK')
  throw error
}finally{
  client.release()
  await db.end()
}

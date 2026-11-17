import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {query} from '../db.js'

const here=path.dirname(fileURLToPath(import.meta.url))
const sql=await fs.readFile(path.join(here,'schema.sql'),'utf8')
await query(sql)
console.log('MEETINGS MIGRATION APPLIED')
process.exit(0)

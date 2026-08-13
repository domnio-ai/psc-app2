import {createToken} from '../src/auth.js'
import {config} from '../src/config.js'
import {db} from '../src/db.js'

const administrator=(await db.query("SELECT id,name,email,role,division,status,token_version FROM users WHERE role='Administrator' AND active=TRUE ORDER BY created_at LIMIT 1")).rows[0]
if(!administrator)throw new Error('An active administrator is required for the authorized Felix backfill.')
const token=createToken(administrator)
const documents=(await db.query("SELECT id,title FROM knowledge_items WHERE status='Published' ORDER BY created_at")).rows
let indexed=0
for(const document of documents){
  const response=await fetch(`${config.aiResearchUrl}/api/documents/${document.id}/index`,{method:'POST',headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(60000)})
  if(response.ok){indexed+=1;console.log(`Indexed: ${document.title}`)}
  else console.error(`Skipped: ${document.title} (HTTP ${response.status})`)
}
console.log(`Felix backfill complete: ${indexed}/${documents.length} approved documents indexed.`)
await db.end()

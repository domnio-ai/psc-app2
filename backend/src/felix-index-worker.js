import {createToken} from './auth.js'
import {config} from './config.js'
import {query,transaction} from './db.js'

const MAX_BACKOFF_SECONDS=300

export const retryDelaySeconds=attempts=>Math.min(MAX_BACKOFF_SECONDS,Math.max(5,5*2**Math.min(attempts,6)))

export async function enqueueFelixDocumentIndex(client,knowledgeId,versionNumber,requestedBy){
  await client.query(
    `INSERT INTO felix_document_index_jobs(knowledge_id,version_number,requested_by,status,next_attempt_at)
     VALUES($1,$2,$3,'Pending',NOW())
     ON CONFLICT(knowledge_id,version_number) DO UPDATE
     SET requested_by=EXCLUDED.requested_by,status='Pending',attempts=0,next_attempt_at=NOW(),
         last_error=NULL,completed_at=NULL,updated_at=NOW()`,
    [knowledgeId,versionNumber,requestedBy]
  )
}

export async function reconcilePublishedDocuments(){
  await query(
    `INSERT INTO felix_document_index_jobs(knowledge_id,version_number,requested_by,status,next_attempt_at)
     SELECT k.id,k.current_version,COALESCE(k.approved_by,k.created_by),'Pending',NOW()
     FROM knowledge_items k
     WHERE k.status='Published' AND k.felix_enabled=TRUE AND k.is_archived=FALSE AND k.current_version>0
     ON CONFLICT(knowledge_id,version_number) DO UPDATE
     SET status='Pending',next_attempt_at=NOW(),last_error=NULL,updated_at=NOW()
     WHERE felix_document_index_jobs.status='Failed'`
  )
  await query(
    `UPDATE felix_document_index_jobs
     SET status='Pending',next_attempt_at=NOW(),last_error='Recovered an interrupted indexing attempt.',updated_at=NOW()
     WHERE status='Processing' AND updated_at<NOW()-INTERVAL '5 minutes'`
  )
}

async function claimJob(){
  return transaction(async client=>{
    const job=(await client.query(
      `SELECT id,knowledge_id,version_number,requested_by,attempts
       FROM felix_document_index_jobs
       WHERE status='Pending' AND next_attempt_at<=NOW()
       ORDER BY next_attempt_at,id
       FOR UPDATE SKIP LOCKED
       LIMIT 1`
    )).rows[0]
    if(!job)return null
    return (await client.query(
      `UPDATE felix_document_index_jobs
       SET status='Processing',attempts=attempts+1,updated_at=NOW()
       WHERE id=$1
       RETURNING *`,
      [job.id]
    )).rows[0]
  })
}

async function indexingUser(requestedBy){
  return (await query(
    `SELECT id,name,email,role,division,status,token_version
     FROM users
     WHERE active=TRUE AND(id=$1 OR role IN('Administrator','Research Manager'))
     ORDER BY CASE WHEN id=$1 THEN 0 WHEN role='Administrator' THEN 1 ELSE 2 END,id
     LIMIT 1`,
    [requestedBy]
  )).rows[0]
}

export async function processFelixIndexJob(){
  const job=await claimJob()
  if(!job)return false
  try{
    const eligible=(await query(`SELECT 1 FROM knowledge_items k JOIN knowledge_versions v ON v.knowledge_id=k.id
      WHERE k.id=$1 AND k.status='Published' AND k.felix_enabled=TRUE AND k.is_archived=FALSE
      AND k.current_version=$2 AND v.version_number=$2 AND v.is_current=TRUE`,[job.knowledge_id,job.version_number])).rowCount>0
    if(!eligible){
      await query("UPDATE felix_document_index_jobs SET status='Failed',last_error='Document/version is no longer eligible for indexing.',updated_at=NOW() WHERE id=$1",[job.id])
      return true
    }
    const user=await indexingUser(job.requested_by)
    if(!user)throw new Error('No active authorized App2 account is available for Felix indexing.')
    const controller=new AbortController()
    const timeout=setTimeout(()=>controller.abort(new Error('Felix indexing request timed out.')),config.felixIndexTimeoutMs)
    let response
    try{
      response=await fetch(`${config.aiResearchUrl}/api/documents/${job.knowledge_id}/index`,{
        method:'POST',
        headers:{Authorization:`Bearer ${createToken(user)}`},
        signal:controller.signal
      })
    }finally{
      clearTimeout(timeout)
    }
    if(!response.ok){
      const detail=(await response.text()).slice(0,500)
      throw new Error(`Felix returned HTTP ${response.status}${detail?`: ${detail}`:''}`)
    }
    // Best-effort cleanup is performed by the existing Felix service before replacing a
    // document index. Passing the exact current version prevents stale versions becoming active.
    await query(
      `UPDATE felix_document_index_jobs
       SET status='Completed',last_error=NULL,completed_at=NOW(),updated_at=NOW()
       WHERE id=$1`,
      [job.id]
    )
  }catch(error){
    const attempts=Number(job.attempts)
    const terminal=attempts>=8
    const delay=retryDelaySeconds(attempts)
    await query(
      `UPDATE felix_document_index_jobs
       SET status=$2::varchar,last_error=$3,
           next_attempt_at=CASE WHEN $2::varchar='Pending' THEN NOW()+($4::text||' seconds')::interval ELSE next_attempt_at END,
           updated_at=NOW()
       WHERE id=$1`,
      [job.id,terminal?'Failed':'Pending',String(error?.message||error).slice(0,1000),delay]
    )
    console.error(`Felix indexing job ${job.id} failed on attempt ${attempts}: ${error?.message||error}`)
  }
  return true
}

export function startFelixIndexWorker(){
  let processing=false
  const pump=async()=>{
    if(processing)return
    processing=true
    try{
      while(await processFelixIndexJob()){}
    }catch(error){
      console.error(`Felix indexing worker failed: ${error?.message||error}`)
    }finally{
      processing=false
    }
  }
  void reconcilePublishedDocuments().then(pump).catch(error=>console.error(`Felix reconciliation failed: ${error?.message||error}`))
  const workTimer=setInterval(()=>void pump(),config.felixIndexIntervalMs)
  const reconciliationTimer=setInterval(()=>void reconcilePublishedDocuments().then(pump).catch(error=>console.error(`Felix reconciliation failed: ${error?.message||error}`)),config.felixIndexReconcileMs)
  workTimer.unref?.()
  reconciliationTimer.unref?.()
  return ()=>{clearInterval(workTimer);clearInterval(reconciliationTimer)}
}

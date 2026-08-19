import {db} from './db.js'

const notifyExpiredNotices=async()=>{
  try{
    await db.query(`WITH expired AS(
      UPDATE alerts SET expiry_notified_at=NOW(),is_pinned=FALSE,pinned_at=NULL,pinned_by=NULL
      WHERE status='Published' AND expires_at<=NOW() AND expiry_notified_at IS NULL
      RETURNING id,title,created_by,expires_at
    )
    INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
    SELECT created_by,'Notice expired','“'||title||'” expired on '||TO_CHAR(expires_at,'DD Mon YYYY at HH24:MI')||' and is no longer visible on the Notice Board.','notice_expired',id
    FROM expired`)
  }catch(error){console.error('Notice expiry notification failed:',error.message)}
}

export function startNoticeExpiryWorker(){
  notifyExpiredNotices()
  const timer=setInterval(notifyExpiredNotices,60000)
  timer.unref?.()
  return()=>clearInterval(timer)
}

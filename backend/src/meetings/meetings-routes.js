import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import {existsSync} from 'node:fs'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {query,transaction} from '../db.js'
import {authenticate} from '../auth.js'
import {isOrganisationScopeRole,isTeamScopeRole,managedUserIds,assignmentTaskScope} from '../scope.js'
import {registerLiveConferenceRoutes} from './live-conference.js'
import {mailStatus,sendMail} from '../mailer.js'
import {savePrivateDraftRepositoryVersion} from '../private-draft-repository.js'
import {storeDocument} from '../document-storage.js'

const moduleDir=path.dirname(fileURLToPath(import.meta.url))
const uploadRoot=path.resolve(moduleDir,'../../uploads/meetings')
const allowedExtensions=new Set(['.mp3','.wav','.m4a','.mp4','.webm','.ogg','.aac','.flac'])
const allowedMeetingDocuments=new Map([
  ['.pdf','application/pdf'],['.doc','application/msword'],['.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['.xls','application/vnd.ms-excel'],['.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['.ppt','application/vnd.ms-powerpoint'],['.pptx','application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ['.rtf','application/rtf'],['.txt','text/plain']
])
const maxMeetingAttachments=10
const maxMeetingAttachmentBytes=18*1024*1024
const safeFilename=value=>String(value||'meeting-audio.webm').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(0,180)

const httpError=(status,message)=>Object.assign(new Error(message),{statusCode:status})
const audit=async(client,userId,action,entityId,details={})=>client.query(
  `INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES($1,$2,'meeting',$3,$4::jsonb)`,
  [userId,action,entityId,JSON.stringify(details)]
)
const notify=async(client,userId,title,body,entityId)=>{
  if(!userId)return
  await client.query(`INSERT INTO notifications(
    user_id,title,body,entity_type,entity_id,priority,action,target_workspace,notification_category
  ) VALUES($1,$2,$3,'meeting',$4,'Normal','Open meeting','Meetings','Information')`,
  [userId,title,body,entityId])
}

const meetingMailText=(meeting,recipientName,kind='Invitation')=>{
  const start=new Date(meeting.start_at).toLocaleString('en-KE',{dateStyle:'full',timeStyle:'short',timeZone:'Africa/Nairobi'})
  const end=meeting.end_at?new Date(meeting.end_at).toLocaleString('en-KE',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Nairobi'}):null
  const location=meeting.venue||meeting.meeting_link||'To be confirmed'
  const purpose=String(meeting.description||'').trim()
  const label=kind==='Update'?'Meeting update':kind==='Reminder'?'Meeting reminder':'Meeting invitation'
  return [
    `Dear ${recipientName||'Colleague'},`,
    '',
    `${label}: ${meeting.title}`,
    `Date and time: ${start}${end?` to ${end}`:''}`,
    `Venue / link: ${location}`,
    meeting.meeting_link?`Online join link: ${meeting.meeting_link}`:null,
    ...(Array.isArray(meeting.resource_links)?meeting.resource_links.map((link,index)=>`Supporting link ${index+1}: ${link}`):[]),
    ...(Array.isArray(meeting.supporting_documents)&&meeting.supporting_documents.length?[`Supporting documents attached:`,...meeting.supporting_documents.map(item=>`- ${item.original_filename}`)]:[]),
    ...(Array.isArray(meeting.agenda)&&meeting.agenda.length?[`Agenda:`,...meeting.agenda.map(item=>`${item.item_no}. ${item.title}${item.background?` — ${item.background}`:''}`)]:[]),
    purpose?`Purpose: ${purpose}`:null,
    '',
    'This meeting is recorded in REDESY. Open Meetings in REDESY for the governed meeting record, agenda, attendance, minutes and actions.',
    '',
    'Regards,',
    'PSC REDESY'
  ].filter(Boolean).join('\n')
}

const normalizeMeetingResourceLinks=value=>{
  const source=Array.isArray(value)?value:(typeof value==='string'?value.split(/\r?\n/):[])
  const links=[...new Set(source.map(item=>String(item||'').trim()).filter(Boolean))]
  if(links.length>10)throw httpError(400,'A maximum of 10 supporting links is allowed.')
  for(const link of links){let parsed;try{parsed=new URL(link)}catch{throw httpError(400,`Invalid supporting link: ${link}`)}if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw httpError(400,'Supporting links must be HTTPS URLs without embedded credentials.')}
  return links
}
const meetingEmailAttachments=async meetingId=>{
  const rows=(await query('SELECT original_filename,stored_path FROM meeting_attachments WHERE meeting_id=$1 ORDER BY created_at,id',[meetingId])).rows
  return rows.map(row=>({filename:row.original_filename,path:row.stored_path}))
}
const assertScheduleApprover=async(subjectUserId,approverUserId)=>{
  const subject=(await query('SELECT id,supervisor_id FROM users WHERE id=$1 AND active=TRUE',[subjectUserId])).rows[0]
  if(!subject)throw httpError(404,'Meeting requester is not active.')
  if(!approverUserId||approverUserId===subjectUserId)throw httpError(400,'A different, authorized scheduling approver is required.')
  const approver=(await query('SELECT id FROM users WHERE id=$1 AND active=TRUE',[approverUserId])).rows[0]
  if(!approver)throw httpError(400,'The selected scheduling approver is unavailable.')
  if(subject.supervisor_id===approverUserId)return approverUserId
  const appointment=(await query(`SELECT id FROM meeting_schedule_approval_appointments
    WHERE subject_user_id=$1 AND approver_user_id=$2 AND starts_at<=NOW() AND expires_at>NOW() AND revoked_at IS NULL
    ORDER BY expires_at DESC LIMIT 1`,[subjectUserId,approverUserId])).rows[0]
  if(!appointment)throw httpError(403,'The selected person is neither your assigned supervisor nor an active appointed approver.')
  return approverUserId
}
const notifyScheduleApproval=(client,userId,title,body,meetingId)=>client.query(`INSERT INTO notifications(
  user_id,title,body,entity_type,entity_id,priority,action,target_workspace,notification_category
) VALUES($1,$2,$3,'meeting',$4,'High','Review meeting request','Reviews & Approvals','Review')`,[userId,title,body,meetingId])
const deliverScheduleApprovalEmail=async(meetingId,recipientId,actorId,kind,comments='')=>{
  const meeting=(await query('SELECT * FROM meetings WHERE id=$1',[meetingId])).rows[0]
  const recipient=(await query('SELECT id,name,email FROM users WHERE id=$1 AND active=TRUE',[recipientId])).rows[0]
  const system=(await query('SELECT email_notifications FROM system_settings WHERE id=1')).rows[0]
  const auditEmail=async(action,details)=>query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES($1,$2,'meeting',$3,$4::jsonb)`,[actorId,action,meetingId,JSON.stringify(details)])
  if(!meeting||!recipient||!recipient.email){await auditEmail('MEETING_SCHEDULE_APPROVAL_EMAIL_SKIPPED',{kind,reason:'Recipient or meeting email unavailable'}).catch(()=>{});return {emailSent:0,emailSkipped:1,status:'Recipient email unavailable'}}
  if((system&&!system.email_notifications)||!mailStatus().ready){const reason=system&&!system.email_notifications?'System email delivery disabled':'SMTP not configured';await auditEmail('MEETING_SCHEDULE_APPROVAL_EMAIL_SKIPPED',{kind,reason,recipientId}).catch(()=>{});return {emailSent:0,emailSkipped:1,status:reason}}
  const start=new Date(meeting.start_at).toLocaleString('en-KE',{dateStyle:'full',timeStyle:'short',timeZone:'Africa/Nairobi'})
  const end=meeting.end_at?new Date(meeting.end_at).toLocaleString('en-KE',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Nairobi'}):'Not supplied'
  const subject=kind==='Submitted'?`Meeting schedule approval requested: ${meeting.title}`:`Meeting schedule ${kind.toLowerCase()}: ${meeting.title}`
  const attachments=await meetingEmailAttachments(meetingId)
  const attachmentNotice=attachments.length?['Supporting documents attached:',...attachments.map(item=>`- ${item.filename}`)]:[]
  const body=[`Dear ${recipient.name||'Colleague'},`,'',kind==='Submitted'?'A meeting schedule request requires your decision in REDESY Reviews & Approvals.':`The meeting schedule decision is: ${kind}.`,`Meeting: ${meeting.title}`,`Date/time (Africa/Nairobi): ${start} to ${end}`,`Venue: ${meeting.venue||'Not supplied'}`,meeting.meeting_link?`Join link: ${meeting.meeting_link}`:null,...(Array.isArray(meeting.resource_links)?meeting.resource_links.map((link,index)=>`Supporting link ${index+1}: ${link}`):[]),...attachmentNotice,meeting.description?`Purpose: ${meeting.description}`:null,comments?`Approver comments: ${comments}`:null,'','Open App2 Meetings for the governed meeting record.','Regards,','PSC REDESY'].filter(Boolean).join('\n')
  try{const sent=await sendMail({to:recipient.email,subject,text:body,attachments});await auditEmail('MEETING_SCHEDULE_APPROVAL_EMAIL_SENT',{kind,recipientId,email:recipient.email,messageId:sent?.messageId||null,attachmentCount:attachments.length});return {emailSent:1,emailSkipped:0,status:'Sent'}}catch(error){await auditEmail('MEETING_SCHEDULE_APPROVAL_EMAIL_FAILED',{kind,recipientId,email:recipient.email,error:String(error?.message||error)}).catch(()=>{});return {emailSent:0,emailSkipped:0,emailFailed:1,status:'Email failed'}}
}

const deliverMeetingEmails=async(meetingId,userIds,actorId,kind='Invitation')=>{
  const ids=[...new Set((Array.isArray(userIds)?userIds:[]).filter(Boolean))]
  if(!ids.length)return {inApp:0,emailSent:0,emailFailed:0,emailSkipped:0,status:'No recipients'}
  const meeting=(await query('SELECT * FROM meetings WHERE id=$1',[meetingId])).rows[0]
  if(!meeting)return {inApp:0,emailSent:0,emailFailed:0,emailSkipped:ids.length,status:'Meeting unavailable'}
  if(meeting.schedule_approval_status && meeting.schedule_approval_status!=='Approved'){
    await query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES($1,'MEETING_EMAIL_SKIPPED','meeting',$2,$3::jsonb)`,[actorId,meetingId,JSON.stringify({kind,reason:'Meeting schedule is not approved; attendee invitation/update held',recipientCount:ids.length})]).catch(()=>{})
    return {inApp:0,emailSent:0,emailFailed:0,emailSkipped:ids.length,status:'Held until meeting schedule approval'}
  }
  const agendaRows=(await query(`SELECT item_no,title,background FROM meeting_agenda_items WHERE meeting_id=$1 ORDER BY item_no`,[meetingId])).rows
  meeting.agenda=agendaRows
  const supportingAttachments=await meetingEmailAttachments(meetingId)
  const recipients=(await query(`SELECT id,name,email FROM users
    WHERE active=TRUE AND id=ANY($1::uuid[]) ORDER BY name`,[ids])).rows
  const system=(await query('SELECT email_notifications FROM system_settings WHERE id=1')).rows[0]
  if(system&&!system.email_notifications){
    await query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)
      VALUES($1,'MEETING_EMAIL_SKIPPED','meeting',$2,$3::jsonb)`,
      [actorId,meetingId,JSON.stringify({kind,reason:'System email delivery disabled',recipientCount:recipients.length})])
    return {inApp:ids.length,emailSent:0,emailFailed:0,emailSkipped:recipients.length,status:'Email disabled by system settings'}
  }
  if(!mailStatus().ready){
    await query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)
      VALUES($1,'MEETING_EMAIL_SKIPPED','meeting',$2,$3::jsonb)`,
      [actorId,meetingId,JSON.stringify({kind,reason:'SMTP not configured',recipientCount:recipients.length})])
    return {inApp:ids.length,emailSent:0,emailFailed:0,emailSkipped:recipients.length,status:'SMTP not configured'}
  }
  let emailSent=0,emailFailed=0,emailSkipped=0
  for(const recipient of recipients){
    if(!recipient.email){emailSkipped++;continue}
    try{
      const subject=`${kind==='Update'?'Meeting update':kind==='Reminder'?'Meeting reminder':'Meeting invitation'}: ${meeting.title}`
      const result=await sendMail({to:recipient.email,subject,text:meetingMailText({...meeting,supporting_documents:supportingAttachments},recipient.name,kind),attachments:supportingAttachments})
      emailSent++
      await query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)
        VALUES($1,'MEETING_EMAIL_SENT','meeting',$2,$3::jsonb)`,
        [actorId,meetingId,JSON.stringify({kind,recipientId:recipient.id,email:recipient.email,messageId:result?.messageId||null,attachmentCount:supportingAttachments.length})])
    }catch(error){
      emailFailed++
      await query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)
        VALUES($1,'MEETING_EMAIL_FAILED','meeting',$2,$3::jsonb)`,
        [actorId,meetingId,JSON.stringify({kind,recipientId:recipient.id,email:recipient.email,error:String(error?.message||error)})]).catch(()=>{})
    }
  }
  return {inApp:ids.length,emailSent,emailFailed,emailSkipped,status:emailFailed?'Completed with email failures':'Sent'}
}

const getScopeIds=async user=>{
  if(isOrganisationScopeRole(user.role))return null
  if(isTeamScopeRole(user.role))return [...new Set([user.id,...await managedUserIds(user)])]
  return [user.id]
}

const meetingAccess=async(user,id)=>{
  const ids=await getScopeIds(user)
  if(ids===null)return true
  const result=await query(`SELECT 1 FROM meetings m WHERE m.id=$1 AND(
    m.created_by=ANY($2::uuid[]) OR m.chair_id=ANY($2::uuid[]) OR m.secretary_id=ANY($2::uuid[]) OR m.reviewer_id=$3 OR m.schedule_approver_id=$3
      OR EXISTS(SELECT 1 FROM meeting_participants p WHERE p.meeting_id=m.id AND p.user_id=ANY($2::uuid[]))
      OR EXISTS(SELECT 1 FROM meeting_actions action LEFT JOIN assignment_tasks linked ON linked.id=action.assignment_task_id
        WHERE action.meeting_id=m.id AND (action.owner_id=ANY($2::uuid[]) OR linked.owner_id=ANY($2::uuid[]) OR linked.reviewer_id=ANY($2::uuid[])))
  )`,[id,ids,user.id])
  return result.rowCount>0
}

const meetingManage=async(user,id)=>{
  if(isOrganisationScopeRole(user.role))return true
  const ids=await getScopeIds(user)
  const result=await query(`SELECT 1 FROM meetings m WHERE m.id=$1 AND(
    m.created_by=ANY($2::uuid[]) OR m.chair_id=ANY($2::uuid[]) OR m.secretary_id=ANY($2::uuid[])
    OR EXISTS(SELECT 1 FROM meeting_participants p WHERE p.meeting_id=m.id AND p.user_id=ANY($2::uuid[]))
  )`,[id,ids||[user.id]])
  return result.rowCount>0
}

const assertCanAccessAssignmentTask=async(user,task)=>{
  const scope=await assignmentTaskScope(user,task.assignment_id)
  if(scope.all)return
  const allowed=new Set(scope.userIds||[])
  if([task.owner_id,task.reviewer_id,task.created_by].some(id=>id&&allowed.has(id)))return
  throw httpError(403,'You are not authorised to link or update this assignment task.')
}
const taskActionStatus=status=>status==='Not Started'?'Open':status
const actionTaskStatus=status=>status==='Open'?'Not Started':status
const requireAccess=async(req,id)=>{if(!await meetingAccess(req.user,id))throw httpError(403,'You are not authorised to access this meeting.')}
const requireManage=async(req,id)=>{if(!await meetingManage(req.user,id))throw httpError(403,'Only the meeting owner, chair, secretary or authorised manager can change this meeting.')}

const listQuery=`SELECT m.*,
  creator.name created_by_name,chair.name chair_name,secretary.name secretary_name,reviewer.name reviewer_name,
  (SELECT COUNT(*)::int FROM meeting_participants p WHERE p.meeting_id=m.id) participant_count,
  (SELECT COUNT(*)::int FROM meeting_agenda_items a WHERE a.meeting_id=m.id) agenda_count,
  (SELECT COUNT(*)::int FROM meeting_actions a WHERE a.meeting_id=m.id) action_count,
  (SELECT COUNT(*)::int FROM meeting_actions a LEFT JOIN assignment_tasks linked ON linked.id=a.assignment_task_id WHERE a.meeting_id=m.id AND (CASE WHEN linked.id IS NULL THEN a.status WHEN linked.status='Not Started' THEN 'Open' ELSE linked.status END)<>'Completed') open_action_count,
  (SELECT t.status FROM meeting_transcripts t WHERE t.meeting_id=m.id ORDER BY t.created_at DESC LIMIT 1) transcript_status,
  (SELECT mm.status FROM meeting_minutes mm WHERE mm.meeting_id=m.id ORDER BY mm.version_no DESC LIMIT 1) minutes_status
 FROM meetings m JOIN users creator ON creator.id=m.created_by
 LEFT JOIN users chair ON chair.id=m.chair_id LEFT JOIN users secretary ON secretary.id=m.secretary_id LEFT JOIN users reviewer ON reviewer.id=m.reviewer_id`

const rowWithManage=async(user,row)=>({...row,can_manage:await meetingManage(user,row.id)})

async function getMeetingDetail(user,id){
  const base=(await query(`${listQuery} WHERE m.id=$1`,[id])).rows[0]
  if(!base)throw httpError(404,'Meeting not found.')
  if(base.schedule_approval_status && base.schedule_approval_status!=='Approved' && base.created_by!==user.id && base.schedule_approver_id!==user.id)throw httpError(404,'Meeting not found.')
  if(base.schedule_approval_status && base.schedule_approval_status!=='Approved' && base.created_by!==user.id && base.schedule_approver_id!==user.id)throw httpError(404,'Meeting not found.')
  const [participants,agenda,transcriptRows,minutesRows,actions,decisions,attachments]=await Promise.all([
    query(`SELECT p.*,u.name user_name,u.email user_email FROM meeting_participants p LEFT JOIN users u ON u.id=p.user_id WHERE p.meeting_id=$1 ORDER BY p.created_at`,[id]),
    query(`SELECT a.*,u.name owner_name FROM meeting_agenda_items a LEFT JOIN users u ON u.id=a.owner_id WHERE a.meeting_id=$1 ORDER BY a.item_no`,[id]),
    query(`SELECT * FROM meeting_transcripts WHERE meeting_id=$1 ORDER BY created_at DESC LIMIT 1`,[id]),
    query(`SELECT mm.*,u.name reviewer_name,
      published_repo.id repository_document_id,published_repo.title repository_document_title,
      published_repo.status repository_document_status,published_repo.record_number repository_record_number,
      current_repo_version.version_number repository_version,
      (regexp_match(current_repo_version.notes,'Approved minutes version v([0-9]+)'))[1]::int repository_minutes_version,
      draft_repo.id repository_draft_document_id,draft_repo.title repository_draft_document_title,
      draft_repo.status repository_draft_document_status,draft_repo.current_version repository_draft_version,
      draft_repo.updated_at repository_draft_updated_at
      FROM meeting_minutes mm
      LEFT JOIN users u ON u.id=mm.reviewer_id
      LEFT JOIN LATERAL(
        SELECT k.id,k.title,k.status,k.record_number,k.current_version
        FROM knowledge_items k
        WHERE k.source_type='App2 Upload' AND k.document_type='Meeting Minutes'
          AND k.source_url=('app2://meetings/'||mm.meeting_id::text||'/minutes')
          AND k.status='Published' AND COALESCE(k.is_archived,FALSE)=FALSE
        ORDER BY k.updated_at DESC LIMIT 1
      ) published_repo ON TRUE
      LEFT JOIN LATERAL(
        SELECT v.version_number,v.notes FROM knowledge_versions v
        WHERE v.knowledge_id=published_repo.id AND v.is_current=TRUE
        ORDER BY v.version_number DESC LIMIT 1
      ) current_repo_version ON TRUE
      LEFT JOIN LATERAL(
        SELECT k.id,k.title,k.status,k.current_version,k.updated_at
        FROM knowledge_items k
        WHERE k.source_type='App2 Upload' AND k.document_type='Meeting Minutes Draft'
          AND k.source_url=('app2://meetings/'||mm.meeting_id::text||'/minutes')
          AND k.status='Draft' AND COALESCE(k.is_archived,FALSE)=FALSE
        ORDER BY k.updated_at DESC LIMIT 1
      ) draft_repo ON TRUE
      WHERE mm.meeting_id=$1 ORDER BY mm.version_no DESC LIMIT 1`,[id]),
    query(`SELECT a.id,a.meeting_id,
      CASE WHEN linked.id IS NULL THEN a.title ELSE linked.title END title,
      CASE WHEN linked.id IS NULL THEN a.description ELSE linked.description END description,
      CASE WHEN linked.id IS NULL THEN a.owner_id ELSE linked.owner_id END owner_id,
      CASE WHEN linked.id IS NULL THEN u.name ELSE task_owner.name END owner_name,
      CASE WHEN linked.id IS NULL THEN a.due_date ELSE linked.due_date END due_date,
      CASE WHEN linked.id IS NULL THEN a.status WHEN linked.status='Not Started' THEN 'Open' ELSE linked.status END status,
      a.created_by,a.created_at,a.updated_at,a.assignment_task_id,
      linked.id linked_task_id,linked.title linked_task_title,linked.status linked_task_status,
      linked.progress linked_task_progress,assignment.title linked_assignment_title
      FROM meeting_actions a
      LEFT JOIN users u ON u.id=a.owner_id
      LEFT JOIN assignment_tasks linked ON linked.id=a.assignment_task_id AND linked.archived_at IS NULL
      LEFT JOIN users task_owner ON task_owner.id=linked.owner_id
      LEFT JOIN assignments assignment ON assignment.id=linked.assignment_id
      WHERE a.meeting_id=$1 ORDER BY a.created_at`,[id]),
    query(`SELECT * FROM meeting_decisions WHERE meeting_id=$1 ORDER BY decision_no`,[id]),
    query(`SELECT a.id,a.meeting_id,a.original_filename,a.mime_type,a.size_bytes,a.uploaded_by,a.created_at,u.name uploaded_by_name
      FROM meeting_attachments a JOIN users u ON u.id=a.uploaded_by WHERE a.meeting_id=$1 ORDER BY a.created_at,a.id`,[id])
  ])
  let transcript=null
  if(transcriptRows.rows[0]){
    const t=transcriptRows.rows[0]
    const segments=await query(`SELECT * FROM meeting_transcript_segments WHERE transcript_id=$1 ORDER BY segment_no`,[t.id])
    transcript={...t,segments:segments.rows.map(s=>({...s,start_seconds:Number(s.start_seconds),end_seconds:Number(s.end_seconds)}))}
  }
  return {...await rowWithManage(user,base),participants:participants.rows,agenda:agenda.rows,transcript,minutes:minutesRows.rows[0]||null,actions:actions.rows,decisions:decisions.rows,supporting_documents:attachments.rows}
}

async function runTranscription(transcriptId,audioPath,outputPath){
  await query(`UPDATE meeting_transcripts SET status='Processing',started_at=NOW(),error_message=NULL WHERE id=$1`,[transcriptId])
  const bundledPython=path.resolve(moduleDir,'../../.venv-transcription/Scripts/python.exe')
  const python=process.env.APP2_PYTHON||process.env.PYTHON||(existsSync(bundledPython)?bundledPython:'python')
  const script=path.join(moduleDir,'transcribe.py')
  const child=spawn(python,[script,audioPath,outputPath],{windowsHide:true,env:process.env})
  let stderr=''
  child.stderr.on('data',data=>{stderr+=String(data).slice(-8000)})
  child.on('error',async error=>{
    await query(`UPDATE meeting_transcripts SET status='Failed',error_message=$2,completed_at=NOW() WHERE id=$1`,[transcriptId,`Transcription worker could not start: ${error.message}`]).catch(()=>{})
  })
  child.on('close',async()=>{
    try{
      const raw=await fs.readFile(outputPath,'utf8')
      const payload=JSON.parse(raw)
      if(!payload.ok)throw new Error(payload.error||stderr||'Local transcription failed.')
      await transaction(async client=>{
        await client.query('DELETE FROM meeting_transcript_segments WHERE transcript_id=$1',[transcriptId])
        for(const segment of payload.segments||[]){
          await client.query(`INSERT INTO meeting_transcript_segments(transcript_id,segment_no,start_seconds,end_seconds,text) VALUES($1,$2,$3,$4,$5)`,[transcriptId,segment.segment_no,segment.start,segment.end,segment.text])
        }
        await client.query(`UPDATE meeting_transcripts SET status='Completed',language=$2,model_name=$3,error_message=NULL,completed_at=NOW() WHERE id=$1`,[transcriptId,payload.language||null,payload.model||null])
      })
    }catch(error){
      await query(`UPDATE meeting_transcripts SET status='Failed',error_message=$2,completed_at=NOW() WHERE id=$1`,[transcriptId,String(error.message||error)]).catch(()=>{})
    }finally{await fs.unlink(outputPath).catch(()=>{})}
  })
}

const requireString=(value,name,max=500)=>{const text=String(value||'').trim();if(!text)throw httpError(400,`${name} is required.`);if(text.length>max)throw httpError(400,`${name} is too long.`);return text}

export function registerMeetingsRoutes(app){
  registerLiveConferenceRoutes(app,{authenticate})
  app.get('/api/meetings/eligible-users',authenticate,async(req,res,next)=>{try{
    const rows=(await query(`SELECT id,name,email,role,division FROM users WHERE active=TRUE ORDER BY name`)).rows
    res.json(rows)
  }catch(error){next(error)}})

  app.get('/api/meetings',authenticate,async(req,res,next)=>{try{
    const ids=await getScopeIds(req.user)
    let result
      if(ids===null)result=await query(`${listQuery} WHERE (m.schedule_approval_status='Approved' OR m.created_by=$1 OR m.schedule_approver_id=$1) ORDER BY m.start_at DESC`,[req.user.id])
      else result=await query(`${listQuery} WHERE (m.schedule_approval_status='Approved' OR m.created_by=$2 OR m.schedule_approver_id=$2) AND (m.created_by=ANY($1::uuid[]) OR m.chair_id=ANY($1::uuid[]) OR m.secretary_id=ANY($1::uuid[]) OR m.reviewer_id=$2 OR EXISTS(SELECT 1 FROM meeting_participants p WHERE p.meeting_id=m.id AND p.user_id=ANY($1::uuid[]))) ORDER BY m.start_at DESC`,[ids,req.user.id])
    const rows=[];for(const row of result.rows)rows.push(await rowWithManage(req.user,row));res.json(rows)
  }catch(error){next(error)}})

  app.get('/api/meetings/:id',authenticate,async(req,res,next)=>{try{await requireAccess(req,req.params.id);res.json(await getMeetingDetail(req.user,req.params.id))}catch(error){next(error)}})

  app.post('/api/meetings/:id/attachments',authenticate,async(req,res,next)=>{let storedPath=null;try{
    await requireManage(req,req.params.id)
    if(!Buffer.isBuffer(req.body)||req.body.length===0)throw httpError(400,'Choose a supporting document to upload.')
    let incomingName=String(req.get('x-file-name')||'supporting-document').trim()
    try{incomingName=decodeURIComponent(incomingName)}catch{}
    const filename=safeFilename(incomingName)
    const extension=path.extname(filename).toLowerCase()
    const mimeType=allowedMeetingDocuments.get(extension)
    if(!mimeType)throw httpError(400,'Supporting documents must be PDF, Word, Excel, PowerPoint, RTF or TXT files.')
    const current=(await query(`SELECT COUNT(*)::int count,COALESCE(SUM(size_bytes),0)::bigint total FROM meeting_attachments WHERE meeting_id=$1`,[req.params.id])).rows[0]
    if(Number(current.count)>=maxMeetingAttachments)throw httpError(409,`A meeting can have up to ${maxMeetingAttachments} supporting documents.`)
    if(Number(current.total)+req.body.length>maxMeetingAttachmentBytes)throw httpError(413,'Supporting documents for a meeting are limited to 18 MB in total.')
    const directory=path.join(uploadRoot,req.params.id,'attachments')
    await fs.mkdir(directory,{recursive:true})
    storedPath=path.join(directory,`${crypto.randomUUID()}${extension}`)
    await fs.writeFile(storedPath,req.body,{flag:'wx'})
    const row=await transaction(async client=>{
      const attachment=(await client.query(`INSERT INTO meeting_attachments(meeting_id,original_filename,stored_path,mime_type,size_bytes,uploaded_by)
        VALUES($1,$2,$3,$4,$5,$6) RETURNING id,meeting_id,original_filename,mime_type,size_bytes,uploaded_by,created_at`,
        [req.params.id,filename,storedPath,mimeType,req.body.length,req.user.id])).rows[0]
      await audit(client,req.user.id,'MEETING_SUPPORTING_DOCUMENT_UPLOADED',req.params.id,{attachmentId:attachment.id,filename,sizeBytes:req.body.length})
      return attachment
    })
    res.status(201).json(row)
  }catch(error){if(storedPath)await fs.unlink(storedPath).catch(()=>{});next(error)}})

  app.get('/api/meetings/:id/attachments/:attachmentId/download',authenticate,async(req,res,next)=>{try{
    await requireAccess(req,req.params.id)
    const attachment=(await query(`SELECT original_filename,stored_path,mime_type FROM meeting_attachments WHERE id=$1 AND meeting_id=$2`,[req.params.attachmentId,req.params.id])).rows[0]
    if(!attachment)throw httpError(404,'Meeting supporting document not found.')
    res.type(attachment.mime_type).download(attachment.stored_path,attachment.original_filename,error=>{if(error&&!res.headersSent)next(error)})
  }catch(error){next(error)}})

  app.delete('/api/meetings/:id/attachments/:attachmentId',authenticate,async(req,res,next)=>{try{
    await requireManage(req,req.params.id)
    const attachment=(await query('SELECT id,stored_path,original_filename FROM meeting_attachments WHERE id=$1 AND meeting_id=$2',[req.params.attachmentId,req.params.id])).rows[0]
    if(!attachment)throw httpError(404,'Meeting supporting document not found.')
    await transaction(async client=>{
      await client.query('DELETE FROM meeting_attachments WHERE id=$1',[attachment.id])
      await audit(client,req.user.id,'MEETING_SUPPORTING_DOCUMENT_REMOVED',req.params.id,{attachmentId:attachment.id,filename:attachment.original_filename})
    })
    await fs.unlink(attachment.stored_path).catch(()=>{})
    res.status(204).end()
  }catch(error){next(error)}})

  app.get('/api/meetings/schedule-approval/eligible-approvers',authenticate,async(req,res,next)=>{try{
    const supervisor=(await query(`SELECT u.id,u.name,u.role FROM users subject JOIN users u ON u.id=subject.supervisor_id WHERE subject.id=$1 AND subject.active=TRUE AND u.active=TRUE`,[req.user.id])).rows.map(row=>({...row,source:'Supervisor',appointment_id:null,expires_at:null}))
    const delegates=(await query(`SELECT DISTINCT u.id,u.name,u.role,'Appointed approver' source,a.id appointment_id,a.expires_at
      FROM meeting_schedule_approval_appointments a JOIN users u ON u.id=a.approver_user_id
      WHERE a.subject_user_id=$1 AND a.starts_at<=NOW() AND a.expires_at>NOW() AND a.revoked_at IS NULL AND u.active=TRUE
      ORDER BY a.expires_at DESC`,[req.user.id])).rows
    const byId=new Map([...supervisor,...delegates].map(item=>[item.id,item]))
    res.json([...byId.values()])
  }catch(error){next(error)}})

  app.get('/api/meetings/schedule-approval/delegable-users',authenticate,async(req,res,next)=>{try{
    const rows=req.user.role==='System Admin'
      ? await query(`SELECT id,name,email,role FROM users WHERE active=TRUE ORDER BY name`)
      : await query(`SELECT id,name,email,role FROM users WHERE active=TRUE AND supervisor_id=$1 ORDER BY name`,[req.user.id])
    res.json(rows.rows)
  }catch(error){next(error)}})

  app.get('/api/meetings/schedule-approval/appointments',authenticate,async(req,res,next)=>{try{
    const rows=await query(`SELECT a.*,subject.name subject_name,approver.name approver_name
      FROM meeting_schedule_approval_appointments a
      JOIN users subject ON subject.id=a.subject_user_id
      JOIN users approver ON approver.id=a.approver_user_id
      WHERE $2='System Admin' OR subject.supervisor_id=$1 OR a.appointed_by=$1
      ORDER BY a.created_at DESC LIMIT 250`,[req.user.id,req.user.role])
    res.json(rows.rows)
  }catch(error){next(error)}})

  app.post('/api/meetings/schedule-approval/appointments',authenticate,async(req,res,next)=>{try{
    const subjectUserId=String(req.body?.subjectUserId||'').trim(),approverUserId=String(req.body?.approverUserId||'').trim()
    const expiresAt=new Date(req.body?.expiresAt||'')
    const reason=String(req.body?.reason||'').trim().slice(0,600)
    if(!subjectUserId||!approverUserId)throw httpError(400,'Select the staff member and appointed approver.')
    if(subjectUserId===approverUserId)throw httpError(400,'A staff member cannot be their own appointed approver.')
    if(Number.isNaN(expiresAt.getTime())||expiresAt<=new Date()||expiresAt>new Date(Date.now()+366*86400000))throw httpError(400,'Appointment expiry must be in the future and within 12 months.')
    const subject=(await query('SELECT id,supervisor_id FROM users WHERE id=$1 AND active=TRUE',[subjectUserId])).rows[0]
    if(!subject)throw httpError(404,'The staff member is not active.')
    if(req.user.role!=='System Admin'&&subject.supervisor_id!==req.user.id)throw httpError(403,'Only the staff member\'s direct supervisor or System Admin can appoint a scheduling delegate.')
    const approver=(await query('SELECT id FROM users WHERE id=$1 AND active=TRUE',[approverUserId])).rows[0]
    if(!approver)throw httpError(400,'The appointed approver is not active.')
    const duplicate=(await query(`SELECT id FROM meeting_schedule_approval_appointments WHERE subject_user_id=$1 AND approver_user_id=$2 AND revoked_at IS NULL AND expires_at>NOW() LIMIT 1`,[subjectUserId,approverUserId])).rows[0]
    if(duplicate)throw httpError(409,'An active appointment already exists for this staff member and approver.')
    const row=await transaction(async client=>{
      const appointment=(await client.query(`INSERT INTO meeting_schedule_approval_appointments(subject_user_id,approver_user_id,appointed_by,expires_at,reason) VALUES($1,$2,$3,$4,$5) RETURNING *`,[subjectUserId,approverUserId,req.user.id,expiresAt.toISOString(),reason])).rows[0]
      await audit(client,req.user.id,'MEETING_SCHEDULE_APPROVER_APPOINTED',appointment.id,{subjectUserId,approverUserId,expiresAt:expiresAt.toISOString(),reason})
      return appointment
    })
    res.status(201).json(row)
  }catch(error){next(error)}})

  app.post('/api/meetings/schedule-approval/appointments/:id/revoke',authenticate,async(req,res,next)=>{try{
    const appointment=(await query(`SELECT a.*,subject.supervisor_id FROM meeting_schedule_approval_appointments a JOIN users subject ON subject.id=a.subject_user_id WHERE a.id=$1`,[req.params.id])).rows[0]
    if(!appointment)throw httpError(404,'Approval appointment not found.')
    if(req.user.role!=='System Admin'&&appointment.supervisor_id!==req.user.id&&appointment.appointed_by!==req.user.id)throw httpError(403,'You cannot revoke this appointment.')
    await transaction(async client=>{
      await client.query(`UPDATE meeting_schedule_approval_appointments SET revoked_at=NOW() WHERE id=$1 AND revoked_at IS NULL`,[appointment.id])
      const pendingRows=(await client.query(`SELECT m.id,m.created_by,subject.supervisor_id,supervisor.active supervisor_active
        FROM meetings m JOIN users subject ON subject.id=m.created_by
        LEFT JOIN users supervisor ON supervisor.id=subject.supervisor_id
        WHERE m.schedule_approval_status='Pending Approval' AND m.schedule_approver_id=$1 AND m.created_by=$2`,
        [appointment.approver_user_id,appointment.subject_user_id])).rows
      for(const pending of pendingRows){
        if(pending.supervisor_id && pending.supervisor_active && pending.supervisor_id===appointment.approver_user_id)continue
        let fallback=pending.supervisor_id && pending.supervisor_active ? pending.supervisor_id : null
        if(!fallback){
          const alternative=(await client.query(`SELECT a.approver_user_id FROM meeting_schedule_approval_appointments a
            JOIN users u ON u.id=a.approver_user_id
            WHERE a.subject_user_id=$1 AND a.approver_user_id<>$2 AND a.starts_at<=NOW() AND a.expires_at>NOW()
              AND a.revoked_at IS NULL AND u.active=TRUE ORDER BY a.expires_at DESC LIMIT 1`,
            [pending.created_by,appointment.approver_user_id])).rows[0]
          fallback=alternative?.approver_user_id||null
        }
        if(fallback){
          await client.query(`UPDATE meetings SET schedule_approver_id=$2,updated_at=NOW() WHERE id=$1`,[pending.id,fallback])
          await notifyScheduleApproval(client,fallback,'Meeting schedule approval reassigned','A pending meeting request was reassigned after an approver appointment was revoked. Open Reviews & Approvals in REDESY.',pending.id)
          await audit(client,req.user.id,'MEETING_SCHEDULE_APPROVER_REASSIGNED',pending.id,{previousApproverId:appointment.approver_user_id,newApproverId:fallback,reason:'Appointment revoked'})
        }else{
          const reason='The appointed approver is no longer authorized. Please revise the approver selection and resubmit.'
          await client.query(`UPDATE meetings SET schedule_approval_status='Returned',schedule_approval_decided_by=$2,schedule_approval_decided_at=NOW(),schedule_approval_comments=$3,updated_at=NOW() WHERE id=$1`,[pending.id,req.user.id,reason])
          await notify(client,pending.created_by,'Meeting request returned for revision',reason,pending.id)
          await audit(client,req.user.id,'MEETING_SCHEDULE_RETURNED',pending.id,{comments:reason,reason:'Appointed approver appointment revoked'})
        }
      }
      await audit(client,req.user.id,'MEETING_SCHEDULE_APPROVER_REVOKED',appointment.id,{subjectUserId:appointment.subject_user_id,approverUserId:appointment.approver_user_id})
    })
    res.json({ok:true})
  }catch(error){next(error)}})

  app.get('/api/meetings/schedule-approvals/pending',authenticate,async(req,res,next)=>{try{
    const rows=await query(`SELECT m.id,m.title,m.meeting_type,m.description,m.start_at,m.end_at,m.venue,m.meeting_link,m.resource_links,m.created_by,m.schedule_approver_id,m.schedule_approval_submitted_at,
      owner.name created_by_name,(SELECT COUNT(*)::int FROM meeting_participants p WHERE p.meeting_id=m.id) participant_count
      FROM meetings m JOIN users owner ON owner.id=m.created_by
      WHERE m.schedule_approval_status='Pending Approval' AND m.schedule_approver_id=$1
      ORDER BY m.schedule_approval_submitted_at ASC NULLS LAST,m.start_at ASC`,[req.user.id])
    res.json(rows.rows)
  }catch(error){next(error)}})

  app.post('/api/meetings/:id/schedule-decision',authenticate,async(req,res,next)=>{try{
    const decision=String(req.body?.decision||'')
    if(!['Approved','Returned','Rejected'].includes(decision))throw httpError(400,'Decision must be Approved, Returned or Rejected.')
    const comments=String(req.body?.comments||'').trim().slice(0,2000)
    if(decision!=='Approved'&&!comments)throw httpError(400,'Comments are required when returning or rejecting a meeting schedule.')
    const existing=(await query('SELECT * FROM meetings WHERE id=$1',[req.params.id])).rows[0]
    if(!existing)throw httpError(404,'Meeting request not found.')
    if(existing.schedule_approver_id!==req.user.id)throw httpError(403,'Only the assigned supervisor or appointed approver can decide this meeting request.')
    if(existing.created_by===req.user.id)throw httpError(403,'A requester cannot approve their own meeting schedule.')
    if(existing.schedule_approval_status!=='Pending Approval')throw httpError(409,'This meeting request is no longer awaiting a schedule decision.')
    await assertScheduleApprover(existing.created_by,req.user.id)
    const decisionResult=await transaction(async client=>{
      let calendarEventId=existing.calendar_event_id
      if(decision==='Approved'&&!calendarEventId){
        const event=(await client.query(`INSERT INTO calendar_events(title,description,start_at,end_at,event_type,created_by) VALUES($1,$2,$3,$4,'Meeting',$5) RETURNING id`,[existing.title,existing.description,existing.start_at,existing.end_at,existing.created_by])).rows[0]
        calendarEventId=event.id
      }
      const updated=(await client.query(`UPDATE meetings SET schedule_approval_status=$2,schedule_approval_decided_by=$3,schedule_approval_decided_at=NOW(),schedule_approval_comments=$4,calendar_event_id=$5,updated_at=NOW() WHERE id=$1 RETURNING *`,[existing.id,decision,req.user.id,comments,decision==='Approved'?calendarEventId:null])).rows[0]
      const notifyTitle=decision==='Approved'?'Meeting schedule approved':decision==='Returned'?'Meeting request returned for revision':'Meeting schedule rejected'
      const notifyBody=decision==='Approved'?`Your meeting request “${existing.title}” was approved and added to Calendar.`:decision==='Returned'?`Your meeting request “${existing.title}” was returned for revision.${comments?` Comments: ${comments}`:''}`:`Your meeting request “${existing.title}” was rejected.${comments?` Comments: ${comments}`:''}`
      await notify(client,existing.created_by,notifyTitle,notifyBody,existing.id)
      if(decision==='Approved'){
        const attendees=(await client.query(`SELECT user_id FROM meeting_participants WHERE meeting_id=$1 AND user_id IS NOT NULL AND user_id<>$2`,[existing.id,existing.created_by])).rows
        for(const attendee of attendees)await notify(client,attendee.user_id,'Meeting invitation',`The meeting “${existing.title}” has been approved for ${new Date(existing.start_at).toLocaleString('en-KE',{timeZone:'Africa/Nairobi'})}. Open Meetings in REDESY for the approved link, venue and agenda.`,existing.id)
      }
      await audit(client,req.user.id,decision==='Approved'?'MEETING_SCHEDULE_APPROVED':decision==='Returned'?'MEETING_SCHEDULE_RETURNED':'MEETING_SCHEDULE_REJECTED',existing.id,{title:existing.title,decision,comments,calendarEventId:decision==='Approved'?calendarEventId:null})
      return updated
    })
    const decisionEmail=await deliverScheduleApprovalEmail(existing.id,existing.created_by,req.user.id,decision,comments)
    let invitationDelivery={inApp:0,emailSent:0,emailFailed:0,emailSkipped:0,status:'Not sent'}
    if(decision==='Approved'){
      const attendeeIds=(await query(`SELECT user_id FROM meeting_participants WHERE meeting_id=$1 AND user_id IS NOT NULL AND user_id<>$2`,[existing.id,existing.created_by])).rows.map(row=>row.user_id)
      invitationDelivery=await deliverMeetingEmails(existing.id,attendeeIds,req.user.id,'Invitation')
    }
    res.json({...await getMeetingDetail(req.user,existing.id),schedule_approval_status:decision,decision_email:decisionEmail,invitation_delivery:invitationDelivery})
  }catch(error){next(error)}})
  app.get('/api/meetings/schedule-approval/eligible-approvers',authenticate,async(req,res,next)=>{try{
    const supervisor=(await query(`SELECT u.id,u.name,u.role FROM users subject JOIN users u ON u.id=subject.supervisor_id WHERE subject.id=$1 AND subject.active=TRUE AND u.active=TRUE`,[req.user.id])).rows.map(row=>({...row,source:'Supervisor',appointment_id:null,expires_at:null}))
    const delegates=(await query(`SELECT DISTINCT u.id,u.name,u.role,'Appointed approver' source,a.id appointment_id,a.expires_at
      FROM meeting_schedule_approval_appointments a JOIN users u ON u.id=a.approver_user_id
      WHERE a.subject_user_id=$1 AND a.starts_at<=NOW() AND a.expires_at>NOW() AND a.revoked_at IS NULL AND u.active=TRUE
      ORDER BY a.expires_at DESC`,[req.user.id])).rows
    const byId=new Map([...supervisor,...delegates].map(item=>[item.id,item]))
    res.json([...byId.values()])
  }catch(error){next(error)}})

  app.get('/api/meetings/schedule-approval/delegable-users',authenticate,async(req,res,next)=>{try{
    const rows=req.user.role==='System Admin'
      ? await query(`SELECT id,name,email,role FROM users WHERE active=TRUE ORDER BY name`)
      : await query(`SELECT id,name,email,role FROM users WHERE active=TRUE AND supervisor_id=$1 ORDER BY name`,[req.user.id])
    res.json(rows.rows)
  }catch(error){next(error)}})

  app.get('/api/meetings/schedule-approval/appointments',authenticate,async(req,res,next)=>{try{
    const rows=await query(`SELECT a.*,subject.name subject_name,approver.name approver_name
      FROM meeting_schedule_approval_appointments a
      JOIN users subject ON subject.id=a.subject_user_id
      JOIN users approver ON approver.id=a.approver_user_id
      WHERE $2='System Admin' OR subject.supervisor_id=$1 OR a.appointed_by=$1
      ORDER BY a.created_at DESC LIMIT 250`,[req.user.id,req.user.role])
    res.json(rows.rows)
  }catch(error){next(error)}})

  app.post('/api/meetings/schedule-approval/appointments',authenticate,async(req,res,next)=>{try{
    const subjectUserId=String(req.body?.subjectUserId||'').trim(),approverUserId=String(req.body?.approverUserId||'').trim()
    const expiresAt=new Date(req.body?.expiresAt||'')
    const reason=String(req.body?.reason||'').trim().slice(0,600)
    if(!subjectUserId||!approverUserId)throw httpError(400,'Select the staff member and appointed approver.')
    if(subjectUserId===approverUserId)throw httpError(400,'A staff member cannot be their own appointed approver.')
    if(Number.isNaN(expiresAt.getTime())||expiresAt<=new Date()||expiresAt>new Date(Date.now()+366*86400000))throw httpError(400,'Appointment expiry must be in the future and within 12 months.')
    const subject=(await query('SELECT id,supervisor_id FROM users WHERE id=$1 AND active=TRUE',[subjectUserId])).rows[0]
    if(!subject)throw httpError(404,'The staff member is not active.')
    if(req.user.role!=='System Admin'&&subject.supervisor_id!==req.user.id)throw httpError(403,'Only the staff member\'s direct supervisor or System Admin can appoint a scheduling delegate.')
    const approver=(await query('SELECT id FROM users WHERE id=$1 AND active=TRUE',[approverUserId])).rows[0]
    if(!approver)throw httpError(400,'The appointed approver is not active.')
    const duplicate=(await query(`SELECT id FROM meeting_schedule_approval_appointments WHERE subject_user_id=$1 AND approver_user_id=$2 AND revoked_at IS NULL AND expires_at>NOW() LIMIT 1`,[subjectUserId,approverUserId])).rows[0]
    if(duplicate)throw httpError(409,'An active appointment already exists for this staff member and approver.')
    const row=await transaction(async client=>{
      const appointment=(await client.query(`INSERT INTO meeting_schedule_approval_appointments(subject_user_id,approver_user_id,appointed_by,expires_at,reason) VALUES($1,$2,$3,$4,$5) RETURNING *`,[subjectUserId,approverUserId,req.user.id,expiresAt.toISOString(),reason])).rows[0]
      await audit(client,req.user.id,'MEETING_SCHEDULE_APPROVER_APPOINTED',appointment.id,{subjectUserId,approverUserId,expiresAt:expiresAt.toISOString(),reason})
      return appointment
    })
    res.status(201).json(row)
  }catch(error){next(error)}})

  app.post('/api/meetings/schedule-approval/appointments/:id/revoke',authenticate,async(req,res,next)=>{try{
    const appointment=(await query(`SELECT a.*,subject.supervisor_id FROM meeting_schedule_approval_appointments a JOIN users subject ON subject.id=a.subject_user_id WHERE a.id=$1`,[req.params.id])).rows[0]
    if(!appointment)throw httpError(404,'Approval appointment not found.')
    if(req.user.role!=='System Admin'&&appointment.supervisor_id!==req.user.id&&appointment.appointed_by!==req.user.id)throw httpError(403,'You cannot revoke this appointment.')
    await transaction(async client=>{
      await client.query(`UPDATE meeting_schedule_approval_appointments SET revoked_at=NOW() WHERE id=$1 AND revoked_at IS NULL`,[appointment.id])
      const pendingRows=(await client.query(`SELECT m.id,m.created_by,subject.supervisor_id,supervisor.active supervisor_active
        FROM meetings m JOIN users subject ON subject.id=m.created_by
        LEFT JOIN users supervisor ON supervisor.id=subject.supervisor_id
        WHERE m.schedule_approval_status='Pending Approval' AND m.schedule_approver_id=$1 AND m.created_by=$2`,
        [appointment.approver_user_id,appointment.subject_user_id])).rows
      for(const pending of pendingRows){
        if(pending.supervisor_id && pending.supervisor_active && pending.supervisor_id===appointment.approver_user_id)continue
        let fallback=pending.supervisor_id && pending.supervisor_active ? pending.supervisor_id : null
        if(!fallback){
          const alternative=(await client.query(`SELECT a.approver_user_id FROM meeting_schedule_approval_appointments a
            JOIN users u ON u.id=a.approver_user_id
            WHERE a.subject_user_id=$1 AND a.approver_user_id<>$2 AND a.starts_at<=NOW() AND a.expires_at>NOW()
              AND a.revoked_at IS NULL AND u.active=TRUE ORDER BY a.expires_at DESC LIMIT 1`,
            [pending.created_by,appointment.approver_user_id])).rows[0]
          fallback=alternative?.approver_user_id||null
        }
        if(fallback){
          await client.query(`UPDATE meetings SET schedule_approver_id=$2,updated_at=NOW() WHERE id=$1`,[pending.id,fallback])
          await notifyScheduleApproval(client,fallback,'Meeting schedule approval reassigned','A pending meeting request was reassigned after an approver appointment was revoked. Open Reviews & Approvals in REDESY.',pending.id)
          await audit(client,req.user.id,'MEETING_SCHEDULE_APPROVER_REASSIGNED',pending.id,{previousApproverId:appointment.approver_user_id,newApproverId:fallback,reason:'Appointment revoked'})
        }else{
          const reason='The appointed approver is no longer authorized. Please revise the approver selection and resubmit.'
          await client.query(`UPDATE meetings SET schedule_approval_status='Returned',schedule_approval_decided_by=$2,schedule_approval_decided_at=NOW(),schedule_approval_comments=$3,updated_at=NOW() WHERE id=$1`,[pending.id,req.user.id,reason])
          await notify(client,pending.created_by,'Meeting request returned for revision',reason,pending.id)
          await audit(client,req.user.id,'MEETING_SCHEDULE_RETURNED',pending.id,{comments:reason,reason:'Appointed approver appointment revoked'})
        }
      }
      await audit(client,req.user.id,'MEETING_SCHEDULE_APPROVER_REVOKED',appointment.id,{subjectUserId:appointment.subject_user_id,approverUserId:appointment.approver_user_id})
    })
    res.json({ok:true})
  }catch(error){next(error)}})

  app.get('/api/meetings/schedule-approvals/pending',authenticate,async(req,res,next)=>{try{
    const rows=await query(`SELECT m.id,m.title,m.meeting_type,m.description,m.start_at,m.end_at,m.venue,m.meeting_link,m.resource_links,m.created_by,m.schedule_approver_id,m.schedule_approval_submitted_at,
      owner.name created_by_name,(SELECT COUNT(*)::int FROM meeting_participants p WHERE p.meeting_id=m.id) participant_count
      FROM meetings m JOIN users owner ON owner.id=m.created_by
      WHERE m.schedule_approval_status='Pending Approval' AND m.schedule_approver_id=$1
      ORDER BY m.schedule_approval_submitted_at ASC NULLS LAST,m.start_at ASC`,[req.user.id])
    res.json(rows.rows)
  }catch(error){next(error)}})

  app.post('/api/meetings/:id/schedule-decision',authenticate,async(req,res,next)=>{try{
    const decision=String(req.body?.decision||'')
    if(!['Approved','Returned','Rejected'].includes(decision))throw httpError(400,'Decision must be Approved, Returned or Rejected.')
    const comments=String(req.body?.comments||'').trim().slice(0,2000)
    if(decision!=='Approved'&&!comments)throw httpError(400,'Comments are required when returning or rejecting a meeting schedule.')
    const existing=(await query('SELECT * FROM meetings WHERE id=$1',[req.params.id])).rows[0]
    if(!existing)throw httpError(404,'Meeting request not found.')
    if(existing.schedule_approver_id!==req.user.id)throw httpError(403,'Only the assigned supervisor or appointed approver can decide this meeting request.')
    if(existing.created_by===req.user.id)throw httpError(403,'A requester cannot approve their own meeting schedule.')
    if(existing.schedule_approval_status!=='Pending Approval')throw httpError(409,'This meeting request is no longer awaiting a schedule decision.')
    await assertScheduleApprover(existing.created_by,req.user.id)
    const decisionResult=await transaction(async client=>{
      let calendarEventId=existing.calendar_event_id
      if(decision==='Approved'&&!calendarEventId){
        const event=(await client.query(`INSERT INTO calendar_events(title,description,start_at,end_at,event_type,created_by) VALUES($1,$2,$3,$4,'Meeting',$5) RETURNING id`,[existing.title,existing.description,existing.start_at,existing.end_at,existing.created_by])).rows[0]
        calendarEventId=event.id
      }
      const updated=(await client.query(`UPDATE meetings SET schedule_approval_status=$2,schedule_approval_decided_by=$3,schedule_approval_decided_at=NOW(),schedule_approval_comments=$4,calendar_event_id=$5,updated_at=NOW() WHERE id=$1 RETURNING *`,[existing.id,decision,req.user.id,comments,decision==='Approved'?calendarEventId:null])).rows[0]
      const notifyTitle=decision==='Approved'?'Meeting schedule approved':decision==='Returned'?'Meeting request returned for revision':'Meeting schedule rejected'
      const notifyBody=decision==='Approved'?`Your meeting request “${existing.title}” was approved and added to Calendar.`:decision==='Returned'?`Your meeting request “${existing.title}” was returned for revision.${comments?` Comments: ${comments}`:''}`:`Your meeting request “${existing.title}” was rejected.${comments?` Comments: ${comments}`:''}`
      await notify(client,existing.created_by,notifyTitle,notifyBody,existing.id)
      if(decision==='Approved'){
        const attendees=(await client.query(`SELECT user_id FROM meeting_participants WHERE meeting_id=$1 AND user_id IS NOT NULL AND user_id<>$2`,[existing.id,existing.created_by])).rows
        for(const attendee of attendees)await notify(client,attendee.user_id,'Meeting invitation',`The meeting “${existing.title}” has been approved for ${new Date(existing.start_at).toLocaleString('en-KE',{timeZone:'Africa/Nairobi'})}. Open Meetings in REDESY for the approved link, venue and agenda.`,existing.id)
      }
      await audit(client,req.user.id,decision==='Approved'?'MEETING_SCHEDULE_APPROVED':decision==='Returned'?'MEETING_SCHEDULE_RETURNED':'MEETING_SCHEDULE_REJECTED',existing.id,{decision,comments,calendarEventId:decision==='Approved'?calendarEventId:null})
      return updated
    })
    const decisionEmail=await deliverScheduleApprovalEmail(existing.id,existing.created_by,req.user.id,decision,comments)
    let invitationDelivery={inApp:0,emailSent:0,emailFailed:0,emailSkipped:0,status:'Not sent'}
    if(decision==='Approved'){
      const attendeeIds=(await query(`SELECT user_id FROM meeting_participants WHERE meeting_id=$1 AND user_id IS NOT NULL AND user_id<>$2`,[existing.id,existing.created_by])).rows.map(row=>row.user_id)
      invitationDelivery=await deliverMeetingEmails(existing.id,attendeeIds,req.user.id,'Invitation')
    }
    res.json({...await getMeetingDetail(req.user,existing.id),schedule_approval_status:decision,decision_email:decisionEmail,invitation_delivery:invitationDelivery})
  }catch(error){next(error)}})
  app.post('/api/meetings',authenticate,async(req,res,next)=>{try{
    const v=req.body||{}
    const title=requireString(v.title,'Meeting title',240)
    const start=new Date(v.startAt)
    if(Number.isNaN(start.getTime()))throw httpError(400,'A valid meeting start time is required.')
    const end=v.endAt?new Date(v.endAt):null
    if(end&&end<start)throw httpError(400,'Meeting end time cannot precede the start time.')
    if(v.reviewerId&&v.reviewerId===req.user.id)throw httpError(400,'The meeting owner cannot review their own minutes.')
    const invitedIds=[...new Set((Array.isArray(v.participantIds)?v.participantIds:[]).filter(Boolean))]
    const participantRoles=v.participantRoles&&typeof v.participantRoles==='object'?v.participantRoles:{}
    const scheduleApproverId=String(v.scheduleApproverId||'').trim()
    await assertScheduleApprover(req.user.id,scheduleApproverId)
    if(!start||Number.isNaN(start.getTime())||!end||Number.isNaN(end.getTime())||end<=start)throw httpError(400,'Meeting start and end are required, and end must be later than start.')
    if(start<=new Date())throw httpError(400,'Meeting start must be in the future.')
    const venue=String(v.venue||'').trim()
    const meetingLink=String(v.meetingLink||'').trim()
    const meetingMode=String(v.meetingMode||(meetingLink&&venue?'Hybrid':meetingLink?'Online':'In-person'))
    if(!['In-person','Online','Hybrid'].includes(meetingMode))throw httpError(400,'Meeting format must be In-person, Online or Hybrid.')
    if((meetingMode==='In-person'||meetingMode==='Hybrid')&&!venue)throw httpError(400,'A physical venue is required for in-person or hybrid meetings.')
    if((meetingMode==='Online'||meetingMode==='Hybrid')&&!meetingLink)throw httpError(400,'An online join link is required for online or hybrid meetings.')
    if(meetingLink){let parsed;try{parsed=new URL(meetingLink)}catch{throw httpError(400,'Online meeting link must be a valid HTTPS URL.')}if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw httpError(400,'Online meeting link must be a valid HTTPS URL without embedded credentials.')}
    const resourceLinks=normalizeMeetingResourceLinks(v.resourceLinks)
    await assertScheduleApprover(req.user.id,scheduleApproverId)
    if(!start||Number.isNaN(start.getTime())||!end||Number.isNaN(end.getTime())||end<=start)throw httpError(400,'Meeting start and end are required, and end must be later than start.')
    if(start<=new Date())throw httpError(400,'Meeting start must be in the future.')
    if(!['In-person','Online','Hybrid'].includes(meetingMode))throw httpError(400,'Meeting format must be In-person, Online or Hybrid.')
    if((meetingMode==='In-person'||meetingMode==='Hybrid')&&!venue)throw httpError(400,'A physical venue is required for in-person or hybrid meetings.')
    if((meetingMode==='Online'||meetingMode==='Hybrid')&&!meetingLink)throw httpError(400,'An online join link is required for online or hybrid meetings.')
    if(meetingLink){let parsed;try{parsed=new URL(meetingLink)}catch{throw httpError(400,'Online meeting link must be a valid HTTPS URL.')}if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw httpError(400,'Online meeting link must be a valid HTTPS URL without embedded credentials.')}
    const row=await transaction(async client=>{
      const meeting=(await client.query(`INSERT INTO meetings(
        title,meeting_type,description,start_at,end_at,venue,meeting_link,created_by,chair_id,secretary_id,reviewer_id,calendar_event_id,resource_links,schedule_approval_status,schedule_approver_id,schedule_approval_submitted_at
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NULL,$12::jsonb,'Pending Approval',$13,NOW()) RETURNING *`,
        [title,String(v.meetingType||'Departmental').slice(0,80),String(v.description||'').trim(),
         start.toISOString(),end.toISOString(),venue||null,meetingLink||null,req.user.id,v.chairId||req.user.id,
         v.secretaryId||null,v.reviewerId||null,JSON.stringify(resourceLinks),scheduleApproverId])).rows[0]
      const coreIds=[req.user.id,v.chairId,v.secretaryId,v.reviewerId].filter(Boolean)
      const allIds=[...new Set([...coreIds,...invitedIds])]
      for(const userId of allIds){
        const isCore=coreIds.includes(userId)
        const role=userId===meeting.chair_id?'Chair':userId===meeting.secretary_id?'Secretary':
          userId===meeting.reviewer_id?'Minutes Reviewer':String(participantRoles[userId]||'Attendee').slice(0,80)
        await client.query(`INSERT INTO meeting_participants(meeting_id,user_id,participant_role,response_status)
          VALUES($1,$2,$3,$4)
          ON CONFLICT(meeting_id,user_id) DO UPDATE SET participant_role=EXCLUDED.participant_role`,
          [meeting.id,userId,role,isCore?'Accepted':'Invited'])
      }
      await notifyScheduleApproval(client,scheduleApproverId,'Meeting schedule approval requested',
        `A meeting request from ${req.user.name||'a staff member'} requires your decision: “${title}” on ${start.toLocaleString('en-KE',{timeZone:'Africa/Nairobi'})}. Open Reviews & Approvals in REDESY.`,meeting.id)
      await audit(client,req.user.id,'MEETING_SCHEDULE_SUBMITTED',meeting.id,{
        title,startAt:start.toISOString(),endAt:end.toISOString(),scheduleApproverId,meetingMode,participantCount:allIds.length,resourceLinkCount:resourceLinks.length
      })
      return {meeting,scheduleApproverId}
    })
    const approvalEmail=await deliverScheduleApprovalEmail(row.meeting.id,row.scheduleApproverId,req.user.id,'Submitted')
    res.status(201).json({...await getMeetingDetail(req.user,row.meeting.id),schedule_approval_status:'Pending Approval',approval_email:approvalEmail,invitation_delivery:{inApp:0,emailSent:0,emailFailed:0,emailSkipped:0,status:'Held until meeting schedule approval'}})
  }catch(error){next(error)}})

  app.patch('/api/meetings/:id',authenticate,async(req,res,next)=>{try{
    await requireManage(req,req.params.id)
    const v=req.body||{}
    const existing=(await query('SELECT * FROM meetings WHERE id=$1',[req.params.id])).rows[0]
    if(!existing)throw httpError(404,'Meeting not found.')
    if(existing.schedule_approval_status==='Rejected')throw httpError(409,'A rejected meeting request cannot be edited or resubmitted.')
    const title=v.title?requireString(v.title,'Meeting title',240):existing.title
    const start=v.startAt?new Date(v.startAt):new Date(existing.start_at)
    const end=v.endAt===null?null:v.endAt?new Date(v.endAt):existing.end_at?new Date(existing.end_at):null
    if(Number.isNaN(start.getTime())||!end||Number.isNaN(end.getTime()))throw httpError(400,'Meeting start and end date/times are required.')
    if(start<=new Date())throw httpError(400,'Meeting start must be in the future.')
    if(end<=start)throw httpError(400,'Meeting end time must be later than the start time.')
    const venue=String(v.venue??existing.venue??'').trim()
    const meetingLink=String(v.meetingLink??existing.meeting_link??'').trim()
    const meetingMode=String(v.meetingMode||(meetingLink&&venue?'Hybrid':meetingLink?'Online':'In-person'))
    if(!['In-person','Online','Hybrid'].includes(meetingMode))throw httpError(400,'Meeting format must be In-person, Online or Hybrid.')
    if((meetingMode==='In-person'||meetingMode==='Hybrid')&&!venue)throw httpError(400,'A physical venue is required for in-person or hybrid meetings.')
    if((meetingMode==='Online'||meetingMode==='Hybrid')&&!meetingLink)throw httpError(400,'An online join link is required for online or hybrid meetings.')
    if(meetingLink){let parsed;try{parsed=new URL(meetingLink)}catch{throw httpError(400,'Online meeting link must be a valid HTTPS URL.')}if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw httpError(400,'Online meeting link must be a valid HTTPS URL without embedded credentials.')}
    const resourceLinks=v.resourceLinks===undefined?normalizeMeetingResourceLinks(existing.resource_links):normalizeMeetingResourceLinks(v.resourceLinks)
    const existingPeople=(await query(`SELECT user_id,participant_role FROM meeting_participants WHERE meeting_id=$1 AND user_id IS NOT NULL`,[existing.id])).rows
    const scheduleChanged=title!==existing.title||String(v.meetingType??existing.meeting_type)!==String(existing.meeting_type)||String(v.description??existing.description??'').trim()!==String(existing.description||'').trim()||start.getTime()!==new Date(existing.start_at).getTime()||end.getTime()!==(existing.end_at?new Date(existing.end_at).getTime():NaN)||venue!==(existing.venue||'')||meetingLink!==(existing.meeting_link||'')||JSON.stringify(resourceLinks)!==JSON.stringify(normalizeMeetingResourceLinks(existing.resource_links))||String((v.chairId??existing.chair_id)??'')!==String(existing.chair_id||'')||String((v.secretaryId??existing.secretary_id)??'')!==String(existing.secretary_id||'')||String((v.reviewerId??existing.reviewer_id)??'')!==String(existing.reviewer_id||'')||(Array.isArray(v.participantIds)&&v.participantIds.map(String).sort().join('|')!==existingPeople.map(item=>item.user_id).filter(Boolean).sort().join('|'))
    const resubmitting=existing.schedule_approval_status==='Returned'
    const needsApproval=resubmitting||(existing.schedule_approval_status==='Approved'&&scheduleChanged)
    const scheduleApproverId=String(v.scheduleApproverId||existing.schedule_approver_id||'').trim()
    if(needsApproval)await assertScheduleApprover(existing.created_by,scheduleApproverId)
    const pendingAtStart=existing.schedule_approval_status==='Pending Approval'
    const participantUpdateRequested=Array.isArray(v.participantIds)
    if(pendingAtStart&&scheduleApproverId!==String(existing.schedule_approver_id||''))throw httpError(409,'A pending request cannot change approvers in place. Ask the current approver to return it for revision, or wait for a decision.')
    if(participantUpdateRequested&&v.participantIds.length>200)throw httpError(400,'A maximum of 200 meeting participants is allowed.')
    const selectedIds=participantUpdateRequested?[...new Set(v.participantIds.map(String).filter(Boolean))]:[]
    if(participantUpdateRequested&&selectedIds.length){const valid=(await query('SELECT id FROM users WHERE active=TRUE AND id=ANY($1::uuid[])',[selectedIds])).rows;if(valid.length!==selectedIds.length)throw httpError(400,'One or more selected participants are unavailable. Refresh and try again.')}
    const invitedIds=participantUpdateRequested?selectedIds:existingPeople.map(item=>item.user_id)
    const participantRoles=v.participantRoles&&typeof v.participantRoles==='object'?v.participantRoles:{}
    const coreIds=[existing.created_by,v.chairId??existing.chair_id,v.secretaryId??existing.secretary_id,v.reviewerId??existing.reviewer_id].filter(Boolean)
    const allIds=[...new Set([...coreIds,...invitedIds])]
    const oldCalendarEventId=existing.calendar_event_id
    const updated=await transaction(async client=>{
      const row=(await client.query(`UPDATE meetings SET title=$2,meeting_type=$3,description=$4,start_at=$5,end_at=$6,venue=$7,meeting_link=$8,chair_id=$9,secretary_id=$10,reviewer_id=$11,resource_links=$12::jsonb,
        schedule_approval_status=CASE WHEN $13 THEN 'Pending Approval' ELSE schedule_approval_status END,
        schedule_approver_id=CASE WHEN $13 THEN $14::uuid ELSE schedule_approver_id END,
        schedule_approval_submitted_at=CASE WHEN $13 THEN NOW() ELSE schedule_approval_submitted_at END,
        schedule_approval_decided_by=CASE WHEN $13 THEN NULL ELSE schedule_approval_decided_by END,
        schedule_approval_decided_at=CASE WHEN $13 THEN NULL ELSE schedule_approval_decided_at END,
        schedule_approval_comments=CASE WHEN $13 THEN NULL ELSE schedule_approval_comments END,
        calendar_event_id=CASE WHEN $13 THEN NULL ELSE calendar_event_id END,updated_at=NOW() WHERE id=$1 RETURNING *`,
        [existing.id,title,v.meetingType??existing.meeting_type,String(v.description??existing.description??'').trim(),start.toISOString(),end?end.toISOString():null,venue||null,meetingLink||null,v.chairId??existing.chair_id,v.secretaryId??existing.secretary_id,v.reviewerId??existing.reviewer_id,JSON.stringify(resourceLinks),needsApproval,scheduleApproverId||null])).rows[0]
      if(needsApproval&&oldCalendarEventId)await client.query('DELETE FROM calendar_events WHERE id=$1',[oldCalendarEventId])
      else if(oldCalendarEventId)await client.query(`UPDATE calendar_events SET title=$2,description=$3,start_at=$4,end_at=$5,updated_at=NOW() WHERE id=$1`,[oldCalendarEventId,title,String(v.description??existing.description??''),start.toISOString(),end?end.toISOString():null])
      if(participantUpdateRequested){
        await client.query(`DELETE FROM meeting_participants WHERE meeting_id=$1 AND user_id IS NOT NULL AND NOT (user_id=ANY($2::uuid[]))`,[existing.id,allIds])
        for(const userId of allIds){
          const prior=existingPeople.find(item=>item.user_id===userId)
          const role=userId===row.chair_id?'Chair':userId===row.secretary_id?'Secretary':userId===row.reviewer_id?'Minutes Reviewer':String(participantRoles[userId]||prior?.participant_role||'Attendee').slice(0,80)
          await client.query(`INSERT INTO meeting_participants(meeting_id,user_id,participant_role,response_status) VALUES($1,$2,$3,$4) ON CONFLICT(meeting_id,user_id) DO UPDATE SET participant_role=EXCLUDED.participant_role`,[existing.id,userId,role,coreIds.includes(userId)?'Accepted':'Invited'])
        }
      }
      if(needsApproval||pendingAtStart)await notifyScheduleApproval(client,scheduleApproverId,'Meeting schedule approval requested',`Meeting request “${title}” has been updated and is awaiting your decision. Open Reviews & Approvals in REDESY.`,existing.id)
      await audit(client,req.user.id,needsApproval?'MEETING_SCHEDULE_RESUBMITTED':pendingAtStart?'MEETING_UPDATED_PENDING_APPROVAL':'MEETING_UPDATED',existing.id,{title,scheduleChanged,needsApproval,scheduleApproverId:needsApproval?scheduleApproverId:existing.schedule_approver_id})
      return row
    })
    if(needsApproval||pendingAtStart){
      await deliverScheduleApprovalEmail(existing.id,scheduleApproverId,req.user.id,'Submitted')
      res.json({...await getMeetingDetail(req.user,existing.id),invitation_delivery:{inApp:0,emailSent:0,emailFailed:0,emailSkipped:0,status:'Held until meeting schedule approval'}})
      return
    }
    const participants=(await query(`SELECT user_id FROM meeting_participants WHERE meeting_id=$1 AND user_id IS NOT NULL AND user_id<>$2`,[existing.id,req.user.id])).rows.map(row=>row.user_id)
    for(const userId of participants)await query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id,priority,action,target_workspace,notification_category) VALUES($1,'Meeting updated',$2,'meeting',$3,'Normal','Open meeting','Meetings','Information')`,[userId,`“${title}” has been updated. Check the latest schedule and meeting details in REDESY.`,existing.id])
    const delivery=await deliverMeetingEmails(existing.id,participants,req.user.id,'Update')
    res.json({...await getMeetingDetail(req.user,existing.id),invitation_delivery:delivery})
  }catch(error){next(error)}})

  app.post('/api/meetings/:id/participants',authenticate,async(req,res,next)=>{try{
    await requireManage(req,req.params.id)
    const userId=req.body?.userId||null
    const guestName=String(req.body?.guestName||'').trim()||null
    if(!userId&&!guestName)throw httpError(400,'Select a REDESY user or provide a guest name.')
    await transaction(async client=>{
      await client.query(`INSERT INTO meeting_participants(
        meeting_id,user_id,guest_name,guest_email,participant_role,response_status
      ) VALUES($1,$2,$3,$4,$5,'Invited')
      ON CONFLICT(meeting_id,user_id) DO UPDATE SET participant_role=EXCLUDED.participant_role`,
      [req.params.id,userId,guestName,String(req.body?.guestEmail||'').trim()||null,
       String(req.body?.participantRole||'Attendee').slice(0,80)])
      if(userId){
        const meetingRow=(await client.query('SELECT title,schedule_approval_status FROM meetings WHERE id=$1',[req.params.id])).rows[0]
        const title=meetingRow?.title||'meeting'
        if(!meetingRow||meetingRow.schedule_approval_status==='Approved')await notify(client,userId,'Meeting invitation',`You have been invited to “${title}”.`,req.params.id)
      }
      await audit(client,req.user.id,'MEETING_PARTICIPANT_ADDED',req.params.id,{userId,guestName})
    })
    const delivery=userId?await deliverMeetingEmails(req.params.id,[userId],req.user.id,'Invitation'):
      {inApp:0,emailSent:0,emailFailed:0,emailSkipped:1,status:'Guest email not automatically sent'}
    res.json({...await getMeetingDetail(req.user,req.params.id),invitation_delivery:delivery})
  }catch(error){next(error)}})

  app.post('/api/meetings/:id/participants/bulk',authenticate,async(req,res,next)=>{try{
    await requireManage(req,req.params.id)
    const input=Array.isArray(req.body?.participants)?req.body.participants:[]
    if(!input.length)throw httpError(400,'Select at least one participant.')
    if(input.length>200)throw httpError(400,'A maximum of 200 participants can be added at once.')
    const rows=input
      .filter(item=>item&&item.userId)
      .map(item=>({userId:String(item.userId),participantRole:String(item.participantRole||'Attendee').slice(0,80)}))
    const unique=[...new Map(rows.map(item=>[item.userId,item])).values()]
    if(!unique.length)throw httpError(400,'Select at least one valid REDESY user.')
    await transaction(async client=>{
      const meeting=(await client.query('SELECT title FROM meetings WHERE id=$1',[req.params.id])).rows[0]
      for(const item of unique){
        await client.query(`INSERT INTO meeting_participants(meeting_id,user_id,participant_role,response_status)
          VALUES($1,$2,$3,'Invited')
          ON CONFLICT(meeting_id,user_id) DO UPDATE SET participant_role=EXCLUDED.participant_role`,
          [req.params.id,item.userId,item.participantRole])
        if(!meeting||meeting.schedule_approval_status==='Approved')await notify(client,item.userId,'Meeting invitation',`You have been invited to “${meeting?.title||'a meeting'}”.`,req.params.id)
      }
      await audit(client,req.user.id,'MEETING_PARTICIPANTS_ADDED',req.params.id,{
        participants:unique.map(item=>({userId:item.userId,role:item.participantRole}))
      })
    })
    const delivery=await deliverMeetingEmails(req.params.id,unique.map(item=>item.userId),req.user.id,'Invitation')
    res.json({...await getMeetingDetail(req.user,req.params.id),invitation_delivery:delivery})
  }catch(error){next(error)}})

  app.patch('/api/meetings/:id/participants/:participantId',authenticate,async(req,res,next)=>{try{
    await requireAccess(req,req.params.id)
    const participant=(await query(`SELECT * FROM meeting_participants WHERE id=$1 AND meeting_id=$2`,
      [req.params.participantId,req.params.id])).rows[0]
    if(!participant)throw httpError(404,'Meeting participant not found.')
    const canManage=await meetingManage(req.user,req.params.id)
    const isSelf=participant.user_id===req.user.id
    if(!canManage&&!isSelf)throw httpError(403,'You cannot update this participant.')
    const allowedResponse=['Invited','Accepted','Tentative','Declined']
    const allowedAttendance=['Not marked','Present','Absent','Apology','Virtual']
    const role=canManage&&req.body?.participantRole?String(req.body.participantRole).slice(0,80):participant.participant_role
    const response=req.body?.responseStatus?String(req.body.responseStatus):participant.response_status
    const attendance=canManage&&req.body?.attendanceStatus?String(req.body.attendanceStatus):participant.attendance_status
    if(!allowedResponse.includes(response))throw httpError(400,'Invalid invitation response status.')
    if(!allowedAttendance.includes(attendance))throw httpError(400,'Invalid attendance status.')
    await query(`UPDATE meeting_participants SET participant_role=$2,response_status=$3,attendance_status=$4 WHERE id=$1`,
      [participant.id,role,response,attendance])
    await query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)
      VALUES($1,'MEETING_PARTICIPANT_UPDATED','meeting',$2,$3::jsonb)`,
      [req.user.id,req.params.id,JSON.stringify({participantId:participant.id,role,response,attendance})])
    res.json(await getMeetingDetail(req.user,req.params.id))
  }catch(error){next(error)}})

  app.delete('/api/meetings/:id/participants/:participantId',authenticate,async(req,res,next)=>{try{
    await requireManage(req,req.params.id)
    const participant=(await query(`SELECT p.*,m.created_by,m.chair_id,m.secretary_id
      FROM meeting_participants p JOIN meetings m ON m.id=p.meeting_id
      WHERE p.id=$1 AND p.meeting_id=$2`,[req.params.participantId,req.params.id])).rows[0]
    if(!participant)throw httpError(404,'Meeting participant not found.')
    if(participant.user_id&&[participant.created_by,participant.chair_id,participant.secretary_id].includes(participant.user_id))
      throw httpError(409,'The meeting owner, chair or secretary cannot be removed from participants.')
    await transaction(async client=>{
      await client.query('DELETE FROM meeting_participants WHERE id=$1',[participant.id])
      await audit(client,req.user.id,'MEETING_PARTICIPANT_REMOVED',req.params.id,{participantId:participant.id,userId:participant.user_id})
    })
    res.json(await getMeetingDetail(req.user,req.params.id))
  }catch(error){next(error)}})

  app.post('/api/meetings/:id/invitations/send',authenticate,async(req,res,next)=>{try{
     await requireManage(req,req.params.id)
     const approvalState=(await query('SELECT schedule_approval_status FROM meetings WHERE id=$1',[req.params.id])).rows[0]
     if(approvalState&&approvalState.schedule_approval_status!=='Approved')throw httpError(409,'Attendee invitations can only be sent after the meeting schedule is approved.')
    const requested=Array.isArray(req.body?.userIds)?req.body.userIds.filter(Boolean):null
    const participantRows=(await query(`SELECT p.user_id,m.title FROM meeting_participants p
      JOIN meetings m ON m.id=p.meeting_id
      WHERE p.meeting_id=$1 AND p.user_id IS NOT NULL`,[req.params.id])).rows
    const available=participantRows.map(row=>row.user_id).filter(id=>id!==req.user.id)
    const ids=requested?[...new Set(requested.filter(id=>available.includes(id)))]:[...new Set(available)]
    const title=participantRows[0]?.title||'Meeting'
    await transaction(async client=>{
      for(const userId of ids){
        await notify(client,userId,'Meeting invitation',`You are invited to “${title}”. Open Meetings in REDESY for the latest details.`,req.params.id)
      }
      await audit(client,req.user.id,'MEETING_INVITATIONS_SENT',req.params.id,{recipientIds:ids})
    })
    const delivery=await deliverMeetingEmails(req.params.id,ids,req.user.id,'Invitation')
    res.json({...delivery,inApp:ids.length})
  }catch(error){next(error)}})

  app.post('/api/meetings/:id/agenda',authenticate,async(req,res,next)=>{try{await requireManage(req,req.params.id);const title=requireString(req.body?.title,'Agenda item',300);const row=await transaction(async client=>{const nextNo=(await client.query('SELECT COALESCE(MAX(item_no),0)+1 n FROM meeting_agenda_items WHERE meeting_id=$1',[req.params.id])).rows[0].n;const item=(await client.query(`INSERT INTO meeting_agenda_items(meeting_id,item_no,title,background,owner_id,duration_minutes) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[req.params.id,nextNo,title,String(req.body?.background||'').trim(),req.body?.ownerId||null,req.body?.durationMinutes||null])).rows[0];await audit(client,req.user.id,'MEETING_AGENDA_ITEM_ADDED',req.params.id,{agendaItemId:item.id,title});return item});res.status(201).json(row)}catch(error){next(error)}})

  app.patch('/api/meetings/:id/agenda/:agendaId',authenticate,async(req,res,next)=>{try{await requireManage(req,req.params.id);const existing=(await query('SELECT * FROM meeting_agenda_items WHERE id=$1 AND meeting_id=$2',[req.params.agendaId,req.params.id])).rows[0];if(!existing)throw httpError(404,'Agenda item not found.');const row=(await query(`UPDATE meeting_agenda_items SET title=$2,background=$3,owner_id=$4,duration_minutes=$5,status=$6,updated_at=NOW() WHERE id=$1 RETURNING *`,[existing.id,req.body?.title??existing.title,req.body?.background??existing.background,req.body?.ownerId??existing.owner_id,req.body?.durationMinutes??existing.duration_minutes,req.body?.status??existing.status])).rows[0];res.json(row)}catch(error){next(error)}})

  app.post('/api/meetings/:id/transcription/audio',authenticate,async(req,res,next)=>{try{await requireManage(req,req.params.id);if(!Buffer.isBuffer(req.body)||req.body.length===0)throw httpError(400,'Audio upload is empty.');const filename=safeFilename(req.get('x-file-name'));const ext=path.extname(filename).toLowerCase();if(!allowedExtensions.has(ext))throw httpError(400,'Unsupported meeting audio/video format.');await fs.mkdir(path.join(uploadRoot,req.params.id),{recursive:true});const storedPath=path.join(uploadRoot,req.params.id,`${crypto.randomUUID()}${ext}`);await fs.writeFile(storedPath,req.body);const transcript=(await query(`INSERT INTO meeting_transcripts(meeting_id,status,original_filename,stored_path,created_by) VALUES($1,'Queued',$2,$3,$4) RETURNING *`,[req.params.id,filename,storedPath,req.user.id])).rows[0];const outputPath=`${storedPath}.json`;void runTranscription(transcript.id,storedPath,outputPath);await query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES($1,'MEETING_AUDIO_UPLOADED','meeting',$2,$3::jsonb)`,[req.user.id,req.params.id,JSON.stringify({transcriptId:transcript.id,filename,size:req.body.length})]);res.status(202).json({...transcript,segments:[]})}catch(error){next(error)}})

  app.get('/api/meetings/:id/transcript',authenticate,async(req,res,next)=>{try{await requireAccess(req,req.params.id);const rows=(await query('SELECT * FROM meeting_transcripts WHERE meeting_id=$1 ORDER BY created_at DESC LIMIT 1',[req.params.id])).rows;if(!rows[0])return res.json(null);const segments=(await query('SELECT * FROM meeting_transcript_segments WHERE transcript_id=$1 ORDER BY segment_no',[rows[0].id])).rows;res.json({...rows[0],segments})}catch(error){next(error)}})

  app.patch('/api/meetings/:id/transcript/segments/:segmentId',authenticate,async(req,res,next)=>{try{await requireManage(req,req.params.id);const text=requireString(req.body?.text,'Transcript text',20000);await query(`UPDATE meeting_transcript_segments s SET speaker_label=$2,corrected_text=$3,corrected_by=$4,corrected_at=NOW() FROM meeting_transcripts t WHERE s.id=$1 AND t.id=s.transcript_id AND t.meeting_id=$5`,[req.params.segmentId,String(req.body?.speakerLabel||'Speaker').slice(0,120),text,req.user.id,req.params.id]);await query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES($1,'MEETING_TRANSCRIPT_CORRECTED','meeting',$2,$3::jsonb)`,[req.user.id,req.params.id,JSON.stringify({segmentId:req.params.segmentId})]);res.json((await getMeetingDetail(req.user,req.params.id)).transcript)}catch(error){next(error)}})

  function meetingMinutesEscapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function replaceMinutesAttendanceSection(content, participants) {
    const people = (Array.isArray(participants) ? participants : []).map(person => ({
      name: person.user_name || person.guest_name || 'Guest',
      status: person.attendance_status || 'Not marked'
    }));
    const markdownRows = people.map(person => `- ${person.name} — ${person.status}`).join('\n') || '- No participants recorded.';
    const htmlRows = people.map(person => `<li>${meetingMinutesEscapeHtml(person.name)} — ${meetingMinutesEscapeHtml(person.status)}</li>`).join('') || '<li>No participants recorded.</li>';
    const value = String(content || '');
    if (/<h[1-6]\b/i.test(value)) {
      const heading = /<h([1-6])\b[^>]*>\s*Attendance\s*<\/h\1\s*>/i;
      const match = heading.exec(value);
      const section = `<ul>${htmlRows}</ul>`;
      if (!match || match.index === undefined) return `${value}${value.trim() ? '' : ''}<h2>Attendance</h2>${section}`;
      const start = match.index + match[0].length;
      const remaining = value.slice(start);
      const nextHeading = /<h[1-6]\b/i.exec(remaining);
      const end = nextHeading?.index ?? remaining.length;
      return `${value.slice(0, start)}${section}${remaining.slice(end)}`;
    }
    const headingPattern = /^[ \t]*#{1,6}[ \t]+Attendance[ \t]*$/im;
    const match = headingPattern.exec(value);
    if (!match || match.index === undefined) return `${value}${value.trim() ? '\n\n' : ''}## Attendance\n${markdownRows}`;
    const start = match.index + match[0].length;
    const remaining = value.slice(start);
    const nextHeading = /^[ \t]*#{1,6}[ \t]+\S.*$/m.exec(remaining);
    const end = nextHeading?.index ?? remaining.length;
    return `${value.slice(0, start)}\n${markdownRows}\n${remaining.slice(end)}`;
  }

  function meetingMinutesSafeHtml(content) {
    const raw = String(content || '').trim();
    const allowed = new Set(['h1','h2','h3','h4','h5','h6','p','ul','ol','li','strong','b','em','i','u','table','thead','tbody','tfoot','tr','td','th','br','hr','blockquote','div','span']);
    if (/<(?:h[1-6]|p|ul|ol|table|div)\b/i.test(raw)) {
      return raw
        .replace(/<(script|style|iframe|object|embed|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<\s*(\/?)\s*([a-z][a-z0-9]*)\b[^>]*>/gi, (tag, close, name) => allowed.has(String(name).toLowerCase()) ? `<${close ? '/' : ''}${String(name).toLowerCase()}>` : '');
    }
    const output = [];
    let inList = false;
    const closeList = () => { if (inList) { output.push('</ul>'); inList = false; } };
    for (const sourceLine of raw.split(/\r?\n/)) {
      const line = sourceLine.trim();
      if (!line) { closeList(); continue; }
      const heading = /^(#{1,6})\s+(.+)$/.exec(line);
      if (heading) { closeList(); output.push(`<h${heading[1].length}>${meetingMinutesEscapeHtml(heading[2])}</h${heading[1].length}>`); continue; }
      const bullet = /^[-*]\s+(.+)$/.exec(line);
      if (bullet) { if (!inList) { output.push('<ul>'); inList = true; } output.push(`<li>${meetingMinutesEscapeHtml(bullet[1])}</li>`); continue; }
      closeList();
      output.push(`<p>${meetingMinutesEscapeHtml(line)}</p>`);
    }
    closeList();
    return output.join('');
  }


  async function buildMeetingMinutesDraftRepositoryHtml(meeting, minute, actor) {
    const coatPath = path.resolve(moduleDir, '../../public/kenya-coat-of-arms.png');
    const pscPath = path.resolve(moduleDir, '../../public/psc-logo.png');
    const [coatBytes, pscBytes] = await Promise.all([
      fs.readFile(coatPath).catch(() => null),
      fs.readFile(pscPath).catch(() => null),
    ]);
    if (!coatBytes || !pscBytes) {
      throw httpError(500, 'Meeting minutes Repository branding assets are missing. Restore backend/public/kenya-coat-of-arms.png and backend/public/psc-logo.png before saving the Repository draft.');
    }
    const coatSrc = `data:image/png;base64,${coatBytes.toString('base64')}`;
    const pscSrc = `data:image/png;base64,${pscBytes.toString('base64')}`;
    const title = meetingMinutesEscapeHtml(meeting.title || 'Meeting');
    const date = meeting.start_at ? meetingMinutesEscapeHtml(new Date(meeting.start_at).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })) : 'Not recorded';
    const venue = meetingMinutesEscapeHtml(meeting.venue || meeting.meeting_link || 'Not recorded');
    const chair = meetingMinutesEscapeHtml(meeting.chair_name || meeting.created_by_name || 'Not recorded');
    const secretary = meetingMinutesEscapeHtml(meeting.secretary_name || 'Not assigned');
    const workflowStatus = meetingMinutesEscapeHtml(minute.status || 'Draft');
    const preparedBy = meetingMinutesEscapeHtml(actor?.name || actor?.email || 'REDESY user');
    const content = meetingMinutesSafeHtml(minute.content || 'Minutes content has not yet been entered.');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>[DRAFT] ${title} — Meeting Minutes</title><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#eceff3;color:#252a32;font:12pt/1.55 "Times New Roman",Georgia,serif}.paper{width:210mm;min-height:297mm;margin:0 auto;padding:17mm 17mm 20mm;background:#fff;border-top:5px solid #b08a28;box-shadow:0 4px 24px rgba(20,26,36,.12)}.identity{display:grid;grid-template-columns:78px 1fr 78px;gap:15px;align-items:center;padding:0 0 13px;border-bottom:2px solid #b08a28;text-align:center;font-family:Arial,Helvetica,sans-serif}.identity img{display:block;max-width:74px;max-height:74px;object-fit:contain;margin:auto}.identity strong{display:block;font-size:12pt;letter-spacing:.08em;color:#775a14}.identity span{display:block;margin-top:5px;font-size:8pt;letter-spacing:.12em;color:#555}.draft-banner{margin:17px 0;padding:10px 12px;border:1px solid #b48e28;background:#fff8e4;color:#714b05;text-align:center;font:bold 10pt Arial,Helvetica,sans-serif;letter-spacing:.05em}.meta{display:grid;grid-template-columns:1fr 1fr;gap:7px 16px;padding:12px 14px;background:#f8f6ef;border:1px solid #ded5bd;font:10pt Arial,Helvetica,sans-serif}.meta p{margin:0}.meta strong{color:#6d5418}.content{margin-top:22px}.content h1{font-size:20pt;border-bottom:2px solid #b08a28;padding-bottom:8px}.content h2{margin:22px 0 8px;padding-bottom:5px;border-bottom:1px solid #ddd0a9;color:#785b12;font-size:14pt}.content p{margin:0 0 9px}.content ul,.content ol{padding-left:23px}.content table{width:100%;border-collapse:collapse;font-size:10pt}.content th,.content td{border:1px solid #cbd0d7;padding:7px;vertical-align:top}.content th{background:#f1ead7}.foot{border-top:1px solid #d5d8de;margin-top:24px;padding-top:8px;color:#626874;text-align:center;font:8pt Arial,Helvetica,sans-serif}@media(max-width:840px){body{padding:0}.paper{width:100%;min-height:100vh;padding:24px 20px;box-shadow:none}.identity{grid-template-columns:52px 1fr 52px;gap:8px}.identity img{max-width:50px;max-height:58px}.meta{grid-template-columns:1fr}}@page{size:A4 portrait;margin:0}@media print{body{padding:0;background:#fff}.paper{width:210mm;min-height:297mm;margin:0;padding:17mm 17mm 20mm;box-shadow:none}.draft-banner{break-inside:avoid}}</style></head><body><main class="paper"><header class="identity"><img src="${coatSrc}" alt="Coat of Arms of Kenya"><div><strong>PUBLIC SERVICE COMMISSION</strong><span>MEETING MINUTES · CONTROLLED WORKING COPY</span></div><img src="${pscSrc}" alt="Public Service Commission logo"></header><div class="draft-banner">WORKING DRAFT — ${workflowStatus.toUpperCase()} — NOT APPROVED — NOT AN OFFICIAL RECORD</div><section class="meta"><p><strong>Meeting:</strong> ${title}</p><p><strong>Date:</strong> ${date}</p><p><strong>Venue:</strong> ${venue}</p><p><strong>Chair:</strong> ${chair}</p><p><strong>Secretary:</strong> ${secretary}</p><p><strong>Minutes version:</strong> v${Number(minute.version_no || 1)}</p><p><strong>Workflow status:</strong> ${workflowStatus}</p><p><strong>Draft snapshot prepared by:</strong> ${preparedBy}</p></section><article class="content">${content}</article><footer class="foot">App2 meeting draft · ${title} · NOT APPROVED / NOT FOR OFFICIAL CITATION</footer></main></body></html>`;
  }

  async function syncMeetingMinutesDraftToRepository(client, meeting, minute, actor) {
    if (!meeting || !minute || !['Draft', 'Returned', 'Submitted'].includes(minute.status)) return null;
    const ownerId = actor?.id || minute.created_by;
    if (!ownerId) throw httpError(409, 'A meeting draft Repository owner could not be identified.');
    const actorForSnapshot = { ...actor, name: actor?.name || actor?.email || 'REDESY user' };
    const html = await buildMeetingMinutesDraftRepositoryHtml(meeting, minute, actorForSnapshot);
    const sourceUrl = `app2://meetings/${meeting.id}/minutes`;
    const saved = await savePrivateDraftRepositoryVersion({
      client,
      actor: actorForSnapshot,
      ownerId,
      entityType: 'meeting',
      entityId: meeting.id,
      title: `[DRAFT] ${meeting.title} — Meeting Minutes`,
      description: `Working draft for “${meeting.title}” (meeting ${meeting.id}), minutes v${minute.version_no}. Workflow status: ${minute.status}. NOT APPROVED; not an official record.`,
      documentType: 'Meeting Minutes Draft',
      subject: meeting.title,
      sourceType: 'App2 Upload',
      tags: ['meeting', 'minutes', 'draft', 'not-approved'],
      bytes: Buffer.from(html, 'utf8'),
      fileExtension: '.html',
      storeDocument,
      audit: async (tx, userId, action, _entityType, entityId, details) => audit(tx, userId, action, entityId, details),
    });
    await client.query(`UPDATE knowledge_items SET source_type='App2 Upload',source_url=$2,category='Working Drafts',
      document_type='Meeting Minutes Draft',subject=$3,directorate='PSC',classification='INTERNAL',felix_enabled=FALSE,
      is_archived=FALSE,record_class='Meeting Records',records_lifecycle_state='Working Document',reviewer_id=$4,updated_at=NOW()
      WHERE id=$1`, [saved.documentId, sourceUrl, meeting.title, minute.reviewer_id || null]);
    await audit(client, actor.id, 'MEETING_MINUTES_DRAFT_REPOSITORY_SYNCED', meeting.id, {
      meetingMinutesId: minute.id, minutesVersion: minute.version_no, workflowStatus: minute.status,
      repositoryDocumentId: saved.documentId, repositoryVersion: saved.version, versionCreated: saved.versionCreated,
    });
    return {
      repository_draft_document_id: saved.documentId,
      repository_draft_document_title: `[DRAFT] ${meeting.title} — Meeting Minutes`,
      repository_draft_document_status: 'Draft',
      repository_draft_version: saved.version,
      repository_draft_version_created: saved.versionCreated,
    };
  }

  async function prepareApprovedMeetingMinutesFile(meeting, minute, approver, options = {}) {
    const storageModule = await import('../document-storage.js');
    const pdfModule = await import('../task-report-pdf.js');
    const storeDocument = storageModule.storeDocument || storageModule.default?.storeDocument;
    const validateDocumentUpload = storageModule.validateDocumentUpload || storageModule.default?.validateDocumentUpload;
    const buildPscTaskFinalPdf = pdfModule.buildPscTaskFinalPdf || pdfModule.default?.buildPscTaskFinalPdf;
    if (typeof storeDocument !== 'function' || typeof validateDocumentUpload !== 'function' || typeof buildPscTaskFinalPdf !== 'function') {
      throw new Error('Meeting minutes publication helpers are unavailable from the configured REDESY backend modules.');
    }
    const downloadOnly = options.downloadOnly === true;
    const approvedRecord = !downloadOnly || (minute.status === 'Approved' && Boolean(minute.approved_by && minute.approved_at));
    const documentTitle = downloadOnly && !approvedRecord
      ? `${meeting.title} — Meeting Minutes — ${String(minute.status || 'Draft').toUpperCase()} — NOT APPROVED`
      : `${meeting.title} — Approved Meeting Minutes`;
    const approvedAt = new Date().toLocaleString('en-GB', { timeZone: 'Africa/Nairobi' });
    const dateLabel = meeting.start_at ? new Date(meeting.start_at).toLocaleString('en-GB', { timeZone: 'Africa/Nairobi' }) : 'Not recorded';
    const html = meetingMinutesSafeHtml(minute.content);
    const pdfBytes = Buffer.from(await buildPscTaskFinalPdf(documentTitle, {
      'Meeting': meeting.title,
      'Meeting date': dateLabel,
      'Venue': meeting.venue || meeting.meeting_link || 'Not recorded',
      'Chair': meeting.chair_name || 'Not recorded',
      'Secretary': meeting.secretary_name || 'Not assigned',
      'Minutes version': `v${minute.version_no}`,
      'Approved by': approvedRecord ? (approver.name || 'Authorised reviewer') : 'NOT APPROVED',
      'Approval date': approvedRecord ? (downloadOnly && minute.approved_at ? new Date(minute.approved_at).toLocaleString('en-GB', { timeZone: 'Africa/Nairobi' }) : approvedAt) : 'NOT APPROVED',
      'Workflow status': approvedRecord ? 'APPROVED OFFICIAL RECORD' : `WORKING DOCUMENT — ${String(minute.status || 'Draft').toUpperCase()} — NOT APPROVED`,
      'Classification': 'INTERNAL'
    }, [{ heading: false, content: html }], { layout: 'portrait', governmentIdentity: options.downloadOnly ? false : true }));
    const originalName = `Meeting_Minutes_${String(meeting.id).replace(/-/g, '').slice(0, 8)}_v${minute.version_no}${downloadOnly && !approvedRecord ? '_DRAFT' : ''}.pdf`;
    const checked = validateDocumentUpload(pdfBytes, originalName, 'application/pdf');
    const stored = options.store === false ? null : await storeDocument(pdfBytes, checked.extension);
    return { pdfBytes, checked, stored, originalName };
  }

  const meetingRepositoryRecordCode = value => String(value || 'GEN').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean).map(part => part.slice(0, 3)).join('').slice(0, 12) || 'GEN';

  async function ensureMeetingRepositoryRecordNumber(client, item) {
    if (item.record_number) return item.record_number;
    const year = new Date(item.document_date || item.created_at || Date.now()).getFullYear();
    const division = meetingRepositoryRecordCode(item.directorate || 'PSC');
    const classCode = meetingRepositoryRecordCode(item.record_class || item.category || item.document_type || 'Record');
    const prefix = `PSC/${division}/${classCode}`;
    const seq = (await client.query(`INSERT INTO repository_record_sequences(year,prefix,last_number)
      VALUES($1,$2,1)
      ON CONFLICT(year,prefix) DO UPDATE SET last_number=repository_record_sequences.last_number+1
      RETURNING last_number`, [year, prefix])).rows[0].last_number;
    const recordNumber = `${prefix}/${year}/${String(seq).padStart(4, '0')}`;
    await client.query('UPDATE knowledge_items SET record_number=$1 WHERE id=$2', [recordNumber, item.id]);
    return recordNumber;
  }

  async function findCurrentMeetingMinutesPublication(client, meeting, minute) {
    const sourceUrl = `app2://meetings/${meeting.id}/minutes`;
    const result = await client.query(`SELECT k.*,v.version_number AS repository_version,v.notes AS publication_notes
      FROM knowledge_items k JOIN knowledge_versions v ON v.knowledge_id=k.id AND v.is_current=TRUE
      WHERE k.source_type='App2 Upload' AND k.document_type='Meeting Minutes' AND k.source_url=$1 AND k.status='Published'
      ORDER BY v.version_number DESC LIMIT 1 FOR UPDATE OF k`, [sourceUrl]);
    const row = result.rows[0];
    const notes = String(row?.publication_notes || '');
    if (!row || !notes.includes(`meetingMinutesId=${minute.id};`) || !notes.includes(`meetingMinutesVersion=${minute.version_no}`)) return null;

    // Bring legacy R2.2 publications into the Repository's discoverable category without creating duplicate versions.
    const repositoryCategoryId = (await client.query(
      "SELECT id FROM document_categories WHERE name='Meeting & Workshop Reports' AND is_active=TRUE LIMIT 1"
    )).rows[0]?.id || null;
    const retentionScheduleId = (await client.query(
      "SELECT id FROM repository_retention_schedules WHERE name='Meeting Record Standard' AND active=TRUE LIMIT 1"
    )).rows[0]?.id || null;
    const expectedTitle = `${meeting.title} — Approved Meeting Minutes`;
    const expectedDescription = `Official approved minutes for “${meeting.title}”, meeting record ${meeting.id}, approved minutes version v${minute.version_no}.`;
    const categoryMatches = row.category === 'Meeting & Workshop Reports' && (!repositoryCategoryId || row.category_id === repositoryCategoryId);
    const metadataNeedsRepair = !categoryMatches || row.title !== expectedTitle || row.description !== expectedDescription ||
      row.felix_enabled !== false || row.is_archived !== false || row.record_class !== 'Meeting Records' ||
      row.records_lifecycle_state !== 'Active Record' || Boolean(retentionScheduleId && row.retention_schedule_id !== retentionScheduleId);
    if (metadataNeedsRepair) {
      await client.query(`UPDATE knowledge_items SET title=$2,description=$3,category='Meeting & Workshop Reports',category_id=$4,
        document_type='Meeting Minutes',subject=$5,status='Published',felix_enabled=FALSE,is_archived=FALSE,
        record_class='Meeting Records',records_lifecycle_state='Active Record',
        retention_schedule_id=COALESCE($6,retention_schedule_id),updated_at=NOW() WHERE id=$1`,
      [row.id, expectedTitle, expectedDescription, repositoryCategoryId, meeting.title, retentionScheduleId]);
    }
    const normalizedItem = {
      id: row.id, record_number: row.record_number, document_date: row.document_date || meeting.start_at,
      created_at: row.created_at, directorate: row.directorate, record_class: 'Meeting Records', category: 'Meeting & Workshop Reports'
    };
    const recordNumber = await ensureMeetingRepositoryRecordNumber(client, normalizedItem);
    return { id: row.id, title: expectedTitle, version: Number(row.repository_version), record_number: recordNumber, reused: true };
  }

  async function persistApprovedMeetingMinutes(client, meeting, minute, approvedBy, prepared) {
    const sourceUrl = `app2://meetings/${meeting.id}/minutes`;
    const priorPublication = await findCurrentMeetingMinutesPublication(client, meeting, minute);
    if (priorPublication) return priorPublication;
    const tags = ['meeting', 'minutes', 'approved'];
    const repositoryCategoryId = (await client.query(
      "SELECT id FROM document_categories WHERE name='Meeting & Workshop Reports' AND is_active=TRUE LIMIT 1"
    )).rows[0]?.id || null;
    const title = `${meeting.title} — Approved Meeting Minutes`;
    const description = `Official approved minutes for “${meeting.title}”, meeting record ${meeting.id}, approved minutes version v${minute.version_no}.`;
    const retentionScheduleId = (await client.query(
      "SELECT id FROM repository_retention_schedules WHERE name='Meeting Record Standard' AND active=TRUE LIMIT 1"
    )).rows[0]?.id || null;
    let item = (await client.query(
      "SELECT * FROM knowledge_items WHERE source_type='App2 Upload' AND document_type IN('Meeting Minutes','Meeting Minutes Draft') AND source_url=$1 FOR UPDATE",
      [sourceUrl]
    )).rows[0];
    let versionNumber = 1;

    if (item) {
      versionNumber = Number((await client.query(
        'SELECT COALESCE(MAX(version_number),0)+1 AS number FROM knowledge_versions WHERE knowledge_id=$1',
        [item.id]
      )).rows[0].number);
      await client.query('UPDATE knowledge_versions SET is_current=FALSE WHERE knowledge_id=$1', [item.id]);
      item = (await client.query(`UPDATE knowledge_items SET
        title=$1,description=$2,author=$3,document_date=$4,status='Published',approved_by=$5,
        approved_at=NOW(),reviewed_by=$5,reviewed_at=NOW(),reviewer_id=$5,current_version=$6,
        category='Meeting & Workshop Reports',category_id=$10,document_type='Meeting Minutes',subject=$8,classification='INTERNAL',
        felix_enabled=FALSE,record_class='Meeting Records',records_lifecycle_state='Active Record',is_archived=FALSE,
        retention_schedule_id=$9,declared_at=COALESCE(declared_at,NOW()),declared_by=COALESCE(declared_by,$5),
        updated_at=NOW()
        WHERE id=$7 RETURNING *`, [
        title, description, meeting.secretary_name || meeting.chair_name || 'Meeting Secretariat',
        meeting.start_at || null, approvedBy, versionNumber, item.id, meeting.title, retentionScheduleId, repositoryCategoryId
      ])).rows[0];
    } else {
      item = (await client.query(`INSERT INTO knowledge_items(
        title,description,category,category_id,tags,author,document_date,status,created_by,approved_by,approved_at,current_version,
        source_type,source_url,document_type,subject,classification,felix_enabled,reviewed_by,reviewed_at,reviewer_id,
        record_class,records_lifecycle_state,retention_schedule_id,declared_at,declared_by
      ) VALUES(
        $1,$2,'Meeting & Workshop Reports',$3,$4,$5,$6,'Published',$7,$8,NOW(),1,
        'App2 Upload',$9,'Meeting Minutes',$10,'INTERNAL',FALSE,$8,NOW(),$8,
        'Meeting Records','Active Record',$11,NOW(),$8
      ) RETURNING *`, [
        title, description, repositoryCategoryId, tags, meeting.secretary_name || meeting.chair_name || 'Meeting Secretariat',
        meeting.start_at || null, meeting.created_by, approvedBy, sourceUrl, meeting.title, retentionScheduleId
      ])).rows[0];
    }

    // The global Published trigger enables Felix by default; governed minutes remain restricted from Felix indexing.
    await client.query('UPDATE knowledge_items SET felix_enabled=FALSE WHERE id=$1', [item.id]);
    const recordNumber = await ensureMeetingRepositoryRecordNumber(client, item);
    const version = (await client.query(`INSERT INTO knowledge_versions(
      knowledge_id,version_number,uploader_id,original_name,stored_name,storage_path,mime_type,size_bytes,sha256_hash,
      is_current,approved_by,approved_at,notes
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,$3,NOW(),$10) RETURNING id,version_number`, [
      item.id, versionNumber, approvedBy, prepared.checked.originalName || prepared.originalName,
      prepared.stored.storedName, prepared.stored.storagePath, prepared.checked.mimeType || 'application/pdf',
      prepared.pdfBytes.length, prepared.checked.sha256,
      `Approved minutes version v${minute.version_no}; meetingId=${meeting.id}; meetingMinutesId=${minute.id}; meetingMinutesVersion=${minute.version_no}`
    ])).rows[0];

    for (const tag of tags) {
      const tagRow = (await client.query(
        'INSERT INTO document_tags(name,normalized_name,created_by) VALUES($1,lower($1),$2) ON CONFLICT(normalized_name) DO UPDATE SET name=EXCLUDED.name RETURNING id',
        [tag, approvedBy]
      )).rows[0];
      await client.query(
        'INSERT INTO document_tag_links(knowledge_id,tag_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [item.id, tagRow.id]
      );
    }
    await audit(client, approvedBy, 'MEETING_MINUTES_PUBLISHED_TO_REPOSITORY', meeting.id, {
      repositoryDocumentId: item.id, repositoryRecordNumber: recordNumber, meetingMinutesId: minute.id,
      minutesVersion: minute.version_no, repositoryVersion: version.version_number, title: item.title
    });
    return { id: item.id, title: item.title, version: version.version_number, record_number: recordNumber, reused: false };
  }

  app.get('/api/meetings/:id/minutes/export.pdf', authenticate, async (req, res, next) => {
    try {
      await requireAccess(req, req.params.id);
      const latest = (await query('SELECT * FROM meeting_minutes WHERE meeting_id=$1 ORDER BY version_no DESC LIMIT 1', [req.params.id])).rows[0];
      if (!latest) throw httpError(404, 'Meeting minutes have not been saved yet.');
      const meeting = await getMeetingDetail(req.user, req.params.id);
      const pdfApprover = latest.approved_by
        ? ((await query('SELECT id,name FROM users WHERE id=$1', [latest.approved_by])).rows[0] || req.user)
        : req.user;
      const prepared = await prepareApprovedMeetingMinutesFile(meeting, latest, pdfApprover, { downloadOnly: true, store: false });
      await transaction(async client => {
        await audit(client, req.user.id, 'MEETING_MINUTES_PDF_DOWNLOADED', req.params.id, {
          minutesId: latest.id,
          minutesVersion: latest.version_no,
          workflowStatus: latest.status,
          approved: latest.status === 'Approved' && Boolean(latest.approved_by && latest.approved_at)
        });
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${prepared.originalName}"`);
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.status(200).send(prepared.pdfBytes);
    } catch (error) { next(error); }
  });
  app.post('/api/meetings/:id/minutes/generate',authenticate,async(req,res,next)=>{
    try {
      await requireManage(req,req.params.id);
      const detail=await getMeetingDetail(req.user,req.params.id);
      const lines=[`# ${detail.title}`,``,`Date: ${new Date(detail.start_at).toLocaleString('en-KE')}`,`Venue: ${detail.venue||detail.meeting_link||'Not recorded'}`,`Chair: ${detail.chair_name||detail.created_by_name}`,`Secretary: ${detail.secretary_name||'Not assigned'}`,``,`## Attendance`,...detail.participants.map(p=>`- ${p.user_name||p.guest_name||'Guest'} — ${p.attendance_status}`),``,`## Agenda`,...detail.agenda.map(a=>`${a.item_no}. ${a.title}${a.background?` — ${a.background}`:''}`),``,`## Discussion record`,...(detail.transcript?.segments||[]).map(s=>`[${Math.floor(Number(s.start_seconds)/60)}:${String(Math.floor(Number(s.start_seconds)%60)).padStart(2,'0')}] ${s.speaker_label||'Speaker'}: ${s.corrected_text||s.text}`),``,`## Decisions`,...detail.decisions.map(d=>`${d.decision_no}. ${d.text}`),``,`## Actions`,...detail.actions.map(a=>`- ${a.title} — ${a.owner_name||'Unassigned'} — due ${a.due_date||'not set'} — ${a.status}`)].join('\n');
      const minute=await transaction(async client=>{
        const latest=(await client.query('SELECT * FROM meeting_minutes WHERE meeting_id=$1 ORDER BY version_no DESC LIMIT 1 FOR UPDATE',[req.params.id])).rows[0];
        let row;
        if(latest&&['Draft','Returned'].includes(latest.status)) {
          const refreshedContent=replaceMinutesAttendanceSection(String(latest.content||''),detail.participants);
          row=(await client.query("UPDATE meeting_minutes SET content=$2,reviewer_id=$3,status='Draft',updated_at=NOW() WHERE id=$1 RETURNING *",[latest.id,refreshedContent,detail.reviewer_id])).rows[0];
        } else {
          const version=Number(latest?.version_no||0)+1;
          row=(await client.query(`INSERT INTO meeting_minutes(meeting_id,version_no,status,content,reviewer_id,created_by) VALUES($1,$2,'Draft',$3,$4,$5) RETURNING *`,[req.params.id,version,lines,detail.reviewer_id,req.user.id])).rows[0];
        }
        const repositoryDraft=await syncMeetingMinutesDraftToRepository(client,detail,row,req.user);
        await audit(client,req.user.id,'MEETING_MINUTES_GENERATED',req.params.id,{minutesId:row.id,version:row.version_no,repositoryDraftId:repositoryDraft?.repository_draft_document_id||null});
        return {...row,...(repositoryDraft||{})};
      });
      res.json(minute);
    } catch(error) { next(error); }
  })

  app.patch('/api/meetings/:id/minutes',authenticate,async(req,res,next)=>{
    try {
      await requireManage(req,req.params.id);
      const content=requireString(req.body?.content,'Minutes content',250000);
      const detail=await getMeetingDetail(req.user,req.params.id);
      const row=await transaction(async client=>{
        const meeting=(await client.query('SELECT id,reviewer_id FROM meetings WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];
        if(!meeting)throw httpError(404,'Meeting not found.');
        const latest=(await client.query('SELECT * FROM meeting_minutes WHERE meeting_id=$1 ORDER BY version_no DESC LIMIT 1 FOR UPDATE',[req.params.id])).rows[0];
        let saved;
        if(!latest){
          const created=(await client.query(`INSERT INTO meeting_minutes(meeting_id,version_no,status,content,reviewer_id,created_by)
            VALUES($1,1,'Draft',$2,$3,$4) RETURNING *`,[req.params.id,content,meeting.reviewer_id,req.user.id])).rows[0];
          saved=created;
          await audit(client,req.user.id,'MEETING_MINUTES_DRAFT_SAVED',req.params.id,{minutesId:saved.id,version:saved.version_no,created:true});
        } else {
          if(!['Draft','Returned'].includes(latest.status))throw httpError(409,'Only draft or returned minutes can be edited. Generate a new draft version before editing approved or submitted minutes.');
          saved=(await client.query(`UPDATE meeting_minutes SET content=$2,status='Draft',updated_at=NOW() WHERE id=$1 RETURNING *`,[latest.id,content])).rows[0];
          await audit(client,req.user.id,'MEETING_MINUTES_DRAFT_SAVED',req.params.id,{minutesId:saved.id,version:saved.version_no,created:false});
        }
        const repositoryDraft=await syncMeetingMinutesDraftToRepository(client,detail,saved,req.user);
        return {...saved,...(repositoryDraft||{})};
      });
      res.json(row);
    } catch(error) { next(error); }
  })

  app.post('/api/meetings/:id/minutes/submit',authenticate,async(req,res,next)=>{
    try {
      await requireManage(req,req.params.id);
      const reviewerId=req.body?.reviewerId;
      if(!reviewerId)throw httpError(400,'A reviewer is required before submission.');
      const meeting=(await query('SELECT * FROM meetings WHERE id=$1',[req.params.id])).rows[0];
      if(!meeting)throw httpError(404,'Meeting not found.');
      if(reviewerId===meeting.created_by||reviewerId===req.user.id)throw httpError(400,'Minutes cannot be self-reviewed.');
      const latest=(await query('SELECT * FROM meeting_minutes WHERE meeting_id=$1 ORDER BY version_no DESC LIMIT 1',[req.params.id])).rows[0];
      if(!latest)throw httpError(409,'Generate or save minutes before submission.');
      const detail=await getMeetingDetail(req.user,req.params.id);
      const row=await transaction(async client=>{
        const locked=(await client.query('SELECT * FROM meeting_minutes WHERE id=$1 FOR UPDATE',[latest.id])).rows[0];
        if(!locked||!['Draft','Returned'].includes(locked.status))throw httpError(409,'Only a saved draft or returned minutes version can be submitted.');
        const updated=(await client.query(`UPDATE meeting_minutes SET status='Submitted',reviewer_id=$2,review_comments=NULL,updated_at=NOW() WHERE id=$1 RETURNING *`,[locked.id,reviewerId])).rows[0];
        await client.query('UPDATE meetings SET reviewer_id=$2,updated_at=NOW() WHERE id=$1',[req.params.id,reviewerId]);
        await notify(client,reviewerId,'Meeting minutes awaiting review',`Minutes for “${meeting.title}” are ready for your review.`,req.params.id);
        const repositoryDraft=await syncMeetingMinutesDraftToRepository(client,detail,updated,req.user);
        await audit(client,req.user.id,'MEETING_MINUTES_SUBMITTED',req.params.id,{reviewerId,minutesId:latest.id,repositoryDraftId:repositoryDraft?.repository_draft_document_id||null});
        return {...updated,...(repositoryDraft||{})};
      });
      res.json(row);
    } catch(error) { next(error); }
  })

  app.post('/api/meetings/:id/minutes/review',authenticate,async(req,res,next)=>{
    let prepared = null;
    try {
      await requireAccess(req,req.params.id);
      const decision = String(req.body?.decision || '');
      if (!['Approved','Returned'].includes(decision)) throw httpError(400,'Decision must be Approved or Returned.');
      const latest = (await query('SELECT * FROM meeting_minutes WHERE meeting_id=$1 ORDER BY version_no DESC LIMIT 1',[req.params.id])).rows[0];
      if (!latest || latest.status !== 'Submitted') throw httpError(409,'Minutes are not awaiting review.');
      if (latest.reviewer_id !== req.user.id) throw httpError(403,'Only the assigned reviewer can decide these minutes.');
      const meeting = await getMeetingDetail(req.user,req.params.id);
      if (!meeting) throw httpError(404,'Meeting not found.');
      if (decision === 'Approved') prepared = await prepareApprovedMeetingMinutesFile(meeting,latest,req.user);
      const outcome = await transaction(async client => {
        const locked = (await client.query('SELECT * FROM meeting_minutes WHERE id=$1 FOR UPDATE',[latest.id])).rows[0];
        if (!locked || locked.status !== 'Submitted') throw httpError(409,'Minutes are no longer awaiting review. Refresh the meeting and try again.');
        if (locked.reviewer_id !== req.user.id) throw httpError(403,'Only the assigned reviewer can decide these minutes.');
        const updated = (await client.query(`UPDATE meeting_minutes SET status=$2,review_comments=$3,approved_by=CASE WHEN $2='Approved' THEN $4 ELSE NULL END,approved_at=CASE WHEN $2='Approved' THEN NOW() ELSE NULL END,updated_at=NOW() WHERE id=$1 RETURNING *`,[locked.id,decision,String(req.body?.comments||'').trim(),req.user.id])).rows[0];
        const publication = decision === 'Approved' ? await persistApprovedMeetingMinutes(client,meeting,updated,req.user.id,prepared) : null;
        const repositoryDraft = decision === 'Returned' ? await syncMeetingMinutesDraftToRepository(client,meeting,updated,req.user) : null;
        await notify(client,meeting.created_by,decision==='Approved'?'Meeting minutes approved':'Meeting minutes returned',decision==='Approved'?`Minutes for “${meeting.title}” were approved and published to the Document Repository${publication?.title ? ` as “${publication.title}”` : ''}.`:`Minutes for “${meeting.title}” were returned for correction.`,req.params.id);
        await audit(client,req.user.id,decision==='Approved'?'MEETING_MINUTES_APPROVED':'MEETING_MINUTES_RETURNED',req.params.id,{title:meeting.title,minutesId:updated.id,version:updated.version_no,comments:req.body?.comments||'',repositoryDocumentId:publication?.id||null,repositoryVersion:publication?.version||null});
        return { updated, publication, repositoryDraft };
      });
      if (outcome.publication?.reused && prepared?.stored?.absolutePath) await fs.unlink(prepared.stored.absolutePath).catch(()=>{});
      prepared = null; // The persisted Repository version owns the stored file, or a redundant temporary file was removed.
      if (outcome.publication) return res.json({ ...outcome.updated, repository_document_id:outcome.publication.id, repository_document_title:outcome.publication.title, repository_document_status:'Published', repository_record_number:outcome.publication.record_number, repository_version:outcome.publication.version });
      return res.json({ ...outcome.updated, ...(outcome.repositoryDraft || {}) });
    } catch(error) {
      if (prepared?.stored?.absolutePath) await fs.unlink(prepared.stored.absolutePath).catch(()=>{});
      next(error);
    }
  })


  app.post('/api/meetings/:id/minutes/sync-draft', authenticate, async (req, res, next) => {
    try {
      await requireManage(req, req.params.id);
      const detail = await getMeetingDetail(req.user, req.params.id);
      const synced = await transaction(async client => {
        const minute = (await client.query('SELECT * FROM meeting_minutes WHERE meeting_id=$1 ORDER BY version_no DESC LIMIT 1 FOR UPDATE', [req.params.id])).rows[0];
        if (!minute) throw httpError(409, 'Save or generate the meeting minutes before syncing a Repository draft.');
        if (!['Draft', 'Returned', 'Submitted'].includes(minute.status)) {
          throw httpError(409, 'Only draft, returned or submitted minutes can be stored as a Repository working draft. Approved minutes use the official Published Repository record.');
        }
        const receipt = await syncMeetingMinutesDraftToRepository(client, detail, minute, req.user);
        await audit(client, req.user.id, 'MEETING_MINUTES_DRAFT_REPOSITORY_SYNC_REQUESTED', req.params.id, {
          meetingMinutesId: minute.id, minutesVersion: minute.version_no, repositoryDocumentId: receipt?.repository_draft_document_id || null,
        });
        return { ...minute, ...(receipt || {}) };
      });
      res.json(synced);
    } catch (error) { next(error); }
  });

  app.post('/api/meetings/:id/minutes/publish-approved', authenticate, async (req, res, next) => {
    let prepared = null;
    try {
      await requireAccess(req, req.params.id);
      const latest = (await query('SELECT * FROM meeting_minutes WHERE meeting_id=$1 ORDER BY version_no DESC LIMIT 1', [req.params.id])).rows[0];
      if (!latest || latest.status !== 'Approved' || !latest.approved_by || !latest.approved_at) {
        throw httpError(409, 'Only a minutes version with a recorded authorised approval can be published to Repository.');
      }
      if (latest.approved_by !== req.user.id && !(await meetingManage(req.user, req.params.id))) {
        throw httpError(403, 'Only the recorded approver or an authorised meeting manager can reconcile this approved Repository record.');
      }
      const meeting = await getMeetingDetail(req.user, req.params.id);
      const sourceUrl = `app2://meetings/${meeting.id}/minutes`;
      const existing = (await query(`SELECT k.id,k.title,k.record_number,v.version_number,v.notes
        FROM knowledge_items k JOIN knowledge_versions v ON v.knowledge_id=k.id AND v.is_current=TRUE
        WHERE k.source_type='App2 Upload' AND k.document_type='Meeting Minutes' AND k.source_url=$1 AND k.status='Published'
        ORDER BY v.version_number DESC LIMIT 1`, [sourceUrl])).rows[0];
      if (existing && String(existing.notes || '').includes(`meetingMinutesId=${latest.id};`) && String(existing.notes || '').includes(`meetingMinutesVersion=${latest.version_no}`)) {
        const receipt = await transaction(async client => {
          const normalized = await findCurrentMeetingMinutesPublication(client, meeting, latest);
          if (!normalized) throw httpError(409, 'The Repository record changed while it was being reconciled. Refresh and retry.');
          await audit(client, req.user.id, 'MEETING_MINUTES_REPOSITORY_PUBLICATION_RECONCILED', req.params.id, {
            meetingMinutesId:latest.id, minutesVersion:latest.version_no, repositoryDocumentId:normalized.id,
            repositoryVersion:normalized.version, alreadyPublished:true
          });
          return normalized;
        });
        return res.json({ ...latest, repository_document_id:receipt.id, repository_document_title:receipt.title,
          repository_document_status:'Published', repository_record_number:receipt.record_number,
          repository_version:receipt.version, repository_minutes_version:Number(latest.version_no), reused:true });
      }
      const approver = (await query('SELECT id,name FROM users WHERE id=$1', [latest.approved_by])).rows[0];
      if (!approver) throw httpError(409, 'The recorded approver no longer resolves to a REDESY user. Repository publication cannot be reconciled safely.');
      prepared = await prepareApprovedMeetingMinutesFile(meeting, latest, approver);
      const publication = await transaction(async client => {
        const locked = (await client.query('SELECT * FROM meeting_minutes WHERE id=$1 AND meeting_id=$2 FOR UPDATE', [latest.id, req.params.id])).rows[0];
        if (!locked || locked.status !== 'Approved' || locked.approved_by !== latest.approved_by || Number(locked.version_no) !== Number(latest.version_no)) {
          throw httpError(409, 'The approved minutes changed during Repository reconciliation. Refresh and retry.');
        }
        const receipt = await persistApprovedMeetingMinutes(client, meeting, locked, locked.approved_by, prepared);
        await audit(client, req.user.id, 'MEETING_MINUTES_REPOSITORY_PUBLICATION_RECONCILED', req.params.id, {
          meetingMinutesId:locked.id, minutesVersion:locked.version_no, repositoryDocumentId:receipt.id,
          repositoryVersion:receipt.version, alreadyPublished:Boolean(receipt.reused)
        });
        return receipt;
      });
      if (publication.reused && prepared?.stored?.absolutePath) await fs.unlink(prepared.stored.absolutePath).catch(()=>{});
      prepared = null;
      return res.json({ ...latest, repository_document_id:publication.id, repository_document_title:publication.title,
        repository_document_status:'Published', repository_record_number:publication.record_number,
        repository_version:publication.version, repository_minutes_version:Number(latest.version_no), reused:Boolean(publication.reused) });
    } catch (error) {
      if (prepared?.stored?.absolutePath) await fs.unlink(prepared.stored.absolutePath).catch(()=>{});
      next(error);
    }
  });

  app.post('/api/meetings/:id/decisions',authenticate,async(req,res,next)=>{try{await requireManage(req,req.params.id);const text=requireString(req.body?.text,'Decision',12000);const row=await transaction(async client=>{const n=(await client.query('SELECT COALESCE(MAX(decision_no),0)+1 n FROM meeting_decisions WHERE meeting_id=$1',[req.params.id])).rows[0].n;const decision=(await client.query(`INSERT INTO meeting_decisions(meeting_id,agenda_item_id,decision_no,text,recorded_by) VALUES($1,$2,$3,$4,$5) RETURNING *`,[req.params.id,req.body?.agendaItemId||null,n,text,req.user.id])).rows[0];await audit(client,req.user.id,'MEETING_DECISION_RECORDED',req.params.id,{decisionId:decision.id,decisionNo:n});return decision});res.status(201).json(row)}catch(error){next(error)}})

  app.get('/api/meetings/:id/linkable-tasks',authenticate,async(req,res,next)=>{try{
    await requireAccess(req,req.params.id)
    const scoped=await getScopeIds(req.user)
    const all=isOrganisationScopeRole(req.user.role)
    const candidates=(await query(`
      SELECT t.id,t.assignment_id,t.title,t.description,t.owner_id,owner.name owner_name,
        t.reviewer_id,reviewer.name reviewer_name,t.due_date,t.status,t.progress,
        assignment.title assignment_title
      FROM assignment_tasks t
      JOIN assignments assignment ON assignment.id=t.assignment_id
      LEFT JOIN users owner ON owner.id=t.owner_id
      LEFT JOIN users reviewer ON reviewer.id=t.reviewer_id
      WHERE t.archived_at IS NULL
        AND NOT EXISTS(SELECT 1 FROM meeting_actions ma WHERE ma.assignment_task_id=t.id)
        AND ($1::boolean OR t.owner_id=ANY($2::uuid[]) OR t.reviewer_id=ANY($2::uuid[])
          OR t.created_by=ANY($2::uuid[])
          OR assignment.created_by=ANY($2::uuid[])
          OR EXISTS(SELECT 1 FROM assignment_members am WHERE am.assignment_id=t.assignment_id AND am.user_id=ANY($2::uuid[])))
      ORDER BY t.due_date NULLS LAST,t.title
      LIMIT 500
    `,[all,scoped||[req.user.id]])).rows
    const permitted=[]
    for(const task of candidates){
      try{await assertCanAccessAssignmentTask(req.user,task);permitted.push(task)}catch(error){if(error.statusCode!==403)throw error}
    }
    res.json(permitted)
  }catch(error){next(error)}})

  app.post('/api/meetings/:id/actions',authenticate,async(req,res,next)=>{try{
    await requireManage(req,req.params.id)
    const assignmentTaskId=req.body?.assignmentTaskId?String(req.body.assignmentTaskId):null
    let linkedTask=null
    if(assignmentTaskId){
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(assignmentTaskId))throw httpError(400,'A valid assignment task must be selected.')
      linkedTask=(await query(`SELECT t.* FROM assignment_tasks t WHERE t.id=$1 AND t.archived_at IS NULL`,[assignmentTaskId])).rows[0]
      if(!linkedTask)throw httpError(404,'The selected assignment task is no longer available.')
      await assertCanAccessAssignmentTask(req.user,linkedTask)
      if(req.body?.ownerId&&req.body.ownerId!==linkedTask.owner_id)throw httpError(400,'The linked task owner is authoritative. Change task ownership in Tasks.')
    }
    const title=linkedTask?linkedTask.title:requireString(req.body?.title,'Action title',300)
    const description=linkedTask?linkedTask.description:String(req.body?.description||'').trim()
    const ownerId=linkedTask?.owner_id||req.body?.ownerId||null
    const dueDate=linkedTask?.due_date||req.body?.dueDate||null
    const initialStatus=linkedTask?taskActionStatus(linkedTask.status):'Open'
    const row=await transaction(async client=>{
      const action=(await client.query(
        `INSERT INTO meeting_actions(meeting_id,title,description,owner_id,due_date,created_by,status,assignment_task_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING *`,
        [req.params.id,title,description,ownerId,dueDate,req.user.id,initialStatus,assignmentTaskId],
      )).rows[0]
      if(!action)throw httpError(409,'That assignment task is already linked to another meeting action.')
      if(action.owner_id)await notify(client,action.owner_id,'Meeting action assigned',`You have been assigned “${title}”.`,req.params.id)
      await audit(client,req.user.id,'MEETING_ACTION_CREATED',req.params.id,{actionId:action.id,title,ownerId:action.owner_id,assignmentTaskId})
      return action
    })
    res.status(201).json(row)
  }catch(error){next(error)}})

  app.patch('/api/meetings/:id/actions/:actionId/link-task',authenticate,async(req,res,next)=>{try{
    await requireManage(req,req.params.id)
    const assignmentTaskId=req.body?.assignmentTaskId?String(req.body.assignmentTaskId):null
    const action=(await query('SELECT a.*,linked.status linked_task_status FROM meeting_actions a LEFT JOIN assignment_tasks linked ON linked.id=a.assignment_task_id WHERE a.id=$1 AND a.meeting_id=$2',[req.params.actionId,req.params.id])).rows[0]
    if(!action)throw httpError(404,'Meeting action not found.')
    let linkedTask=null
    if(assignmentTaskId){
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(assignmentTaskId))throw httpError(400,'A valid assignment task must be selected.')
      linkedTask=(await query('SELECT * FROM assignment_tasks WHERE id=$1 AND archived_at IS NULL',[assignmentTaskId])).rows[0]
      if(!linkedTask)throw httpError(404,'The selected assignment task is no longer available.')
      await assertCanAccessAssignmentTask(req.user,linkedTask)
      const alreadyLinked=await query('SELECT 1 FROM meeting_actions WHERE assignment_task_id=$1 AND id<>$2',[assignmentTaskId,action.id])
      if(alreadyLinked.rowCount)throw httpError(409,'That assignment task is already linked to another meeting action.')
      if(action.owner_id&&action.owner_id!==linkedTask.owner_id)throw httpError(400,'The linked task owner is authoritative. Change task ownership in Tasks.')
    }
    const status=linkedTask?taskActionStatus(linkedTask.status):(action.linked_task_status?taskActionStatus(action.linked_task_status):action.status)
    const result=await transaction(async client=>{
      const row=(await client.query(
        `UPDATE meeting_actions SET assignment_task_id=$3,
          title=COALESCE($4,title),description=COALESCE($5,description),
          owner_id=CASE WHEN $3::uuid IS NULL THEN owner_id ELSE $6 END,
          due_date=CASE WHEN $3::uuid IS NULL THEN due_date ELSE $7 END,
          status=$8,updated_at=NOW()
         WHERE id=$1 AND meeting_id=$2 RETURNING *`,
        [action.id,req.params.id,assignmentTaskId,linkedTask?.title??null,linkedTask?.description??null,linkedTask?.owner_id??null,linkedTask?.due_date??null,status],
      )).rows[0]
      await audit(client,req.user.id,'MEETING_ACTION_TASK_LINK_CHANGED',req.params.id,{actionId:action.id,previousTaskId:action.assignment_task_id||null,assignmentTaskId})
      return row
    })
    res.json(result)
  }catch(error){next(error)}})

  app.patch('/api/meetings/:id/actions/:actionId',authenticate,async(req,res,next)=>{try{
    await requireAccess(req,req.params.id)
    const action=(await query('SELECT a.*,linked.owner_id linked_task_owner_id,linked.reviewer_id linked_task_reviewer_id FROM meeting_actions a LEFT JOIN assignment_tasks linked ON linked.id=a.assignment_task_id WHERE a.id=$1 AND a.meeting_id=$2',[req.params.actionId,req.params.id])).rows[0]
    if(!action)throw httpError(404,'Meeting action not found.')
    if(![action.owner_id,action.linked_task_owner_id,action.linked_task_reviewer_id].includes(req.user.id)&&!await meetingManage(req.user,req.params.id))throw httpError(403,'Only the action owner, linked task owner/reviewer or meeting manager can update this action.')
    const status=String(req.body?.status||'Open')
    if(!['Open','In Progress','Blocked','Completed'].includes(status))throw httpError(400,'Invalid meeting action status.')
    let row
    if(action.assignment_task_id){
      const task=(await query('SELECT * FROM assignment_tasks WHERE id=$1 AND archived_at IS NULL FOR UPDATE',[action.assignment_task_id])).rows[0]
      if(!task)throw httpError(409,'The linked assignment task is archived or unavailable. Unlink it before updating this meeting action.')
      await assertCanAccessAssignmentTask(req.user,task)
      const taskStatus=actionTaskStatus(status)
      row=await transaction(async client=>{
        await client.query(
          'UPDATE assignment_tasks SET status=$2,progress=CASE WHEN $2=\'Completed\' THEN 100 WHEN $2=\'Not Started\' THEN 0 ELSE progress END,updated_at=NOW() WHERE id=$1',
          [task.id,taskStatus],
        )
        await audit(client,req.user.id,'MEETING_ACTION_UPDATED',req.params.id,{actionId:action.id,assignmentTaskId:task.id,status,sourceOfTruth:'assignment_tasks'})
        return (await client.query(
          `SELECT a.id,a.meeting_id,a.title,a.description,a.owner_id,u.name owner_name,a.due_date,
            CASE WHEN t.id IS NULL THEN a.status WHEN t.status='Not Started' THEN 'Open' ELSE t.status END status,
            a.created_by,a.created_at,a.updated_at,a.assignment_task_id,t.id linked_task_id,t.title linked_task_title,t.status linked_task_status,t.progress linked_task_progress
           FROM meeting_actions a LEFT JOIN users u ON u.id=a.owner_id
           LEFT JOIN assignment_tasks t ON t.id=a.assignment_task_id WHERE a.id=$1`,
          [action.id],
        )).rows[0]
      })
    }else{
      row=(await query('UPDATE meeting_actions SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING *',[action.id,status])).rows[0]
      await query('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES($1,\'MEETING_ACTION_UPDATED\',\'meeting\',$2,$3::jsonb)',[req.user.id,req.params.id,JSON.stringify({actionId:action.id,status})])
    }
    res.json(row)
  }catch(error){next(error)}})

  app.post('/api/meetings/:id/complete',authenticate,async(req,res,next)=>{try{await requireManage(req,req.params.id);await transaction(async client=>{await client.query(`UPDATE meetings SET status='Completed',completed_at=NOW(),updated_at=NOW() WHERE id=$1`,[req.params.id]);await audit(client,req.user.id,'MEETING_COMPLETED',req.params.id,{})});res.json(await getMeetingDetail(req.user,req.params.id))}catch(error){next(error)}})
}

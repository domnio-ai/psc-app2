import crypto from 'node:crypto'
import {query,transaction} from '../db.js'
import {audit} from '../audit.js'
import {isOrganisationScopeRole,isTeamScopeRole,managedUserIds} from '../scope.js'

const httpError=(status,message)=>Object.assign(new Error(message),{statusCode:status})
const safeBase=(value)=>String(value||'').trim().replace(/\/+$/,'')
const deploymentMode=()=> 'private-self-hosted'

function conferenceConfig(){
  const raw=safeBase(process.env.APP2_CONFERENCE_URL)
  if(!raw)return {configured:false,baseUrl:'',reason:'Private Jitsi is not configured. Set APP2_CONFERENCE_URL in backend/.env and restart the REDESY API.'}
  let parsed
  try{parsed=new URL(raw)}catch{return {configured:false,baseUrl:'',reason:'APP2_CONFERENCE_URL is not a valid URL.'}}
  const allowInsecure=String(process.env.APP2_CONFERENCE_ALLOW_INSECURE_LOCAL||'').toLowerCase()==='true'
  const localHost=['localhost','127.0.0.1','::1'].includes(parsed.hostname)
  if(parsed.protocol!=='https:'&&!(allowInsecure&&localHost)){
    return {configured:false,baseUrl:'',reason:'Private Jitsi must use HTTPS. HTTP is allowed only for localhost when APP2_CONFERENCE_ALLOW_INSECURE_LOCAL=true.'}
  }
  if(/(^|\.)meet\.jit\.si$/i.test(parsed.hostname)){
    return {configured:false,baseUrl:'',reason:'Public meet.jit.si is disabled for REDESY. Configure a PSC/self-hosted Jitsi URL.'}
  }
  return {configured:true,baseUrl:raw,reason:null}
}

function requireConferenceConfig(){
  const config=conferenceConfig()
  if(!config.configured)throw httpError(503,config.reason)
  return config
}

function newRoomCode(){
  return `app2-private-${crypto.randomBytes(18).toString('base64url')}`
}

async function getScopeIds(user){
  if(isOrganisationScopeRole(user.role))return null
  if(isTeamScopeRole(user.role))return [...new Set([user.id,...await managedUserIds(user)])]
  return [user.id]
}

async function canAccess(user,meetingId){
  const ids=await getScopeIds(user)
  if(ids===null)return true
    const result=await query(`SELECT 1 FROM meetings m WHERE m.id=$1 AND m.schedule_approval_status='Approved' AND(    m.created_by=ANY($2::uuid[]) OR m.chair_id=ANY($2::uuid[]) OR m.secretary_id=ANY($2::uuid[]) OR m.reviewer_id=$3
    OR EXISTS(SELECT 1 FROM meeting_participants p WHERE p.meeting_id=m.id AND p.user_id=ANY($2::uuid[]))
  )`,[meetingId,ids,user.id])
  return result.rowCount>0
}

async function canManage(user,meetingId){
  if(isOrganisationScopeRole(user.role))return true
  const ids=await getScopeIds(user)
  const result=await query(`SELECT 1 FROM meetings WHERE id=$1 AND(created_by=ANY($2::uuid[]) OR chair_id=ANY($2::uuid[]) OR secretary_id=ANY($2::uuid[]))`,[meetingId,ids||[user.id]])
  return result.rowCount>0
}

async function requireAccess(req,id){if(!await canAccess(req.user,id))throw httpError(403,'You are not authorised to join this meeting.')}
async function requireManage(req,id){if(!await canManage(req.user,id))throw httpError(403,'Only the meeting chair, secretary or authorised manager can control the live room.')}

async function ensureSession(client,meetingId,userId){
  const config=requireConferenceConfig()
  let row=(await client.query('SELECT * FROM meeting_conference_sessions WHERE meeting_id=$1 ORDER BY created_at DESC LIMIT 1',[meetingId])).rows[0]
  if(row&&row.status!=='Ended'){
    if(row.provider_base_url!==config.baseUrl){
      row=(await client.query(`UPDATE meeting_conference_sessions SET provider='jitsi-self-hosted',provider_base_url=$2,updated_at=NOW() WHERE id=$1 RETURNING *`,[row.id,config.baseUrl])).rows[0]
    }
    return row
  }
  row=(await client.query(`INSERT INTO meeting_conference_sessions(meeting_id,provider,provider_base_url,room_code,status,created_by)
    VALUES($1,'jitsi-self-hosted',$2,$3,'Ready',$4) RETURNING *`,[meetingId,config.baseUrl,newRoomCode(),userId])).rows[0]
  return row
}

function joinPayload(session,meeting,user){
  const config=requireConferenceConfig()
  const base=config.baseUrl
  const name=encodeURIComponent(user.name||'REDESY participant')
  const room=encodeURIComponent(session.room_code)
  const joinUrl=`${base}/${room}#userInfo.displayName=${name}&config.prejoinPageEnabled=false&config.startWithAudioMuted=true&config.startWithVideoMuted=true&config.disableDeepLinking=true`
  return {
    sessionId:session.id,
    provider:'jitsi-self-hosted',
    providerBaseUrl:base,
    deploymentMode:deploymentMode(),
    roomCode:session.room_code,
    joinUrl,
    status:session.status,
    startedAt:session.started_at,
    endedAt:session.ended_at,
    isHost:meeting.created_by===user.id||meeting.chair_id===user.id||meeting.secretary_id===user.id||['Director','System Admin'].includes(user.role),
  }
}

async function providerStatus(){
  const config=conferenceConfig()
  if(!config.configured)return {configured:false,reachable:false,deploymentMode:deploymentMode(),provider:'jitsi-self-hosted',providerBaseUrl:null,message:config.reason}
  const controller=new AbortController()
  const timeout=setTimeout(()=>controller.abort(),4000)
  try{
    const response=await fetch(config.baseUrl,{method:'GET',redirect:'follow',signal:controller.signal,headers:{'User-Agent':'App2-Meetings-Health/2.1'}})
    return {configured:true,reachable:response.ok,deploymentMode:deploymentMode(),provider:'jitsi-self-hosted',providerBaseUrl:config.baseUrl,message:response.ok?'Private Jitsi is reachable.':`Private Jitsi returned HTTP ${response.status}.`}
  }catch{
    return {configured:true,reachable:false,deploymentMode:deploymentMode(),provider:'jitsi-self-hosted',providerBaseUrl:config.baseUrl,message:'Private Jitsi could not be reached by the REDESY API.'}
  }finally{clearTimeout(timeout)}
}

export function registerLiveConferenceRoutes(app,{authenticate}){
  app.get('/api/meetings-live/provider-status',authenticate,async(_req,res,next)=>{try{res.json(await providerStatus())}catch(error){next(error)}})

  app.get('/api/meetings/:id/conference',authenticate,async(req,res,next)=>{try{
    await requireAccess(req,req.params.id)
    const meeting=(await query('SELECT * FROM meetings WHERE id=$1',[req.params.id])).rows[0]
    if(!meeting)throw httpError(404,'Meeting not found.')
    const session=(await query('SELECT * FROM meeting_conference_sessions WHERE meeting_id=$1 ORDER BY created_at DESC LIMIT 1',[req.params.id])).rows[0]
    res.json(session?joinPayload(session,meeting,req.user):null)
  }catch(error){next(error)}})

  app.post('/api/meetings/:id/conference/start',authenticate,async(req,res,next)=>{try{
    requireConferenceConfig()
    await requireManage(req,req.params.id)
    const payload=await transaction(async client=>{
      const meeting=(await client.query('SELECT * FROM meetings WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0]
      if(!meeting)throw httpError(404,'Meeting not found.')
      let session=await ensureSession(client,meeting.id,req.user.id)
      session=(await client.query(`UPDATE meeting_conference_sessions SET status='Live',started_at=COALESCE(started_at,NOW()),ended_at=NULL,updated_at=NOW() WHERE id=$1 RETURNING *`,[session.id])).rows[0]
      await client.query(`UPDATE meetings SET status=CASE WHEN status='Scheduled' THEN 'In Progress' ELSE status END,updated_at=NOW() WHERE id=$1`,[meeting.id])
      await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
        SELECT DISTINCT p.user_id,'Meeting is live',$1,'meeting',$2 FROM meeting_participants p
        WHERE p.meeting_id=$2 AND p.user_id IS NOT NULL AND p.user_id<>$3`,[`“${meeting.title}” is now live on the private REDESY conference service.`,meeting.id,req.user.id])
      await audit(client,req.user.id,'MEETING_CONFERENCE_STARTED','meeting',meeting.id,{provider:'jitsi-self-hosted',roomCode:session.room_code})
      return joinPayload(session,meeting,req.user)
    })
    res.json(payload)
  }catch(error){next(error)}})

  app.post('/api/meetings/:id/conference/join',authenticate,async(req,res,next)=>{try{
    requireConferenceConfig()
    await requireAccess(req,req.params.id)
    const payload=await transaction(async client=>{
      const meeting=(await client.query('SELECT * FROM meetings WHERE id=$1',[req.params.id])).rows[0]
      if(!meeting)throw httpError(404,'Meeting not found.')
      let session=await ensureSession(client,meeting.id,req.user.id)
      if(session.status==='Ready'&&await canManage(req.user,meeting.id))session=(await client.query(`UPDATE meeting_conference_sessions SET status='Live',started_at=COALESCE(started_at,NOW()),updated_at=NOW() WHERE id=$1 RETURNING *`,[session.id])).rows[0]
      await client.query(`INSERT INTO meeting_conference_presence(session_id,user_id,joined_at,last_seen_at)
        VALUES($1,$2,NOW(),NOW()) ON CONFLICT(session_id,user_id) DO UPDATE SET joined_at=CASE WHEN meeting_conference_presence.left_at IS NULL THEN meeting_conference_presence.joined_at ELSE NOW() END,left_at=NULL,last_seen_at=NOW()`,[session.id,req.user.id])
      await audit(client,req.user.id,'MEETING_CONFERENCE_JOINED','meeting',meeting.id,{sessionId:session.id,provider:'jitsi-self-hosted'})
      return joinPayload(session,meeting,req.user)
    })
    res.json(payload)
  }catch(error){next(error)}})

  app.post('/api/meetings/:id/conference/leave',authenticate,async(req,res,next)=>{try{
    await requireAccess(req,req.params.id)
    await transaction(async client=>{
      const session=(await client.query('SELECT * FROM meeting_conference_sessions WHERE meeting_id=$1 ORDER BY created_at DESC LIMIT 1',[req.params.id])).rows[0]
      if(session)await client.query('UPDATE meeting_conference_presence SET left_at=NOW(),last_seen_at=NOW() WHERE session_id=$1 AND user_id=$2',[session.id,req.user.id])
      await audit(client,req.user.id,'MEETING_CONFERENCE_LEFT','meeting',req.params.id,{sessionId:session?.id||null})
    })
    res.status(204).end()
  }catch(error){next(error)}})

  app.post('/api/meetings/:id/conference/end',authenticate,async(req,res,next)=>{try{
    await requireManage(req,req.params.id)
    await transaction(async client=>{
      const session=(await client.query('SELECT * FROM meeting_conference_sessions WHERE meeting_id=$1 ORDER BY created_at DESC LIMIT 1',[req.params.id])).rows[0]
      if(!session)throw httpError(409,'This meeting has no live conference session.')
      await client.query(`UPDATE meeting_conference_sessions SET status='Ended',ended_at=NOW(),updated_at=NOW() WHERE id=$1`,[session.id])
      await client.query(`UPDATE meeting_conference_presence SET left_at=COALESCE(left_at,NOW()),last_seen_at=NOW() WHERE session_id=$1`,[session.id])
      await audit(client,req.user.id,'MEETING_CONFERENCE_ENDED','meeting',req.params.id,{sessionId:session.id,provider:'jitsi-self-hosted'})
    })
    res.status(204).end()
  }catch(error){next(error)}})

  app.get('/api/meetings/:id/conference/presence',authenticate,async(req,res,next)=>{try{
    await requireAccess(req,req.params.id)
    const session=(await query('SELECT * FROM meeting_conference_sessions WHERE meeting_id=$1 ORDER BY created_at DESC LIMIT 1',[req.params.id])).rows[0]
    if(!session)return res.json([])
    const rows=(await query(`SELECT p.user_id,u.name,u.role,p.joined_at,p.left_at,p.last_seen_at,(p.left_at IS NULL) active
      FROM meeting_conference_presence p JOIN users u ON u.id=p.user_id WHERE p.session_id=$1 ORDER BY p.joined_at`,[session.id])).rows
    res.json(rows)
  }catch(error){next(error)}})
}

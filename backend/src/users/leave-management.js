import {z} from 'zod'
import express from 'express'
import {query,transaction} from '../db.js'
import {audit} from '../audit.js'
import {managedUserIds,canManageUser,isOrganisationScopeRole} from '../scope.js'
import {managerRoles} from './leave-policy.js'
import {config} from '../config.js'
import {deleteStoredDocument,resolveDocumentPath,storeDocument,validateDocumentUpload} from '../document-storage.js'


const dateOnly=value=>value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10)
const workingDays=(start,end,holidays=[])=>{
 const from=new Date(`${dateOnly(start)}T00:00:00Z`),to=new Date(`${dateOnly(end)}T00:00:00Z`)
 const holidaySet=new Set(holidays.map(date=>dateOnly(date)))
 let count=0
 for(let d=new Date(from);d<=to;d.setUTCDate(d.getUTCDate()+1)){
  const day=d.getUTCDay(),date=d.toISOString().slice(0,10)
  if(day!==0&&day!==6&&!holidaySet.has(date))count++
 }
 return count
}
const notify=async(client,userId,title,body,id,priority='Normal',category='Information')=>{
 const action=category==='Review'?'Open leave approval':'Open leave request'
 const workspace=category==='Review'?'Reviews & Approvals':'Leave'
 await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id,priority,action,target_workspace,event_key,notification_category)
 VALUES($1,$2,$3,'leave_request',$4,$5,$6,$7,$8,$9)
 ON CONFLICT(user_id,event_key) WHERE event_key IS NOT NULL DO NOTHING`,
 [userId,title,body,id,priority,action,workspace,`leave:${id}:${userId}:${title}`,category])
}
const requestSchema=z.object({leaveTypeCode:z.string().min(2).max(40),startDate:z.string().date(),endDate:z.string().date(),reason:z.string().trim().max(2000).default('')})
const decisionSchema=z.object({decision:z.enum(['Approved','Returned','Rejected']),note:z.string().trim().max(2000).default('')})
const publicHolidaySchema=z.object({
 holidayDate:z.string().date(),
 name:z.string().trim().min(3).max(200),
 description:z.string().trim().max(1000).default(''),
})
const publicHolidayUpdateSchema=z.object({
 holidayDate:z.string().date().optional(),
 name:z.string().trim().min(3).max(200).optional(),
 description:z.string().trim().max(1000).optional(),
 active:z.boolean().optional(),
}).refine(value=>Object.keys(value).length>0,{message:'At least one holiday field must be updated.'})


export function registerLeaveManagementRoutes(app,{authenticate,validate}){
 app.get('/api/leave/types',authenticate,async(_req,res,next)=>{try{
  res.json((await query(`SELECT code,name,default_entitlement_days,paid,requires_document FROM leave_types WHERE active=TRUE ORDER BY display_order,name`)).rows)
 }catch(error){next(error)}})

 app.get('/api/leave/holidays',authenticate,async(req,res,next)=>{try{
  const admin=req.user.role==='System Admin'
  const rows=(await query(
   'SELECT id,holiday_date::text holiday_date,name,description,active,created_at,updated_at FROM public_holidays WHERE ($1::boolean OR active=TRUE) ORDER BY holiday_date,name',
   [admin],
  )).rows
  res.json(rows)
 }catch(error){next(error)}})

 app.post('/api/leave/holidays',authenticate,validate(publicHolidaySchema),async(req,res,next)=>{try{
  if(req.user.role!=='System Admin')return res.status(403).json({error:'Only a System Administrator can maintain the institutional public-holiday calendar.'})
  const value=req.validated
  const result=await transaction(async client=>{
   const row=(await client.query(
    'INSERT INTO public_holidays(holiday_date,name,description,created_by,updated_by) VALUES($1,$2,$3,$4,$4) ON CONFLICT(holiday_date) DO NOTHING RETURNING id,holiday_date::text holiday_date,name,description,active,created_at,updated_at',
    [value.holidayDate,value.name,value.description,req.user.id],
   )).rows[0]
   if(!row)return null
   await audit(client,req.user.id,'PUBLIC_HOLIDAY_CREATED','public_holiday',row.id,{
    holidayDate:row.holiday_date,name:row.name,
   })
   return row
  })
  if(!result)return res.status(409).json({error:'A holiday record already exists for this date. Reactivate or update the existing record instead.'})
  res.status(201).json(result)
 }catch(error){next(error)}})

 app.patch('/api/leave/holidays/:id',authenticate,validate(publicHolidayUpdateSchema),async(req,res,next)=>{try{
  if(req.user.role!=='System Admin')return res.status(403).json({error:'Only a System Administrator can maintain the institutional public-holiday calendar.'})
  const value=req.validated
  const result=await transaction(async client=>{
   const row=(await client.query(
    'UPDATE public_holidays SET holiday_date=COALESCE($1,holiday_date),name=COALESCE($2,name),description=COALESCE($3,description),active=COALESCE($4,active),updated_by=$5,updated_at=NOW() WHERE id=$6 RETURNING id,holiday_date::text holiday_date,name,description,active,created_at,updated_at',
    [value.holidayDate??null,value.name??null,value.description??null,value.active??null,req.user.id,req.params.id],
   )).rows[0]
   if(!row)return null
   await audit(client,req.user.id,row.active?'PUBLIC_HOLIDAY_UPDATED':'PUBLIC_HOLIDAY_DEACTIVATED','public_holiday',row.id,{
    holidayDate:row.holiday_date,name:row.name,active:row.active,
   })
   return row
  })
  if(!result)return res.status(404).json({error:'Public-holiday record not found.'})
  res.json(result)
 }catch(error){next(error)}})

 app.get('/api/leave/requests',authenticate,async(req,res,next)=>{try{
  const manager=managerRoles.includes(req.user.role),scoped=manager?await managedUserIds(req.user):[req.user.id],all=manager&&scoped===null,ids=all?[]:scoped||[req.user.id]
  res.json((await query(`SELECT lr.*,lt.name leave_type_name,u.name user_name,u.email user_email,u.role user_role,u.division,
   (SELECT COUNT(*) FROM generate_series(lr.start_date,lr.end_date,INTERVAL '1 day') leave_day(day)
     WHERE EXTRACT(ISODOW FROM leave_day.day)<6
       AND NOT EXISTS(SELECT 1 FROM public_holidays ph WHERE ph.active=TRUE AND ph.holiday_date=leave_day.day::date))::int calculated_working_days,
   approver.name approver_name,EXISTS(SELECT 1 FROM leave_request_attachments lra WHERE lra.leave_request_id=lr.id) has_attachment,CASE WHEN lr.status='Approved' AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date THEN TRUE ELSE FALSE END currently_on_leave
   FROM leave_requests lr JOIN leave_types lt ON lt.code=lr.leave_type_code JOIN users u ON u.id=lr.user_id
   LEFT JOIN users approver ON approver.id=lr.approver_id
   WHERE $1::boolean OR lr.user_id=ANY($2::uuid[])
   ORDER BY CASE lr.status WHEN 'Pending' THEN 0 WHEN 'Approved' THEN 1 ELSE 2 END,lr.start_date DESC`,[all,ids])).rows)
 }catch(error){next(error)}})

 app.get('/api/leave/balances/:userId',authenticate,async(req,res,next)=>{try{
  if(req.user.id!==req.params.userId&&!await canManageUser(req.user,req.params.userId))return res.status(403).json({error:'You cannot view leave balances outside your authorised team scope.'})
  const year=Number(req.query.year||new Date().getFullYear())
  if(!Number.isInteger(year)||year<1900||year>2200)return res.status(400).json({error:'Choose a valid leave-balance year.'})
  res.json((await query(`SELECT lt.code,lt.name,lt.default_entitlement_days entitlement_days,
   COALESCE(adj.adjustment_days,0)::numeric adjustment_days,COALESCE(used.used_days,0)::numeric used_days,
   CASE WHEN lt.default_entitlement_days IS NULL THEN NULL ELSE lt.default_entitlement_days+COALESCE(adj.adjustment_days,0)-COALESCE(used.used_days,0) END remaining_days
   FROM leave_types lt
   LEFT JOIN LATERAL(SELECT SUM(adjustment_days) adjustment_days FROM leave_balance_adjustments a WHERE a.user_id=$1 AND a.leave_type_code=lt.code AND a.leave_year=$2) adj ON TRUE
   LEFT JOIN LATERAL(
    SELECT SUM((SELECT COUNT(*) FROM generate_series(
      GREATEST(lr.start_date,make_date($2,1,1)),
      LEAST(lr.end_date,make_date($2,12,31)),
      INTERVAL '1 day'
    ) AS leave_day(day)
    WHERE EXTRACT(ISODOW FROM leave_day.day)<6
      AND NOT EXISTS(SELECT 1 FROM public_holidays ph WHERE ph.active=TRUE AND ph.holiday_date=leave_day.day::date)
    )) used_days
    FROM leave_requests lr
    WHERE lr.user_id=$1 AND lr.leave_type_code=lt.code AND lr.status='Approved'
      AND lr.start_date<=make_date($2,12,31) AND lr.end_date>=make_date($2,1,1)
   ) used ON TRUE
   WHERE lt.active=TRUE ORDER BY lt.display_order`,[req.params.userId,year])).rows)
 }catch(error){next(error)}})

 const createLeaveRequest=async(req,res,next)=>{
  let stored=null
  try{
   let v=req.validated,upload=null
   if(Buffer.isBuffer(req.body)){
    let metadata={};try{metadata=JSON.parse(String(req.get('x-leave-request')||'{}'))}catch{return res.status(400).json({error:'Leave request details are invalid.'})}
    const parsed=requestSchema.safeParse(metadata);if(!parsed.success)return res.status(400).json({error:'Complete the leave request details before submitting.'})
    v=parsed.data
    if(!req.body.length)return res.status(400).json({error:'Choose a supporting document to upload.'})
    let originalName=String(req.get('x-file-name')||'supporting-document');try{originalName=decodeURIComponent(originalName)}catch{}
    upload=validateDocumentUpload(req.body,originalName,req.get('x-file-mime-type')||req.get('content-type'))
    stored=await storeDocument(req.body,upload.extension)
   }
   if(v.endDate<v.startDate)return res.status(400).json({error:'Leave end date cannot be before the start date.'})
   const result=await transaction(async client=>{
    const type=(await client.query('SELECT * FROM leave_types WHERE code=$1 AND active=TRUE',[v.leaveTypeCode])).rows[0];if(!type)return {kind:'type'}
    if(type.requires_document&&!stored)return {kind:'document'}
    const holidays=(await client.query('SELECT holiday_date::text holiday_date FROM public_holidays WHERE active=TRUE AND holiday_date BETWEEN $1::date AND $2::date',[v.startDate,v.endDate])).rows.map(row=>row.holiday_date)
    const days=workingDays(v.startDate,v.endDate,holidays)
    if(days<1)return {kind:'days'}
    const overlap=(await client.query(`SELECT id FROM leave_requests WHERE user_id=$1 AND status IN('Pending','Approved','Returned')
     AND daterange(start_date,end_date,'[]') && daterange($2::date,$3::date,'[]') LIMIT 1`,[req.user.id,v.startDate,v.endDate])).rows[0]
    if(overlap)return {kind:'overlap'}
    const row=(await client.query(`INSERT INTO leave_requests(user_id,leave_type_code,start_date,end_date,working_days,reason)
     VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[req.user.id,v.leaveTypeCode,v.startDate,v.endDate,days,v.reason])).rows[0]
    if(stored)await client.query(`INSERT INTO leave_request_attachments(leave_request_id,original_filename,stored_path,mime_type,size_bytes,sha256,uploaded_by)
     VALUES($1,$2,$3,$4,$5,$6,$7)`,[row.id,upload.originalName,stored.storagePath,upload.mimeType,stored.sizeBytes,upload.sha256,req.user.id])
    const supervisor=(await client.query('SELECT supervisor_id FROM users WHERE id=$1',[req.user.id])).rows[0]?.supervisor_id
    if(supervisor)await notify(client,supervisor,'Leave request awaiting review',`${req.user.name} requested ${type.name} from ${v.startDate} to ${v.endDate} (${days} working days).`,row.id,'High','Review')
    await audit(client,req.user.id,'LEAVE_REQUEST_SUBMITTED','leave_request',row.id,{leaveTypeCode:v.leaveTypeCode,startDate:v.startDate,endDate:v.endDate,workingDays:days,attachment:Boolean(stored)})
    return {kind:'created',row}
   })
   if(result.kind==='type')return res.status(400).json({error:'Choose an active leave type.'})
   if(result.kind==='document')return res.status(400).json({error:'This leave type requires a supporting document.'})
   if(result.kind==='days')return res.status(400).json({error:'The leave period must include at least one working day after weekends and configured public holidays are excluded.'})
   if(result.kind==='overlap')return res.status(409).json({error:'This leave period overlaps another pending or approved leave request.'})
   stored=null
   res.status(201).json(result.row)
  }catch(error){next(error)}finally{if(stored)await deleteStoredDocument(stored.storagePath)}
 }
 const rawLeaveUpload=express.raw({type:'application/octet-stream',limit:config.maxUploadMb*1024*1024})
 app.post('/api/leave/requests',authenticate,(req,res,next)=>req.is('application/octet-stream')?rawLeaveUpload(req,res,next):validate(requestSchema)(req,res,next),createLeaveRequest)
 app.get('/api/leave/requests/:id/attachment',authenticate,async(req,res,next)=>{try{
  const row=(await query(`SELECT a.original_filename,a.stored_path,a.mime_type,lr.user_id FROM leave_request_attachments a
   JOIN leave_requests lr ON lr.id=a.leave_request_id WHERE lr.id=$1 ORDER BY a.created_at DESC LIMIT 1`,[req.params.id])).rows[0]
  if(!row)return res.status(404).json({error:'Leave supporting document not found.'})
  if(req.user.id!==row.user_id&&!await canManageUser(req.user,row.user_id))return res.status(403).json({error:'You cannot access this leave supporting document.'})
  res.type(row.mime_type).download(resolveDocumentPath(row.stored_path),row.original_filename,error=>{if(error&&!res.headersSent)next(error)})
 }catch(error){next(error)}})

 app.post('/api/leave/requests/:id/decision',authenticate,validate(decisionSchema),async(req,res,next)=>{try{
  if(!managerRoles.includes(req.user.role))return res.status(403).json({error:'Only an authorised manager can decide leave requests.'})
  const result=await transaction(async client=>{
   const row=(await client.query(`SELECT lr.*,u.name user_name,lt.name leave_type_name FROM leave_requests lr
    JOIN users u ON u.id=lr.user_id JOIN leave_types lt ON lt.code=lr.leave_type_code WHERE lr.id=$1 FOR UPDATE`,[req.params.id])).rows[0]
   if(!row)return {kind:'missing'};if(row.user_id===req.user.id)return {kind:'self'}
   if(!['Pending','Returned'].includes(row.status))return {kind:'state'}
   if(!await canManageUser(req.user,row.user_id))return {kind:'scope'}
   const holidayRows=(await client.query('SELECT holiday_date::text holiday_date FROM public_holidays WHERE active=TRUE AND holiday_date BETWEEN $1::date AND $2::date',[dateOnly(row.start_date),dateOnly(row.end_date)])).rows
   const approvedWorkingDays=workingDays(row.start_date,row.end_date,holidayRows.map(item=>item.holiday_date))
   if(req.validated.decision==='Approved'&&approvedWorkingDays<1)return {kind:'days'}
   const updated=(await client.query(`UPDATE leave_requests SET status=$1,working_days=CASE WHEN $1='Approved' THEN $5 ELSE working_days END,approver_id=$2,decision_note=$3,decided_at=NOW(),updated_at=NOW() WHERE id=$4 RETURNING *`,
    [req.validated.decision,req.user.id,req.validated.note,row.id,approvedWorkingDays])).rows[0]
   await notify(client,row.user_id,`Leave ${req.validated.decision.toLowerCase()}`,`${row.leave_type_name} from ${row.start_date.toISOString().slice(0,10)} to ${row.end_date.toISOString().slice(0,10)} was ${req.validated.decision.toLowerCase()}.`,row.id,'High','Information')
   await audit(client,req.user.id,'LEAVE_REQUEST_DECIDED','leave_request',row.id,{decision:req.validated.decision,note:req.validated.note,userId:row.user_id,leaveTypeName:row.leave_type_name})
   return {kind:'updated',row:updated}
  })
  if(result.kind==='missing')return res.status(404).json({error:'Leave request not found.'})
  if(result.kind==='self')return res.status(409).json({error:'A manager cannot approve or reject their own leave request.'})
  if(result.kind==='state')return res.status(409).json({error:'This leave request is no longer awaiting a decision.'})
  if(result.kind==='scope')return res.status(403).json({error:'This leave request is outside your authorised team scope.'})
  if(result.kind==='days')return res.status(409).json({error:'This request contains no working days after configured public holidays and weekends are excluded. Return it so the employee can revise the dates.'})
  res.json(result.row)
 }catch(error){next(error)}})

 app.post('/api/leave/requests/:id/cancel',authenticate,async(req,res,next)=>{try{
  const result=await transaction(async client=>{
   const row=(await client.query('SELECT * FROM leave_requests WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0]
   if(!row)return {kind:'missing'};if(row.user_id!==req.user.id&&!await canManageUser(req.user,row.user_id))return {kind:'scope'}
   if(['Rejected','Cancelled'].includes(row.status))return {kind:'state'}
   const updated=(await client.query(`UPDATE leave_requests SET status='Cancelled',cancelled_at=NOW(),updated_at=NOW() WHERE id=$1 RETURNING *`,[row.id])).rows[0]
   const employee=(await client.query('SELECT id,name,supervisor_id FROM users WHERE id=$1',[row.user_id])).rows[0]
   if(req.user.id===row.user_id&&employee?.supervisor_id){
    await notify(client,employee.supervisor_id,'Leave request cancelled',`${employee.name} cancelled a leave request scheduled from ${row.start_date.toISOString().slice(0,10)} to ${row.end_date.toISOString().slice(0,10)}.`,row.id,'Normal','Information')
   }else if(req.user.id!==row.user_id){
    await notify(client,row.user_id,'Leave request cancelled by manager',`Your leave request scheduled from ${row.start_date.toISOString().slice(0,10)} to ${row.end_date.toISOString().slice(0,10)} was cancelled by ${req.user.name}.`,row.id,'High','Information')
   }
   await audit(client,req.user.id,'LEAVE_REQUEST_CANCELLED','leave_request',row.id,{userId:row.user_id});return {kind:'updated',row:updated}
  })
  if(result.kind==='missing')return res.status(404).json({error:'Leave request not found.'})
  if(result.kind==='scope')return res.status(403).json({error:'You cannot cancel this leave request.'})
  if(result.kind==='state')return res.status(409).json({error:'This leave request cannot be cancelled.'})
  res.json(result.row)
 }catch(error){next(error)}})
}

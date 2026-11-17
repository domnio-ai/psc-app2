import crypto from 'node:crypto'
import {z} from 'zod'
import {authenticate,authorize} from '../auth.js'
import {audit} from '../audit.js'
import {query,transaction} from '../db.js'
import {mailStatus} from '../mailer.js'
import {auditReportAccess,categories as reportCategories,deleteReportView,recordReportExport,reportCatalogue,reportData,reportPermissions,reportSummary,reportViews,saveReportView,setFavourite,REPORT_EXPORT_MAX_ROWS} from './report-service.js'
import {renderReportExport,renderReportPackPdf} from './report-export.js'
import {institutionalIntelligence} from './institutional-intelligence.js'

export function registerReportRoutes(app,{validate,governedDate}){
  app.get('/api/reports',authenticate,async(req,res,next)=>{try{res.json(await reportCatalogue(req.user))}catch(error){next(error)}})
  app.get('/api/reports/categories',authenticate,(_req,res)=>res.json(reportCategories()))
  app.get('/api/reports-summary',authenticate,async(req,res,next)=>{try{res.json(await reportSummary(req.user))}catch(error){next(error)}})
  app.get('/api/report-intelligence',authenticate,async(req,res,next)=>{try{res.json(await institutionalIntelligence(req.user,req.query))}catch(error){next(error)}})
  app.get('/api/reports/:key',authenticate,async(req,res,next)=>{try{const catalogue=await reportCatalogue(req.user);const item=catalogue.find(report=>report.key===req.params.key);if(!item)return res.status(404).json({error:'Report not found or unavailable to your role.'});res.json(item)}catch(error){next(error)}})
  app.get('/api/reports/:key/data',authenticate,async(req,res,next)=>{try{const result=await reportData(req.user,req.params.key,req.query);await auditReportAccess(req.user,req.params.key);res.json(result)}catch(error){if(error.auditDenied)await auditReportAccess(req.user,req.params.key,true).catch(()=>{});next(error)}})
  app.post('/api/reports/:key/favourite',authenticate,async(req,res,next)=>{try{res.json(await setFavourite(req.user,req.params.key,true))}catch(error){next(error)}})
  app.delete('/api/reports/:key/favourite',authenticate,async(req,res,next)=>{try{res.json(await setFavourite(req.user,req.params.key,false))}catch(error){next(error)}})
  app.get('/api/report-schedules',authenticate,async(req,res,next)=>{try{const all=req.user.role==='System Admin';res.json((await query(`SELECT * FROM report_schedules WHERE $1 OR owner_id=$2 ORDER BY enabled DESC,next_run_at`,[all,req.user.id])).rows)}catch(error){next(error)}})
  app.post('/api/report-schedules',authenticate,validate(z.object({reportKey:z.string().min(2).max(100),name:z.string().min(2).max(120),format:z.enum(['pdf','docx','xlsx']),frequency:z.enum(['Daily','Weekly','Monthly']),recipientEmails:z.array(z.string().email()).min(1).max(20),filters:z.record(z.string(),z.union([z.string(),z.number(),z.boolean()])).default({}),nextRunAt:z.string().datetime()})),async(req,res,next)=>{try{if(!reportPermissions(req.user).includes('GENERATE_REPORTS')&&!reportPermissions(req.user).includes('EXPORT_REPORTS'))return res.status(403).json({error:'You cannot schedule reports.'});const v=req.validated,row=await transaction(async client=>{const created=(await client.query('INSERT INTO report_schedules(owner_id,report_key,name,format,frequency,recipient_emails,filters,next_run_at)VALUES($1,$2,$3,$4,$5,$6,$7,$8)RETURNING *',[req.user.id,v.reportKey,v.name,v.format,v.frequency,v.recipientEmails,v.filters,v.nextRunAt])).rows[0];await audit(client,req.user.id,'REPORT_SCHEDULE_CREATED','report_schedule',created.id,{reportKey:v.reportKey,format:v.format,frequency:v.frequency,recipientCount:v.recipientEmails.length,nextRunAt:v.nextRunAt});return created});res.status(201).json(row)}catch(error){next(error)}})
  app.patch('/api/report-schedules/:id',authenticate,validate(z.object({enabled:z.boolean()})),async(req,res,next)=>{try{const admin=req.user.role==='System Admin',row=await transaction(async client=>{const updated=(await client.query('UPDATE report_schedules SET enabled=$1,updated_at=NOW() WHERE id=$2 AND($3 OR owner_id=$4)RETURNING *',[req.validated.enabled,req.params.id,admin,req.user.id])).rows[0];if(!updated)return null;await audit(client,req.user.id,req.validated.enabled?'REPORT_SCHEDULE_ENABLED':'REPORT_SCHEDULE_PAUSED','report_schedule',updated.id,{reportKey:updated.report_key});return updated});if(!row)return res.status(404).json({error:'Schedule not found.'});res.json(row)}catch(error){next(error)}})
  app.delete('/api/report-schedules/:id',authenticate,async(req,res,next)=>{try{const admin=req.user.role==='System Admin',removed=await transaction(async client=>{const row=(await client.query('DELETE FROM report_schedules WHERE id=$1 AND($2 OR owner_id=$3)RETURNING id,report_key,name',[req.params.id,admin,req.user.id])).rows[0];if(!row)return null;await audit(client,req.user.id,'REPORT_SCHEDULE_DELETED','report_schedule',row.id,{reportKey:row.report_key,name:row.name});return row});if(!removed)return res.status(404).json({error:'Schedule not found.'});res.json({id:req.params.id})}catch(error){next(error)}})
  app.get('/api/report-governance',authenticate,async(req,res,next)=>{try{if(!reportPermissions(req.user).includes('VIEW_REPORTS'))return res.status(403).json({error:'You cannot view reporting governance.'});const organisation=req.user.role==='System Admin',params=organisation?[]:[req.user.id],owner=organisation?'TRUE':'l.user_id=$1';const actions=['REPORT_ACCESSED','REPORT_ACCESS_DENIED','REPORT_EXPORTED','REPORT_VIEW_SAVED','REPORT_VIEW_DELETED','REPORT_SCHEDULE_CREATED','REPORT_SCHEDULE_ENABLED','REPORT_SCHEDULE_PAUSED','REPORT_SCHEDULE_DELETED','REPORT_SCHEDULE_DELIVERED','REPORT_SCHEDULE_FAILED'];const [events,exports,schedules]=await Promise.all([query(`SELECT l.action,l.entity_type,l.entity_id,l.details,l.created_at,COALESCE(u.name,'System') actor_name FROM audit_logs l LEFT JOIN users u ON u.id=l.user_id WHERE ${owner} AND l.action=ANY($${params.length+1}::text[]) ORDER BY l.created_at DESC LIMIT 100`,[...params,actions]),query(`SELECT COUNT(*)::int total,COUNT(*)FILTER(WHERE created_at>=NOW()-INTERVAL '24 hours')::int recent_24h,MAX(created_at) last_export_at FROM report_exports WHERE ${organisation?'TRUE':'user_id=$1'}`,params),query(`SELECT COUNT(*)::int total,COUNT(*)FILTER(WHERE enabled)::int enabled,COUNT(*)FILTER(WHERE last_status='Failed')::int failed,MAX(last_run_at) last_delivery_at FROM report_schedules WHERE ${organisation?'TRUE':'owner_id=$1'}`,params)]);res.json({generatedAt:new Date().toISOString(),visibility:organisation?'Organisation report audit':'My report activity',events:events.rows,exports:exports.rows[0],schedules:schedules.rows[0]})}catch(error){next(error)}})
  app.get('/api/reports/:key/decisions',authenticate,authorize('System Admin','Deputy Director'),async(req,res,next)=>{try{res.json((await query('SELECT d.*,u.name created_by_name,ru.name resolved_by_name FROM report_decisions d JOIN users u ON u.id=d.created_by LEFT JOIN users ru ON ru.id=d.resolved_by WHERE report_key=$1 ORDER BY status,created_at DESC',[req.params.key])).rows)}catch(error){next(error)}})
  app.post('/api/reports/:key/decisions',authenticate,authorize('System Admin','Deputy Director'),validate(z.object({title:z.string().min(3).max(240),decision:z.string().min(3).max(5000),filters:z.record(z.string(),z.union([z.string(),z.number(),z.boolean()])).default({}),dueDate:governedDate.default(null)})),async(req,res,next)=>{try{const v=req.validated,row=(await query('INSERT INTO report_decisions(report_key,title,decision,filters,due_date,created_by)VALUES($1,$2,$3,$4,$5,$6)RETURNING *',[req.params.key,v.title,v.decision,v.filters,v.dueDate,req.user.id])).rows[0];res.status(201).json(row)}catch(error){next(error)}})
  app.patch('/api/reports/:key/decisions/:id/resolve',authenticate,authorize('System Admin','Deputy Director'),async(req,res,next)=>{try{const row=(await query("UPDATE report_decisions SET status='Resolved',resolved_by=$1,resolved_at=NOW() WHERE id=$2 AND report_key=$3 RETURNING *",[req.user.id,req.params.id,req.params.key])).rows[0];if(!row)return res.status(404).json({error:'Decision not found.'});res.json(row)}catch(error){next(error)}})
  app.post('/api/reports/:key/signoff',authenticate,authorize('System Admin','Deputy Director'),validate(z.object({filters:z.record(z.string(),z.union([z.string(),z.number(),z.boolean()])).default({}),comments:z.string().max(4000).default('')})),async(req,res,next)=>{try{const result=await reportData(req.user,req.params.key,{...req.validated.filters,page:1,pageSize:100}),snapshot={title:result.report.title,period:result.period,kpis:result.kpis,rows:result.rows,generatedAt:result.generatedAt},hash=crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),row=(await query('INSERT INTO report_signoffs(report_key,filters,report_snapshot,report_hash,signed_by,comments)VALUES($1,$2,$3,$4,$5,$6)RETURNING *',[req.params.key,req.validated.filters,snapshot,hash,req.user.id,req.validated.comments])).rows[0];res.status(201).json(row)}catch(error){next(error)}})
  app.get('/api/reports/:key/signoffs',authenticate,async(req,res,next)=>{try{res.json((await query('SELECT s.id,s.report_key,s.report_hash,s.status,s.signed_at,s.comments,u.name signed_by_name FROM report_signoffs s JOIN users u ON u.id=s.signed_by WHERE s.report_key=$1 ORDER BY s.signed_at DESC LIMIT 50',[req.params.key])).rows)}catch(error){next(error)}})
  app.patch('/api/admin/report-definitions/:key',authenticate,authorize('System Admin'),validate(z.object({enabled:z.boolean(),accessNote:z.string().max(1000).default('')})),async(req,res,next)=>{try{const row=(await query('INSERT INTO report_definition_overrides(report_key,enabled,access_note,updated_by)VALUES($1,$2,$3,$4)ON CONFLICT(report_key)DO UPDATE SET enabled=EXCLUDED.enabled,access_note=EXCLUDED.access_note,updated_by=EXCLUDED.updated_by,updated_at=NOW()RETURNING *',[req.params.key,req.validated.enabled,req.validated.accessNote,req.user.id])).rows[0];res.json(row)}catch(error){next(error)}})
  app.get('/api/admin/report-monitoring',authenticate,authorize('System Admin'),async(_req,res,next)=>{try{const [exports,schedules,failures,signoffs]=await Promise.all([query("SELECT COUNT(*)::int total,COUNT(*)FILTER(WHERE created_at>=NOW()-INTERVAL '24 hours')::int recent FROM report_exports"),query("SELECT COUNT(*)::int total,COUNT(*)FILTER(WHERE enabled)::int enabled,COUNT(*)FILTER(WHERE last_status='Failed')::int failed FROM report_schedules"),query("SELECT report_key,format,created_at FROM report_exports ORDER BY created_at DESC LIMIT 20"),query("SELECT COUNT(*)::int total FROM report_signoffs WHERE status='Signed Off'")]);res.json({exports:exports.rows[0],schedules:schedules.rows[0],recentExports:failures.rows,signoffs:signoffs.rows[0].total,mail:mailStatus()})}catch(error){next(error)}})
  app.get('/api/reports/:key/views',authenticate,async(req,res,next)=>{try{res.json(await reportViews(req.user,req.params.key))}catch(error){next(error)}})
  app.post('/api/reports/:key/views',authenticate,validate(z.object({name:z.string().min(1).max(120),filters:z.record(z.string(),z.union([z.string(),z.number(),z.boolean()])).default({}),isDefault:z.boolean().default(false)})),async(req,res,next)=>{try{res.status(201).json(await saveReportView(req.user,req.params.key,req.validated))}catch(error){next(error)}})
  app.delete('/api/reports/:key/views/:id',authenticate,async(req,res,next)=>{try{res.json(await deleteReportView(req.user,req.params.key,req.params.id))}catch(error){next(error)}})
  app.post('/api/reports/export-pack',authenticate,validate(z.object({
    reportKeys:z.array(z.string().min(2).max(100)).min(1).max(100),
    title:z.string().max(180).default('Institutional Management Report Pack'),
    paperSize:z.enum(['A4','Letter']).default('A4'),
    filters:z.object({from:z.string().optional(),to:z.string().optional(),status:z.string().max(80).optional()}).default({}),
  })),async(req,res,next)=>{
    try{
      if(!reportPermissions(req.user).includes('EXPORT_REPORTS'))return res.status(403).json({error:'You do not have permission to export reports.'})
      const keys=[...new Set(req.validated.reportKeys)],reports=[]
      let recordCount=0
      let scope=null
      for(const key of keys){
        const remaining=REPORT_EXPORT_MAX_ROWS-recordCount
        if(remaining<=0)return res.status(413).json({error:`The consolidated pack exceeds ${REPORT_EXPORT_MAX_ROWS.toLocaleString('en-US')} records. Select fewer reports or narrow the reporting period.`})
        const pageSize=Math.max(10,remaining)
        const result=await reportData(req.user,key,{...req.validated.filters,page:1,pageSize},{maxPageSize:pageSize})
        if(!result.available)return res.status(409).json({error:result.notices?.[0]||`Report “${key}” is unavailable.`})
        scope||=result.scope
        const rowsForReport=Number(result.pagination?.total??result.rows.length)
        if(rowsForReport>remaining)return res.status(413).json({error:`The consolidated pack exceeds ${REPORT_EXPORT_MAX_ROWS.toLocaleString('en-US')} records. Select fewer reports or narrow the reporting period.`})
        recordCount+=rowsForReport
        reports.push({key,title:result.report.title,recordCount:rowsForReport,kpis:result.kpis||[],columns:result.columns||[],rows:result.rows||[]})
      }
      const title=req.validated.title.trim()||'Institutional Management Report Pack'
      const rendered=await renderReportPackPdf({title,paperSize:req.validated.paperSize,period:req.validated.filters,generatedAt:new Date().toISOString(),generatedBy:req.user.name||req.user.email||'Current authorised REDESY user',scope,reports,recordCount})
      await Promise.all(reports.map(report=>recordReportExport(req.user,report.key,'pdf',{...req.validated.filters,exportProfile:'consolidated-pack',packReportCount:keys.length},report.recordCount)))
      const safe=title.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()
      res.setHeader('Content-Type',rendered.type)
      res.setHeader('Content-Disposition',`attachment; filename="${safe}-consolidated-report-pack.pdf"`)
      res.send(rendered.buffer)
    }catch(error){next(error)}
  })
  app.get('/api/reports/:key/export',authenticate,async(req,res,next)=>{
    try{
      if(!reportPermissions(req.user).includes('EXPORT_REPORTS'))return res.status(403).json({error:'You do not have permission to export reports.'})
      const format=String(req.query.format||'pdf').toLowerCase()
      const profile=String(req.query.profile||'detailed').toLowerCase()
      if(!['detailed','brief','institutional-detailed'].includes(profile))return res.status(400).json({error:'Unsupported report export profile.'})
      const paperSize=String(req.query.paperSize||'A4')
      if(!['A4','Letter'].includes(paperSize))return res.status(400).json({error:'Choose A4 or Letter paper for the PDF.'})
      const customTitle=typeof req.query.title==='string'?req.query.title.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,180):''
      const rowLimit=profile==='brief'?100:REPORT_EXPORT_MAX_ROWS
      const result=await reportData(
        req.user,
        req.params.key,
        {...req.query,page:1,pageSize:rowLimit},
        {maxPageSize:rowLimit},
      )
      if(!result.available)return res.status(409).json({error:result.notices?.[0]||'Report is unavailable.'})
      const totalRows=Number(result.pagination?.total??result.rows.length)
      if(profile!=='brief'&&totalRows>REPORT_EXPORT_MAX_ROWS){
        return res.status(413).json({error:`This report contains more than ${REPORT_EXPORT_MAX_ROWS.toLocaleString('en-US')} records. Narrow the reporting period or filters to create a complete export.`})
      }
      const intelligence=profile==='institutional-detailed'?await institutionalIntelligence(req.user,req.query):null
      const outputTitle=customTitle||result.report.title
      const rendered=await renderReportExport(format,{
        ...result.exportModel,
        title:outputTitle,
        paperSize,
        profile,
        intelligence,
        reportKey:req.params.key,
        generatedBy:req.user.name||req.user.email||'Current authorised REDESY user',
        documentStatus:'Generated PDF · No approval or sign-off recorded',
        classification:'INTERNAL',
      })
      await recordReportExport(req.user,req.params.key,format,{...result.filters,exportProfile:profile},result.rows.length)
      const safe=outputTitle.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()
      const suffix=profile==='brief'?'-management-brief':profile==='institutional-detailed'?'-detailed-institutional-report':''
      res.setHeader('Content-Type',rendered.type)
      res.setHeader('Content-Disposition',`attachment; filename="${safe}${suffix}.${rendered.extension}"`)
      res.send(rendered.buffer)
    }catch(error){next(error)}
  })
}

import {config} from './config.js'
import {query,transaction} from './db.js'
import {mailStatus,sendMail} from './mailer.js'

let maintenanceRunning=false
let lastMaintenanceAt=0

const cleanError=error=>String(error?.message||error||'Unknown email delivery error').slice(0,1500)

const appLink=()=>config.frontendOrigin||config.frontendOrigins?.[0]||'http://localhost:5173'

export async function syncImportantNotificationReminders(){
  await transaction(async client=>{
    // Assignment reminder: one due-tomorrow email and one first-overdue email per due date.
    await client.query(`INSERT INTO notifications(
      user_id,title,body,entity_type,entity_id,event_key,priority,reminder_kind,action,target_workspace
    )
    SELECT am.user_id,
      CASE WHEN a.due_date<CURRENT_DATE THEN 'Assignment overdue' ELSE 'Assignment due tomorrow' END,
      '“'||a.title||'” '||
        CASE WHEN a.due_date<CURRENT_DATE
          THEN 'was due on '||TO_CHAR(a.due_date,'DD Mon YYYY')||'. Immediate action is required.'
          ELSE 'is due tomorrow ('||TO_CHAR(a.due_date,'DD Mon YYYY')||'). Please confirm progress and complete the next required step.'
        END,
      'assignment',a.id,
      'email-reminder:assignment:'||a.id||':'||a.due_date||':'||CASE WHEN a.due_date<CURRENT_DATE THEN 'overdue' ELSE 'tomorrow' END,
      'High',
      CASE WHEN a.due_date<CURRENT_DATE THEN 'OVERDUE' ELSE 'DUE_TOMORROW' END,
      'Open assignment','Assignments'
    FROM assignments a
    JOIN assignment_members am ON am.assignment_id=a.id
    WHERE a.status<>'Completed'
      AND (a.due_date=CURRENT_DATE+1 OR a.due_date<CURRENT_DATE)
    ON CONFLICT(user_id,event_key) WHERE event_key IS NOT NULL DO NOTHING`)

    // Task reminder for task owner.
    await client.query(`INSERT INTO notifications(
      user_id,title,body,entity_type,entity_id,event_key,priority,reminder_kind,action,target_workspace
    )
    SELECT t.owner_id,
      CASE WHEN t.due_date<CURRENT_DATE THEN 'Task overdue' ELSE 'Task due tomorrow' END,
      '“'||t.title||'” '||
        CASE WHEN t.due_date<CURRENT_DATE
          THEN 'was due on '||TO_CHAR(t.due_date,'DD Mon YYYY')||'. Immediate action is required.'
          ELSE 'is due tomorrow ('||TO_CHAR(t.due_date,'DD Mon YYYY')||'). Please complete or update the task.'
        END,
      'assignment_task',t.id,
      'email-reminder:task:'||t.id||':'||t.due_date||':'||CASE WHEN t.due_date<CURRENT_DATE THEN 'overdue' ELSE 'tomorrow' END,
      'High',
      CASE WHEN t.due_date<CURRENT_DATE THEN 'OVERDUE' ELSE 'DUE_TOMORROW' END,
      'Open task','Tasks'
    FROM assignment_tasks t
    WHERE t.owner_id IS NOT NULL
      AND t.archived_at IS NULL
      AND t.status<>'Completed'
      AND (t.due_date=CURRENT_DATE+1 OR t.due_date<CURRENT_DATE)
    ON CONFLICT(user_id,event_key) WHERE event_key IS NOT NULL DO NOTHING`)

    // Research lead/collaborator deadline reminder.
    await client.query(`INSERT INTO notifications(
      user_id,title,body,entity_type,entity_id,event_key,priority,reminder_kind,action,target_workspace
    )
    SELECT recipient.user_id,
      CASE WHEN p.end_date<CURRENT_DATE THEN 'Research deadline overdue' ELSE 'Research deadline tomorrow' END,
      '“'||p.title||'” '||
        CASE WHEN p.end_date<CURRENT_DATE
          THEN 'passed its target date on '||TO_CHAR(p.end_date,'DD Mon YYYY')||'. Review the project status and required next action.'
          ELSE 'reaches its target date tomorrow ('||TO_CHAR(p.end_date,'DD Mon YYYY')||'). Review readiness and remaining work.'
        END,
      'research',p.id,
      'email-reminder:research:'||p.id||':'||p.end_date||':'||recipient.user_id||':'||CASE WHEN p.end_date<CURRENT_DATE THEN 'overdue' ELSE 'tomorrow' END,
      'High',
      CASE WHEN p.end_date<CURRENT_DATE THEN 'OVERDUE' ELSE 'DUE_TOMORROW' END,
      'Open research','Research Repository'
    FROM research_projects p
    JOIN LATERAL(
      SELECT p.lead_id user_id
      UNION
      SELECT rc.user_id FROM research_collaborators rc WHERE rc.project_id=p.id
    ) recipient ON recipient.user_id IS NOT NULL
    WHERE p.status NOT IN('Completed','Published','Archived')
      AND (p.end_date=CURRENT_DATE+1 OR p.end_date<CURRENT_DATE)
    ON CONFLICT(user_id,event_key) WHERE event_key IS NOT NULL DO NOTHING`)
  })
}

export async function deliverPendingNotificationEmails(limit=24){
  const status=mailStatus()
  if(!status.ready)return {processed:0,sent:0,suppressed:0,failed:0,ready:false}

  const rows=(await query(`SELECT n.*,u.email,u.name,
      COALESCE(up.email_notifications,TRUE) email_notifications,
      COALESCE(up.important_email_notifications,TRUE) important_email_notifications,
      COALESCE(up.deadline_reminders,TRUE) deadline_reminders,
      COALESCE(ss.email_notifications,TRUE) system_email_notifications
    FROM notifications n
    JOIN users u ON u.id=n.user_id AND u.active=TRUE
    LEFT JOIN user_preferences up ON up.user_id=u.id
    CROSS JOIN system_settings ss
    WHERE n.email_eligible=TRUE
      AND n.email_status IN('Pending','Retry')
      AND COALESCE(n.next_email_attempt_at,NOW())<=NOW()
      AND n.email_attempts<3
    ORDER BY CASE n.priority WHEN 'Critical' THEN 0 WHEN 'High' THEN 1 ELSE 2 END,n.created_at ASC
    LIMIT $1`,[limit])).rows

  let sent=0,suppressed=0,failed=0
  for(const row of rows){
    const userAllows=Boolean(row.email_notifications)
    const importantAllows=row.priority==='Critical'||Boolean(row.important_email_notifications)
    const reminderAllows=!row.reminder_kind||Boolean(row.deadline_reminders)
    if(!row.system_email_notifications||!userAllows||!importantAllows||!reminderAllows||!row.email){
      await query(`UPDATE notifications SET email_status='Suppressed',
        email_last_error=$2,next_email_attempt_at=NULL
        WHERE id=$1`,[row.id,!row.system_email_notifications?'System email delivery disabled.':!userAllows?'User email notifications disabled.':!importantAllows?'Important-email preference disabled.':!reminderAllows?'Deadline reminders disabled.':'No user email address available.'])
      suppressed++
      continue
    }

    await query(`UPDATE notifications SET email_status='Sending',email_attempts=email_attempts+1 WHERE id=$1`,[row.id])
    try{
      const prefix=row.priority==='Critical'?'[CRITICAL] ':row.priority==='High'?'[ACTION] ':''
      const text=[
        row.body,
        '',
        `Priority: ${row.priority}`,
        row.reminder_kind?`Reminder: ${row.reminder_kind.replaceAll('_',' ')}`:null,
        '',
        `Open REDESY: ${appLink()}`,
        '',
        'This message was generated by REDESY because this workflow event is classified as important.'
      ].filter(Boolean).join('\n')
      const result=await sendMail({to:row.email,subject:`${prefix}${row.title}`,text})
      await query(`UPDATE notifications SET email_status='Sent',email_sent_at=NOW(),
        email_message_id=$2,email_last_error=NULL,next_email_attempt_at=NULL
        WHERE id=$1`,[row.id,result.messageId||null])
      sent++
    }catch(error){
      const attempts=Number(row.email_attempts||0)+1
      const terminal=attempts>=3
      await query(`UPDATE notifications SET email_status=$2,email_last_error=$3,
        next_email_attempt_at=CASE WHEN $2='Retry' THEN NOW()+INTERVAL '15 minutes' ELSE NULL END
        WHERE id=$1`,[row.id,terminal?'Failed':'Retry',cleanError(error)])
      failed++
    }
  }

  return {processed:rows.length,sent,suppressed,failed,ready:true}
}


export async function deliverPendingInternalEmails(limit=24){
  if(!mailStatus().ready)return {processed:0,sent:0,failed:0,ready:false}
  const rows=(await query(`SELECT r.id recipient_row_id,r.recipient_email,r.attempts,
      m.subject,m.body,sender.name sender_name,sender.email sender_email,
      COALESCE(ss.email_notifications,TRUE) system_email_notifications
    FROM app_email_recipients r
    JOIN app_email_messages m ON m.id=r.message_id
    JOIN users sender ON sender.id=m.sender_id
    CROSS JOIN system_settings ss
    WHERE r.delivery_status IN('Pending','Retry') AND r.next_attempt_at<=NOW() AND r.attempts<3
    ORDER BY m.created_at ASC LIMIT $1`,[limit])).rows
  let sent=0,failed=0
  for(const row of rows){
    if(!row.system_email_notifications){
      await query(`UPDATE app_email_recipients SET delivery_status='Suppressed',
        last_error='System email delivery is disabled.',next_attempt_at=NULL WHERE id=$1`,[row.recipient_row_id])
      continue
    }
    await query(`UPDATE app_email_recipients SET delivery_status='Sending',attempts=attempts+1 WHERE id=$1`,[row.recipient_row_id])
    try{
      const result=await sendMail({
        to:row.recipient_email,
        subject:row.subject,
        text:[row.body,'',`Sent from REDESY by ${row.sender_name} <${row.sender_email}>.`,`Open REDESY: ${appLink()}`].join('\n')
      })
      await query(`UPDATE app_email_recipients SET delivery_status='Sent',sent_at=NOW(),
        provider_message_id=$2,last_error=NULL,next_attempt_at=NULL WHERE id=$1`,
        [row.recipient_row_id,result.messageId||null])
      sent++
    }catch(error){
      const attempts=Number(row.attempts||0)+1
      const terminal=attempts>=3
      await query(`UPDATE app_email_recipients SET delivery_status=$2,last_error=$3,
        next_attempt_at=CASE WHEN $2='Retry' THEN NOW()+INTERVAL '15 minutes' ELSE NULL END WHERE id=$1`,
        [row.recipient_row_id,terminal?'Failed':'Retry',cleanError(error)])
      failed++
    }
  }
  return {processed:rows.length,sent,failed,ready:true}
}

export async function runNotificationMaintenance(){
  await syncImportantNotificationReminders()
  const notifications=await deliverPendingNotificationEmails()
  const internalEmail=await deliverPendingInternalEmails()
  return {notifications,internalEmail}
}

export function scheduleNotificationMaintenance(){
  const now=Date.now()
  if(maintenanceRunning||now-lastMaintenanceAt<15000)return
  maintenanceRunning=true
  lastMaintenanceAt=now
  setTimeout(async()=>{
    try{await runNotificationMaintenance()}
    catch(error){console.error('Notification maintenance failed:',cleanError(error))}
    finally{maintenanceRunning=false}
  },0)
}

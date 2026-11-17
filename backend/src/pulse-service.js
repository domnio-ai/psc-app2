import {query,transaction} from './db.js'
import {managedUserIds} from './scope.js'
import {isManagementRole} from './auth.js'
import {canDecideLeaveRequests} from './users/leave-policy.js'
import {researchLifecycleStatusSql,researchCurrentSql,researchReadyToPublishSql} from './research-status.js'
import {calendarForUser} from './calendar-service.js'
import {buildPulse} from './pulse-model.js'
import {closeCompletedWorkNotifications} from './notifications/notification-lifecycle.js'

export async function visibleNotifications(user,run=query){
  await closeCompletedWorkNotifications(run,user.id)
  // Do not return mismatched legacy notice bodies to the client. Author workflow notices remain private to their author.
  return (await run(`SELECT n.* FROM notifications n WHERE n.user_id=$1
    AND(n.event_key IS NULL OR n.event_key NOT LIKE 'task-deadline:%' OR EXISTS(SELECT 1 FROM assignment_tasks t
      WHERE t.id::text=n.entity_id AND t.owner_id=$1 AND t.archived_at IS NULL AND t.status<>'Completed'
      AND n.event_key='task-deadline:'||t.id||':'||t.due_date||':'||CASE WHEN t.due_date<CURRENT_DATE THEN 'overdue' ELSE 'soon' END))
    AND(n.entity_type<>'notice' OR EXISTS(SELECT 1 FROM alerts a WHERE a.id::text=n.entity_id
      AND((a.status='Published' AND(a.audience_role IS NULL OR a.audience_role=$2) AND(a.expires_at IS NULL OR a.expires_at>NOW()))
        OR(a.created_by=$1 AND n.title IN('Notice approved','Notice returned for correction','New notice comment')))))
    ORDER BY n.created_at DESC,n.id`,[user.id,user.role])).rows
}
export async function syncTaskDeadlineNotifications(client,userId){
  await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id,event_key,priority)
    SELECT t.owner_id,CASE WHEN t.due_date<CURRENT_DATE THEN 'Task overdue' ELSE 'Task due soon' END,
      t.title||' — due '||TO_CHAR(t.due_date,'DD Mon YYYY'),'assignment_task',t.id,
      'task-deadline:'||t.id||':'||t.due_date||':'||CASE WHEN t.due_date<CURRENT_DATE THEN 'overdue' ELSE 'soon' END,'High'
    FROM assignment_tasks t WHERE t.owner_id=$1 AND t.archived_at IS NULL AND t.status<>'Completed' AND t.due_date<=CURRENT_DATE+7
    ON CONFLICT(user_id,event_key) WHERE event_key IS NOT NULL DO NOTHING`,[userId])
}
export async function pulseForUser(user){
  const scoped=await managedUserIds(user),all=scoped===null,ids=scoped||[user.id]
  // One repeatable-read snapshot makes every count reconcile with the exact returned drilldown rows.
  const records=await transaction(async client=>{
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const run=(sql)=>client.query(sql,[all,ids,user.id])
    const rows=[]
    const add=(result,module,type,destination)=>rows.push(...result.rows.map(r=>({...r,module,type,destination,contextId:r.contextId||r.id})))
    add(await run(`SELECT a.id,a.title,a.status,a.due_date "dueDate",EXISTS(SELECT 1 FROM assignment_members ownm WHERE ownm.assignment_id=a.id AND ownm.user_id=$3) owned FROM assignments a WHERE $3::uuid IS NOT NULL AND($1 OR a.created_by=ANY($2::uuid[]) OR EXISTS(SELECT 1 FROM assignment_members m WHERE m.assignment_id=a.id AND m.user_id=ANY($2::uuid[])) OR EXISTS(SELECT 1 FROM assignment_tasks t WHERE t.assignment_id=a.id AND t.archived_at IS NULL AND t.owner_id=ANY($2::uuid[])))`),'Assignments','Assignment','Assignments')
    const tasks=await run(`SELECT t.id,t.title,CASE WHEN t.status='Completed' THEN t.status WHEN t.contribution_status='Ready for Integration' THEN 'Under Review' WHEN t.contribution_status='Integrated' THEN 'Approved' WHEN t.contribution_status='Draft' AND EXISTS(SELECT 1 FROM task_report_versions v WHERE v.task_id=t.id AND v.version_number=t.contribution_report_version AND v.status IN('Changes Requested','Rejected')) THEN 'Changes Requested' ELSE t.status END status,t.due_date "dueDate",t.assignment_id "contextId",t.owner_id=$3 owned,t.reviewer_id=$3 AND t.contribution_status='Ready for Integration' "myReview",t.owner_id=$3 AND t.contribution_status='Integrated' AND t.status<>'Completed' "needsAction",t.contribution_report_version report_version FROM assignment_tasks t WHERE t.archived_at IS NULL AND($1 OR t.owner_id=ANY($2::uuid[]) OR t.reviewer_id=$3 AND t.contribution_status='Ready for Integration')`)
    add({rows:tasks.rows.filter(r=>all||isManagementRole(user.role)||r.owned)},'Tasks','Task','Tasks')
    add({rows:tasks.rows.filter(r=>r.myReview).map(r=>({...r,needsAction:true,reviewKind:'Task Report'}))},'Reviews & Approvals','Review','Tasks')
    add({rows:tasks.rows.filter(r=>r.report_version>0 && (all||isManagementRole(user.role)||r.owned))},'Reports & Analytics','Task','Tasks')
    const research=await run(`SELECT p.id,p.title,${researchLifecycleStatusSql('p')} status,p.end_date "dueDate",(p.lead_id=$3 OR EXISTS(SELECT 1 FROM research_collaborators ownc WHERE ownc.project_id=p.id AND ownc.user_id=$3)) owned FROM research_projects p WHERE $3::uuid IS NOT NULL AND (${researchCurrentSql('p')} OR ${researchReadyToPublishSql('p')}) AND($1 OR p.lead_id=ANY($2::uuid[]) OR EXISTS(SELECT 1 FROM research_collaborators c WHERE c.project_id=p.id AND c.user_id=ANY($2::uuid[])))`)
    add(research,'Research Repository','Research Project','Research Repository')
    const researchReviews=await client.query(`SELECT p.id,p.title,'Under Review' status,p.end_date "dueDate",true "myReview",true "needsAction",'Research Report' "reviewKind" FROM research_projects p JOIN LATERAL(SELECT v.status,v.reviewer_id FROM research_report_versions v WHERE v.project_id=p.id ORDER BY v.version_number DESC LIMIT 1) assigned_version ON TRUE WHERE assigned_version.status='Submitted' AND assigned_version.reviewer_id=$1`,[user.id])
    add(researchReviews,'Reviews & Approvals','Review','Research Repository')
    add(await run(`SELECT p.id,p.title,v.status,p.end_date "dueDate" FROM research_projects p JOIN LATERAL(SELECT status FROM research_report_versions WHERE project_id=p.id ORDER BY version_number DESC LIMIT 1) v ON TRUE WHERE $3::uuid IS NOT NULL AND($1 OR p.lead_id=ANY($2::uuid[]) OR EXISTS(SELECT 1 FROM research_collaborators c WHERE c.project_id=p.id AND c.user_id=ANY($2::uuid[])))`),'Reports & Analytics','Research Project','Research Repository')
    const reports=await run(`SELECT d.id,d.title,d.status,d.review_due_date "dueDate",d.context_id "contextId",d.created_by=$3 owned,d.reviewer_id=$3 AND d.status IN('Submitted','Under Review') "myReview",d.created_by=$3 AND d.status='Approved' "needsAction",'Generated Document' "reviewKind",d.context FROM generated_documents d WHERE $3::uuid IS NOT NULL AND($1 OR d.created_by=ANY($2::uuid[]) OR d.reviewer_id=$3)`)
    add(reports,'Reports & Analytics','Report','Reports & Analytics')
    add({rows:reports.rows.filter(r=>r.myReview).map(r=>({...r,needsAction:true}))},'Reviews & Approvals','Review','Assignments')
    const repository=await run(`SELECT k.id,k.title,k.status,k.created_by=$3 owned,k.reviewer_id=$3 AND k.status='Pending Approval' "myReview",'Knowledge' "reviewKind" FROM knowledge_items k WHERE $3::uuid IS NOT NULL AND($1 OR k.created_by=ANY($2::uuid[]) OR k.reviewer_id=$3) AND(k.status<>'Draft' OR k.created_by=$3 OR EXISTS(SELECT 1 FROM users owner WHERE owner.id=k.created_by AND owner.supervisor_id=$3))`)
    add(repository,'Document Repository','Knowledge','Document Repository')
    add({rows:repository.rows.filter(r=>r.myReview).map(r=>({...r,needsAction:true}))},'Reviews & Approvals','Review','Document Repository')
    if(canDecideLeaveRequests(user.role)){
      add(await run(`SELECT lr.id,
        u.name||' - '||lt.name||' leave request' title,
        lr.status,
        TRUE "myReview",
        TRUE "needsAction",
        'Leave Request' "reviewKind"
      FROM leave_requests lr
      JOIN users u ON u.id=lr.user_id
      JOIN leave_types lt ON lt.code=lr.leave_type_code
      WHERE lr.status='Pending'
        AND lr.user_id<>$3
        AND ($1 OR lr.user_id=ANY($2::uuid[]))`),
        'Reviews & Approvals','Review','Reviews & Approvals')
    }
    if(isManagementRole(user.role))add(await run(`SELECT u.id,u.name title,u.role status,u.role,CASE WHEN current_leave.id IS NOT NULL THEN 'On Leave' ELSE u.status END "availabilityStatus",
      current_leave.leave_type_name "leaveTypeName",current_leave.end_date "leaveEndDate",
      CASE WHEN current_leave.id IS NOT NULL THEN TRUE ELSE FALSE END "currentlyOnLeave"
      FROM users u
      LEFT JOIN LATERAL(SELECT lr.id,lr.end_date,lt.name leave_type_name FROM leave_requests lr JOIN leave_types lt ON lt.code=lr.leave_type_code
        WHERE lr.user_id=u.id AND lr.status='Approved' AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date ORDER BY lr.start_date LIMIT 1) current_leave ON TRUE
      WHERE u.active=TRUE AND $3::uuid IS NOT NULL AND($1 OR u.id=ANY($2::uuid[]))`),'Team & Users','User','Team & Users')
    const notices=await client.query(`SELECT id,title,severity status FROM alerts WHERE status='Published' AND(audience_role IS NULL OR audience_role=$1) AND(expires_at IS NULL OR expires_at>NOW())`,[user.role])
    add(notices,'Notice Board','Notice','Notice Board')
    return rows
  })
  const [notifications,calendar]=await Promise.all([visibleNotifications(user),calendarForUser(user)])
  const pulse=buildPulse(records,notifications,calendar)
  pulse.scope=all?'Organisation':user.role==='Researcher'?'Own work and assigned reviews':'Reporting hierarchy'
  return pulse
}

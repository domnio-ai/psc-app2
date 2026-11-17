import {query} from '../db.js'
import {isManagementRole} from '../auth.js'
import {isOrganisationScopeRole,isTeamScopeRole,managedUserIds} from '../scope.js'
import {loadPreviousContributionEvidence} from './contribution-comparison.js'
import {loadTeamCapacityEvidence} from './team-capacity.js'
import {researchCurrentSql,researchDueSoonSql,researchLifecycleStatusSql,researchOverdueSql} from '../research-status.js'

const dateFilter=(alias,field,from,to,values)=>{
  let sql='TRUE'
  if(from){values.push(from);sql+=` AND ${alias}.${field}::date>=$${values.length}::date`}
  if(to){values.push(to);sql+=` AND ${alias}.${field}::date<=$${values.length}::date`}
  return sql
}
const assignmentScope=(user,scopeIds,alias='a')=>{
  if(isOrganisationScopeRole(user.role))return {sql:'TRUE',values:[]}
  if(isTeamScopeRole(user.role))return {sql:`(${alias}.created_by=ANY($1::uuid[]) OR EXISTS(SELECT 1 FROM assignment_members scope_am WHERE scope_am.assignment_id=${alias}.id AND scope_am.user_id=ANY($1::uuid[])) OR EXISTS(SELECT 1 FROM assignment_tasks scope_at WHERE scope_at.assignment_id=${alias}.id AND(scope_at.owner_id=ANY($1::uuid[]) OR scope_at.reviewer_id=ANY($1::uuid[]))))`,values:[scopeIds]}
  return {sql:`(${alias}.created_by=$1 OR EXISTS(SELECT 1 FROM assignment_members scope_am WHERE scope_am.assignment_id=${alias}.id AND scope_am.user_id=$1))`,values:[user.id]}
}
const researchScope=(user,scopeIds,alias='p')=>{
  if(isOrganisationScopeRole(user.role))return {sql:'TRUE',values:[]}
  if(isTeamScopeRole(user.role))return {sql:`(${alias}.lead_id=ANY($1::uuid[]) OR EXISTS(SELECT 1 FROM research_collaborators scope_rc WHERE scope_rc.project_id=${alias}.id AND scope_rc.user_id=ANY($1::uuid[])) OR EXISTS(SELECT 1 FROM research_reviewers scope_rr WHERE scope_rr.project_id=${alias}.id AND scope_rr.reviewer_id=ANY($1::uuid[]) AND scope_rr.active=TRUE))`,values:[scopeIds]}
  return {sql:`(${alias}.lead_id=$1 OR EXISTS(SELECT 1 FROM research_collaborators scope_rc WHERE scope_rc.project_id=${alias}.id AND scope_rc.user_id=$1) OR EXISTS(SELECT 1 FROM research_reviewers scope_rr WHERE scope_rr.project_id=${alias}.id AND scope_rr.reviewer_id=$1 AND scope_rr.active=TRUE))`,values:[user.id]}
}
const addDates=(scope,alias,field,filters,kind)=>{
  const values=[...scope.values]
  let sql=`${scope.sql} AND ${dateFilter(alias,field,filters.from,filters.to,values)}`
  if(kind==='assignment'&&filters.workType==='Research')sql+=' AND FALSE'
  if(kind==='research'&&['Assignments','Tasks'].includes(filters.workType))sql+=' AND FALSE'
  if(filters.status!=='All'){
    if(filters.status==='Overdue')sql+=kind==='assignment'?` AND ${alias}.status<>'Completed' AND ${alias}.due_date<CURRENT_DATE`:` AND ${researchOverdueSql(alias)}`
    else if(filters.status==='Awaiting Review')sql+=kind==='assignment'?` AND ${alias}.status='Ready for Review'`:` AND ${researchLifecycleStatusSql(alias)}='Under Review'`
    else if(filters.status==='Active')sql+=kind==='assignment'?` AND ${alias}.status IN('Not Started','In Progress')`:` AND ${researchLifecycleStatusSql(alias)} IN('Planning','Active')`
    else if(filters.status==='Changes Requested')sql+=kind==='assignment'?' AND FALSE':` AND ${researchLifecycleStatusSql(alias)}='Changes Requested'`
    else if(filters.status==='Completed')sql+=` AND ${alias}.status='Completed'`
  }
  return {sql,values}
}
const ALLOWED_WORK_TYPES=new Set(['All','Assignments','Tasks','Research'])
const ALLOWED_REPORT_STATUSES=new Set(['All','Overdue','Awaiting Review','Active','Changes Requested','Completed'])
const badRequest=message=>Object.assign(new Error(message),{status:400})
const strictIsoDate=(value,label)=>{
  const text=String(value||'').trim()
  if(!text)return ''
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text))throw badRequest(`Invalid reporting ${label} date.`)
  const parsed=new Date(`${text}T00:00:00Z`)
  if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==text)throw badRequest(`Invalid reporting ${label} date.`)
  return text
}
const parseFilters=input=>{
  if(input===null||typeof input!=='object'||Array.isArray(input))throw badRequest('Invalid reporting filters.')
  const from=strictIsoDate(input.from,'start'),to=strictIsoDate(input.to,'end')
  if(from&&to&&from>to)throw badRequest('Reporting start date cannot be after end date.')
  const workType=String(input.workType||'All').trim()||'All'
  const status=String(input.status||'All').trim()||'All'
  if(!ALLOWED_WORK_TYPES.has(workType))throw badRequest('Invalid reporting work type.')
  if(!ALLOWED_REPORT_STATUSES.has(status))throw badRequest('Invalid reporting status.')
  return {from,to,workType,status}
}

const previousPeriodFilters=filters=>{
  if(!filters.from||!filters.to)return null
  const from=new Date(`${filters.from}T00:00:00Z`)
  const to=new Date(`${filters.to}T00:00:00Z`)
  const span=Math.max(1,Math.round((to-from)/86400000)+1)
  const previousTo=new Date(from.getTime()-86400000)
  const previousFrom=new Date(previousTo.getTime()-(span-1)*86400000)
  const iso=value=>value.toISOString().slice(0,10)
  return {...filters,from:iso(previousFrom),to:iso(previousTo)}
}
const delta=(current,previous)=>Number(current)-Number(previous)

const insight=(completed,created,overdue,pending)=>{
  if(overdue>completed&&overdue>0)return 'The overdue workload exceeds completed work in this period; management attention should focus on ageing records and accountable owners.'
  if(pending>Math.max(3,completed))return 'Work is accumulating at review stage, indicating that the current constraint is review capacity rather than work creation.'
  if(created>completed)return 'New work exceeded completions in this period, so the active backlog is likely to grow unless throughput improves.'
  if(completed>0)return 'Completions kept pace with or exceeded new work, indicating stable delivery throughput for the selected period.'
  return 'There is not yet enough completed activity in this period for a reliable performance interpretation.'
}

export async function institutionalIntelligence(user,input={}){
  const filters=parseFilters(input)
  const manager=isManagementRole(user.role)
  const managedIds=manager?await managedUserIds(user):[user.id]
  const allManagement=managedIds===null
  const scopeIds=managedIds||[user.id]
  const a=addDates(assignmentScope(user,scopeIds),'a','created_at',filters,'assignment'),p=addDates(researchScope(user,scopeIds),'p','created_at',filters,'research')
  const previousFilters=previousPeriodFilters(filters)
  const previousA=previousFilters?addDates(assignmentScope(user,scopeIds),'a','created_at',previousFilters,'assignment'):null
  const previousP=previousFilters?addDates(researchScope(user,scopeIds),'p','created_at',previousFilters,'research'):null
  const reviewWhere=allManagement?'TRUE':isTeamScopeRole(user.role)?'v.submitted_by=ANY($1::uuid[]) OR v.reviewer_id=ANY($1::uuid[])':'v.submitted_by=$1 OR v.reviewer_id=$1'
  const reviewValues=allManagement?[]:isTeamScopeRole(user.role)?[scopeIds]:[user.id]
  const [work,trend,statuses,deadlineRisk,research,researchPipeline,researchAgeing,reviews,reviewOutcomes,publicationTrend,reviewTurnaroundTrend,attentionAssignments,attentionResearch,published,people,records,previousWork,previousResearch,contributions]=await Promise.all([
    query(`SELECT COUNT(*)::int total,COUNT(*)FILTER(WHERE a.status='Completed')::int completed,COUNT(*)FILTER(WHERE a.status NOT IN('Completed','Ready for Review'))::int active,COUNT(*)FILTER(WHERE a.status='Not Started')::int not_started,COUNT(*)FILTER(WHERE a.status<>'Completed' AND a.due_date<CURRENT_DATE)::int overdue,COUNT(*)FILTER(WHERE a.status='Ready for Review')::int awaiting_review,COUNT(*)FILTER(WHERE a.status<>'Completed' AND a.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE+INTERVAL '7 days')::int due_soon,COUNT(*)FILTER(WHERE a.status='Completed' AND a.due_date IS NOT NULL)::int completed_with_due_date,COUNT(*)FILTER(WHERE a.status='Completed' AND a.due_date IS NOT NULL AND a.updated_at::date<=a.due_date)::int completed_on_time,COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM(a.updated_at-a.created_at))/86400)FILTER(WHERE a.status='Completed'),1),0)::float average_completion_days FROM assignments a WHERE ${a.sql}`,a.values),
    query(`SELECT TO_CHAR(month,'Mon YYYY') label,COALESCE(created,0)::int created,COALESCE(completed,0)::int completed,COALESCE(overdue,0)::int overdue FROM generate_series(DATE_TRUNC('month',COALESCE(NULLIF($${a.values.length+1},'')::date,CURRENT_DATE-INTERVAL '5 months')),DATE_TRUNC('month',COALESCE(NULLIF($${a.values.length+2},'')::date,CURRENT_DATE)),'1 month') month LEFT JOIN LATERAL(SELECT COUNT(*) created,COUNT(*)FILTER(WHERE status='Completed') completed,COUNT(*)FILTER(WHERE status<>'Completed' AND due_date<CURRENT_DATE) overdue FROM assignments a WHERE ${a.sql} AND DATE_TRUNC('month',a.created_at)=month) x ON TRUE ORDER BY month`,[...a.values,filters.from,filters.to]),
    query(`SELECT CASE WHEN a.status='Ready for Review' THEN 'Awaiting Review' WHEN a.status='Completed' THEN 'Completed' WHEN a.status<>'Completed' AND a.due_date<CURRENT_DATE THEN 'Overdue' ELSE 'Active' END label,COUNT(*)::int value FROM assignments a WHERE ${a.sql} GROUP BY 1 ORDER BY 1`,a.values),
    query(`SELECT bucket label,COUNT(*)::int value FROM(SELECT CASE WHEN a.status='Completed' THEN 'Completed' WHEN a.due_date<CURRENT_DATE THEN 'Overdue' WHEN a.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE+INTERVAL '7 days' THEN 'Due in 7 days' WHEN a.due_date BETWEEN CURRENT_DATE+INTERVAL '8 days' AND CURRENT_DATE+INTERVAL '30 days' THEN 'Due in 8–30 days' WHEN a.due_date IS NULL THEN 'No due date' ELSE 'Beyond 30 days' END bucket FROM assignments a WHERE ${a.sql}) risk GROUP BY bucket ORDER BY CASE bucket WHEN 'Overdue' THEN 1 WHEN 'Due in 7 days' THEN 2 WHEN 'Due in 8–30 days' THEN 3 WHEN 'Beyond 30 days' THEN 4 WHEN 'No due date' THEN 5 ELSE 6 END`,a.values),
    query(`SELECT COUNT(*)::int total,COUNT(*)FILTER(WHERE ${researchLifecycleStatusSql('p')}='Active')::int active,COUNT(*)FILTER(WHERE ${researchLifecycleStatusSql('p')}='Under Review')::int under_review,COUNT(*)FILTER(WHERE ${researchLifecycleStatusSql('p')}='Completed')::int approved,COUNT(*)FILTER(WHERE ${researchOverdueSql('p')})::int overdue FROM research_projects p WHERE ${p.sql}`,p.values),
    query(`SELECT ${researchLifecycleStatusSql('p')} label,COUNT(*)::int value FROM research_projects p WHERE ${p.sql} GROUP BY 1 ORDER BY 1`,p.values),
    query(`SELECT CASE WHEN CURRENT_DATE-p.created_at::date<30 THEN '<30 days' WHEN CURRENT_DATE-p.created_at::date<60 THEN '30–60 days' WHEN CURRENT_DATE-p.created_at::date<90 THEN '60–90 days' ELSE '90+ days' END label,COUNT(*)::int value FROM research_projects p WHERE ${p.sql} AND ${researchCurrentSql('p')} GROUP BY 1 ORDER BY MIN(CURRENT_DATE-p.created_at::date)`,p.values),
    query(`SELECT COUNT(*)::int submitted,COUNT(*)FILTER(WHERE status='Approved')::int approved,COUNT(*)FILTER(WHERE status='Changes Requested')::int changes_requested,COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM(reviewed_at-submitted_at))/86400)FILTER(WHERE reviewed_at IS NOT NULL),1),0)::float average_review_days,COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM(NOW()-submitted_at))/86400)FILTER(WHERE status='Submitted'),1),0)::float pending_review_age FROM research_report_versions v WHERE ${reviewWhere}`,[...reviewValues]),
    query(`SELECT status label,COUNT(*)::int value FROM research_report_versions v WHERE ${reviewWhere} GROUP BY status ORDER BY status`,[...reviewValues]),
    query(`SELECT TO_CHAR(DATE_TRUNC('month',COALESCE(reviewed_at,submitted_at,created_at)),'Mon YYYY') label,COUNT(*)FILTER(WHERE submitted_at IS NOT NULL)::int submitted,COUNT(*)FILTER(WHERE status='Approved')::int approved FROM research_report_versions v WHERE ${reviewWhere} GROUP BY DATE_TRUNC('month',COALESCE(reviewed_at,submitted_at,created_at)) ORDER BY MIN(COALESCE(reviewed_at,submitted_at,created_at))`,[...reviewValues]),
    query(`SELECT TO_CHAR(DATE_TRUNC('month',COALESCE(reviewed_at,submitted_at,created_at)),'Mon YYYY') label,COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM(reviewed_at-submitted_at))/86400)FILTER(WHERE reviewed_at IS NOT NULL),1),0)::float average_days,COUNT(*)FILTER(WHERE reviewed_at IS NOT NULL)::int reviewed,COUNT(*)FILTER(WHERE status='Submitted')::int pending FROM research_report_versions v WHERE ${reviewWhere} GROUP BY DATE_TRUNC('month',COALESCE(reviewed_at,submitted_at,created_at)) ORDER BY MIN(COALESCE(reviewed_at,submitted_at,created_at))`,[...reviewValues]),
    query(`SELECT a.id,a.title,'Assignment' type,a.status,a.due_date,a.division,COALESCE((SELECT STRING_AGG(DISTINCT member.name,', ' ORDER BY member.name) FROM assignment_members am JOIN users member ON member.id=am.user_id WHERE am.assignment_id=a.id),creator.name,'Not assigned') owner_name,COALESCE(NULLIF(BTRIM(a.division),''),'Unassigned team') responsible_team,CASE WHEN a.due_date<CURRENT_DATE THEN 'Overdue assignment' ELSE 'Due within 7 days' END reason FROM assignments a LEFT JOIN users creator ON creator.id=a.created_by WHERE ${a.sql} AND a.status<>'Completed' AND a.due_date<=CURRENT_DATE+INTERVAL '7 days' ORDER BY a.due_date NULLS LAST LIMIT 25`,a.values),
    query(`SELECT p.id,p.title,'Research' type,${researchLifecycleStatusSql('p')} status,p.end_date due_date,COALESCE(lead.name,'Unassigned') owner_name,COALESCE(NULLIF(BTRIM(lead.division),''),'Unassigned team') responsible_team,CASE WHEN ${researchOverdueSql('p')} THEN 'Overdue research' WHEN p.updated_at<NOW()-INTERVAL '30 days' THEN 'No progress recorded for 30+ days' ELSE 'Approaching deadline' END reason FROM research_projects p LEFT JOIN users lead ON lead.id=p.lead_id WHERE ${p.sql} AND ${researchCurrentSql('p')} AND(p.end_date<=CURRENT_DATE+INTERVAL '14 days' OR p.updated_at<NOW()-INTERVAL '30 days') ORDER BY p.end_date NULLS LAST LIMIT 25`,p.values),
    query(`SELECT k.id,k.title,k.document_type report_type,k.author generated_by,approver.name approved_by,k.approved_at approval_date,k.created_at published_date,k.classification audience,k.status FROM knowledge_items k LEFT JOIN users approver ON approver.id=k.approved_by WHERE k.status='Published' AND k.document_type ILIKE '%Report%' AND($1::boolean OR k.created_by=ANY($2::uuid[]) OR k.approved_by=ANY($2::uuid[]) OR k.reviewer_id=ANY($2::uuid[])) ORDER BY k.created_at DESC LIMIT 50`,[allManagement,scopeIds]),
    manager?query(`SELECT u.id,u.name,u.division team,
      (COALESCE(aw.total_assignments,0)+COALESCE(tw.total_tasks,0))::int total_assigned,
      (COALESCE(aw.active_assignments,0)+COALESCE(tw.active_tasks,0))::int active_work,
      (COALESCE(aw.completed_assignments,0)+COALESCE(tw.completed_tasks,0))::int completed,
      (COALESCE(aw.overdue_assignments,0)+COALESCE(tw.overdue_tasks,0))::int overdue,
      COALESCE(rw.research_active,0)::int research_active,
      COALESCE(rvw.awaiting_review,0)::int awaiting_review,
      COALESCE(aw.on_time_rate,0)::float on_time_rate
      FROM users u
      LEFT JOIN LATERAL(
        SELECT COUNT(DISTINCT a.id)::int total_assignments,
          COUNT(DISTINCT a.id)FILTER(WHERE a.status<>'Completed')::int active_assignments,
          COUNT(DISTINCT a.id)FILTER(WHERE a.status='Completed')::int completed_assignments,
          COUNT(DISTINCT a.id)FILTER(WHERE a.status<>'Completed' AND a.due_date<CURRENT_DATE)::int overdue_assignments,
          COALESCE(ROUND(100.0*COUNT(DISTINCT a.id)FILTER(WHERE a.status='Completed' AND(a.due_date IS NULL OR a.updated_at::date<=a.due_date))/NULLIF(COUNT(DISTINCT a.id)FILTER(WHERE a.status='Completed'),0),1),0)::float on_time_rate
        FROM assignment_members am JOIN assignments a ON a.id=am.assignment_id
        WHERE am.user_id=u.id AND($4='' OR a.created_at::date>=$4::date) AND($5='' OR a.created_at::date<=$5::date)
      ) aw ON TRUE
      LEFT JOIN LATERAL(
        SELECT COUNT(DISTINCT t.id)::int total_tasks,
          COUNT(DISTINCT t.id)FILTER(WHERE t.status<>'Completed')::int active_tasks,
          COUNT(DISTINCT t.id)FILTER(WHERE t.status='Completed')::int completed_tasks,
          COUNT(DISTINCT t.id)FILTER(WHERE t.status<>'Completed' AND t.due_date<CURRENT_DATE)::int overdue_tasks
        FROM assignment_tasks t
        WHERE t.owner_id=u.id AND t.archived_at IS NULL AND($4='' OR t.created_at::date>=$4::date) AND($5='' OR t.created_at::date<=$5::date)
      ) tw ON TRUE
      LEFT JOIN LATERAL(
        SELECT COUNT(DISTINCT rp.id)FILTER(WHERE ${researchCurrentSql('rp')})::int research_active
        FROM research_projects rp
        WHERE (rp.lead_id=u.id OR EXISTS(SELECT 1 FROM research_collaborators prc WHERE prc.project_id=rp.id AND prc.user_id=u.id))
          AND($4='' OR rp.created_at::date>=$4::date) AND($5='' OR rp.created_at::date<=$5::date)
      ) rw ON TRUE
      LEFT JOIN LATERAL(
        SELECT COUNT(DISTINCT v.id)FILTER(WHERE v.status='Submitted')::int awaiting_review
        FROM research_report_versions v
        WHERE v.reviewer_id=u.id AND($4='' OR COALESCE(v.submitted_at,v.created_at)::date>=$4::date) AND($5='' OR COALESCE(v.submitted_at,v.created_at)::date<=$5::date)
      ) rvw ON TRUE
      WHERE u.active=TRUE AND($1::boolean OR u.id=ANY($2::uuid[])) AND u.id<>$3 AND u.role IN('Researcher','Deputy Director','Assistant Director') ORDER BY u.name`,[allManagement,scopeIds,user.id,filters.from,filters.to]):Promise.resolve({rows:[]}),
    query(`SELECT a.id,a.title,'Assignment' type,a.status,a.priority,a.due_date,a.division,a.created_at,a.updated_at FROM assignments a WHERE ${a.sql} ORDER BY a.updated_at DESC LIMIT 100`,a.values),
    previousA?query(`SELECT COUNT(*)::int total,COUNT(*)FILTER(WHERE a.status='Completed')::int completed,COUNT(*)FILTER(WHERE a.status<>'Completed' AND a.due_date<CURRENT_DATE)::int overdue,COUNT(*)FILTER(WHERE a.status='Ready for Review')::int awaiting_review FROM assignments a WHERE ${previousA.sql}`,previousA.values):Promise.resolve({rows:[{total:0,completed:0,overdue:0,awaiting_review:0}]}),
    previousP?query(`SELECT COUNT(*)::int total,COUNT(*)FILTER(WHERE ${researchLifecycleStatusSql('p')}='Completed')::int completed,COUNT(*)FILTER(WHERE ${researchOverdueSql('p')})::int overdue FROM research_projects p WHERE ${previousP.sql}`,previousP.values):Promise.resolve({rows:[{total:0,completed:0,overdue:0}]}),
    manager?query(`SELECT contribution.* FROM(
      SELECT u.id user_id,u.name,u.division team,'Assignment' work_type,a.id work_id,a.title work_title,COALESCE(am.member_role,'Contributor') contribution_role,a.status,0::int progress,a.updated_at evidence_at,'Assignment team membership' evidence
      FROM users u JOIN assignment_members am ON am.user_id=u.id JOIN assignments a ON a.id=am.assignment_id
      WHERE u.active=TRUE AND($1::boolean OR u.id=ANY($2::uuid[])) AND u.id<>$3 AND($4='' OR a.created_at::date>=$4::date) AND($5='' OR a.created_at::date<=$5::date)
      UNION ALL
      SELECT u.id,u.name,u.division,'Task',t.id,t.title,'Task owner',t.status,COALESCE(t.progress,0)::int,t.updated_at,'Assigned task ownership'
      FROM users u JOIN assignment_tasks t ON t.owner_id=u.id
      WHERE u.active=TRUE AND($1::boolean OR u.id=ANY($2::uuid[])) AND u.id<>$3 AND($4='' OR t.created_at::date>=$4::date) AND($5='' OR t.created_at::date<=$5::date)
      UNION ALL
      SELECT u.id,u.name,u.division,'Review',t.id,t.title,'Task reviewer',t.status,COALESCE(t.progress,0)::int,t.updated_at,'Task review responsibility'
      FROM users u JOIN assignment_tasks t ON t.reviewer_id=u.id
      WHERE u.active=TRUE AND($1::boolean OR u.id=ANY($2::uuid[])) AND u.id<>$3 AND($4='' OR t.created_at::date>=$4::date) AND($5='' OR t.created_at::date<=$5::date)
      UNION ALL
      SELECT u.id,u.name,u.division,'Research',p.id,p.title,'Research lead',p.status,0::int,p.updated_at,'Research lead accountability'
      FROM users u JOIN research_projects p ON p.lead_id=u.id
      WHERE u.active=TRUE AND($1::boolean OR u.id=ANY($2::uuid[])) AND u.id<>$3 AND($4='' OR p.created_at::date>=$4::date) AND($5='' OR p.created_at::date<=$5::date)
      UNION ALL
      SELECT u.id,u.name,u.division,'Research',p.id,p.title,COALESCE(NULLIF(rc.role,''),'Research collaborator'),p.status,0::int,p.updated_at,'Research collaboration'
      FROM users u JOIN research_collaborators rc ON rc.user_id=u.id JOIN research_projects p ON p.id=rc.project_id
      WHERE u.active=TRUE AND($1::boolean OR u.id=ANY($2::uuid[])) AND u.id<>$3 AND($4='' OR p.created_at::date>=$4::date) AND($5='' OR p.created_at::date<=$5::date)
      UNION ALL
      SELECT u.id,u.name,u.division,'Review',p.id,p.title,'Research reviewer',p.status,0::int,p.updated_at,'Active research review responsibility'
      FROM users u JOIN research_reviewers rr ON rr.reviewer_id=u.id AND rr.active=TRUE JOIN research_projects p ON p.id=rr.project_id
      WHERE u.active=TRUE AND($1::boolean OR u.id=ANY($2::uuid[])) AND u.id<>$3 AND($4='' OR p.created_at::date>=$4::date) AND($5='' OR p.created_at::date<=$5::date)
    ) contribution ORDER BY contribution.name,contribution.evidence_at DESC`,[allManagement,scopeIds,user.id,filters.from,filters.to]):Promise.resolve({rows:[]})
  ])
  const [assignmentReadiness,researchReadiness]=await Promise.all([
    query(`SELECT COUNT(*)::int total,
      COUNT(*)FILTER(WHERE a.status<>'Completed' AND a.due_date IS NULL)::int missing_deadline,
      COUNT(*)FILTER(WHERE a.status<>'Completed' AND a.updated_at<NOW()-INTERVAL '30 days')::int stale_active,
      COUNT(*)FILTER(WHERE NOT EXISTS(SELECT 1 FROM assignment_members am WHERE am.assignment_id=a.id))::int without_team_members
      FROM assignments a WHERE ${a.sql}`,a.values),
    query(`SELECT COUNT(*)::int total,
      COUNT(*)FILTER(WHERE NULLIF(BTRIM(p.research_question),'') IS NULL)::int missing_research_question,
      COUNT(*)FILTER(WHERE NULLIF(BTRIM(p.objectives),'') IS NULL)::int missing_objectives,
      COUNT(*)FILTER(WHERE NULLIF(BTRIM(p.methodology),'') IS NULL)::int missing_methodology,
      COUNT(*)FILTER(WHERE p.assignment_id IS NULL)::int without_parent_assignment,
      COUNT(*)FILTER(WHERE p.status NOT IN('Completed','Archived') AND p.end_date IS NULL)::int missing_end_date,
      COUNT(*)FILTER(WHERE p.status NOT IN('Completed','Archived') AND p.updated_at<NOW()-INTERVAL '30 days')::int stale_active
      FROM research_projects p WHERE ${p.sql}`,p.values)
  ])
  const previousContributions=manager&&previousFilters?await loadPreviousContributionEvidence({allManagement,scopeIds,userId:user.id,from:previousFilters.from,to:previousFilters.to}):[]
  const teamCapacityEvidence=manager?await loadTeamCapacityEvidence({allManagement,scopeIds,userId:user.id}):[]
  const contributionComparison=previousFilters?{label:`Previous comparable period (${previousFilters.from} to ${previousFilters.to})`,from:previousFilters.from,to:previousFilters.to}:null
  const w=work.rows[0],r=research.rows[0],rv=reviews.rows[0],pw=previousWork.rows[0],pr=previousResearch.rows[0]
  const approvalRate=Number(rv.submitted)?Math.round(Number(rv.approved)*100/Number(rv.submitted)):0
  const completionRate=Number(w.total)?Math.round(Number(w.completed)*100/Number(w.total)):0
  const onTimeCompletionRate=Number(w.completed_with_due_date)?Math.round(Number(w.completed_on_time)*100/Number(w.completed_with_due_date)):0
  const researchCompletionRate=Number(r.total)?Math.round(Number(r.approved)*100/Number(r.total)):0
  const attention=[...attentionAssignments.rows,...attentionResearch.rows]
  const lifecycle=[
    {label:'Created',value:Number(w.total)},
    {label:'Started',value:Math.max(0,Number(w.total)-Number(w.not_started))},
    {label:'Reached review',value:Number(w.awaiting_review)+Number(w.completed)},
    {label:'Completed',value:Number(w.completed)}
  ]
  const previousCompletionRate=Number(pw.total)?Math.round(Number(pw.completed)*100/Number(pw.total)):0
  const previousResearchCompletionRate=Number(pr.total)?Math.round(Number(pr.completed)*100/Number(pr.total)):0
  const comparison=previousFilters?{
    label:`Previous comparable period (${previousFilters.from} to ${previousFilters.to})`,
    from:previousFilters.from,
    to:previousFilters.to,
    metrics:{totalWork:Number(pw.total),completed:Number(pw.completed),overdue:Number(pw.overdue),awaitingReview:Number(pw.awaiting_review),completionRate:previousCompletionRate,researchTotal:Number(pr.total),researchCompleted:Number(pr.completed),researchOverdue:Number(pr.overdue),researchCompletionRate:previousResearchCompletionRate},
    deltas:{totalWork:delta(w.total,pw.total),completed:delta(w.completed,pw.completed),overdue:delta(w.overdue,pw.overdue),awaitingReview:delta(w.awaiting_review,pw.awaiting_review),completionRate:delta(completionRate,previousCompletionRate),researchCompletionRate:delta(researchCompletionRate,previousResearchCompletionRate)}
  }:null
  const levelOrder={critical:0,watch:1,healthy:2}
  const priorities=[]
  if(Number(w.overdue)>0)priorities.push({key:'overdue-work',level:Number(w.overdue)>=3?'critical':'watch',title:'Reduce overdue assignment backlog',evidence:`${Number(w.overdue)} assignment${Number(w.overdue)===1?' is':'s are'} overdue in the current scope.`,action:'Open the overdue cohort, confirm accountable owners and agree recovery dates.'})
  if(Number(w.awaiting_review)>0)priorities.push({key:'review-queue',level:Number(w.awaiting_review)>=3?'critical':'watch',title:'Clear work awaiting review',evidence:`${Number(w.awaiting_review)} assignment${Number(w.awaiting_review)===1?' is':'s are'} waiting at the review stage.`,action:'Check reviewer capacity and re-balance only where governance permits.'})
  if(Number(r.overdue)>0)priorities.push({key:'research-delay',level:Number(r.overdue)>=2?'critical':'watch',title:'Recover overdue research',evidence:`${Number(r.overdue)} research project${Number(r.overdue)===1?' is':'s are'} beyond the recorded end date.`,action:'Review milestones, evidence gaps and the next accountable research action.'})
  if(Number(rv.pending_review_age)>=5)priorities.push({key:'review-age',level:Number(rv.pending_review_age)>=10?'critical':'watch',title:'Address ageing research reviews',evidence:`Pending research reviews average ${Number(rv.pending_review_age)} days in queue.`,action:'Inspect the oldest submitted versions and confirm reviewer availability.'})
  if(completionRate<85)priorities.push({key:'completion-rate',level:completionRate<70?'critical':'watch',title:'Improve completion throughput',evidence:`The scoped assignment completion rate is ${completionRate}% against the 85% reference threshold.`,action:'Use lifecycle and deadline-risk views to identify where work is stalling before completion.'})
  priorities.sort((a,b)=>levelOrder[a.level]-levelOrder[b.level])
  const pendingResearchReviews=reviewOutcomes.rows.find(row=>String(row.label)==='Submitted')?.value||0
  const bottlenecks=[
    {label:'Overdue assignments',value:Number(w.overdue)},
    {label:'Assignments awaiting review',value:Number(w.awaiting_review)},
    {label:'Assignments due soon',value:Number(w.due_soon)},
    {label:'Overdue research',value:Number(r.overdue)},
    {label:'Pending research reviews',value:Number(pendingResearchReviews)}
  ]
  const riskConcentration=people.rows.map(row=>({id:String(row.id),name:String(row.name),overdue:Number(row.overdue||0),awaiting_review:Number(row.awaiting_review||0),exposure:Number(row.overdue||0)+Number(row.awaiting_review||0)})).filter(row=>row.exposure>0).sort((a,b)=>b.exposure-a.exposure).slice(0,8)
  const decisionSupport={priorities:priorities.slice(0,4),bottlenecks,riskConcentration}
  const teamSummary=new Map()
  for(const row of people.rows){
    const team=String(row.team||'').trim()||'Unassigned team'
    const current=teamSummary.get(team)||{team,overdue:0,awaitingReview:0,active:0,completed:0,officers:0}
    current.overdue+=Number(row.overdue||0)
    current.awaitingReview+=Number(row.awaiting_review||0)
    current.active+=Number(row.active_work||0)
    current.completed+=Number(row.completed||0)
    current.officers+=1
    teamSummary.set(team,current)
  }
  const teamPressure=[...teamSummary.values()].map(row=>({...row,exposure:row.overdue+row.awaitingReview})).sort((a,b)=>b.exposure-a.exposure||b.overdue-a.overdue||a.team.localeCompare(b.team))
  const totalExposure=teamPressure.reduce((sum,row)=>sum+row.exposure,0)
  const topTeam=teamPressure[0]||null
  const topTeamShare=topTeam&&totalExposure?Math.round(topTeam.exposure*100/totalExposure):0
  const recentTrend=trend.rows.slice(-3)
  const recentCreated=recentTrend.reduce((sum,row)=>sum+Number(row.created||0),0)
  const recentCompleted=recentTrend.reduce((sum,row)=>sum+Number(row.completed||0),0)
  const throughputGap=recentCreated-recentCompleted
  const evidenceStrength=Number(w.total)>=30?'Strong':Number(w.total)>=10?'Moderate':'Limited'
  const earlySignals=[]
  const addEarlySignal=(signal)=>earlySignals.push({...signal,evidenceStrength})
  if(comparison&&Number(comparison.deltas.overdue)>0){
    addEarlySignal({key:'overdue-trajectory',level:Number(comparison.deltas.overdue)>=3?'critical':'watch',title:'Overdue pressure is increasing',responsibleTeam:topTeam?.team||'Scope-wide',evidence:`Overdue assignments increased by ${Number(comparison.deltas.overdue)} compared with the immediately preceding equal-length period.`,outlook:'If the current pattern continues, overdue pressure is likely to remain elevated in the next reporting period.',action:'Open the overdue cohort, confirm accountable teams and agree recovery dates before the next reporting checkpoint.'})
  }else if(throughputGap>0){
    addEarlySignal({key:'throughput-gap',level:throughputGap>=5?'critical':'watch',title:'Work inflow is exceeding completions',responsibleTeam:topTeam?.team||'Scope-wide',evidence:`Across the most recent ${recentTrend.length} monthly points, ${recentCreated} assignments were created and ${recentCompleted} completed, a gap of ${throughputGap}.`,outlook:'The active backlog may grow if completion throughput does not catch up with new work.',action:'Review the teams carrying the largest open workload and protect completion capacity.'})
  }
  if((comparison&&Number(comparison.deltas.awaitingReview)>0)||Number(rv.pending_review_age)>=5){
    const growth=comparison?Number(comparison.deltas.awaitingReview):0
    addEarlySignal({key:'review-pressure',level:growth>=3||Number(rv.pending_review_age)>=10?'critical':'watch',title:'Review pressure is building',responsibleTeam:topTeam?.team||'Scope-wide',evidence:`${Number(w.awaiting_review)} assignments currently await review${growth>0?`, up by ${growth} from the previous comparable period`:''}; pending research reviews average ${Number(rv.pending_review_age)} days.`,outlook:'Review queues are likely to remain a delivery constraint unless reviewer capacity or sequencing changes.',action:'Inspect the oldest review items and rebalance reviewer capacity only within approved governance rules.'})
  }
  if(comparison&&Number(comparison.deltas.completionRate)<=-5){
    addEarlySignal({key:'completion-deterioration',level:Number(comparison.deltas.completionRate)<=-10?'critical':'watch',title:'Completion rate has deteriorated',responsibleTeam:topTeam?.team||'Scope-wide',evidence:`Completion rate is ${completionRate}%, ${Math.abs(Number(comparison.deltas.completionRate))} percentage points below the previous comparable period.`,outlook:'Without a throughput correction, the lower completion rate may persist into the next reporting period.',action:'Use lifecycle, deadline-risk and team workload views to identify where work is stalling.'})
  }
  if(topTeam&&totalExposure>=2&&topTeamShare>=50){
    addEarlySignal({key:'team-concentration',level:topTeamShare>=70?'critical':'watch',title:'Operational risk is concentrated in one team',responsibleTeam:topTeam.team,evidence:`${topTeam.team} accounts for ${topTeamShare}% of the current overdue and awaiting-review exposure (${topTeam.exposure} of ${totalExposure} items).`,outlook:'A concentrated queue can create a local bottleneck even when organisation-wide totals appear manageable.',action:`Review ${topTeam.team}'s deadlines, reviewer capacity and active workload before redistributing work.`})
  }
  if(Number(w.due_soon)>=3){
    addEarlySignal({key:'deadline-wave',level:Number(w.due_soon)>=6?'critical':'watch',title:'A near-term deadline wave is approaching',responsibleTeam:topTeam?.team||'Scope-wide',evidence:`${Number(w.due_soon)} assignments are due within seven days.`,outlook:'Near-term overdue exposure may rise if these records are not closed or formally re-planned.',action:'Confirm readiness and blockers for the due-soon cohort before deadlines expire.'})
  }
  const earlyWarning={
    signals:earlySignals.slice(0,5),
    evidenceStrength,
    methodology:'Rules use current scoped REDESY records, the immediately preceding equal-length period, recent monthly inflow/completion counts and transparent team exposure thresholds. They are directional early warnings, not statistical forecasts or staff scores.'
  }
  const clampPercent=value=>Math.max(0,Math.min(100,Math.round(Number(value)||0)))
  const overdueChange=comparison?Number(comparison.deltas.overdue||0):0
  const reviewChange=comparison?Number(comparison.deltas.awaitingReview||0):0
  const completionChange=comparison?Number(comparison.deltas.completionRate||0):0
  const baselineProjection={
    overdue:Math.max(0,Number(w.overdue)+Math.max(0,overdueChange)),
    awaitingReview:Math.max(0,Number(w.awaiting_review)+Math.max(0,reviewChange)),
    completionRate:clampPercent(completionRate+completionChange)
  }
  const forecast={
    responsibleTeam:topTeam?.team||'Scope-wide',
    evidenceStrength,
    baseline:baselineProjection,
    scenarios:[
      {key:'current-pattern',title:'Current pattern continues',assumption:'Repeats the most recent comparable-period direction once.',overdue:baselineProjection.overdue,awaitingReview:baselineProjection.awaitingReview,completionRate:baselineProjection.completionRate},
      {key:'review-relief',title:'Reduce review backlog by 25%',assumption:'Management closes or reallocates one quarter of the current awaiting-review queue.',overdue:Number(w.overdue),awaitingReview:Math.max(0,Math.round(Number(w.awaiting_review)*0.75)),completionRate},
      {key:'overdue-first',title:'Clear 50% of overdue work first',assumption:'Half of the current overdue cohort is resolved or formally replanned before new overdue exposure is added.',overdue:Math.max(0,Math.ceil(Number(w.overdue)*0.5)),awaitingReview:Number(w.awaiting_review),completionRate},
      {key:'completion-lift',title:'Improve completion by 10 percentage points',assumption:'Completion rate improves by a fixed 10 percentage points while current overdue and review queues are held constant.',overdue:Number(w.overdue),awaitingReview:Number(w.awaiting_review),completionRate:clampPercent(completionRate+10)}
    ],
    methodology:'Scenario values are deterministic what-if calculations using current scoped REDESY counts and the immediately preceding equal-length comparison. They are planning aids, not statistical forecasts, probabilities or promises of future performance.'
  }
  return {generatedAt:new Date().toISOString(),filters,scope:{type:allManagement?'ORGANISATION':manager?'TEAM_SUBTREE':'OWN_OR_CONTEXTUAL',role:user.role},basis:{assignments:Number(w.total),research:Number(r.total),publishedReports:published.rows.length},dataQuality:{assignments:assignmentReadiness.rows[0]||{},research:researchReadiness.rows[0]||{}},overview:{comparison,kpis:{totalWork:Number(w.total),completed:Number(w.completed),active:Number(w.active),overdue:Number(w.overdue),awaitingReview:Number(w.awaiting_review),dueSoon:Number(w.due_soon),completionRate,onTimeCompletionRate,approvalRate,averageCompletionDays:Number(w.average_completion_days),activeResearch:Number(r.active),researchUnderReview:Number(r.under_review),approvedResearch:Number(r.approved),researchCompletionRate,publishedResearch:published.rows.filter(x=>x.report_type==='Research Final Report').length},indicatorBasis:{completionRate:{numerator:Number(w.completed),denominator:Number(w.total)},onTimeCompletionRate:{numerator:Number(w.completed_on_time),denominator:Number(w.completed_with_due_date)},approvalRate:{numerator:Number(rv.approved),denominator:Number(rv.submitted)},researchCompletionRate:{numerator:Number(r.approved),denominator:Number(r.total)}},interpretation:insight(Number(w.completed),trend.rows.reduce((n,x)=>n+Number(x.created),0),Number(w.overdue),Number(w.awaiting_review)),completionTrend:trend.rows,status:statuses.rows,deadlineRisk:deadlineRisk.rows,lifecycle,records:records.rows,decisionSupport,earlyWarning,forecast},research:{portfolio:r,pipeline:researchPipeline.rows,ageing:researchAgeing.rows,review:{...rv,outcomes:reviewOutcomes.rows},publicationTrend:publicationTrend.rows,reviewTurnaroundTrend:reviewTurnaroundTrend.rows,interpretation:Number(r.under_review)>Number(r.active)?'The portfolio is concentrated in review, so approval capacity is the immediate constraint.':Number(r.overdue)>0?`${r.overdue} research project${Number(r.overdue)===1?' is':'s are'} overdue and require accountable follow-up.`:'The current research portfolio has no recorded overdue projects.'},attention,people:people.rows,contributions:contributions.rows,previousContributions,contributionComparison,teamCapacityEvidence,published:published.rows,capabilities:{management:manager,people:manager,reportBuilder:manager,published:true}}
}

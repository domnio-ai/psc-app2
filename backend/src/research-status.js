export const RESEARCH_PROJECT_STATUSES=['Planning','Active','Under Review','Completed','Archived']
export const RESEARCH_REPORT_STATUSES=['Draft','Submitted','Changes Requested','Approved','Rejected']
export const RESEARCH_CURRENT_PROJECT_STATUSES=['Planning','Active','Under Review']
export const RESEARCH_TERMINAL_PROJECT_STATUSES=['Completed','Archived']
export const RESEARCH_DUE_SOON_DAYS=7

export const isCurrentResearchStatus=status=>RESEARCH_CURRENT_PROJECT_STATUSES.includes(status)
export const isTerminalResearchStatus=status=>RESEARCH_TERMINAL_PROJECT_STATUSES.includes(status)

const latestVersionStatusSql=alias=>`(SELECT rv.status FROM research_report_versions rv WHERE rv.project_id=${alias}.id ORDER BY rv.version_number DESC LIMIT 1)`
const hasPublishedFinalSql=alias=>`EXISTS(
  SELECT 1
  FROM knowledge_items k
  JOIN repository_entity_links rel ON rel.knowledge_id=k.id
  WHERE rel.entity_type='research'
    AND rel.entity_id=${alias}.id
    AND k.document_type='Research Final Report'
    AND k.status='Published'
    AND COALESCE(k.is_archived,FALSE)=FALSE
)`

export const researchCurrentSql=(alias='p')=>`(
  ${alias}.status::text=ANY(ARRAY['Planning','Active','Under Review']::text[])
  AND COALESCE(${latestVersionStatusSql(alias)},'Draft') NOT IN('Approved','Rejected')
)`
export const researchReadyToPublishSql=(alias='p')=>`(
  ${alias}.status<>'Completed'
  AND ${latestVersionStatusSql(alias)}='Approved'
  AND NOT ${hasPublishedFinalSql(alias)}
)`
export const researchOverdueSql=(alias='p')=>`(
  ${researchCurrentSql(alias)}
  AND ${alias}.end_date IS NOT NULL
  AND ${alias}.end_date<CURRENT_DATE
)`
export const researchDueSoonSql=(alias='p',days=RESEARCH_DUE_SOON_DAYS)=>`(
  ${researchCurrentSql(alias)}
  AND ${alias}.end_date IS NOT NULL
  AND ${alias}.end_date>=CURRENT_DATE
  AND ${alias}.end_date<=CURRENT_DATE+INTERVAL '${Number(days)} days'
)`

export const researchLifecycleStatusSql=(alias='p')=>`CASE
  WHEN ${alias}.status='Archived' THEN 'Archived'
  WHEN ${alias}.status='Completed' OR ${hasPublishedFinalSql(alias)} THEN 'Completed'
  WHEN ${latestVersionStatusSql(alias)}='Approved' THEN 'Ready to Publish'
  WHEN ${latestVersionStatusSql(alias)}='Submitted' THEN 'Under Review'
  WHEN ${latestVersionStatusSql(alias)}='Changes Requested' THEN 'Changes Requested'
  WHEN ${latestVersionStatusSql(alias)}='Rejected' THEN 'Rejected'
  ELSE ${alias}.status
END`

export const researchStatusDisplay=status=>({
  Planning:'Planning',
  Active:'Active',
  'Under Review':'Under Review',
  'Changes Requested':'Changes Requested',
  Approved:'Ready to Publish',
  'Ready to Publish':'Ready to Publish',
  Rejected:'Rejected',
  Completed:'Completed',
  Archived:'Archived'
}[status]||status||'Planning')

export async function reconcileResearchLifecycleState(client){
  const repaired=(await client.query(`UPDATE research_projects p
    SET status='Completed',updated_at=NOW()
    WHERE p.status<>'Completed'
      AND ${hasPublishedFinalSql('p')}
    RETURNING p.id,p.title,p.lead_id`)).rows

  for(const project of repaired){
    await client.query(
      `INSERT INTO research_activity(project_id,user_id,action,details)
       VALUES($1,NULL,'RESEARCH_STATUS_RECONCILED',$2::jsonb)`,
      [project.id,JSON.stringify({to:'Completed',reason:'Published controlled final report exists'})]
    )
    if(project.lead_id){
      await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
        SELECT $1,'Research status reconciled',$2,'research',$3
        WHERE NOT EXISTS(
          SELECT 1 FROM notifications
          WHERE user_id=$1 AND entity_type='research' AND entity_id=$3::text
            AND title='Research status reconciled'
        )`,[project.lead_id,`“${project.title}” was reconciled to Completed because its controlled final report is published.`,project.id])
    }
  }
  return repaired
}

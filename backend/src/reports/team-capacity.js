import {query} from '../db.js'

const ROLE_SQL="u.role IN('Researcher','Deputy Director','Assistant Director')"

export async function loadTeamCapacityEvidence({allManagement,scopeIds,userId}){
  const result=await query(`SELECT capacity.* FROM(
    SELECT u.id user_id,u.name,u.division team,'Assignment' work_type,a.id work_id,a.title work_title,COALESCE(am.member_role,'Assignment member') responsibility,a.status,a.due_date,a.updated_at evidence_at
    FROM users u JOIN assignment_members am ON am.user_id=u.id JOIN assignments a ON a.id=am.assignment_id
    WHERE u.active=TRUE AND ${ROLE_SQL} AND($1::boolean OR u.id=ANY($2::uuid[])) AND u.id<>$3 AND a.status<>'Completed'
    UNION ALL
    SELECT u.id,u.name,u.division,'Task',t.id,t.title,'Task owner',t.status,t.due_date,t.updated_at
    FROM users u JOIN assignment_tasks t ON t.owner_id=u.id
    WHERE u.active=TRUE AND ${ROLE_SQL} AND($1::boolean OR u.id=ANY($2::uuid[])) AND u.id<>$3 AND t.archived_at IS NULL AND t.status<>'Completed'
    UNION ALL
    SELECT u.id,u.name,u.division,'Research',p.id,p.title,
      CASE WHEN p.lead_id=u.id THEN 'Research lead' ELSE COALESCE(NULLIF(rc.role,''),'Research collaborator') END,
      p.status,p.end_date,p.updated_at
    FROM users u JOIN research_projects p ON p.lead_id=u.id OR EXISTS(SELECT 1 FROM research_collaborators rcx WHERE rcx.project_id=p.id AND rcx.user_id=u.id)
    LEFT JOIN research_collaborators rc ON rc.project_id=p.id AND rc.user_id=u.id
    WHERE u.active=TRUE AND ${ROLE_SQL} AND($1::boolean OR u.id=ANY($2::uuid[])) AND u.id<>$3 AND p.status NOT IN('Completed','Archived')
    UNION ALL
    SELECT u.id,u.name,u.division,'Review',t.id,t.title,'Task reviewer',t.status,t.due_date,t.updated_at
    FROM users u JOIN assignment_tasks t ON t.reviewer_id=u.id
    WHERE u.active=TRUE AND ${ROLE_SQL} AND($1::boolean OR u.id=ANY($2::uuid[])) AND u.id<>$3 AND t.archived_at IS NULL AND t.status<>'Completed'
    UNION ALL
    SELECT u.id,u.name,u.division,'Review',p.id,p.title,'Research reviewer',p.status,p.end_date,p.updated_at
    FROM users u JOIN research_reviewers rr ON rr.reviewer_id=u.id AND rr.active=TRUE JOIN research_projects p ON p.id=rr.project_id
    WHERE u.active=TRUE AND ${ROLE_SQL} AND($1::boolean OR u.id=ANY($2::uuid[])) AND u.id<>$3 AND p.status NOT IN('Completed','Archived')
    UNION ALL
    SELECT u.id,u.name,u.division,'Review',v.id,p.title,'Submitted research report reviewer',v.status,NULL::date,COALESCE(v.submitted_at,v.created_at)
    FROM users u JOIN research_report_versions v ON v.reviewer_id=u.id JOIN research_projects p ON p.id=v.project_id
    WHERE u.active=TRUE AND ${ROLE_SQL} AND($1::boolean OR u.id=ANY($2::uuid[])) AND u.id<>$3 AND v.status='Submitted'
  ) capacity ORDER BY capacity.name,capacity.due_date NULLS LAST,capacity.evidence_at DESC`,[allManagement,scopeIds,userId])
  return result.rows
}

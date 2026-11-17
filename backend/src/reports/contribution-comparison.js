import {query} from '../db.js'

export async function loadPreviousContributionEvidence({allManagement,scopeIds,userId,from,to}){
  if(!from||!to)return []
  const result=await query(`SELECT contribution.* FROM(
    SELECT u.id user_id,u.name,u.division team,'Assignment' work_type,a.id work_id,a.title work_title,COALESCE(am.member_role,'Contributor') contribution_role,a.status,0::int progress,a.updated_at evidence_at,'Assignment team membership' evidence
    FROM users u JOIN assignment_members am ON am.user_id=u.id JOIN assignments a ON a.id=am.assignment_id
    WHERE u.active=TRUE AND($1::boolean OR u.id=ANY($2::uuid[])) AND u.id<>$3 AND a.created_at::date>=$4::date AND a.created_at::date<=$5::date
    UNION ALL
    SELECT u.id,u.name,u.division,'Task',t.id,t.title,'Task owner',t.status,COALESCE(t.progress,0)::int,t.updated_at,'Assigned task ownership'
    FROM users u JOIN assignment_tasks t ON t.owner_id=u.id
    WHERE u.active=TRUE AND($1::boolean OR u.id=ANY($2::uuid[])) AND u.id<>$3 AND t.created_at::date>=$4::date AND t.created_at::date<=$5::date
    UNION ALL
    SELECT u.id,u.name,u.division,'Review',t.id,t.title,'Task reviewer',t.status,COALESCE(t.progress,0)::int,t.updated_at,'Task review responsibility'
    FROM users u JOIN assignment_tasks t ON t.reviewer_id=u.id
    WHERE u.active=TRUE AND($1::boolean OR u.id=ANY($2::uuid[])) AND u.id<>$3 AND t.created_at::date>=$4::date AND t.created_at::date<=$5::date
    UNION ALL
    SELECT u.id,u.name,u.division,'Research',p.id,p.title,'Research lead',p.status,0::int,p.updated_at,'Research lead accountability'
    FROM users u JOIN research_projects p ON p.lead_id=u.id
    WHERE u.active=TRUE AND($1::boolean OR u.id=ANY($2::uuid[])) AND u.id<>$3 AND p.created_at::date>=$4::date AND p.created_at::date<=$5::date
    UNION ALL
    SELECT u.id,u.name,u.division,'Research',p.id,p.title,COALESCE(NULLIF(rc.role,''),'Research collaborator'),p.status,0::int,p.updated_at,'Research collaboration'
    FROM users u JOIN research_collaborators rc ON rc.user_id=u.id JOIN research_projects p ON p.id=rc.project_id
    WHERE u.active=TRUE AND($1::boolean OR u.id=ANY($2::uuid[])) AND u.id<>$3 AND p.created_at::date>=$4::date AND p.created_at::date<=$5::date
    UNION ALL
    SELECT u.id,u.name,u.division,'Review',p.id,p.title,'Research reviewer',p.status,0::int,p.updated_at,'Active research review responsibility'
    FROM users u JOIN research_reviewers rr ON rr.reviewer_id=u.id AND rr.active=TRUE JOIN research_projects p ON p.id=rr.project_id
    WHERE u.active=TRUE AND($1::boolean OR u.id=ANY($2::uuid[])) AND u.id<>$3 AND p.created_at::date>=$4::date AND p.created_at::date<=$5::date
  ) contribution ORDER BY contribution.name,contribution.evidence_at DESC`,[allManagement,scopeIds,userId,from,to])
  return result.rows
}

import {query} from './db.js'

export const organisationScopeRoles=['System Admin','Director']
export const teamScopeRoles=['Deputy Director','Assistant Director']
export const isOrganisationScopeRole=role=>organisationScopeRoles.includes(role)
export const isTeamScopeRole=role=>teamScopeRoles.includes(role)

// Operational oversight follows the reporting tree. System Admin is intentionally
// excluded from business approvals even though the role has technical access.
export const operationalOversightRoles=['Director','Deputy Director','Assistant Director']
export const isOperationalOversightRole=role=>operationalOversightRoles.includes(role)

export async function canOverseeUser(user,targetId){
  if(!targetId||!isOperationalOversightRole(user?.role))return false
  if(user.role==='Director')return true
  const ids=await managedUserIds(user)
  return Array.isArray(ids)&&ids.includes(targetId)
}

// Return active management-role ancestors from the immediate supervisor upward.
// A path guard protects this recursive query if a malformed reporting cycle exists.
export async function reportingOversightManagerIds(userId){
  const result=await query(`WITH RECURSIVE reporting_chain AS(
    SELECT member.supervisor_id AS id,1 AS depth,ARRAY[member.id,member.supervisor_id]::uuid[] AS path
    FROM users member
    WHERE member.id=$1 AND member.active=TRUE AND member.supervisor_id IS NOT NULL
    UNION ALL
    SELECT supervisor.supervisor_id,chain.depth+1,chain.path||supervisor.supervisor_id
    FROM reporting_chain chain
    JOIN users supervisor ON supervisor.id=chain.id AND supervisor.active=TRUE
    WHERE supervisor.supervisor_id IS NOT NULL
      AND chain.depth<50
      AND NOT supervisor.supervisor_id=ANY(chain.path)
  )
  SELECT manager.id,MIN(chain.depth) depth
  FROM reporting_chain chain
  JOIN users manager ON manager.id=chain.id AND manager.active=TRUE
  WHERE manager.role IN('Director','Deputy Director','Assistant Director')
  GROUP BY manager.id
  ORDER BY MIN(chain.depth)`,[userId])
  return result.rows.map(row=>row.id)
}

export async function immediateSupervisorForUser(userId){
  return (await query(`SELECT supervisor.id,supervisor.name,supervisor.role,supervisor.division
    FROM users member
    JOIN users supervisor ON supervisor.id=member.supervisor_id AND supervisor.active=TRUE
    WHERE member.id=$1 AND member.active=TRUE`,[userId])).rows[0]||null
}

export async function immediateOversightReviewers(userId){
  return (await query(`SELECT candidate.id,candidate.name,candidate.email,candidate.role,candidate.division,
      candidate.status,candidate.active,candidate.supervisor_id,
      supervisor.id oversight_manager_id,supervisor.name oversight_manager_name,supervisor.role oversight_manager_role
    FROM users member
    JOIN users supervisor ON supervisor.id=member.supervisor_id AND supervisor.active=TRUE
    JOIN users candidate ON candidate.active=TRUE
      AND(candidate.id=supervisor.id OR candidate.supervisor_id=supervisor.id)
    WHERE member.id=$1 AND member.active=TRUE
      AND candidate.id<>member.id
      AND candidate.role<>'System Admin'
    ORDER BY CASE WHEN candidate.id=supervisor.id THEN 0 ELSE 1 END,candidate.name`,[userId])).rows
}

export async function isImmediateSupervisorOf(supervisorId,userId){
  return Boolean((await query('SELECT 1 FROM users WHERE id=$1 AND supervisor_id=$2 AND active=TRUE',[userId,supervisorId])).rowCount)
}

export async function managedUserIds(user){
  if(isOrganisationScopeRole(user.role))return null
  if(!isTeamScopeRole(user.role))return [user.id]
  const result=await query(`WITH RECURSIVE managed AS(
    SELECT id FROM users WHERE id=$1 AND active=TRUE
    UNION ALL
    SELECT u.id FROM users u JOIN managed m ON u.supervisor_id=m.id WHERE u.active=TRUE
  ) SELECT id FROM managed`,[user.id])
  return result.rows.map(row=>row.id)
}

export async function canManageUser(user,targetId){
  if(isOrganisationScopeRole(user.role))return true
  if(!isTeamScopeRole(user.role))return user.id===targetId
  const ids=await managedUserIds(user)
  return ids.includes(targetId)
}

export async function canManageAssignment(user,assignmentId){
  if(isOrganisationScopeRole(user.role))return true
  if(!isTeamScopeRole(user.role))return false
  const result=await query(`WITH RECURSIVE managed AS(
    SELECT id FROM users WHERE id=$1 AND active=TRUE
    UNION ALL SELECT u.id FROM users u JOIN managed m ON u.supervisor_id=m.id WHERE u.active=TRUE
  )
  SELECT 1 FROM assignments a WHERE a.id=$2 AND(
    a.created_by IN(SELECT id FROM managed)
    OR EXISTS(SELECT 1 FROM assignment_members am WHERE am.assignment_id=a.id AND am.user_id IN(SELECT id FROM managed))
    OR EXISTS(SELECT 1 FROM assignment_tasks t WHERE t.assignment_id=a.id AND(t.owner_id IN(SELECT id FROM managed) OR t.reviewer_id IN(SELECT id FROM managed)))
  )`,[user.id,assignmentId])
  return result.rowCount>0
}

export async function assignmentTaskScope(user,assignmentId){
  if(isOrganisationScopeRole(user.role))return {all:true,userIds:null,mode:'organisation'}

  if(isTeamScopeRole(user.role)){
    if(!await canManageAssignment(user,assignmentId))return {all:false,userIds:[],mode:'none'}
    return {all:false,userIds:await managedUserIds(user),mode:'team'}
  }

  const lead=(await query(
    "SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2 AND member_role='Lead'",
    [assignmentId,user.id]
  )).rowCount>0

  if(lead)return {all:true,userIds:[user.id],mode:'lead'}

  const related=(await query(
    `SELECT 1
       FROM assignments a
      WHERE a.id=$1
        AND(
          EXISTS(
            SELECT 1
              FROM assignment_members am
             WHERE am.assignment_id=a.id
               AND am.user_id=$2
          )
          OR EXISTS(
            SELECT 1
              FROM assignment_tasks t
             WHERE t.assignment_id=a.id
               AND t.archived_at IS NULL
               AND(t.owner_id=$2 OR t.reviewer_id=$2)
          )
        )
      LIMIT 1`,
    [assignmentId,user.id]
  )).rowCount>0

  return related
    ? {all:false,userIds:[user.id],mode:'self'}
    : {all:false,userIds:[],mode:'none'}
}

export async function canManageResearch(user,researchId){
  if(isOrganisationScopeRole(user.role))return true
  if(!isTeamScopeRole(user.role))return false
  const result=await query(`WITH RECURSIVE managed AS(
    SELECT id FROM users WHERE id=$1 AND active=TRUE
    UNION ALL SELECT u.id FROM users u JOIN managed m ON u.supervisor_id=m.id WHERE u.active=TRUE
  )
  SELECT 1 FROM research_projects p WHERE p.id=$2 AND(
    p.lead_id IN(SELECT id FROM managed)
    OR EXISTS(SELECT 1 FROM research_collaborators rc WHERE rc.project_id=p.id AND rc.user_id IN(SELECT id FROM managed))
    OR EXISTS(SELECT 1 FROM research_reviewers rr WHERE rr.project_id=p.id AND rr.reviewer_id IN(SELECT id FROM managed) AND rr.active=TRUE)
    OR EXISTS(SELECT 1 FROM research_milestones rm WHERE rm.project_id=p.id AND rm.owner_id IN(SELECT id FROM managed))
  )`,[user.id,researchId])
  return result.rowCount>0
}

export async function canManageKnowledge(user,knowledgeId){
  if(isOrganisationScopeRole(user.role))return true
  if(!isTeamScopeRole(user.role))return false
  const result=await query(`WITH RECURSIVE managed AS(
    SELECT id FROM users WHERE id=$1 AND active=TRUE
    UNION ALL SELECT u.id FROM users u JOIN managed m ON u.supervisor_id=m.id WHERE u.active=TRUE
  )
  SELECT 1 FROM knowledge_items k WHERE k.id=$2 AND(
    k.created_by IN(SELECT id FROM managed)
    OR k.reviewer_id IN(SELECT id FROM managed)
    OR k.approved_by IN(SELECT id FROM managed)
    OR EXISTS(
      SELECT 1 FROM repository_entity_links rel
      WHERE rel.knowledge_id=k.id AND(
        (rel.entity_type='assignment' AND EXISTS(SELECT 1 FROM assignment_members am WHERE am.assignment_id=rel.entity_id AND am.user_id IN(SELECT id FROM managed)))
        OR (rel.entity_type='task' AND EXISTS(SELECT 1 FROM assignment_tasks t WHERE t.id=rel.entity_id AND(t.owner_id IN(SELECT id FROM managed) OR t.reviewer_id IN(SELECT id FROM managed))))
        OR (rel.entity_type='research' AND EXISTS(SELECT 1 FROM research_projects p WHERE p.id=rel.entity_id AND(p.lead_id IN(SELECT id FROM managed) OR EXISTS(SELECT 1 FROM research_collaborators rc WHERE rc.project_id=p.id AND rc.user_id IN(SELECT id FROM managed)))))
      )
    )
  )`,[user.id,knowledgeId])
  return result.rowCount>0
}

export async function canManageEntity(user,kind,id){
  if(kind==='assignment')return canManageAssignment(user,id)
  if(kind==='research')return canManageResearch(user,id)
  if(kind==='knowledge')return canManageKnowledge(user,id)
  if(kind==='user')return canManageUser(user,id)
  return isOrganisationScopeRole(user.role)
}

export async function userApprovedLeaveConflict(userId,startDate,endDate){
  if(!userId||!startDate||!endDate)return null
  return (await query(`SELECT lr.id,lr.start_date,lr.end_date,lt.name leave_type_name FROM leave_requests lr
    JOIN leave_types lt ON lt.code=lr.leave_type_code WHERE lr.user_id=$1 AND lr.status='Approved'
    AND daterange(lr.start_date,lr.end_date,'[]') && daterange($2::date,$3::date,'[]')
    ORDER BY lr.start_date LIMIT 1`,[userId,startDate,endDate])).rows[0]||null
}

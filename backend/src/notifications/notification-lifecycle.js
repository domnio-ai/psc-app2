/** Close non-review notifications when their linked work reaches a terminal state. */
export async function closeCompletedWorkNotifications(run,userId){
  return run(`UPDATE notifications n SET
      archived_at=COALESCE(n.archived_at,NOW()),
      closed_at=COALESCE(n.closed_at,NOW()),
      close_reason='Work completed'
    WHERE n.user_id=$1 AND n.closed_at IS NULL
      AND COALESCE(n.notification_category,'')<>'Review'
      AND(
        (n.entity_type IN('assignment','assignment_status','assignment_due','assignment_overdue','assignment_completed')
          AND EXISTS(SELECT 1 FROM assignments a WHERE a.id::text=n.entity_id AND(
            a.status='Completed' OR EXISTS(SELECT 1 FROM repository_entity_links rel
              JOIN knowledge_items k ON k.id=rel.knowledge_id
              WHERE rel.entity_type='assignment' AND rel.entity_id=a.id
                AND k.document_type='Assignment Final Report' AND k.status='Published' AND COALESCE(k.is_archived,FALSE)=FALSE))))
        OR(n.entity_type='assignment_task'
          AND EXISTS(SELECT 1 FROM assignment_tasks t WHERE t.id::text=n.entity_id AND(
            t.status='Completed' OR t.archived_at IS NOT NULL OR t.contribution_status='Integrated' OR EXISTS(
              SELECT 1 FROM repository_entity_links rel JOIN knowledge_items k ON k.id=rel.knowledge_id
              WHERE rel.entity_type='task' AND rel.entity_id=t.id
                AND k.document_type='Task Final Report' AND k.status='Published' AND COALESCE(k.is_archived,FALSE)=FALSE))))
        OR(n.entity_type='research'
          AND EXISTS(SELECT 1 FROM research_projects p WHERE p.id::text=n.entity_id AND(
            p.status IN('Completed','Archived') OR EXISTS(SELECT 1 FROM repository_entity_links rel
              JOIN knowledge_items k ON k.id=rel.knowledge_id
              WHERE rel.entity_type='research' AND rel.entity_id=p.id
                AND k.document_type='Research Final Report' AND k.status='Published' AND COALESCE(k.is_archived,FALSE)=FALSE))))
        OR(n.entity_type IN('knowledge','document') AND EXISTS(
          SELECT 1 FROM knowledge_items k WHERE k.id::text=n.entity_id AND k.status='Published' AND COALESCE(k.is_archived,FALSE)=FALSE))
        OR(n.entity_type='meeting'
          AND EXISTS(SELECT 1 FROM meetings m WHERE m.id::text=n.entity_id AND m.status='Completed'))
      )`,[userId])
}

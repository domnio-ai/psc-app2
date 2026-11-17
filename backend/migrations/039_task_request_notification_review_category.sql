-- APP2 Task Request Notifications: route pending approval notices to Reviews & Approvals.
-- Additive: preserves the existing notification schema and previously applied migrations.
-- Historical notifications are reclassified in-app only; this migration does not queue email.

CREATE OR REPLACE FUNCTION app2_notification_category(
  p_title TEXT,
  p_entity_type TEXT,
  p_reminder_kind TEXT DEFAULT NULL
) RETURNS VARCHAR
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_reminder_kind,'')<>'' THEN 'Reminder'
    WHEN COALESCE(p_title,'') IN (
      'Assignment report review assigned',
      'Research section requires approval',
      'Research report awaiting review',
      'Draft research report ready for review',
      'Document awaiting review',
      'Document review assigned',
      'Research review assigned',
      'Document deletion approval required',
      'Document improvement reviewer assigned',
      'Assignment proposal awaiting approval',
      'Task request awaiting approval'
    ) THEN 'Review'
    WHEN COALESCE(p_title,'') IN (
      'New research assignment',
      'New approved research assignment',
      'Research lead assignment',
      'Research project assigned',
      'Assigned task',
      'Research final report ready to publish',
      'Assignment report changes requested',
      'Assignment report rejected',
      'Research report changes requested',
      'Research report rejected',
      'Document returned for correction',
      'Document deletion rejected',
      'Document improvement assigned'
    ) THEN 'Action'
    WHEN COALESCE(p_title,'') ~* '(due soon|due tomorrow|overdue|milestone due|milestone overdue|review due soon|review overdue|disposition action due|improvement overdue)$'
      THEN 'Reminder'
    ELSE 'Information'
  END
$$;

-- Reclassify historical task-request notifications without sending email retroactively.
UPDATE notifications
SET notification_category='Review',
    priority=CASE WHEN priority='Critical' THEN 'Critical' ELSE 'High' END,
    important_at=COALESCE(important_at,NOW()),
    email_eligible=FALSE,
    email_status=CASE WHEN email_sent_at IS NOT NULL THEN 'Sent' ELSE 'Not Required' END,
    next_email_attempt_at=NULL
WHERE entity_type='assignment_task_request'
  AND title='Task request awaiting approval'
  AND email_sent_at IS NULL;

-- Preserve delivery audit on any matching notification whose email was already sent.
UPDATE notifications
SET notification_category='Review',
    priority=CASE WHEN priority='Critical' THEN 'Critical' ELSE 'High' END,
    important_at=COALESCE(important_at,NOW())
WHERE entity_type='assignment_task_request'
  AND title='Task request awaiting approval'
  AND email_sent_at IS NOT NULL;

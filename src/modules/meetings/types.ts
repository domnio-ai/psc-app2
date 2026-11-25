export type MeetingUser = { id: string; name: string; email?: string | null; role: string; division?: string | null };
export type MeetingScheduleApprover = { id: string; name: string; role: string; source: "Supervisor" | "Appointed approver"; appointment_id?: string | null; expires_at?: string | null };
export type MeetingScheduleApprovalItem = { id: string; title: string; meeting_type: string; description: string; start_at: string; end_at: string | null; venue: string | null; meeting_link: string | null; resource_links?: string[] | null; created_by: string; created_by_name: string; schedule_approver_id: string; schedule_approval_submitted_at: string; participant_count: number };
export type MeetingApprovalAppointment = { id: string; subject_user_id: string; subject_name: string; approver_user_id: string; approver_name: string; appointed_by: string; expires_at: string; revoked_at: string | null; created_at: string };

export type MeetingSummary = {
  id: string;
  title: string;
  meeting_type: string;
  description: string;
  start_at: string;
  end_at: string | null;
  venue: string | null;
  meeting_link: string | null;
  resource_links?: string[] | null;
  schedule_approval_status?: "Pending Approval" | "Approved" | "Returned" | "Rejected" | string;
  schedule_approver_id?: string | null;
  schedule_approval_comments?: string | null;
  schedule_approval_submitted_at?: string | null;
  // APP2_UNIVERSAL_MEETING_HISTORY_OPTION_B_R3
  schedule_approval_decided_by?: string | null;
  schedule_approval_decided_at?: string | null;
  status: string;
  created_by: string;
  created_by_name: string;
  chair_id: string | null;
  chair_name: string | null;
  secretary_id: string | null;
  secretary_name: string | null;
  reviewer_id: string | null;
  reviewer_name: string | null;
  participant_count: number;
  agenda_count: number;
  action_count: number;
  open_action_count: number;
  transcript_status: string | null;
  minutes_status: string | null;
  can_manage: boolean;
};

export type MeetingParticipant = {
  id: string;
  meeting_id: string;
  user_id: string | null;
  user_name: string | null;
  user_email?: string | null;
  guest_name: string | null;
  guest_email: string | null;
  participant_role: string;
  response_status: string;
  attendance_status: string;
};

export type AgendaItem = {
  id: string;
  meeting_id: string;
  item_no: number;
  title: string;
  background: string;
  owner_id: string | null;
  owner_name: string | null;
  duration_minutes: number | null;
  status: string;
};

export type TranscriptSegment = {
  id: string;
  segment_no: number;
  start_seconds: number;
  end_seconds: number;
  speaker_label: string | null;
  text: string;
  corrected_text: string | null;
};

export type TranscriptJob = {
  id: string;
  meeting_id: string;
  status: string;
  original_filename: string;
  language: string | null;
  model_name: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  segments: TranscriptSegment[];
};

export type MeetingMinute = {
  id: string;
  meeting_id: string;
  version_no: number;
  status: string;
  content: string;
  reviewer_id: string | null;
  reviewer_name: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  review_comments: string | null;
  updated_at: string;
  repository_document_id?: string | null;
  repository_document_title?: string | null;
  repository_document_status?: string | null;
  repository_record_number?: string | null;
  repository_version?: number | null;
  repository_minutes_version?: number | null;
  repository_draft_document_id?: string | null;
  repository_draft_document_title?: string | null;
  repository_draft_document_status?: string | null;
  repository_draft_version?: number | null;
  repository_draft_updated_at?: string | null;
};

export type MeetingAction = {
  id: string;
  meeting_id: string;
  title: string;
  description: string;
  owner_id: string | null;
  owner_name: string | null;
  due_date: string | null;
  status: string;
  assignment_task_id?: string | null;
  linked_task_id?: string | null;
  linked_task_title?: string | null;
  linked_task_status?: string | null;
  linked_task_progress?: number | null;
  linked_assignment_title?: string | null;
};

export type MeetingTaskLinkOption = {
  id: string;
  assignment_id: string;
  title: string;
  description: string;
  owner_id: string | null;
  owner_name: string | null;
  reviewer_id: string | null;
  reviewer_name: string | null;
  due_date: string | null;
  status: string;
  progress: number;
  assignment_title: string;
};

export type MeetingAttachment = {
  id: string;
  meeting_id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  uploaded_by_name?: string | null;
  created_at: string;
};

export type MeetingDecision = {
  id: string;
  meeting_id: string;
  decision_no: number;
  text: string;
  agenda_item_id: string | null;
};

export type MeetingInvitationDelivery = {
  inApp: number;
  emailSent: number;
  emailFailed: number;
  emailSkipped: number;
  status: string;
};

export type MeetingDetail = MeetingSummary & {
  invitation_delivery?: MeetingInvitationDelivery;
  participants: MeetingParticipant[];
  agenda: AgendaItem[];
  transcript: TranscriptJob | null;
  minutes: MeetingMinute | null;
  actions: MeetingAction[];
  decisions: MeetingDecision[];
  supporting_documents: MeetingAttachment[];
};

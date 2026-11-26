const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
const AI_API_URL = import.meta.env.VITE_AI_API_URL || `${API_URL}/felix`;
const TASKS_READ_SOURCE = (
  import.meta.env.VITE_TASKS_READ_SOURCE || "node"
).trim().toLowerCase();
const TASKS_SHADOW_API_URL = (
  import.meta.env.VITE_TASKS_SHADOW_API_URL || "http://127.0.0.1:8010/api"
).replace(/\/+$/, "");
let unauthorizedHandler: (() => void) | null = null;

export type PermanentAccountRole =
  | "System Admin"
  | "Director"
  | "Deputy Director"
  | "Assistant Director"
  | "Researcher";

export type ResearchTeamRole = PermanentAccountRole | "Reviewer";

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: PermanentAccountRole;
  division: string;
  status: string;
  active: boolean;
  must_change_password?: boolean;
  active_assignments?: number;
  completed_assignments?: number;
  supervisor_id?: string | null;
  supervisor_name?: string | null;
  supervisor_role?: string | null;
  availability_status?: string | null;
  leave_type_name?: string | null;
  leave_start_date?: string | null;
  leave_end_date?: string | null;
};
export type LeaveType = {code:string;name:string;default_entitlement_days:number|null;paid:boolean;requires_document:boolean};
export type LeaveRequest = {id:string;user_id:string;user_name?:string;user_email?:string;user_role?:string;division?:string;leave_type_code:string;leave_type_name:string;start_date:string;end_date:string;working_days:number;reason:string;status:"Pending"|"Approved"|"Returned"|"Rejected"|"Cancelled";approver_name?:string|null;decision_note?:string|null;submitted_at:string;decided_at?:string|null;currently_on_leave?:boolean};
export type LeaveBalance = {code:string;name:string;entitlement_days:number|null;adjustment_days:number;used_days:number;remaining_days:number|null};

export type ApiAssignment = {
  id: string;
  title: string;
  description: string;
  objective?: string;
  scope?: string;
  instructions?: string;
  expected_output?: string;
  division: string;
  start_date?: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  research_id?: string | null;
  research_title?: string | null;
  research_relation_type?: string | null;
  workflow_status?: string;
  final_report_status?: string | null;
  task_count?: number;
  completed_task_count?: number;
  accepted_task_report_count?: number;
  members: {
    id: string;
    name: string;
    role: string;
    supervisor_id?: string | null;
    supervisor_name?: string | null;
    supervisor_role?: string | null;
  }[];
};
export type ApiAssignmentSection = {
  id: string;
  assignment_id: string;
  title: string;
  description: string;
  section_order: number;
  lead_id: string | null;
  lead_name: string | null;
  start_date: string | null;
  due_date: string | null;
  status:
    | "Not Started"
    | "In Progress"
    | "Blocked"
    | "Ready for Integration"
    | "Completed";
  progress: number;
  is_mandatory: boolean;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  archived_by: string | null;
};
export type AssignmentSectionInput = {
  title: string;
  description: string;
  leadId: string | null;
  startDate: string | null;
  dueDate: string | null;
  status: ApiAssignmentSection["status"];
  progress: number;
  isMandatory: boolean;
};
export type AssignmentInput = {
  title: string;
  description: string;
  objective: string;
  scope: string;
  instructions: string;
  expectedOutput: string;
  division: string;
  startDate: string | null;
  dueDate: string | null;
  priority: string;
  memberIds: string[];
  leadId?: string | null;
};
export type ApiAttachment = {
  id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  uploader_name: string;
};
export type ApiHistory = {
  id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  user_name: string;
};
export type ApiAssignmentTask = {
  id: string;
  assignment_id: string;
  title: string;
  description: string;
  owner_id: string | null;
  owner_name: string | null;
  priority: string;
  status: string;
  progress: number;
  start_date: string | null;
  due_date: string | null;
  notes: string;
  expected_contribution: string;
  assignment_part: string;
  target_document_id: string | null;
  target_document_title: string | null;
  target_section_id: string | null;
  target_section_title: string | null;
  assignment_section_id: string | null;
  assignment_section_title: string | null;
  task_purpose: string;
  specific_instructions: string;
  expected_findings: string;
  expected_output: string;
  evidence_required: string;
  reviewer_id: string | null;
  reviewer_name?: string | null;
  contribution_title: string;
  contribution_summary: string;
  contribution_findings: string;
  contribution_recommendations: string;
  evidence_reviewed: string;
  contribution_challenges: string;
  contribution_next_actions: string;
  contribution_status:
    | "Draft"
    | "Ready for Integration"
    | "Integrated"
    | "Accepted";
  contribution_section_statuses: Record<
    string,
    "Draft" | "In Review" | "Final"
  >;
  contribution_updated_at: string | null;
  contribution_ready_at: string | null;
  contribution_integrated_at: string | null;
  contribution_report_html?: string;
  contribution_report_version?: number;
  contribution_report_generated_at?: string | null;
  report_mode?: "structured" | "blank";
  blank_content?: string;
  repository_document_id?: string | null;
  repository_document_title?: string | null;
  repository_sync_job_id?: number | null;
  repository_sync_status?: "pending" | "processing" | "retry" | "done" | "dead" | "unavailable" | "not_requested";
  repository_sync_error?: string;
  repository_sync_message?: string;
  repository_draft_id?: string | null;
  repository_draft_version?: number | null;
  persistence_status?: "saved";
  persistence_warning?: string;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  archived_by?: string | null;
  assignment_title?: string;
  assignment_description?: string;
  assignment_division?: string;
  assignment_status?: string;
  assignment_priority?: string;
  assignment_due_date?: string | null;
  assignment_lead_name?: string | null;
};
export type ApiAssignmentTaskRequest = {
  id: string;
  assignment_id: string;
  requested_by: string;
  requested_by_name: string;
  title: string;
  description: string;
  suggested_owner_id: string | null;
  suggested_owner_name: string | null;
  priority: string;
  due_date: string | null;
  reason: string;
  status: "Pending" | "Approved" | "Rejected" | "Withdrawn";
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_comments: string;
  task_id: string | null;
  task_title: string | null;
  created_at: string;
  updated_at: string;
  assignment_title?: string;
  assignment_due_date?: string | null;
  can_decide?: boolean;
  is_mine?: boolean;
};

export type ApiTaskRequestAssignment = {
  id: string;
  title: string;
  due_date: string | null;
  priority: string;
  members: {
    id: string;
    name: string;
    role: string;
    division: string | null;
    member_role: string;
  }[];
};
export type ApiTaskRequestReviewer = {
  id: string;
  name: string;
  role: string;
  division: string | null;
  relation: string;
};
export type ApiAssignmentMemberRequest = {
  id: string;
  assignment_id: string;
  requested_by: string;
  requested_by_name: string;
  requested_user_id: string;
  requested_user_name: string;
  requested_user_role: string;
  requested_user_division: string | null;
  reason: string;
  status: "Pending" | "Approved" | "Rejected" | "Withdrawn";
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  review_comments: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};
export type ApiAssignmentReview = {
  id: string;
  assignment_id: string;
  reviewer_id: string;
  reviewer_name: string;
  decision: "Submitted" | "Under Review" | "Changes Requested" | "Approved";
  comments: string;
  created_at: string;
};
export type KnowledgeItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  category_id?: string | null;
  directorate?: string | null;
  document_type?: string;
  subject?: string;
  author?: string | null;
  document_date?: string | null;
  classification?: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
  felix_enabled?: boolean;
  is_archived?: boolean;
  current_version?: number;
  current_version_id?: string | null;
  tags: string[];
  status: string;
  assignment_id: string | null;
  created_at: string;
  updated_at?: string | null;
  reviewed_at?: string | null;
  created_by?: string | null;
  created_by_name: string;
  latest_version: number;
  original_name: string;
  size_bytes: number;
  source_type: string;
  source_url: string;
  reviewer_id?: string | null;
  reviewer_name?: string | null;
  reviewed_by_name?: string | null;
  approved_by_name?: string | null;
  origin_links?: {
    type: "assignment" | "task" | "research" | "report";
    id: string;
    title: string | null;
  }[];
  worked_by?: string[];
  assignments?: { id: string; title: string }[];
};
export type KnowledgeVersion = {
  id: string;
  version_number: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  updated_at?: string | null;
  reviewed_at?: string | null;
  created_by?: string | null;
  created_by_name: string;
};
export type ExternalResearchImportReviewer = {
  id: string;
  reviewer_id: string;
  name: string;
  role: string;
  division: string;
  assigned_at: string;
};
export type ExternalResearchImportReview = {
  id: string;
  version_number: number;
  reviewer_id: string;
  reviewer_name: string;
  decision: "Review Started" | "Revision Requested" | "Resubmitted" | "Approved" | "Rejected";
  notes: string;
  created_at: string;
};
export type ExternalResearchImportVersion = {
  id: string;
  version_number: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  notes: string;
  created_at: string;
  uploader_name: string;
  is_current: boolean;
};
export type ExternalResearchImport = {
  id: string;
  knowledge_id: string;
  submitted_by: string;
  submitted_by_name: string;
  institution: string | null;
  research_type: string;
  status: "Pending Review" | "Under Review" | "Revision Requested" | "Resubmitted" | "Published" | "Rejected";
  revision_ready: boolean;
  submitted_at: string;
  updated_at: string;
  published_at: string | null;
  title: string;
  description: string;
  author: string | null;
  document_date: string | null;
  directorate: string | null;
  classification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
  tags: string[];
  current_version: number;
  current_version_id: string | null;
  original_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  felix_enabled: boolean;
  document_status: string;
  reviewers: ExternalResearchImportReviewer[];
  reviews?: ExternalResearchImportReview[];
  versions?: ExternalResearchImportVersion[];
  can_review: boolean;
  can_upload_revision: boolean;
};
export type ExternalResearchImportInput = {
  title: string;
  description: string;
  author: string;
  institution: string;
  directorate: string;
  researchType: string;
  researchDate: string;
  tags: string;
  classification: string;
  reviewerIds: string[];
  felixEnabled: boolean;
};

export type ResearchProject = {
  id: string;
  title: string;
  summary: string;
  research_question: string;
  objectives: string;
  methodology: string;
  status: string;
  workflow_status?: string;
  can_manage?: boolean;
  start_date: string | null;
  end_date: string | null;
  assignment_id: string | null;
  lead_id: string;
  lead_name: string;
  oversight_manager_id?: string | null;
  oversight_manager_name?: string | null;
  oversight_manager_role?: string | null;
  collaborators: { id: string; name: string; role: string }[];
  reviewers: {
    id: string;
    reviewer_id: string;
    name: string;
    role: string;
    division: string;
    review_role: string;
    assigned_at: string;
  }[];
  assignments: {
    id: string;
    title: string;
    description: string;
    division: string;
    due_date: string | null;
    priority: string;
    status: string;
    relation_type: string;
    linked_at: string;
  }[];
  assignment_requests: {
    id: string;
    title: string;
    description: string;
    division: string;
    due_date: string | null;
    priority: string;
    member_ids: string[];
    status: "Pending Approval" | "Approved" | "Rejected";
    requested_by: string;
    requested_by_name: string;
    decision_comment: string;
    assignment_id: string | null;
    created_at: string;
  }[];
  milestones: {
    id: string;
    title: string;
    description: string;
    owner_id: string;
    owner_name: string;
    due_date: string;
    priority: "Low" | "Normal" | "High" | "Critical";
    status: "Pending" | "In Progress" | "Completed";
  }[];
};
export type ResearchMilestoneTask = {
  id: string;
  assignment_id: string;
  title: string;
  status: string;
  progress: number;
  due_date: string | null;
  owner_id: string | null;
  owner_name: string | null;
  reviewer_id: string | null;
  reviewer_name: string | null;
  assignment_title: string;
  linked: boolean;
};

export type ResearchScopeView = "my" | "team" | "reviews";

export type ResearchSource = {
  id: string;
  project_id: string;
  source_type: string;
  title: string;
  author: string;
  publisher: string;
  publication_date: string | null;
  url: string;
  identifier: string;
  notes: string;
  provenance:
    | "Internal"
    | "External"
    | "Primary Evidence"
    | "Secondary Evidence";
  quality: "Unrated" | "Low" | "Moderate" | "High";
  relevance: "Background" | "Supporting" | "Core";
  created_by_name: string;
  created_at: string;
};
export type ResearchRepositoryDocument = {
  id: string;
  title: string;
  description: string;
  category: string;
  document_type?: string;
  subject?: string;
  classification?: string;
  status: string;
  current_version?: number;
  latest_version: number;
  original_name: string;
  created_by_name: string;
  linked_by_name?: string | null;
  linked_at: string;
};
export type ResearchActivity = {
  id: number;
  action: string;
  details: Record<string, unknown>;
  user_name: string | null;
  created_at: string;
};
export type DocumentTemplate = {
  id: string;
  template_key: string;
  name: string;
  context: "Assignment" | "Research";
  description: string;
  sections: { key: string; title: string }[];
  version: number;
  governance_status: "Draft" | "Standard" | "Approved" | "Retired";
  active: boolean;
  created_by_name?: string;
  approved_by_name?: string;
};
export type GeneratedDocumentSummary = {
  id: string;
  template_id: string;
  template_name: string;
  template_key?: string;
  template_version: number;
  context: "Assignment" | "Research";
  context_id: string;
  title: string;
  reference: string;
  classification: string;
  status: string;
  version: number;
  created_by?: string;
  created_by_name: string;
  reviewer_id?: string | null;
  reviewer_name?: string | null;
  section_count?: number;
  ready_sections?: number;
  repository_document_id?: string | null;
  repository_document_title?: string | null;
  project_status?: string;
  external_import_id?: string | null;
  external_import_name?: string | null;
  external_import_mime_type?: string | null;
  external_import_version?: number | null;
  external_import_status?: string | null;
  created_at: string;
  updated_at: string;
};
export type GeneratedDocumentSection = {
  id: string;
  section_key: string;
  title: string;
  section_order: number;
  content: string;
  completion: number;
  section_status:
    | "Not Started"
    | "In Progress"
    | "Ready"
    | "Needs Changes"
    | "Complete";
  owner_id: string | null;
  owner_name?: string;
  updated_by_name?: string;
  updated_at: string;
  locked_by_name?: string;
  lock_expires_at?: string;
};
export type ExternalAssignmentReportImport = {
  id: string;
  version_number: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  sha256_hash: string;
  status: string;
  created_at: string;
  uploader_name?: string;
};

export type GeneratedDocument = GeneratedDocumentSummary & {
  template_status: string;
  current_user_role?: "Lead" | "Contributor" | "Reviewer" | "Manager" | null;
  can_edit_report?: boolean;
  can_submit_report?: boolean;
  can_review_report?: boolean;
  can_finalize_report?: boolean;
  external_import?: ExternalAssignmentReportImport | null;
  reviewer_name?: string;
  submitted_by_name?: string;
  submitted_at?: string;
  approved_by_name?: string;
  approved_at?: string;
  sections: GeneratedDocumentSection[];
};
export type GeneratedDocumentControl = {
  versions: {
    id: string;
    version_number: number;
    status: string;
    change_note: string;
    created_by_name: string;
    created_at: string;
  }[];
  reviews: {
    id: string;
    version_number: number;
    decision: string;
    comments: string;
    reviewer_name: string;
    created_at: string;
  }[];
  comments: {
    id: string;
    body: string;
    author_name: string;
    section_title?: string;
    resolved: boolean;
    created_at: string;
  }[];
  references: {
    id: string;
    source_type: string;
    title: string;
    author: string;
    publication_year: number | null;
    publisher: string;
    url: string;
    identifier: string;
    citation_style: "APA" | "Harvard" | "Chicago";
  }[];
};
export type AiResearchEngine = {
  mode: string;
  provider: string;
  ollamaConnected: boolean;
  gptResearcherConnected: boolean;
  researchMateConnected: boolean;
  paidProvidersEnabled: boolean;
  offline: boolean;
  scope: string;
};
export type FelixAction = {
  type:
    | "navigate"
    | "draft_notice"
    | "draft_assignment"
    | "update_assignment_status";
  label: string;
  target: string;
  payload: Record<string, string>;
};
export type FelixMode = "Auto" | "Research" | "App2 Expert" | "Code Review";
export type FelixAdviceContext = "Assignment" | "Research" | "Report";
export type FelixAdviceResponse = {
  context_type: FelixAdviceContext;
  adviser: "Professor Felix";
  role: "Senior Research Professor and Institutional Adviser";
  deterministic: true;
  used_llm: false;
  headline: string;
  summary: string;
  priorities: string[];
  warnings: string[];
  next_actions: string[];
};
export type FelixFinding = {
  finding_id: string;
  severity: "Critical" | "High" | "Medium" | "Low" | "Informational";
  confidence: "High" | "Medium" | "Low";
  category: string;
  repository: string;
  branch: string;
  commit: string;
  file_path: string;
  start_line: number;
  end_line: number;
  evidence: string;
  description: string;
  impact: string;
  recommended_correction: string;
  proposed_patch: string | null;
  suggested_tests: string;
  review_status: string;
};
export type ChangeProposal = {
  id: string;
  finding_id: string;
  severity: string;
  category: string;
  description: string;
  proposed_by: string;
  proposed_by_name: string;
  repository: string;
  branch: string;
  commit_hash: string;
  file_path: string;
  patch: string;
  rationale: string;
  risk_level: string;
  status:
    | "Pending Approval"
    | "Approved"
    | "Rejected"
    | "Superseded"
    | "Applied"
    | "Application Failed";
  application_status: "Not Applied" | "Applied" | "Failed";
  created_at: string;
  events: {
    action: string;
    actor_name: string;
    comments: string;
    created_at: string;
  }[];
};
export type FelixResponse = {
  answer: string;
  model: string;
  mode?: FelixMode | "APP2_OPERATION" | "KNOWLEDGE_SEARCH" | "REASONING";
  intent?: string;
  sources?: Record<string, unknown>[];
  metadata?: {
    used_llm: boolean;
    response_ms?: number;
    timings_ms?: Record<string, number>;
    selected_tool?: string | null;
  };
  retrieval?: {
    mode: "document" | "repository";
    requested_document_id: string | null;
    document_name: string | null;
    approval_status: string | null;
    chunks_retrieved: number;
    pages_used: number[];
    source_document_ids: string[];
    scope_valid: boolean;
  };
  references?: string[];
  action?: FelixAction;
  report?: boolean;
  confidence?: "High" | "Moderate" | "Low";
  citationValidation?: {
    citation: number;
    label: string;
    supported: boolean;
    score: number;
  }[];
  repository?: string;
  branch?: string;
  commit?: string;
  reviewRunId?: string;
  findings?: FelixFinding[];
  toolResults?: {
    tool: string;
    command_label: string;
    status: string;
    exit_code: number | null;
    duration_ms: number;
    output: string;
  }[];
};
export type ScheduledReviewJob = {
  id: string;
  name: string;
  trigger_type: "Commit" | "Pull Request" | "Nightly" | "Weekly";
  profile: string;
  enabled: boolean;
  interval_minutes: number | null;
  schedule_time: string | null;
  schedule_weekday: number | null;
  next_run_at: string | null;
  last_run_at: string | null;
};
export type ScheduledReviewRun = {
  id: string;
  job_id: string | null;
  trigger_source: string;
  repository: string;
  branch: string;
  commit_hash: string;
  profile: string;
  status: "Running" | "Completed" | "Failed";
  report: string;
  started_at: string;
  completed_at: string | null;
  error_message?: string;
};
export type ScheduledReviews = {
  profiles: Record<string, string[]>;
  jobs: ScheduledReviewJob[];
  runs: ScheduledReviewRun[];
};
export type FelixAuditEvent = {
  id: number;
  event_type: string;
  user_id: string | null;
  user_name: string | null;
  occurred_at: string;
  operating_mode: string;
  query: string;
  retrieved_documents: string[];
  retrieved_code_files: string[];
  repository: string | null;
  branch: string | null;
  commit_hash: string | null;
  tools_executed: Record<string, unknown>[];
  generated_response: string;
  findings: Record<string, unknown>[];
  proposed_patches: string[];
  approval_action: Record<string, unknown> | null;
  test_results: Record<string, unknown>[];
  final_outcome: string;
  metadata: Record<string, unknown>;
};
export type FelixAdminOverview = {
  engine: AiResearchEngine & { model: string };
  documents: {
    indexed_documents: number;
    indexed_chunks: number;
    last_document_indexed_at: string | null;
  };
  repositories: {
    id: string;
    name: string;
    branch: string | null;
    commit_hash: string | null;
    last_indexed_at: string | null;
    indexed_files: number;
  }[];
  liveRepository: { repository: string; branch: string; commit: string };
  failedIndexingJobs: {
    id: string;
    started_at: string;
    error_message: string | null;
  }[];
  quality: {
    research: {
      total: number;
      approved: number;
      failed: number;
      draft_ready: number;
    };
    citations: { total: number; supported: number; average_score: number };
  };
  findings: {
    finding_id: string;
    severity: string;
    confidence: string;
    category: string;
    file_path: string;
    start_line: number;
    description: string;
    impact: string;
    review_status: string;
    created_at: string;
  }[];
  securityFindings: {
    finding_id: string;
    severity: string;
    category: string;
    description: string;
    file_path: string;
    created_at: string;
  }[];
  dependencyAlerts: {
    profile: string;
    started_at: string;
    command_label: string;
    status: string;
    output?: string;
  }[];
  testResults: {
    profile: string;
    started_at: string;
    command_label: string;
    status: string;
    duration_ms?: number;
  }[];
  reviewSchedules: ScheduledReviewJob[];
  reviewRuns: ScheduledReviewRun[];
  pendingApprovals: {
    id: string;
    file_path: string;
    risk_level: string;
    proposed_by_name: string;
    created_at: string;
    status: string;
    application_status: string;
  }[];
  auditEvents: {
    id: number;
    event_type: string;
    user_name: string | null;
    occurred_at: string;
    operating_mode: string;
    query: string;
    final_outcome: string;
  }[];
};
export type AiResearchJob = {
  id: string;
  title: string;
  question: string;
  scope: string;
  source_mode: string;
  depth: string;
  provider: string;
  status: string;
  progress: number;
  plan: { step: number; title: string; description: string }[];
  draft_report: string;
  error_message?: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  sources: {
    id: string;
    title: string;
    url?: string;
    excerpt: string;
    citation_number: number;
  }[];
  events: {
    id: number;
    event: string;
    details: Record<string, unknown>;
    created_at: string;
  }[];
};
export type DocumentItem = KnowledgeItem & {
  locked_by_name?: string;
  locked_at?: string;
  expires_at?: string;
  retention_until?: string;
  record_number?: string | null;
  record_class?: string | null;
  records_lifecycle_state?: "Working Document" | "Under Improvement" | "Under Review" | "Active Record" | "Superseded" | "Archived" | "Disposition Review";
  review_due_at?: string | null;
  legal_hold?: boolean;
  legal_hold_reason?: string | null;
  declared_at?: string | null;
  declared_by?: string | null;
  supersedes_id?: string | null;
  disposition_action?: "Review" | "Destroy" | "Transfer" | "Permanent";
  disposition_notes?: string | null;
  protection_scope?: string | null;
  retention_schedule_id?: string | null;
  next_review_at?: string | null;
  superseded_by?: string | null;
  superseded_at?: string | null;
  felix_index_status?: "Pending" | "Processing" | "Completed" | "Failed" | null;
  felix_index_attempts?: number | null;
  felix_index_error?: string | null;
  felix_index_updated_at?: string | null;
};
export type ReportDefinition = {
  key: string;
  title: string;
  description: string;
  category: string;
  level: "OPERATIONAL" | "EXECUTIVE" | "BOTH";
  permission: string;
  filters: string[];
  frequency: string;
  enabled: boolean;
  available: boolean;
  unavailableReason?: string;
  favourite: boolean;
};
export type ReportKpi = {
  key: string;
  label: string;
  value: string | number;
  status: "neutral" | "good" | "warning" | "danger";
  comparison?: string | number | null;
  available: boolean;
};
export type ReportChart = {
  key: string;
  title: string;
  type: "donut" | "bar" | "horizontal-bar" | "line";
  series: {
    label: string;
    value?: number;
    received?: number;
    completed?: number;
    id?: string;
  }[];
  drillField?: string | null;
};
export type ReportData = {
  report: ReportDefinition;
  filters: Record<string, unknown>;
  period: { from: string | null; to: string | null };
  kpis: ReportKpi[];
  charts: ReportChart[];
  columns: string[];
  rows: Record<string, unknown>[];
  pagination: { page: number; pageSize: number; total: number; pages: number };
  generatedAt: string;
  scope: { type: string; division: string | null; userId: string | null };
  available: boolean;
  notices?: string[];
  sections?: {
    key: string;
    title: string;
    rows: Record<string, unknown>[];
    message?: string;
  }[];
};
export type ReportView = {
  id: string;
  name: string;
  filters: Record<string, string | number | boolean>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type ReportSchedule = {
  id: string;
  owner_id: string;
  report_key: string;
  name: string;
  format: "pdf" | "docx" | "xlsx";
  frequency: "Daily" | "Weekly" | "Monthly";
  recipient_emails: string[];
  filters: Record<string, string | number | boolean>;
  enabled: boolean;
  next_run_at: string;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ReportGovernance = {
  generatedAt: string;
  visibility: string;
  events: {
    action: string;
    entity_type: string;
    entity_id: string;
    details: Record<string, unknown> | null;
    created_at: string;
    actor_name: string;
  }[];
  exports: { total: number; recent_24h: number; last_export_at: string | null };
  schedules: { total: number; enabled: number; failed: number; last_delivery_at: string | null };
};

export type ReportsSummary = {
  scope: { type: string; division: string | null; userId: string | null };
  reportCount: number;
  availableCount: number;
  generatedAt: string;
  reports: {
    key: string;
    title: string;
    category: string;
    level: string;
    recordCount: number;
    available: boolean;
    kpis: ReportKpi[];
    error?: string;
  }[];
};

export type InstitutionalIntelligence = {
  generatedAt: string;
  filters: { from: string; to: string; workType: string; status: string };
  scope: { type: string; role: string };
  basis: { assignments: number; research: number; publishedReports: number };
  dataQuality?: {
    assignments: { total: number; missing_deadline: number; stale_active: number; without_team_members: number };
    research: { total: number; missing_research_question: number; missing_objectives: number; missing_methodology: number; without_parent_assignment: number; missing_end_date: number; stale_active: number };
  };
  overview: {
    comparison: null | {
      label: string;
      from: string;
      to: string;
      metrics: Record<string, number>;
      deltas: Record<string, number>;
    };
    kpis: Record<string, number>;
    indicatorBasis: Record<string, { numerator: number; denominator: number }>;
    interpretation: string;
    completionTrend: { label: string; created: number; completed: number; overdue: number }[];
    status: { label: string; value: number }[];
    deadlineRisk: { label: string; value: number }[];
    lifecycle: { label: string; value: number }[];
    records: Record<string, unknown>[];
    decisionSupport: {
      priorities: { key: string; level: 'critical' | 'watch' | 'healthy'; title: string; evidence: string; action: string }[];
      bottlenecks: { label: string; value: number }[];
      riskConcentration: { id: string; name: string; overdue: number; awaiting_review: number; exposure: number }[];
    };
    earlyWarning: {
      signals: {
        key: string;
        level: 'critical' | 'watch' | 'healthy';
        title: string;
        responsibleTeam: string;
        evidence: string;
        outlook: string;
        action: string;
        evidenceStrength: 'Limited' | 'Moderate' | 'Strong';
      }[];
      evidenceStrength: 'Limited' | 'Moderate' | 'Strong';
      methodology: string;
    };
    forecast: {
      responsibleTeam: string;
      evidenceStrength: 'Limited' | 'Moderate' | 'Strong';
      baseline: { overdue: number; awaitingReview: number; completionRate: number };
      scenarios: {
        key: string;
        title: string;
        assumption: string;
        overdue: number;
        awaitingReview: number;
        completionRate: number;
      }[];
      methodology: string;
    };
  };
  research: {
    portfolio: Record<string, number>;
    pipeline: { label: string; value: number }[];
    ageing: { label: string; value: number }[];
    review: { submitted: number; approved: number; changes_requested: number; average_review_days: number; pending_review_age: number; outcomes: { label: string; value: number }[] };
    publicationTrend: { label: string; submitted: number; approved: number }[];
    reviewTurnaroundTrend: { label: string; average_days: number; reviewed: number; pending: number }[];
    interpretation: string;
  };
  attention: Record<string, unknown>[];
  people: Record<string, unknown>[];
  contributions: Record<string, unknown>[];
  previousContributions: Record<string, unknown>[];
  contributionComparison: { label: string; from: string; to: string } | null;
  teamCapacityEvidence: Record<string, unknown>[];
  published: Record<string, unknown>[];
  capabilities: { management: boolean; people: boolean; reportBuilder: boolean; published: boolean };
};
export type RepositoryOrigin = {
  id: string;
  title: string;
  type: "Assignment" | "Task" | "Research" | "App2 Report";
};
export type DocumentDeletionRequest = {
  id: string;
  knowledge_id: string | null;
  knowledge_title: string;
  requested_by: string;
  requested_by_name: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  review_comments: string;
  reviewed_at: string | null;
  created_at: string;
};
export type ReviewEvent = {
  id: number;
  action: string;
  comments: string;
  created_at: string;
  actor_name: string;
  reviewer_name?: string;
};
export type RepositorySavedView = {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type RepositoryRetentionSchedule = {
  id: string;
  name: string;
  record_class: string;
  review_interval_months: number | null;
  retention_years: number | null;
  disposition_action: "Review" | "Destroy" | "Transfer" | "Permanent";
  description: string;
  active: boolean;
};

export type RepositoryAssuranceCheck = {
  key: string;
  area: "Identity" | "Governance" | "Integrity" | "Protection" | "Traceability" | "Knowledge";
  label: string;
  status: "PASS" | "WARNING" | "GAP" | "INFO";
  message: string;
  actionTab: "Overview" | "Versions" | "Relationships" | "Protection" | "Review & Retention" | "Audit" | "Felix";
};

export type RepositoryGovernanceReconciliationRow = {
  id: string;
  title: string;
  recordNumber?: string | null;
  recordClass?: string | null;
  reviewerId?: string | null;
  reviewerName?: string | null;
  retentionScheduleId?: string | null;
  retentionScheduleName?: string | null;
  nextReviewAt?: string | null;
  reviewerSuggestion?: {
    userId: string;
    userName: string;
    source: "single-authoritative-approval";
  } | null;
  retentionSuggestion?: {
    scheduleId: string;
    scheduleName: string;
    reviewIntervalMonths?: number | null;
    source: "exact-record-class";
  } | null;
  suggestedReviewDate?: string | null;
  missingReviewer: boolean;
  missingRetention: boolean;
  missingReviewDate: boolean;
};

export type RepositoryAssuranceOverviewItem = {
  id: string;
  title: string;
  record_number?: string | null;
  status: string;
  records_lifecycle_state?: string | null;
  overall: "READY" | "READY WITH MINOR ISSUES" | "NEEDS REVISION" | "SIGNIFICANT GAPS";
  gaps: number;
  warnings: number;
};

export type RepositoryAssuranceOverview = {
  total: number;
  counts: {
    READY: number;
    "READY WITH MINOR ISSUES": number;
    "NEEDS REVISION": number;
    "SIGNIFICANT GAPS": number;
  };
  items: RepositoryAssuranceOverviewItem[];
};

export type RepositoryRecordAssurance = {
  recordId: string;
  overall: "READY" | "READY WITH MINOR ISSUES" | "NEEDS REVISION" | "SIGNIFICANT GAPS";
  gaps: number;
  warnings: number;
  checkedAt: string;
  checks: RepositoryAssuranceCheck[];
};

export type RepositoryRecordDetail = {
  record: DocumentItem & {
    retention_schedule_name?: string | null;
    schedule_disposition_action?: string | null;
  };
  versions: KnowledgeVersion[];
  relationships: RepositoryRelationship[];
  activity: Array<{id:number;action:string;created_at:string;user_name:string;details:Record<string,unknown>}>;
  improvements: DocumentImprovementAssignment[];
  protection: DocumentProtectionPolicy | null;
};

export type FelixRecordContext = {
  authoritative: boolean;
  currentVersion: number;
  recordNumber: string | null;
  lifecycle: string | null;
  replacement: {id:string;title:string;record_number:string|null;current_version:number;status:string} | null;
  warnings: string[];
  relationships: Array<{relationship_type:string;entity_type:string;entity_title:string|null;pinned_version_number:number|null}>;
};

export type DocumentProtectionEffective = {
  canView: boolean;
  canDownload: boolean;
  canCopy: boolean;
  canPrint: boolean;
  canLink: boolean;
  watermark: boolean;
  watermarkText: string | null;
  readerScope: "INHERITED" | "TEAM" | "NAMED_USERS" | "REVIEWER_ONLY" | "MANAGEMENT_ONLY";
  restrictionReason: string;
  classification: string;
};

export type DocumentProtectionPolicy = {
  knowledge_id: string;
  reader_scope: "INHERITED" | "TEAM" | "NAMED_USERS" | "REVIEWER_ONLY" | "MANAGEMENT_ONLY";
  allow_download: boolean;
  allow_copy: boolean;
  allow_print: boolean;
  allow_link: boolean;
  watermark: boolean;
  restriction_reason: string;
  expires_at: string | null;
  approved_by: string | null;
  updated_by: string;
  updated_at: string;
  grants: Array<{
    id: string;
    user_id: string;
    user_name: string;
    role: string;
    can_view: boolean;
    can_download: boolean;
    can_copy: boolean;
    can_print: boolean;
    can_link: boolean;
  }>;
};

export type RepositoryRelationship = {
  id: string;
  knowledge_id: string;
  relationship_type: "Evidence for" | "Reference for" | "Source for" | "Supports" | "Produced by" | "Supersedes" | "Related to" | "Annex to";
  entity_type: "assignment" | "task" | "research" | "report";
  entity_id: string;
  entity_title: string;
  pinned_version_id: string | null;
  pinned_version_number: number | null;
  notes: string;
  linked_by: string;
  linked_by_name: string;
  created_at: string;
};

export type DocumentImprovementAssignment = {
  id: string;
  knowledge_id: string;
  knowledge_title: string;
  assignee_id: string;
  assignee_name: string;
  reviewer_id: string;
  reviewer_name: string;
  created_by: string;
  created_by_name: string;
  improvement_type: "Content Update" | "Policy Review" | "Legal Review" | "Metadata Improvement" | "Formatting" | "Annual Review" | "Other";
  reason: string;
  due_date: string | null;
  status: "Assigned" | "In Progress" | "Submitted" | "Completed" | "Cancelled";
  starting_version: number;
  submitted_version: number | null;
  completed_version: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type ReviewItem = DocumentItem & {
  reviewer_id?: string;
  reviewer_name?: string;
  review_history: ReviewEvent[];
};
export type InternalEmailRecipient = {
  id:string; name:string; email:string; role:string; division:string;
};
export type InternalSentEmail = {
  id:string; subject:string; body:string; created_at:string;
  recipients:Array<{
    id:string; recipient_id:string; recipient_name:string; recipient_email:string;
    delivery_status:"Pending"|"Sending"|"Sent"|"Retry"|"Failed"|"Suppressed";
    sent_at:string|null; last_error:string|null;
  }>;
};

export type MessageUser = {
  id:string;
  name:string;
  email:string;
  role:string;
  division:string;
  status:string;
  presence?:"Online"|"Away"|"Offline";
  last_seen_at?:string|null;
};
export type MessageConversation = {
  id:string;
  kind:"Direct"|"Group";
  title:string|null;
  owner_id:string|null;
  created_by:string;
  created_at:string;
  updated_at:string;
  members:MessageUser[];
  last_message:string|null;
  last_message_at:string|null;
  unread_count:number;
};
export type IncomingMessagePreview = {
  id:string;
  conversation_id:string;
  sender_id:string;
  sender_name:string;
  body:string;
  created_at:string;
  kind:"Direct"|"Group";
  title:string|null;
  members:Array<{id:string;name:string}>;
};

export type MessageConversationInfo = {
  id:string;
  kind:"Direct"|"Group";
  title:string|null;
  owner_id:string|null;
  created_by:string;
  is_member:boolean;
  can_manage:boolean;
  members:Array<MessageUser & {is_owner:boolean}>;
};

export type MessageConversationEvent = {
  id:string;
  conversation_id:string;
  actor_id:string;
  actor_name:string;
  event_type:"Group Renamed"|"Member Added"|"Member Removed";
  target_user_id:string|null;
  target_user_name:string|null;
  details:Record<string,unknown>;
  created_at:string;
};

export type MessageReaction = {emoji:string;count:number;me:boolean};
export type MessageAttachment = {id:string;original_name:string;mime_type:string;size_bytes:number};
export type AppMessage = {
  id:string;
  conversation_id:string;
  sender_id:string;
  sender_name:string;
  sender_role:string;
  body:string;
  context_type:string|null;
  context_id:string|null;
  context_title:string|null;
  created_at:string;
  reply_to_message_id?:string|null;
  reply_body?:string|null;
  reply_sender_name?:string|null;
  reactions?:MessageReaction[];
  attachments?:MessageAttachment[];
  recipient_count?:number;
  delivered_count?:number;
  read_count?:number;
};
export type MessagePresence = {userId:string;status:"Online"|"Away"|"Offline";lastSeenAt:string|null};

export type ApiNotification = {
  id: string;
  title: string;
  body: string;
  entity_type?: string;
  entity_id?: string;
  read_at: string | null;
  archived_at?: string | null;
  closed_at?: string | null;
  close_reason?: string | null;
  important_at?: string | null;
  priority?: "Critical" | "High" | "Normal" | "Informational";
  action?: string | null;
  target_workspace?: string | null;
  target_tab?: string | null;
  event_key?: string | null;
  email_eligible?: boolean;
  email_status?: "Not Required" | "Pending" | "Sending" | "Sent" | "Retry" | "Suppressed" | "Failed";
  email_sent_at?: string | null;
  reminder_kind?: string | null;
  notification_category?: "Action" | "Review" | "Reminder" | "Information";
  created_at: string;
};
export type RepositoryGroup = {
  domain: "Research" | "Assignment" | "Task" | "Other";
  group_id: string;
  work_title: string;
  owner_name: string | null;
  document_count: number;
  latest_version: number;
  latest_activity: string;
  final_report_available: boolean;
  documents: Array<{
    id: string;
    title: string;
    document_type?: string;
    status: string;
    classification?: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
    current_version?: number;
    updated_at?: string | null;
    created_by?: string | null;
    reviewer_id?: string | null;
    approved_by?: string | null;
    approved_at?: string | null;
    source_type: string;
  }>;
};
export type DashboardWorkItem = {
  id: string;
  type:
    | "Assignment"
    | "Task"
    | "Research Project"
    | "Research Milestone"
    | "Review"
    | "Finalization";
  title: string;
  status: string;
  dueDate: string | null;
  nextAction: string;
  destination: string;
  contextId: string;
  contextTitle?: string | null;
  ownerName?: string | null;
  teamName?: string | null;
  reviewKind?: "Task Report" | "Research Report" | "Generated Document" | "Knowledge" | "Meeting Schedule Approval" | "Meeting Minutes" | "Leave Request" | "Notice" | "Assignment Member Request" | "Assignment Task Request" | "Research Assignment Request" | "Document Deletion Request" | "Assignment Review" | null;
  updatedAt?: string;
  days?: number;
  group?: "Overdue" | "Today" | "Tomorrow" | "This Week" | "Later";
};
export type DashboardTeamWorkloadDetail = {
  member: {
    id: string;
    name: string;
    division: string;
    role: string;
  };
  assignments: DashboardTeamWorkloadItem[];
  tasks: DashboardTeamWorkloadItem[];
  research: DashboardTeamWorkloadItem[];
};

export type DashboardTeamWorkloadItem = {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  dueDate: string | null;
  type: string;
  destination: string;
  contextId: string;
  contextTitle: string | null;
};
export type DashboardResponse = {
  generatedAt: string;
  role: string;
  scope?: { type: string; userId?: string | null };
  attention: {
    assignments: number;
    reviews: number;
    overdue: number;
    notifications: number;
    almostDue: number;
  };
  myWork: DashboardWorkItem[];
  reviewHistory: DashboardWorkItem[];
  deadlines: DashboardWorkItem[];
  recentActivity: {
    id: string;
    title: string;
    body: string;
    entity_type?: string;
    entity_id?: string;
    created_at: string;
  }[];
  quickActions: { label: string; destination: string }[];
  management: null | {
    scope?: { type: string; label: string };
    team: {
      total: number;
      roles: Record<string, number>;
      workload: {
        id: string;
        name: string;
        division: string;
        active_assignments: number;
        active_tasks: number;
        active_research: number;
        overdue: number;
        due_soon: number;
      }[];
    };
    assignments: { active: number; overdue: number; dueSoon: number };
    tasks: {
      active: number;
      overdue: number;
      dueSoon: number;
      awaitingReview: number;
    };
    research: {
      current: number;
      active: number;
      planning: number;
      underReview: number;
      changesRequested: number;
      completed: number;
      readyToPublish: number;
      overdue: number;
      dueSoon: number;
      items: DashboardWorkItem[];
      milestones: {
        active: number;
        overdue: number;
        dueSoon: number;
      };
    };
    work: {
      overdue: number;
      dueSoon: number;
    };
    // APP2_TEAM_REVIEW_STATUS_TYPE
    reviews: {
      pending: number;
      generatedDocuments: number;
      researchReports: number;
      taskReports: number;
      repositoryDocuments: number;
      items: {
        id: string;
        title: string;
        status: string;
        due_date: string | null;
        updated_at: string;
        review_context: string;
        context_id: string;
        context_title: string | null;
        reviewer_name: string | null;
        review_kind:
          | "Generated Document"
          | "Research Report"
          | "Task Report"
          | "Knowledge";
      }[];
    };    repository: {
      pendingReview: number;
      published: number;
      pendingItems: ReviewItem[];
    };
  };
};
export type CompletedWorkResponse = {
  assignments: {
    id: string;
    title: string;
    status: string;
    completed_at: string;
    lead_name?: string | null;
  }[];
  tasks: {
    id: string;
    assignment_id: string;
    title: string;
    status: string;
    completed_at: string;
    assignment_title: string;
    owner_name?: string | null;
  }[];
  research: {
    id: string;
    title: string;
    status: string;
    completed_at: string;
    lead_name?: string | null;
  }[];
};

export type NoticeItem = {
  id: string;
  title: string;
  body: string;
  severity: "Information" | "Important" | "Urgent";
  audience_role: string | null;
  status: "Pending Approval" | "Published" | "Rejected";
  event_start: string | null;
  event_end: string | null;
  expires_at: string | null;
  is_pinned: boolean;
  pinned_at?: string | null;
  rejection_reason: string | null;
  created_at: string;
  created_by: string;
  created_by_name: string;
  reviewed_by_name?: string;
  can_manage?: boolean;
};
export type NoticeComment = { id:string; alert_id:string; body:string; created_at:string; user_id:string; user_name:string; user_role:string };
export type CalendarItem = {
  id: string;
  title: string;
  start_at: string;
  end_at?: string | null;
  type:
    | "assignment"
    | "task"
    | "research_milestone"
    | "research_deadline"
    | "document_review"
    | "notice"
    | "notice_expiry"
    | "custom_event";
  status: string;
  entity_id?: string;
  is_dated_event?: boolean;
  description?: string;
  created_by?: string;
  created_by_name?: string;
  can_manage?: boolean;
};
export type AnalyticsReport = {
  summary: {
    total: number;
    completed: number;
    overdue: number;
    completion_rate: number;
    pending_reviews: number;
    published_documents: number;
    active_research: number;
    generated_document_reviews?: number;
    approved_generated_documents?: number;
  };
  assignmentStatuses: { status: string; total: number }[];
  divisions: { division: string; total: number; completed: number }[];
  documentStatuses: { status: string; total: number }[];
  researchStatuses: { status: string; total: number }[];
  reviewers: {
    id: string;
    name: string;
    approved: number;
    rejected: number;
    pending: number;
  }[];
  trends: { month: string; created: number; completed: number }[];
  people: {
    id: string;
    name: string;
    role: string;
    division: string;
    assigned: number;
    completed: number;
    overdue: number;
    completion_rate: number;
  }[];
};
export type AuditLog = {
  id: number;
  user_id: string | null;
  user_name: string;
  user_email?: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};
export type AuditResponse = {
  items: AuditLog[];
  total: number;
  actions: string[];
  entityTypes: string[];
};
export type SettingsResponse = {
  system: {
    organization_name: string;
    department_name: string;
    support_email: string;
    session_minutes: number;
    max_upload_mb: number;
    default_retention_days: number;
    document_categories: string[];
    maintenance_mode: boolean;
    email_notifications: boolean;
    updated_at: string;
  };
  preferences: {
    email_notifications: boolean;
    in_app_notifications: boolean;
    important_email_notifications: boolean;
    deadline_reminders: boolean;
    compact_layout: boolean;
    theme_mode: "Dark" | "Light" | "System" | "Gold Grey" | "Navy Blue" | "PSC Slate" | "Low-Contrast Navy" | "Executive Gold" | "Sage Ivory";
    accent_color: "Gold" | "Blue" | "Green";
    updated_at?: string;
  };
  health: {
    api: string;
    database: string;
    environment: string;
    database_time: string;
    configured_upload_limit_mb: number;
    configured_session: string;
  };
};
export type UpdateStatus = {
  application: string;
  applicationVersion: string;
  apiVersion: string;
  runtime: string;
  database: string;
  databaseVersion: string;
  status: string;
  updateChannel: string;
  automaticUpdates: boolean;
  checkedAt: string;
};
export type EmailDeliveryStatus = {
  enabled: boolean;
  configured: boolean;
  provider: "Gmail SMTP" | "Custom SMTP" | null;
  host: string | null;
  port: number;
  secure: boolean;
  from: string;
  ready: boolean;
};

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  let response: Response;
  try {
    response = await workflowFetch(`${API_URL}${path}`, {
      ...options,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Cache-Control": "no-cache",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Network request failed";
    throw new Error(
      `APP2 could not reach its API at ${API_URL}. Check that the backend is running and that this browser can reach it, then retry. Your open draft remains in the editor. (${reason})`,
    );
  }
  let data: any = null;
  if (response.status !== 204) {
    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text();
    if (contentType.includes("application/json")) {
      try {
        data = raw ? JSON.parse(raw.replace(/^\uFEFF/, "")) : null;
      } catch {
        throw new Error(
          `The APP2 API returned malformed JSON for ${path} (HTTP ${response.status}). Restart the API service and try again.`,
        );
      }
    } else {
      const preview = raw.replace(/\s+/g, " ").trim().slice(0, 120);
      throw new Error(
        `The APP2 API returned ${contentType || "an unknown response type"} for ${path} (HTTP ${response.status})${preview && !/[\u0000-\u0008]/.test(preview) ? `: ${preview}` : ""}.`,
      );
    }
  }
  if (response.status === 401 && token) unauthorizedHandler?.();
  if (!response.ok) {
    const fieldErrors = data?.details?.fieldErrors as
      | Record<string, string[] | undefined>
      | undefined;
    const specific = fieldErrors
      ? Object.entries(fieldErrors).flatMap(([field, messages]) =>
          (messages || []).map(
            (message) =>
              `${field.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}: ${message}`,
          ),
        )[0]
      : undefined;
    throw new Error(
      specific ||
        data?.error ||
        "The PSC service could not complete your request.",
    );
  }
  return data as T;
}

type TasksShadowEnvelope = {
  contractVersion: string;
  schemaVersion: number;
  sourceAuthority: string;
  tasks: ApiAssignmentTask[];
};

async function readTasks(token: string): Promise<ApiAssignmentTask[]> {
  const readFromNode = () =>
    request<ApiAssignmentTask[]>("/tasks", {}, token);

  if (TASKS_READ_SOURCE !== "shadow") {
    return readFromNode();
  }

  try {
    const response = await workflowFetch(
      `${TASKS_SHADOW_API_URL}/shadow/tasks`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      return readFromNode();
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return readFromNode();
    }

    const data = (await response.json()) as TasksShadowEnvelope;
    if (
      data?.contractVersion !== "tasks-shadow-v2" ||
      data?.schemaVersion !== 2 ||
      data?.sourceAuthority !== "Node/PostgreSQL" ||
      !Array.isArray(data?.tasks)
    ) {
      return readFromNode();
    }

    return data.tasks;
  } catch {
    return readFromNode();
  }
}

async function aiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  try {
    const response = await workflowFetch(`${AI_API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    const data = response.status === 204 ? null : await response.json();
    if (response.status === 401 && token) unauthorizedHandler?.();
    if (!response.ok)
      throw new Error(
        data?.detail ||
          data?.error ||
          "The AI Researcher could not complete your request.",
      );
    return data as T;
  } catch (error) {
    if (error instanceof TypeError)
      throw new Error(
        "The separate AI Researcher service is offline. APP2 is still available.",
      );
    throw error;
  }
}
export type ResearchReportVersion = {
  id: string;
  project_id: string;
  version_number: number;
  title: string;
  report_snapshot: { team?: { id?: string; name: string; role: string }[]; sections?: ResearchReportSection[] };
  status: "Draft" | "Submitted" | "Changes Requested" | "Approved" | "Rejected";
  reviewer_id: string | null;
  reviewer_name?: string | null;
  submitted_by?: string | null;
  submitted_by_name?: string | null;
  submitted_at?: string | null;
  reviewed_by?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  review_comments?: string;
  created_at: string;
};

export type ResearchReportSection = {
  id: string;
  section_key: string;
  title: string;
  content: string;
  section_order: number;
  status:
    | "Not Started"
    | "Draft"
    | "In Progress"
    | "Ready for Review"
    | "Approved";
  owner_id: string | null;
  owner_name?: string | null;
  reviewer_id: string | null;
  reviewer_name?: string | null;
  updated_at: string;
  updated_by_name?: string | null;
};

export const api = {
  onUnauthorized: (handler: (() => void) | null) => {
    unauthorizedHandler = handler;
  },
  login: (email: string, password: string) =>
    request<{ token: string; user: ApiUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  loginDirectory: () =>
    request<Array<{ name: string; email: string; role: string }>>(
      "/auth/login-directory",
    ),
  me: (token: string) => request<ApiUser>("/auth/me", {}, token),
  logout: (token: string) =>
    request<void>("/auth/logout", { method: "POST" }, token),
  changePassword: (
    token: string,
    currentPassword: string,
    newPassword: string,
  ) =>
    request<{ token: string; user: ApiUser }>(
      "/auth/change-password",
      {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      },
      token,
    ),
  forgotPassword: (email: string) =>
    request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (resetToken: string, newPassword: string) =>
    request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token: resetToken, newPassword }),
    }),
  users: (token: string) => request<ApiUser[]>("/users", {}, token),
  createUser: (
    token: string,
    input: {
      name: string;
      email: string;
      role: string;
      division: string;
      supervisorId: string | null;
    },
  ) =>
    request<ApiUser & { setup_email_sent: boolean }>(
      "/users",
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  updateUser: (
    token: string,
    id: string,
    input: {
      name: string;
      email: string;
      role: string;
      division: string;
      supervisorId: string | null;
      status: string;
      active: boolean;
    },
  ) =>
    request<ApiUser>(
      `/users/${id}`,
      { method: "PATCH", body: JSON.stringify(input) },
      token,
    ),
  updateRole: (token: string, id: string, role: string) =>
    request<ApiUser>(
      `/users/${id}/role`,
      { method: "PATCH", body: JSON.stringify({ role }) },
      token,
    ),
  resetUserPassword: (token: string, id: string, purpose: "reset" | "setup" = "reset") =>
    request<{ message: string; email: string; expiresInMinutes: number }>(
      `/users/${id}/reset-password`,
      { method: "POST", body: JSON.stringify({ purpose }) },
      token,
    ),
  leaveTypes: (token: string) => request<LeaveType[]>("/leave/types", {}, token),
  leaveRequests: (token: string) => request<LeaveRequest[]>("/leave/requests", {}, token),
  leaveBalances: (token: string, userId: string, year = new Date().getFullYear()) => request<LeaveBalance[]>(`/leave/balances/${userId}?year=${year}`, {}, token),
  submitLeaveRequest: (token: string, input: {leaveTypeCode:string;startDate:string;endDate:string;reason:string}) => request<LeaveRequest>("/leave/requests",{method:"POST",body:JSON.stringify(input)},token),
  decideLeaveRequest: (token: string, id: string, decision: "Approved"|"Returned"|"Rejected", note: string) => request<LeaveRequest>(`/leave/requests/${id}/decision`,{method:"POST",body:JSON.stringify({decision,note})},token),
  cancelLeaveRequest: (token: string, id: string) => request<LeaveRequest>(`/leave/requests/${id}/cancel`,{method:"POST"},token),

  assignments: (token: string) =>
    request<ApiAssignment[]>("/assignments", {}, token),
  createAssignment: (token: string, input: AssignmentInput) =>
    request<ApiAssignment>(
      "/assignments",
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  updateAssignment: (
    token: string,
    id: string,
    input: Omit<AssignmentInput, "memberIds">,
  ) =>
    request<ApiAssignment>(
      `/assignments/${id}`,
      { method: "PATCH", body: JSON.stringify(input) },
      token,
    ),
  deleteAssignment: (token: string, id: string) =>
    request<void>(`/assignments/${id}`, { method: "DELETE" }, token),
  updateStatus: (token: string, id: string, status: string) =>
    request<ApiAssignment>(
      `/assignments/${id}/status`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      token,
    ),
  addMember: (
    token: string,
    assignmentId: string,
    userId: string,
    memberRole = "Contributor",
  ) =>
    request<void>(
      `/assignments/${assignmentId}/members`,
      { method: "POST", body: JSON.stringify({ userId, memberRole }) },
      token,
    ),
  assignmentSections: (token: string, assignmentId: string) =>
    request<ApiAssignmentSection[]>(
      `/assignments/${assignmentId}/sections`,
      {},
      token,
    ),
  createAssignmentSection: (
    token: string,
    assignmentId: string,
    input: AssignmentSectionInput,
  ) =>
    request<ApiAssignmentSection>(
      `/assignments/${assignmentId}/sections`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  createAssignmentStarterStructure: (token: string, assignmentId: string) =>
    request<ApiAssignmentSection[]>(
      `/assignments/${assignmentId}/sections/starter`,
      { method: "POST" },
      token,
    ),
  updateAssignmentSection: (
    token: string,
    assignmentId: string,
    sectionId: string,
    input: Partial<AssignmentSectionInput>,
  ) =>
    request<ApiAssignmentSection>(
      `/assignments/${assignmentId}/sections/${sectionId}`,
      { method: "PATCH", body: JSON.stringify(input) },
      token,
    ),
  archiveAssignmentSection: (
    token: string,
    assignmentId: string,
    sectionId: string,
  ) =>
    request<ApiAssignmentSection>(
      `/assignments/${assignmentId}/sections/${sectionId}/archive`,
      { method: "POST" },
      token,
    ),
  reorderAssignmentSections: (
    token: string,
    assignmentId: string,
    input: { id: string; sectionOrder: number }[],
  ) =>
    request<ApiAssignmentSection[]>(
      `/assignments/${assignmentId}/sections/reorder`,
      { method: "PATCH", body: JSON.stringify(input) },
      token,
    ),
  assignmentTasks: (token: string, assignmentId: string) =>
    request<ApiAssignmentTask[]>(
      `/assignments/${assignmentId}/tasks`,
      {},
      token,
    ),
  assignmentTaskAssignableUsers: (token: string, assignmentId: string) =>
    request<ApiUser[]>(
      `/assignments/${assignmentId}/assignable-task-users`,
      {},
      token,
    ),
  tasks: (token: string) => readTasks(token),
  taskContext: (token: string, taskId: string) =>
    request<{ assignment: ApiAssignment; task: ApiAssignmentTask }>(
      `/tasks/${taskId}/context`,
      {},
      token,
    ),
  assignmentReviewerCandidates: (
    token: string,
    assignmentId: string,
    ownerId?: string,
  ) =>
    request<ApiUser[]>(
      `/assignments/${assignmentId}/reviewer-candidates${ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : ""}`,
      {},
      token,
    ),
  assignmentReportReviewers: (token: string, assignmentId: string) =>
    request<ApiUser[]>(
      `/assignments/${assignmentId}/report-reviewers`,
      {},
      token,
    ),
  addTaskToAssignmentReportSection: (
    token: string,
    documentId: string,
    sectionId: string,
    taskId: string,
  ) =>
    request<GeneratedDocumentSection>(
      `/assignment-reports/${documentId}/sections/${sectionId}/tasks/${taskId}`,
      { method: "POST" },
      token,
    ),
  createAssignmentTask: (
    token: string,
    assignmentId: string,
    input: Record<string, unknown>,
  ) =>
    request<ApiAssignmentTask>(
      `/assignments/${assignmentId}/tasks`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  updateAssignmentTask: (
    token: string,
    assignmentId: string,
    taskId: string,
    input: Record<string, unknown>,
  ) =>
    request<ApiAssignmentTask>(
      `/assignments/${assignmentId}/tasks/${taskId}`,
      { method: "PATCH", body: JSON.stringify(input) },
      token,
    ),
  assignAssignmentTaskReviewer: (
    token: string,
    assignmentId: string,
    taskId: string,
    reviewerId: string,
  ) =>
    request<ApiAssignmentTask>(
      `/assignments/${assignmentId}/tasks/${taskId}/reviewer`,
      { method: "PATCH", body: JSON.stringify({ reviewerId }) },
      token,
    ),
  archiveAssignmentTask: (
    token: string,
    assignmentId: string,
    taskId: string,
  ) =>
    request<ApiAssignmentTask>(
      `/assignments/${assignmentId}/tasks/${taskId}/archive`,
      { method: "POST" },
      token,
    ),
  deleteAssignmentTask: (
    token: string,
    assignmentId: string,
    taskId: string,
    reason: string,
  ) =>
    request<void>(
      `/assignments/${assignmentId}/tasks/${taskId}`,
      { method: "DELETE", body: JSON.stringify({ reason }) },
      token,
    ),
  updateAssignmentTaskContribution: (
    token: string,
    assignmentId: string,
    taskId: string,
    input: Record<string, unknown>,
  ) =>
    request<ApiAssignmentTask>(
      `/assignments/${assignmentId}/tasks/${taskId}/contribution`,
      { method: "PATCH", body: JSON.stringify(input) },
      token,
    ),
  reviewAssignmentTaskContribution: (
    token: string,
    assignmentId: string,
    taskId: string,
    input: { decision: "Changes Requested" | "Rejected" | "Approved"; comments: string },
  ) =>
    request<ApiAssignmentTask>(
      `/assignments/${assignmentId}/tasks/${taskId}/contribution-review`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  reopenRejectedAssignmentTask: (
    token: string,
    assignmentId: string,
    taskId: string,
  ) =>
    request<ApiAssignmentTask>(
      `/assignments/${assignmentId}/tasks/${taskId}/reopen-after-rejection`,
      { method: "POST" },
      token,
    ),
  finalizeAssignmentTaskContribution: (
    token: string,
    assignmentId: string,
    taskId: string,
  ) =>
    request<ApiAssignmentTask>(
      `/assignments/${assignmentId}/tasks/${taskId}/contribution-finalize`,
      { method: "POST" },
      token,
    ),
  updateAssignmentTaskContributionSection: (
    token: string,
    assignmentId: string,
    taskId: string,
    input: {
      sectionKey: string;
      status: "Draft" | "In Review" | "Final";
      content: string;
    },
  ) =>
    request<ApiAssignmentTask>(
      `/assignments/${assignmentId}/tasks/${taskId}/contribution-section`,
      { method: "PATCH", body: JSON.stringify(input) },
      token,
    ),
  previewAssignmentTaskContribution: (
    token: string,
    assignmentId: string,
    taskId: string,
    input: Record<string, unknown>,
  ) =>
    request<{ html: string; title: string }>(
      `/assignments/${assignmentId}/tasks/${taskId}/contribution-preview`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  assignmentTaskContributionReport: (
    token: string,
    assignmentId: string,
    taskId: string,
  ) =>
    request<{
      html: string;
      title: string;
      version: number;
      generatedAt: string | null;
      status: string;
    }>(
      `/assignments/${assignmentId}/tasks/${taskId}/contribution-report`,
      {},
      token,
    ),
  taskReviewContext: (token: string, taskId: string) =>
    request<{ assignment: ApiAssignment; task: ApiAssignmentTask }>(
      `/task-reviews/${taskId}/context`,
      {},
      token,
    ),
  taskRequests: (token: string) =>
    request<ApiAssignmentTaskRequest[]>("/task-requests", {}, token),
  taskRequestAssignments: (token: string) =>
    request<ApiTaskRequestAssignment[]>("/task-request-assignments", {}, token),
  taskRequestReviewerCandidates: (
    token: string,
    requestId: string,
    ownerId: string,
  ) =>
    request<ApiTaskRequestReviewer[]>(
      `/task-requests/${requestId}/reviewer-candidates?ownerId=${encodeURIComponent(ownerId)}`,
      {},
      token,
    ),
  createTaskRequest: (
    token: string,
    input: Record<string, unknown> & { assignmentId: string },
  ) =>
    request<ApiAssignmentTaskRequest>(
      "/task-requests",
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  decideTaskRequest: (
    token: string,
    requestId: string,
    input: Record<string, unknown> & { reviewerId?: string | null },
  ) =>
    request<ApiAssignmentTaskRequest>(
      `/task-requests/${requestId}`,
      { method: "PATCH", body: JSON.stringify(input) },
      token,
    ),
  assignmentTaskRequests: (token: string, assignmentId: string) =>
    request<ApiAssignmentTaskRequest[]>(
      `/assignments/${assignmentId}/task-requests`,
      {},
      token,
    ),
  createAssignmentTaskRequest: (
    token: string,
    assignmentId: string,
    input: Record<string, unknown>,
  ) =>
    request<ApiAssignmentTaskRequest>(
      `/assignments/${assignmentId}/task-requests`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  decideAssignmentTaskRequest: (
    token: string,
    assignmentId: string,
    requestId: string,
    input: Record<string, unknown> & { reviewerId?: string | null },
  ) =>
    request<ApiAssignmentTaskRequest>(
      `/assignments/${assignmentId}/task-requests/${requestId}`,
      { method: "PATCH", body: JSON.stringify(input) },
      token,
    ),
  assignmentMemberRequests: (token: string, assignmentId: string) =>
    request<ApiAssignmentMemberRequest[]>(
      `/assignments/${assignmentId}/member-requests`,
      {},
      token,
    ),
  createAssignmentMemberRequest: (
    token: string,
    assignmentId: string,
    input: { userId: string; reason: string },
  ) =>
    request<ApiAssignmentMemberRequest>(
      `/assignments/${assignmentId}/member-requests`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  decideAssignmentMemberRequest: (
    token: string,
    assignmentId: string,
    requestId: string,
    input: { decision: "Approved" | "Rejected"; comments?: string },
  ) =>
    request<ApiAssignmentMemberRequest>(
      `/assignments/${assignmentId}/member-requests/${requestId}`,
      { method: "PATCH", body: JSON.stringify(input) },
      token,
    ),
  assignmentReviews: (token: string, assignmentId: string) =>
    request<ApiAssignmentReview[]>(
      `/assignments/${assignmentId}/reviews`,
      {},
      token,
    ),
  reviewAssignment: (
    token: string,
    assignmentId: string,
    decision: ApiAssignmentReview["decision"],
    comments = "",
  ) =>
    request<ApiAssignmentReview>(
      `/assignments/${assignmentId}/reviews`,
      { method: "POST", body: JSON.stringify({ decision, comments }) },
      token,
    ),
  comments: (token: string, assignmentId: string) =>
    request<
      { id: string; body: string; author_name: string; created_at: string }[]
    >(`/assignments/${assignmentId}/comments`, {}, token),
  addComment: (token: string, assignmentId: string, body: string) =>
    request(
      `/assignments/${assignmentId}/comments`,
      { method: "POST", body: JSON.stringify({ body }) },
      token,
    ),
  history: (token: string, assignmentId: string) =>
    request<ApiHistory[]>(`/assignments/${assignmentId}/history`, {}, token),
  attachments: (token: string, assignmentId: string) =>
    request<ApiAttachment[]>(
      `/assignments/${assignmentId}/attachments`,
      {},
      token,
    ),
  uploadAttachment: async (token: string, assignmentId: string, file: File) => {
    const response = await workflowFetch(
      `${API_URL}/assignments/${assignmentId}/attachments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
          "X-File-Name": encodeURIComponent(file.name),
          "X-File-Type": file.type || "application/octet-stream",
        },
        body: file,
      },
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(data?.error || "Attachment could not be uploaded.");
    return data as ApiAttachment;
  },

  downloadAttachment: async (
    token: string,
    attachmentId: string,
    fileName: string,
  ) => {
    const response = await workflowFetch(
      `${API_URL}/attachments/${attachmentId}/download`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) throw new Error("Attachment could not be downloaded.");
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  },
  knowledge: (token: string, search = "") =>
    request<KnowledgeItem[]>(
      `/knowledge${search ? `?search=${encodeURIComponent(search)}` : ""}`,
      {},
      token,
    ),
  uploadKnowledge: async (
    token: string,
    file: File,
    metadata: {
      title: string;
      description: string;
      category: string;
      tags: string;
      author?: string;
      documentDate?: string;
      sourceType: string;
      sourceUrl: string;
      originEntityId?: string;
      directorate: string;
      documentType: string;
      subject: string;
      classification: string;
      felixEnabled: boolean;
      reviewerId?: string;
    },
  ) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    const inferredMimeType = extension === "pdf"
      ? "application/pdf"
      : extension === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : extension === "md"
          ? "text/markdown"
          : extension === "txt"
            ? "text/plain"
            : "application/octet-stream";
    const response = await workflowFetch(`${API_URL}/knowledge`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "X-File-Name": encodeURIComponent(file.name),
        "X-File-Type": file.type || inferredMimeType,
        "X-Title": encodeURIComponent(metadata.title),
        "X-Description": encodeURIComponent(metadata.description),
        "X-Category": encodeURIComponent(metadata.category),
        "X-Tags": encodeURIComponent(metadata.tags),
        ...(metadata.author ? { "X-Author": encodeURIComponent(metadata.author) } : {}),
        ...(metadata.documentDate ? { "X-Document-Date": encodeURIComponent(metadata.documentDate) } : {}),
        "X-Source-Type": encodeURIComponent(metadata.sourceType),
        "X-Source-Url": encodeURIComponent(metadata.sourceUrl),
        "X-Directorate": encodeURIComponent(metadata.directorate),
        "X-Document-Type": encodeURIComponent(metadata.documentType),
        "X-Subject": encodeURIComponent(metadata.subject),
        "X-Classification": metadata.classification,
        "X-Felix-Enabled": String(metadata.felixEnabled),
        ...(metadata.reviewerId ? { "X-Reviewer-Id": metadata.reviewerId } : {}),
        ...(metadata.originEntityId
          ? { "X-Origin-Entity-Id": metadata.originEntityId }
          : {}),
      },
      body: file,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(data?.error || (response.status === 413
        ? "The document exceeds the configured upload limit."
        : `Document upload failed (HTTP ${response.status}).`));
    return data as KnowledgeItem;
  },
  approveKnowledge: (
    token: string,
    id: string,
    approved: boolean,
    reason?: string,
  ) =>
    request<KnowledgeItem>(
      `/knowledge/${id}/approve`,
      { method: "PATCH", body: JSON.stringify({ approved, reason }) },
      token,
    ),
  deleteKnowledge: (token: string, id: string) =>
    request<void>(`/knowledge/${id}`, { method: "DELETE" }, token),
  submitKnowledge: (token: string, id: string) =>
    request<KnowledgeItem>(
      `/document-reviews/${id}/submit`,
      { method: "POST" },
      token,
    ),
  knowledgeVersions: (token: string, id: string) =>
    request<KnowledgeVersion[]>(`/knowledge/${id}/versions`, {}, token),
  uploadKnowledgeVersion: async (token: string, id: string, file: File) => {
    const response = await workflowFetch(`${API_URL}/knowledge/${id}/versions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "X-File-Name": encodeURIComponent(file.name),
        "X-File-Type": file.type || "application/octet-stream",
      },
      body: file,
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data?.error || "Version could not be uploaded.");
    return data;
  },
  downloadKnowledgeVersion: async (
    token: string,
    id: string,
    fileName: string,
  ) => {
    let response: Response;
    try {
      response = await workflowFetch(
        `${API_URL}/knowledge/versions/${id}/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(120_000),
        },
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new Error("PDF preparation timed out. Try again; the download button is available again.");
      }
      throw error;
    }
    const blob = await response.blob();
    if (!response.ok) {
      let message = "Document PDF could not be downloaded.";
      try {
        const payload = JSON.parse(await blob.text());
        message = payload?.error || message;
      } catch {
        // Keep the user-facing fallback when the server does not return JSON.
      }
      throw new Error(message);
    }
    if (await blob.slice(0, 5).text() !== "%PDF-") {
      throw new Error("The server response was not a valid PDF. Please try again or contact support.");
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.style.display = "none";
    const pdfFileName = /\.pdf$/i.test(fileName)
      ? fileName
      : `${fileName.replace(/\.[^.]+$/, "") || "document"}.pdf`;
    anchor.download = pdfFileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  },
  openKnowledgeCurrent: async (
    token: string,
    id: string,
    fileName = "document",
  ) => {
    const popup = window.open("about:blank", "_blank");
    const response = await workflowFetch(`${API_URL}/documents/${id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      popup?.close();
      throw new Error(
        (await response.json().catch(() => ({}))).error ||
          "The final report could not be opened.",
      );
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    if (blob.type === "application/pdf" && popup) {
      popup.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
      popup?.close();
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    }
  },
  linkKnowledgeToAssignment: (token: string, id: string, assignmentId: string) =>
    request<void>(
      `/knowledge/${id}/assignments`,
      { method: "POST", body: JSON.stringify({ assignmentId }) },
      token,
    ),
  documentCategories: (token: string) =>
    request<{ id: string; name: string; description: string }[]>(
      "/document-categories",
      {},
      token,
    ),
  documentDetails: (token: string, id: string) =>
    request<Record<string, unknown>>(`/documents/${id}`, {}, token),
  documentWorkflow: (
    token: string,
    id: string,
    action: "submit" | "approve" | "reject" | "archive" | "restore",
    reason = "",
  ) =>
    request<KnowledgeItem>(
      `/documents/${id}/${action}`,
      { method: "POST", body: JSON.stringify({ reason }) },
      token,
    ),
  setDocumentFelix: (token: string, id: string, enabled: boolean) =>
    request<KnowledgeItem>(
      `/documents/${id}/felix/${enabled ? "enable" : "disable"}`,
      { method: "POST" },
      token,
    ),
  askDocumentFelix: (token: string, id: string, message: string) =>
    request<{
      answer: string;
      sources: unknown[];
      document: { title: string; version: number };
      retrieval?: FelixResponse["retrieval"];
    }>(
      `/documents/${id}/ask-felix`,
      { method: "POST", body: JSON.stringify({ message }) },
      token,
    ),
  assessDocumentFelix: (token: string, id: string, mode = "audit") =>
    request<Record<string, any>>(
      `/documents/${id}/felix-assessment`,
      { method: "POST", body: JSON.stringify({ mode }) },
      token,
    ),
  externalResearchImports: (token: string) =>
    request<ExternalResearchImport[]>("/research-imports", {}, token),
  externalResearchImport: (token: string, id: string) =>
    request<ExternalResearchImport>(`/research-imports/${id}`, {}, token),
  createExternalResearchImport: async (
    token: string,
    file: File,
    metadata: ExternalResearchImportInput,
  ) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    const inferredMimeType = extension === "pdf"
      ? "application/pdf"
      : extension === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : extension === "md"
          ? "text/markdown"
          : extension === "txt"
            ? "text/plain"
            : "application/octet-stream";
    const response = await workflowFetch(`${API_URL}/research-imports`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "X-File-Name": encodeURIComponent(file.name),
        "X-File-Type": file.type || inferredMimeType,
        "X-Title": encodeURIComponent(metadata.title),
        "X-Description": encodeURIComponent(metadata.description),
        "X-Author": encodeURIComponent(metadata.author),
        "X-Institution": encodeURIComponent(metadata.institution),
        "X-Directorate": encodeURIComponent(metadata.directorate),
        "X-Research-Type": encodeURIComponent(metadata.researchType),
        "X-Research-Date": encodeURIComponent(metadata.researchDate),
        "X-Tags": encodeURIComponent(metadata.tags),
        "X-Classification": metadata.classification,
        "X-Reviewer-Ids": metadata.reviewerIds.join(","),
        "X-Felix-Enabled": String(metadata.felixEnabled),
      },
      body: file,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || `Research import failed (HTTP ${response.status}).`);
    return data as ExternalResearchImport;
  },
  startExternalResearchReview: (token: string, id: string) =>
    request<ExternalResearchImport>(`/research-imports/${id}/start-review`, { method: "POST" }, token),
  decideExternalResearch: (
    token: string,
    id: string,
    decision: "Request Revision" | "Approve" | "Reject",
    notes: string,
  ) => request<ExternalResearchImport>(`/research-imports/${id}/decision`, { method: "POST", body: JSON.stringify({ decision, notes }) }, token),
  uploadExternalResearchRevision: async (token: string, id: string, file: File, notes = "") => {
    const response = await workflowFetch(`${API_URL}/research-imports/${id}/revisions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "X-File-Name": encodeURIComponent(file.name),
        "X-File-Type": file.type || "application/octet-stream",
        "X-Version-Notes": encodeURIComponent(notes),
      },
      body: file,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Revised research version could not be uploaded.");
    return data;
  },
  resubmitExternalResearch: (token: string, id: string) =>
    request<ExternalResearchImport>(`/research-imports/${id}/resubmit`, { method: "POST" }, token),
  loadDocumentReader: async (token: string, documentId: string, versionId?: string) => {
    const suffix = versionId ? `/versions/${versionId}` : "";
    const response = await workflowFetch(`${API_URL}/documents/${documentId}${suffix}/reader`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.error || "Document reader could not be opened.");
    }
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/pdf")) return { format: "pdf" as const, blob: await response.blob() };
    return { format: "document" as const, ...(await response.json()) };
  },
  research: (token: string, view: ResearchScopeView = "my") =>
    request<ResearchProject[]>(
      `/research?view=${encodeURIComponent(view)}`,
      {},
      token,
    ),
  researchProject: (token: string, id: string) =>
    request<ResearchProject>(`/research/${id}`, {}, token),
  createResearch: (token: string, input: Record<string, unknown>) =>
    request<ResearchProject>(
      "/research",
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  updateResearchPlan: (
    token: string,
    id: string,
    input: {
      summary: string;
      researchQuestion: string;
      objectives: string;
      methodology: string;
      startDate: string | null;
      endDate: string | null;
    },
  ) =>
    request<ResearchProject>(
      `/research/${id}/plan`,
      { method: "PATCH", body: JSON.stringify(input) },
      token,
    ),
  updateResearchTeam: (
    token: string,
    id: string,
    input: {
      leadId: string;
      collaborators: { userId: string; role: string }[];
    },
  ) =>
    request<ResearchProject>(
      `/research/${id}/team`,
      { method: "PATCH", body: JSON.stringify(input) },
      token,
    ),
  eligibleResearchTeamMembers: (token: string, id: string) =>
    request<ApiUser[]>(`/research/${id}/eligible-team-members`, {}, token),
  requestResearchTeamExpansion: (
    token: string,
    id: string,
    members: { userId: string; role: string }[],
  ) =>
    request<{ requested: boolean; names: string }>(
      `/research/${id}/team-expansion-request`,
      { method: "POST", body: JSON.stringify({ members }) },
      token,
    ),
  requestResearchBriefChange: (token: string, id: string, reason: string) =>
    request<{ requested: boolean }>(
      `/research/${id}/brief-change-request`,
      { method: "POST", body: JSON.stringify({ reason }) },
      token,
    ),
  updateResearchReviewers: (token: string, id: string, reviewerIds: string[]) =>
    request<{ reviewerIds: string[] }>(
      `/research/${id}/reviewers`,
      { method: "PATCH", body: JSON.stringify({ reviewerIds }) },
      token,
    ),
  eligibleResearchReviewers: (token: string, id: string) =>
    request<ApiUser[]>(`/research/${id}/eligible-reviewers`, {}, token),
  createResearchAssignment: (
    token: string,
    researchId: string,
    input: AssignmentInput,
  ) =>
    request<ApiAssignment>(
      `/research/${researchId}/assignments`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  decideResearchAssignmentRequest: (
    token: string,
    researchId: string,
    requestId: string,
    decision: "Approved" | "Rejected",
    comment = "",
  ) => request(
    `/research/${researchId}/assignment-requests/${requestId}/decision`,
    { method: "POST", body: JSON.stringify({ decision, comment }) },
    token,
  ),
  linkResearchAssignment: (
    token: string,
    researchId: string,
    assignmentId: string,
    relationType = "Research Work",
  ) =>
    request<{ assignmentId: string }>(
      `/research/${researchId}/assignments/link`,
      { method: "POST", body: JSON.stringify({ assignmentId, relationType }) },
      token,
    ),
  unlinkResearchAssignment: (token: string, researchId: string, assignmentId: string) =>
    request<void>(
      `/research/${researchId}/assignments/${assignmentId}`,
      { method: "DELETE" },
      token,
    ),
  updateResearchStatus: (token: string, id: string, status: string) =>
    request<ResearchProject>(
      `/research/${id}/status`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      token,
    ),
  addResearchMilestone: (
    token: string,
    id: string,
    input: {
      title: string;
      description: string;
      ownerId: string;
      dueDate: string;
      priority: string;
    },
  ) =>
    request(
      `/research/${id}/milestones`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  updateResearchMilestone: (
    token: string,
    id: string,
    milestoneId: string,
    status: string,
  ) =>
    request(
      `/research/${id}/milestones/${milestoneId}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      token,
    ),
  updateResearchMilestoneDetails: (
    token: string,
    id: string,
    milestoneId: string,
    input: { title: string; description: string; ownerId: string; dueDate: string; priority: string },
  ) =>
    request(
      `/research/${id}/milestones/${milestoneId}/details`,
      { method: "PATCH", body: JSON.stringify(input) },
      token,
    ),
  researchMilestoneTasks: (token: string, id: string, milestoneId: string) =>
    request<{ linked: ResearchMilestoneTask[]; available: ResearchMilestoneTask[] }>(
      `/research/${id}/milestones/${milestoneId}/tasks`,
      {},
      token,
    ),
  linkResearchMilestoneTask: (token: string, id: string, milestoneId: string, taskId: string) =>
    request<{ milestoneId: string; taskId: string }>(
      `/research/${id}/milestones/${milestoneId}/tasks/${taskId}`,
      { method: "POST" },
      token,
    ),
  unlinkResearchMilestoneTask: (token: string, id: string, milestoneId: string, taskId: string) =>
    request<void>(
      `/research/${id}/milestones/${milestoneId}/tasks/${taskId}`,
      { method: "DELETE" },
      token,
    ),
  researchRepositoryDocuments: (token: string, id: string) =>
    request<ResearchRepositoryDocument[]>(`/research/${id}/repository-documents`, {}, token),
  linkResearchRepositoryDocument: (token: string, id: string, knowledgeId: string) =>
    request<{ knowledgeId: string; title: string }>(
      `/research/${id}/repository-documents/link`,
      { method: "POST", body: JSON.stringify({ knowledgeId }) },
      token,
    ),
  unlinkResearchRepositoryDocument: (token: string, id: string, knowledgeId: string) =>
    request<void>(
      `/research/${id}/repository-documents/${knowledgeId}`,
      { method: "DELETE" },
      token,
    ),
  researchSources: (token: string, id: string) =>
    request<ResearchSource[]>(`/research/${id}/sources`, {}, token),
  addResearchSource: (
    token: string,
    id: string,
    input: Record<string, unknown>,
  ) =>
    request<ResearchSource>(
      `/research/${id}/sources`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  updateResearchSource: (
    token: string,
    id: string,
    sourceId: string,
    input: { provenance: string; quality: string; relevance: string },
  ) =>
    request<ResearchSource>(
      `/research/${id}/sources/${sourceId}`,
      { method: "PATCH", body: JSON.stringify(input) },
      token,
    ),
  deleteResearchSource: (token: string, id: string, sourceId: string) =>
    request<void>(
      `/research/${id}/sources/${sourceId}`,
      { method: "DELETE" },
      token,
    ),
  deleteResearch: (token: string, id: string, reason: string) =>
    request<void>(
      `/research/${id}`,
      { method: "DELETE", body: JSON.stringify({ reason }) },
      token,
    ),
  researchActivity: (token: string, id: string) =>
    request<ResearchActivity[]>(`/research/${id}/activity`, {}, token),
  documentTemplates: (token: string, context: "Assignment" | "Research") =>
    request<DocumentTemplate[]>(
      `/document-templates?context=${context}`,
      {},
      token,
    ),
  createDocumentTemplate: (token: string, input: Record<string, unknown>) =>
    request<DocumentTemplate>(
      "/document-templates",
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  governDocumentTemplate: (
    token: string,
    id: string,
    status: string,
    active: boolean,
  ) =>
    request<DocumentTemplate>(
      `/document-templates/${id}/governance`,
      { method: "PATCH", body: JSON.stringify({ status, active }) },
      token,
    ),
  generatedDocuments: (
    token: string,
    context: "Assignment" | "Research",
    contextId: string,
  ) =>
    request<GeneratedDocumentSummary[]>(
      `/generated-documents?context=${context}&contextId=${contextId}`,
      {},
      token,
    ),
  createGeneratedDocument: (
    token: string,
    input: {
      templateId: string;
      context: "Assignment" | "Research";
      contextId: string;
      title: string;
      classification: string;
    },
  ) =>
    request<GeneratedDocumentSummary>(
      "/generated-documents",
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  generatedDocument: (token: string, id: string) =>
    request<GeneratedDocument>(`/generated-documents/${id}`, {}, token),
  saveGeneratedDocumentSection: (
    token: string,
    id: string,
    sectionId: string,
    content: string,
    completion: number,
    sectionStatus?: string,
  ) =>
    request<GeneratedDocumentSection & { repository_sync_job_id?: number | null; repository_sync_status?: string; repository_sync_error?: string; repository_sync_message?: string; repository_draft_id?: string; repository_draft_version?: number; }>(
      `/generated-documents/${id}/sections/${sectionId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ content, completion, sectionStatus }),
      },
      token,
    ),
  lockGeneratedDocumentSection: (
    token: string,
    id: string,
    sectionId: string,
  ) =>
    request<{ expires_at: string }>(
      `/generated-documents/${id}/sections/${sectionId}/lock`,
      { method: "POST" },
      token,
    ),
  unlockGeneratedDocumentSection: (
    token: string,
    id: string,
    sectionId: string,
  ) =>
    request<void>(
      `/generated-documents/${id}/sections/${sectionId}/lock`,
      { method: "DELETE" },
      token,
    ),
  assignGeneratedDocumentSection: (
    token: string,
    id: string,
    sectionId: string,
    ownerId: string | null,
  ) =>
    request<GeneratedDocumentSection>(
      `/generated-documents/${id}/sections/${sectionId}/owner`,
      { method: "PATCH", body: JSON.stringify({ ownerId }) },
      token,
    ),
  resolveGeneratedDocumentComment: (
    token: string,
    id: string,
    commentId: string,
    resolved: boolean,
  ) =>
    request(
      `/generated-documents/${id}/comments/${commentId}/resolve`,
      { method: "PATCH", body: JSON.stringify({ resolved }) },
      token,
    ),
  downloadResearchDocumentTemplate: async (
    token: string,
    id: string,
    researchId: string,
    name: string,
  ) => {
    const response = await workflowFetch(
      `${API_URL}/research-document-templates/${id}/download?researchId=${researchId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok)
      throw new Error(
        (await response.json()).error || "Research template could not be downloaded.",
      );
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${name}.doc`;
    anchor.click();
    URL.revokeObjectURL(url);
  },
  downloadDocumentTemplate: async (
    token: string,
    id: string,
    assignmentId: string,
    name: string,
  ) => {
    const response = await workflowFetch(
      `${API_URL}/document-templates/${id}/download?assignmentId=${assignmentId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok)
      throw new Error(
        (await response.json()).error || "Template could not be downloaded.",
      );
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${name}.doc`;
    anchor.click();
    URL.revokeObjectURL(url);
  },
  exportGeneratedDocument: async (
    token: string,
    id: string,
    name: string,
    format: "docx" | "pdf" | "doc" = "docx",
  ) => {
    const response = await workflowFetch(
      `${API_URL}/generated-documents/${id}/export?format=${format}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "";
      let message = "Report could not be downloaded.";
      if (contentType.includes("application/json")) {
        const payload = await response.json().catch(() => null);
        if (typeof payload?.error === "string") message = payload.error;
      } else {
        const body = await response.text().catch(() => "");
        if (body.trim()) message = body.trim().slice(0, 300);
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    if (!blob.size) throw new Error("The report export was empty. Please save the report and try again.");
    if (format === "pdf") {
      if (blob.type && blob.type !== "application/pdf") {
        throw new Error("The server did not return a PDF. Please try again or contact support if this continues.");
      }
      if (await blob.slice(0, 5).text() !== "%PDF-") {
        throw new Error("The report export response is not a valid PDF. Please try again or contact support if this continues.");
      }
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "assignment-report"}.${format}`;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Keep the object URL alive long enough for the browser's download manager
    // to consume it. Revoking immediately can cancel the download in Chromium.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
  generatedDocumentControl: (token: string, id: string) =>
    request<GeneratedDocumentControl>(
      `/generated-documents/${id}/control`,
      {},
      token,
  ),
  applyAssignmentReportTemplate: (token: string, documentId: string, templateId: string, replaceExisting = false) =>
    request<{ applied: boolean; template: { id: string; name: string } }>(
      `/assignment-reports/${documentId}/apply-template`,
      { method: "POST", body: JSON.stringify({ templateId, replaceExisting }) },
      token,
    ),
  addGeneratedDocumentComment: (
    token: string,
    id: string,
    sectionId: string | null,
    body: string,
  ) =>
    request(
      `/generated-documents/${id}/comments`,
      { method: "POST", body: JSON.stringify({ sectionId, body }) },
      token,
    ),
  addGeneratedDocumentReference: (
    token: string,
    id: string,
    input: Record<string, unknown>,
  ) =>
    request(
      `/generated-documents/${id}/references`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  submitGeneratedDocument: (
    token: string,
    id: string,
    input: Record<string, unknown>,
  ) =>
    request(
      `/generated-documents/${id}/submit`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  reviewGeneratedDocument: (
    token: string,
    id: string,
    decision: string,
    comments: string,
  ) =>
    request(
      `/generated-documents/${id}/review`,
      { method: "POST", body: JSON.stringify({ decision, comments }) },
      token,
    ),
  submitAssignmentReport: (
    token: string,
    id: string,
    input: Record<string, unknown>,
  ) =>
    request(
      `/assignment-reports/${id}/submit`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  importAssignmentReport: async (
    token: string,
    id: string,
    file: File,
  ) => {
    const response = await workflowFetch(`${API_URL}/assignment-reports/${id}/import`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "X-File-Name": encodeURIComponent(file.name),
        "X-File-Type": file.type || "application/octet-stream",
      },
      body: file,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(payload.error || "The external report could not be imported.");
    return payload as ExternalAssignmentReportImport;
  },
  openImportedAssignmentReport: async (
    token: string,
    id: string,
    fileName = "assignment-report",
    mimeType = "application/octet-stream",
  ) => {
    const popup =
      mimeType === "application/pdf" ? window.open("about:blank", "_blank") : null;
    const response = await workflowFetch(
      `${API_URL}/assignment-reports/${id}/import/current/file`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) {
      popup?.close();
      throw new Error(
        (await response.json().catch(() => ({}))).error ||
          "The imported report could not be opened.",
      );
    }
    const url = URL.createObjectURL(await response.blob());
    if (mimeType === "application/pdf" && popup) {
      popup.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    }
  },
  fetchImportedAssignmentReportFile: async (
    token: string,
    id: string,
  ) => {
    const response = await workflowFetch(
      `${API_URL}/assignment-reports/${id}/import/current/file`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) {
      throw new Error(
        (await response.json().catch(() => ({}))).error ||
          "The imported report could not be opened.",
      );
    }
    return {
      blob: await response.blob(),
      mimeType: response.headers.get("content-type") || "application/octet-stream",
      fileName: "assignment-report",
    };
  },
  readImportedAssignmentReport: (
    token: string,
    id: string,
  ) =>
    request<{ html: string; fileName: string; mimeType: string }>(
      `/assignment-reports/${id}/import/current/reader`,
      {},
      token,
    ),
  discardImportedAssignmentReport: (
    token: string,
    id: string,
  ) =>
    request<{ discarded: boolean }>(
      `/assignment-reports/${id}/import/current`,
      { method: "DELETE" },
      token,
    ),
  compileAssignmentReport: (
    token: string,
    assignmentId: string,
    input: {
      templateId: string;
      title: string;
      taskIds: string[];
      knowledgeIds: string[];
      reportType?: "Progress" | "Final";
    },
  ) =>
    request<GeneratedDocumentSummary>(
      `/assignments/${assignmentId}/reports/compile`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  reviewAssignmentReport: async (
    token: string,
    id: string,
    decision: string,
    comments: string,
  ) => {
    const review = await request<GeneratedDocumentSummary>(
      `/assignment-reports/${id}/review`,
      { method: "POST", body: JSON.stringify({ decision, comments }) },
      token,
    );
    if (decision !== "Approved") return { review };
    try {
      const publication = await api.finalizeAssignmentReport(token, id);
      return { review, publication, publicationError: null };
    } catch (error) {
      return {
        review,
        publication: null,
        publicationError: error instanceof Error ? error.message : "Automatic publication failed.",
      };
    }
  },
  finalizeAssignmentReport: (token: string, id: string) =>
    request<{
      report: GeneratedDocumentSummary;
      repository_document_id: string;
      repository_document_title: string;
    }>(`/assignment-reports/${id}/finalize`, { method: "POST" }, token),
  newGeneratedDocumentVersion: (
    token: string,
    id: string,
    changeNote: string,
  ) =>
    request(
      `/generated-documents/${id}/new-version`,
      { method: "POST", body: JSON.stringify({ changeNote }) },
      token,
    ),
  researchComments: (token: string, id: string) =>
    request<
      {
        id: string;
        body: string;
        category: "Update" | "Question" | "Decision" | "Review Note";
        resolved: boolean;
        resolved_at: string | null;
        created_at: string;
        author_id: string;
        author_name: string;
      }[]
    >(`/research/${id}/comments`, {}, token),

  addResearchComment: (
    token: string,
    id: string,
    body: string,
    category: "Update" | "Question" | "Decision" | "Review Note" = "Update",
  ) =>
    request(
      `/research/${id}/comments`,
      {
        method: "POST",
        body: JSON.stringify({ body, category }),
      },
      token,
    ),
  resolveResearchComment: (
    token: string,
    id: string,
    commentId: string,
    resolved: boolean,
  ) =>
    request(
      `/research/${id}/comments/${commentId}/resolve`,
      { method: "PATCH", body: JSON.stringify({ resolved }) },
      token,
    ),

  researchReport: (token: string, id: string) =>
    request<ResearchReportSection[]>(`/research/${id}/report`, {}, token),

  researchReportVersions: (token: string, id: string) =>
    request<ResearchReportVersion[]>(`/research/${id}/report/versions`, {}, token),

  downloadResearchReportPdf: async (
    token: string,
    id: string,
    fileName: string,
    versionId?: string | null,
  ) => {
    const query = versionId ? `?versionId=${encodeURIComponent(versionId)}` : "";
    const response = await workflowFetch(
      `${API_URL}/research/${id}/report/export.pdf${query}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "The Research report PDF could not be downloaded.");
    }
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileName.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "research-report"}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  applyResearchReportTemplate: (
    token: string,
    id: string,
    input: { templateKey: string; replaceExisting?: boolean },
  ) =>
    request<{
      template: { name: string; template_key: string };
      sections: ResearchReportSection[];
    }>(
      `/research/${id}/report/apply-template`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),

  submitResearchReport: (token: string, id: string, input: { title: string; reviewerId: string }) =>
    request<ResearchReportVersion>(`/research/${id}/report/submit`, { method: "POST", body: JSON.stringify(input) }, token),

  decideResearchReport: (token: string, projectId: string, versionId: string, input: { decision: "Approved" | "Changes Requested" | "Rejected"; comments: string }) =>
    request<ResearchReportVersion>(`/research/${projectId}/report/versions/${versionId}/decision`, { method: "POST", body: JSON.stringify(input) }, token),

  researchReportSectionAccess: (token: string, projectId: string, sectionId: string) =>
    request<{
      can_edit: boolean;
      owner_id: string | null;
      owner_name: string | null;
      reviewer_id: string | null;
      reviewer_name: string | null;
      locked: boolean;
      reason: string;
    }>(`/research/${projectId}/report/${sectionId}/access`, {}, token),
  updateResearchReportSection: (
    token: string,
    projectId: string,
    sectionId: string,
    input: {
      title?: string;
      content?: string;
      status?:
        | "Not Started"
        | "Draft"
        | "In Progress"
        | "Ready for Review"
        | "Approved";
      ownerId?: string | null;
      reviewerId?: string | null;
      persistDraft?: boolean;
    },
  ) =>
    request<ResearchReportSection & {
      repository_document_id?: string;
      repository_version?: number;
      repository_sync_job_id?: number | null;
      repository_sync_status?: string;
      repository_sync_error?: string;
      repository_sync_message?: string;
      repository_draft_id?: string;
      repository_draft_version?: number;
    }>(
      `/research/${projectId}/report/${sectionId}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
      token,
    ),
  generateResearchReport: (
    token: string,
    projectId: string,
    input: {
      title: string;
      classification: "Official" | "Internal" | "Confidential" | "Public";
      templateId: string | null;
      mode?: "Draft" | "Final";
      reviewerId?: string | null;
      knowledgeIds?: string[];
    },
  ) =>
    request<GeneratedDocumentSummary>(
      `/research/${projectId}/report/generate`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),

  aiResearchEngine: (token: string) =>
    aiRequest<AiResearchEngine>("/engine", {}, token),
  askFelix: (
    token: string,
    message: string,
    history: { role: "user" | "assistant"; content: string }[] = [],
    mode: FelixMode = "Auto",
    documentId?: string,
  ) =>
    aiRequest<FelixResponse>(
      "/chat",
      { method: "POST", body: JSON.stringify({ message, history, mode, ...(documentId ? { document_id: documentId, retrieval_mode: "document" } : {}) }) },
      token,
    ),
  felixAdvice: (
    token: string,
    contextType: FelixAdviceContext,
    entry: Record<string, unknown>,
  ) =>
    aiRequest<FelixAdviceResponse>(
      "/advice",
      { method: "POST", body: JSON.stringify({ context_type: contextType, entry }) },
      token,
    ),
  changeProposals: (token: string) =>
    aiRequest<ChangeProposal[]>("/change-proposals", {}, token),
  createChangeProposal: (token: string, findingId: string) =>
    aiRequest<ChangeProposal>(
      `/code-review/findings/${encodeURIComponent(findingId)}/proposal`,
      { method: "POST" },
      token,
    ),
  decideChangeProposal: (
    token: string,
    id: string,
    decision: "Approved" | "Rejected",
    comments: string,
  ) =>
    aiRequest<ChangeProposal>(
      `/change-proposals/${id}/decision`,
      { method: "POST", body: JSON.stringify({ decision, comments }) },
      token,
    ),
  scheduledReviews: (token: string) =>
    aiRequest<ScheduledReviews>("/scheduled-reviews", {}, token),
  updateScheduledReview: (
    token: string,
    id: string,
    input: {
      enabled: boolean;
      intervalMinutes: number | null;
      scheduleTime: string | null;
      scheduleWeekday: number | null;
    },
  ) =>
    aiRequest<ScheduledReviewJob>(
      `/scheduled-reviews/${id}`,
      { method: "PATCH", body: JSON.stringify(input) },
      token,
    ),
  runScheduledReview: (token: string, id: string) =>
    aiRequest<ScheduledReviewRun>(
      `/scheduled-reviews/${id}/run`,
      { method: "POST" },
      token,
    ),
  felixAuditEvents: (token: string, params = "") =>
    aiRequest<{ items: FelixAuditEvent[]; total: number }>(
      `/audit-events${params ? `?${params}` : ""}`,
      {},
      token,
    ),
  felixAdminOverview: (token: string) =>
    aiRequest<FelixAdminOverview>("/admin/overview", {}, token),
  felixIndexApp2Source: (token: string) =>
    aiRequest<{status:string;repository:string;scanned_files:number;added_files:number;changed_files:number;unchanged_files:number;removed_files:number;branch?:string|null;commit?:string|null}>("/admin/index-app2", { method: "POST" }, token),
  aiResearchJobs: (token: string) =>
    aiRequest<AiResearchJob[]>("/jobs", {}, token),
  createAiResearchJob: (
    token: string,
    input: {
      title: string;
      question: string;
      scope: string;
      sourceMode: string;
      depth: string;
    },
  ) =>
    aiRequest<AiResearchJob>(
      "/jobs",
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  startAiResearchJob: (token: string, id: string) =>
    aiRequest<AiResearchJob>(`/jobs/${id}/start`, { method: "POST" }, token),
  updateAiResearchStatus: (
    token: string,
    id: string,
    status: string,
    comments = "",
  ) =>
    aiRequest<AiResearchJob>(
      `/jobs/${id}/status`,
      { method: "PATCH", body: JSON.stringify({ status, comments }) },
      token,
    ),
  documents: (token: string) =>
    request<DocumentItem[]>("/documents", {}, token),
  repositoryOrigins: (token: string) =>
    request<RepositoryOrigin[]>("/repository/origins", {}, token),
  documentDeletionRequests: (token: string) =>
    request<DocumentDeletionRequest[]>(
      "/document-deletion-requests",
      {},
      token,
    ),
  requestDocumentDeletion: (token: string, id: string, reason: string) =>
    request<DocumentDeletionRequest>(
      `/documents/${id}/deletion-requests`,
      { method: "POST", body: JSON.stringify({ reason }) },
      token,
    ),
  decideDocumentDeletion: (
    token: string,
    id: string,
    approved: boolean,
    comments: string,
  ) =>
    request<DocumentDeletionRequest>(
      `/document-deletion-requests/${id}/decision`,
      { method: "POST", body: JSON.stringify({ approved, comments }) },
      token,
    ),
  checkoutDocument: (token: string, id: string) =>
    request(`/documents/${id}/checkout`, { method: "POST" }, token),
  checkinDocument: (token: string, id: string) =>
    request<void>(`/documents/${id}/checkin`, { method: "POST" }, token),
  retainDocument: (
    token: string,
    id: string,
    retentionUntil: string | null,
    archive = false,
  ) =>
    request<DocumentItem>(
      `/documents/${id}/retention`,
      { method: "PATCH", body: JSON.stringify({ retentionUntil, archive }) },
      token,
    ),
  repositorySavedViews: (token: string) =>
    request<RepositorySavedView[]>("/repository/saved-views", {}, token),
  saveRepositoryView: (token: string, name: string, filters: Record<string, unknown>) =>
    request<RepositorySavedView>("/repository/saved-views",{method:"POST",body:JSON.stringify({name,filters})},token),
  deleteRepositoryView: (token: string, id: string) =>
    request<void>(`/repository/saved-views/${id}`,{method:"DELETE"},token),
  repositoryRetentionSchedules: (token: string) =>
    request<RepositoryRetentionSchedule[]>("/repository/retention-schedules",{},token),
  createRepositoryRetentionSchedule: (
    token:string,
    input:{name:string;recordClass:string;reviewIntervalMonths:number|null;retentionYears:number|null;dispositionAction:"Review"|"Destroy"|"Transfer"|"Permanent";description:string},
  ) => request<RepositoryRetentionSchedule>("/repository/retention-schedules",{method:"POST",body:JSON.stringify(input)},token),
  updateDocumentGovernance: (token:string,id:string,input:{recordClass:string;retentionScheduleId:string|null;nextReviewAt:string|null}) =>
    request<DocumentItem>(`/documents/${id}/governance`,{method:"PATCH",body:JSON.stringify(input)},token),
  supersedeDocument: (token:string,id:string,replacementId:string) =>
    request<{ok:boolean}>(`/documents/${id}/supersede`,{method:"POST",body:JSON.stringify({replacementId})},token),
  completeRepositoryGovernanceReview: (
    token:string,
    id:string,
    input:{
      outcome:"Confirm Current"|"Needs Improvement"|"Supersede Required";
      nextReviewAt:string|null;
      comments:string;
    },
  ) => request<DocumentItem>(
    `/documents/${id}/governance-review`,
    {method:"POST",body:JSON.stringify(input)},
    token,
  ),
  repositoryGovernanceReconciliation: (token:string) =>
    request<RepositoryGovernanceReconciliationRow[]>("/repository/governance-reconciliation",{},token),
  applyRepositoryGovernanceReconciliation: (
    token:string,
    id:string,
    input:{
      reviewerId?:string|null;
      retentionScheduleId?:string|null;
      nextReviewAt?:string|null;
      reviewerSource?:"single-authoritative-approval"|"manual-manager-confirmation"|null;
      retentionSource?:"exact-record-class"|"manual-manager-confirmation"|null;
    },
  ) => request<DocumentItem>(
    `/repository/governance-reconciliation/${id}/apply`,
    {method:"POST",body:JSON.stringify(input)},
    token,
  ),
  repositoryAssuranceOverview: (token:string) =>
    request<RepositoryAssuranceOverview>("/documents/assurance-summary",{},token),
  repositoryRecordAssurance: (token:string,id:string) =>
    request<RepositoryRecordAssurance>(`/documents/${id}/assurance`,{},token),
  repositoryRecordDetail: (token:string,id:string) =>
    request<RepositoryRecordDetail>(`/documents/${id}/detail`,{},token),
  felixRecordContext: (token:string,id:string) =>
    request<FelixRecordContext>(`/documents/${id}/felix-record-context`,{},token),
  documentProtectionEffective: (token: string, id: string) =>
    request<DocumentProtectionEffective>(`/documents/${id}/protection-effective`, {}, token),
  recordDocumentPrint: (token: string, id: string) =>
    request<void>(`/documents/${id}/print-event`, { method: "POST" }, token),
  documentProtection: (token: string, id: string) =>
    request<DocumentProtectionPolicy>(`/documents/${id}/protection`, {}, token),
  updateDocumentProtection: (
    token: string,
    id: string,
    input: {
      readerScope: DocumentProtectionPolicy["reader_scope"];
      allowDownload: boolean;
      allowCopy: boolean;
      allowPrint: boolean;
      allowLink: boolean;
      watermark: boolean;
      restrictionReason: string;
      expiresAt: string | null;
      userIds: string[];
    },
  ) =>
    request<DocumentProtectionPolicy>(
      `/documents/${id}/protection`,
      { method: "PUT", body: JSON.stringify(input) },
      token,
    ),
  documentRelationships: (token: string, id: string) =>
    request<RepositoryRelationship[]>(`/documents/${id}/relationships`, {}, token),
  createDocumentRelationship: (
    token: string,
    id: string,
    input: {
      relationshipType: RepositoryRelationship["relationship_type"];
      entityType: RepositoryRelationship["entity_type"];
      entityId: string;
      pinCurrentVersion: boolean;
      notes?: string;
    },
  ) =>
    request<RepositoryRelationship>(
      `/documents/${id}/relationships`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  deleteDocumentRelationship: (token: string, id: string, relationshipId: string) =>
    request<{ ok: boolean }>(
      `/documents/${id}/relationships/${relationshipId}`,
      { method: "DELETE" },
      token,
    ),
  documentImprovements: (token: string, documentId?: string) =>
    request<DocumentImprovementAssignment[]>(
      `/document-improvements${documentId ? `?documentId=${encodeURIComponent(documentId)}` : ""}`,
      {},
      token,
    ),
  createDocumentImprovement: (
    token: string,
    id: string,
    input: {
      assigneeId: string;
      reviewerId: string;
      improvementType: DocumentImprovementAssignment["improvement_type"];
      reason: string;
      dueDate: string | null;
    },
  ) =>
    request<DocumentImprovementAssignment>(
      `/documents/${id}/improvements`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  updateDocumentImprovementStatus: (
    token: string,
    id: string,
    status: DocumentImprovementAssignment["status"],
  ) =>
    request<DocumentImprovementAssignment>(
      `/document-improvements/${id}/status`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      token,
    ),
  updateDocumentRecordsMetadata: (
    token: string,
    id: string,
    input: {
      recordNumber?: string | null;
      recordClass?: string;
      reviewDueAt?: string | null;
      dispositionAction?: "Review" | "Destroy" | "Transfer" | "Permanent";
      legalHold?: boolean;
      legalHoldReason?: string | null;
    },
  ) =>
    request<DocumentItem>(
      `/documents/${id}/records-metadata`,
      { method: "PATCH", body: JSON.stringify(input) },
      token,
    ),
  declareDocumentRecord: (token: string, id: string) =>
    request<DocumentItem>(
      `/documents/${id}/declare-record`,
      { method: "POST" },
      token,
    ),
  documentReviewers: (token: string) =>
    request<ApiUser[]>("/document-reviewers", {}, token),
  documentReviews: (token: string) =>
    request<ReviewItem[]>("/document-reviews", {}, token),
  assignDocumentReviewer: (token: string, id: string, reviewerId: string) =>
    request<ReviewItem>(
      `/document-reviews/${id}/assign`,
      { method: "PATCH", body: JSON.stringify({ reviewerId }) },
      token,
    ),
  decideDocumentReview: (
    token: string,
    id: string,
    approved: boolean,
    comments: string,
  ) =>
    request<DocumentItem>(
      `/document-reviews/${id}/decision`,
      { method: "POST", body: JSON.stringify({ approved, comments }) },
      token,
    ),
  documentReviewHistory: (token: string, id: string) =>
    request<ReviewEvent[]>(`/document-reviews/${id}/history`, {}, token),
  reindexFelixDocument: (token: string, id: string) =>
    request<{ queued: boolean; documentId: string; version: number }>(`/documents/${id}/felix/reindex`, { method: "POST" }, token),
  reindexPublishedFelixDocuments: (token: string) =>
    request<{ queued: number; scope: string }>(`/documents/felix/reindex-published`, { method: "POST" }, token),
  documentActivity: (token: string, id: string) =>
    request<Array<{id:number;action:string;created_at:string;user_name:string;details:Record<string,unknown>}>>(`/documents/${id}/activity`, {}, token),
  logDocumentCopy: (token: string, id: string, payload: {versionId?: string; page?: number; charCount: number; mode: "INTERNAL_COPY" | "BLOCKED_NATIVE"}) =>
    request<void>(`/documents/${id}/copy-event`, {method:"POST", body:JSON.stringify(payload)}, token),
  dashboard: (token: string, signal?: AbortSignal) =>
    request<DashboardResponse>("/dashboard", { signal }, token),
  dashboardTeamWorkload: (token: string, userId: string) =>
    request<DashboardTeamWorkloadDetail>(
      `/dashboard/team/${userId}/workload`,
      {},
      token,
    ),
  completedWork: (token: string, signal?: AbortSignal) =>
    request<CompletedWorkResponse>(
      "/dashboard/completed-work",
      { signal },
      token,
    ),
  notifications: (token: string, signal?: AbortSignal) =>
    request<ApiNotification[]>("/notifications", {signal}, token),
  messageUsers: (token:string) =>
    request<MessageUser[]>("/messages/users", {}, token),
  messagePresence: (token:string) => request<MessagePresence[]>("/messages/presence", {}, token),
  setMessagePresence: (token:string,status:"Online"|"Away") => request<MessagePresence>("/messages/presence",{method:"POST",body:JSON.stringify({status})},token),
  messageUnreadCount: (token:string) =>
    request<{unread:number}>("/messages/unread-count", {}, token),
  recentUnreadMessages: (token:string) =>
    request<IncomingMessagePreview[]>("/messages/recent-unread", {}, token),
  messageConversations: (token:string) =>
    request<MessageConversation[]>("/messages/conversations", {}, token),
  createMessageConversation: (
    token:string,
    input:{participantIds:string[];title?:string},
  ) => request<MessageConversation>("/messages/conversations",
    {method:"POST",body:JSON.stringify(input)},token),
  conversationMessages: (token:string,conversationId:string) =>
    request<AppMessage[]>(`/messages/conversations/${conversationId}`, {}, token),
  messageConversationInfo: (token:string,conversationId:string) =>
    request<MessageConversationInfo>(`/messages/conversations/${conversationId}/info`, {}, token),
  messageConversationEvents: (token:string,conversationId:string) =>
    request<MessageConversationEvent[]>(`/messages/conversations/${conversationId}/events`, {}, token),
  renameMessageConversation: (token:string,conversationId:string,title:string) =>
    request<MessageConversation>(`/messages/conversations/${conversationId}`,
      {method:"PATCH",body:JSON.stringify({title})},token),
  addMessageConversationMembers: (token:string,conversationId:string,memberIds:string[]) =>
    request<{added:Array<{id:string;name:string}>}>(`/messages/conversations/${conversationId}/members`,
      {method:"POST",body:JSON.stringify({memberIds})},token),
  removeMessageConversationMember: (token:string,conversationId:string,userId:string) =>
    request<{ok:boolean}>(`/messages/conversations/${conversationId}/members/${userId}`,
      {method:"DELETE"},token),
  markConversationRead: (token:string,conversationId:string) =>
    request<{ok:boolean}>(`/messages/conversations/${conversationId}/read`,
      {method:"POST",body:JSON.stringify({})},token),
  sendConversationMessage: (
    token:string,
    conversationId:string,
    input:{body:string;contextType?:string|null;contextId?:string|null;contextTitle?:string|null;replyToMessageId?:string|null},
  ) => request<AppMessage>(`/messages/conversations/${conversationId}/messages`,
    {method:"POST",body:JSON.stringify(input)},token),
  reactToMessage: (token:string,messageId:string,emoji:string) =>
    request<{ok:boolean}>(`/messages/messages/${messageId}/reactions`,{method:"POST",body:JSON.stringify({emoji})},token),
  removeMessageReaction: (token:string,messageId:string,emoji:string) =>
    request<{ok:boolean}>(`/messages/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,{method:"DELETE"},token),
  uploadMessageAttachment: async (token:string,conversationId:string,file:File) => {
    const response=await workflowFetch(`${API_URL}/messages/conversations/${conversationId}/attachments`,{
      method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/octet-stream","X-File-Name":encodeURIComponent(file.name),"X-File-Type":file.type||"application/octet-stream"},body:file,
    });
    const data=await response.json();
    if(!response.ok)throw new Error(data?.error||"Message attachment could not be uploaded.");
    return data as AppMessage;
  },
  downloadMessageAttachment: async (token:string,attachmentId:string,fileName:string) => {
    const response=await workflowFetch(`${API_URL}/messages/attachments/${attachmentId}/download`,{headers:{Authorization:`Bearer ${token}`}});
    if(!response.ok)throw new Error("Message attachment could not be downloaded.");
    const url=URL.createObjectURL(await response.blob());
    const anchor=document.createElement("a");anchor.href=url;anchor.download=fileName;anchor.click();URL.revokeObjectURL(url);
  },
  setConversationTyping: (token:string,conversationId:string,typing:boolean) => request<{ok:boolean}>(`/messages/conversations/${conversationId}/typing`,{method:"POST",body:JSON.stringify({typing})},token),
  internalEmailRecipients: (token: string) =>
    request<InternalEmailRecipient[]>("/internal-email/recipients", {}, token),
  sentInternalEmails: (token: string) =>
    request<InternalSentEmail[]>("/internal-email/sent", {}, token),
  sendInternalEmail: (token: string, input: {recipientIds:string[];subject:string;body:string}) =>
    request<{id:string;status:string;recipientCount:number}>(
      "/internal-email",{method:"POST",body:JSON.stringify(input)},token),
  repositoryGroups: (token: string, domain?: RepositoryGroup["domain"]) =>
    request<RepositoryGroup[]>(`/repository/groups${domain ? `?domain=${encodeURIComponent(domain)}` : ""}`, {}, token),
  logPreviewCopy: (
    token: string,
    input: {
      entityType: "knowledge" | "generated_document" | "assignment_task";
      entityId: string;
      source: string;
      characters: number;
    },
  ) =>
    request<{ logged: true }>(
      "/reader-copy-events",
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  readNotification: (token: string, id: string) =>
    request<ApiNotification>(
      `/notifications/${id}/read`,
      { method: "PATCH" },
      token,
    ),
  updateNotificationState: (token: string, id: string, state: {read?: boolean; important?: boolean; archived?: boolean}) =>
    request<ApiNotification>(`/notifications/${id}/state`, {method: "PATCH", body: JSON.stringify(state)}, token),
  readAllNotifications: (token: string) =>
    request<{ updated: number }>(
      "/notifications/read-all",
      { method: "PATCH" },
      token,
    ),
  archiveReadNotifications: (token: string) =>
    request<{updated: number}>("/notifications/archive-read", {method: "PATCH"}, token),
  clearReadNotifications: (token: string) =>
    request<{ deleted: number }>(
      "/notifications/read",
      { method: "DELETE" },
      token,
    ),
  analytics: (
    token: string,
    filters: { from: string; to: string; division: string; status: string },
  ) =>
    request<AnalyticsReport>(
      `/analytics/reports?${new URLSearchParams(filters)}`,
      {},
      token,
    ),
  reportCatalogue: (token: string) =>
    request<ReportDefinition[]>("/reports", {}, token),
  reportsSummary: (token: string) =>
    request<ReportsSummary>("/reports-summary", {}, token),
  reportCategories: (token: string) =>
    request<string[]>("/reports/categories", {}, token),
  reportData: (
    token: string,
    key: string,
    filters: Record<string, string | number>,
  ) =>
    request<ReportData>(
      `/reports/${key}/data?${new URLSearchParams(Object.entries(filters).map(([name, value]) => [name, String(value)]))}`,
      {},
      token,
    ),
  reportIntelligence: (token: string, filters: Record<string, string> = {}) =>
    request<InstitutionalIntelligence>(
      `/report-intelligence?${new URLSearchParams(filters).toString()}`,
      {},
      token,
    ),
  favouriteReport: (token: string, key: string, favourite: boolean) =>
    request<{ key: string; favourite: boolean }>(
      `/reports/${key}/favourite`,
      { method: favourite ? "POST" : "DELETE" },
      token,
    ),
  reportViews: (token: string, key: string) =>
    request<ReportView[]>(`/reports/${key}/views`, {}, token),
  saveReportView: (
    token: string,
    key: string,
    name: string,
    filters: Record<string, string | number | boolean>,
    isDefault = false,
  ) =>
    request<ReportView>(
      `/reports/${key}/views`,
      { method: "POST", body: JSON.stringify({ name, filters, isDefault }) },
      token,
    ),
  deleteReportView: (token: string, key: string, id: string) =>
    request<{ id: string }>(
      `/reports/${key}/views/${id}`,
      { method: "DELETE" },
      token,
    ),
  exportReport: async (
    token: string,
    key: string,
    format: "pdf" | "docx" | "xlsx",
    filters: Record<string, string | number>,
  ) => {
    const response = await workflowFetch(
      `${API_URL}/reports/${key}/export?${new URLSearchParams([...Object.entries(filters).map(([name, value]) => [name, String(value)]), ["format", format]])}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) {
      let message = "Report could not be exported.";
      try {
        message = (await response.json()).error || message;
      } catch {}
      throw new Error(message);
    }
    const disposition = response.headers.get("content-disposition") || "",
      match = disposition.match(/filename="?([^";]+)"?/);
    const url = URL.createObjectURL(await response.blob()),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = match?.[1] || `report.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  },
  exportReportPack: async (
    token: string,
    reportKeys: string[],
    input: { title: string; paperSize: "A4" | "Letter"; filters: Record<string, string | number | boolean> },
  ) => {
    const response = await workflowFetch(`${API_URL}/reports/export-pack`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reportKeys, ...input }),
    });
    if (!response.ok) {
      let message = "Consolidated report pack could not be exported.";
      try { message = (await response.json()).error || message; } catch {}
      throw new Error(message);
    }
    const disposition = response.headers.get("content-disposition") || "",
      match = disposition.match(/filename="?([^";]+)"?/);
    const url = URL.createObjectURL(await response.blob()), anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = match?.[1] || "consolidated-report-pack.pdf";
    anchor.click();
    URL.revokeObjectURL(url);
  },
  reportGovernance: (token: string) =>
    request<ReportGovernance>("/report-governance", {}, token),
  reportSchedules: (token: string) =>
    request<ReportSchedule[]>("/report-schedules", {}, token),
  createReportSchedule: (token: string, input: {
    reportKey: string; name: string; format: "pdf" | "docx" | "xlsx";
    frequency: "Daily" | "Weekly" | "Monthly"; recipientEmails: string[];
    filters: Record<string, string | number | boolean>; nextRunAt: string;
  }) =>
    request<ReportSchedule>(
      "/report-schedules",
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  updateReportSchedule: (token: string, id: string, enabled: boolean) =>
    request<ReportSchedule>(
      `/report-schedules/${id}`,
      { method: "PATCH", body: JSON.stringify({ enabled }) },
      token,
    ),
  deleteReportSchedule: (token: string, id: string) =>
    request<{ id: string }>(
      `/report-schedules/${id}`,
      { method: "DELETE" },
      token,
    ),
  reportDecisions: (token: string, key: string) =>
    request<Record<string, unknown>[]>(`/reports/${key}/decisions`, {}, token),
  createReportDecision: (
    token: string,
    key: string,
    input: Record<string, unknown>,
  ) =>
    request<Record<string, unknown>>(
      `/reports/${key}/decisions`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  resolveReportDecision: (token: string, key: string, id: string) =>
    request<Record<string, unknown>>(
      `/reports/${key}/decisions/${id}/resolve`,
      { method: "PATCH", body: "{}" },
      token,
    ),
  signoffReport: (
    token: string,
    key: string,
    filters: Record<string, string | number | boolean>,
    comments: string,
  ) =>
    request<Record<string, unknown>>(
      `/reports/${key}/signoff`,
      { method: "POST", body: JSON.stringify({ filters, comments }) },
      token,
    ),
  updateReportDefinition: (
    token: string,
    key: string,
    enabled: boolean,
    accessNote = "",
  ) =>
    request<Record<string, unknown>>(
      `/admin/report-definitions/${key}`,
      { method: "PATCH", body: JSON.stringify({ enabled, accessNote }) },
      token,
    ),
  auditLogs: (
    token: string,
    filters: {
      search: string;
      userId: string;
      action: string;
      entityType: string;
      from: string;
      to: string;
    },
  ) =>
    request<AuditResponse>(
      `/audit-logs?${new URLSearchParams(filters)}`,
      {},
      token,
    ),
  settings: (token: string) =>
    request<SettingsResponse>("/settings", {}, token),
  settingsUpdateStatus: (token: string) =>
    request<UpdateStatus>("/settings/updates", {}, token),
  emailDeliveryStatus: (token: string) =>
    request<EmailDeliveryStatus>("/settings/email-status", {}, token),
  notificationEmailStatus: (token: string) =>
    request<{mailer: EmailDeliveryStatus; queue: {email_status:string; total:number}[]}>("/settings/notification-email-status", {}, token),
  sendTestEmail: (token: string, email: string) =>
    request<{ message: string; messageId: string; accepted: string[] }>(
      "/settings/test-email",
      { method: "POST", body: JSON.stringify({ email }) },
      token,
    ),
  updateSystemSettings: (
    token: string,
    input: {
      organizationName: string;
      departmentName: string;
      supportEmail: string;
      sessionMinutes: number;
      maxUploadMb: number;
      defaultRetentionDays: number;
      documentCategories: string[];
      maintenanceMode: boolean;
      emailNotifications: boolean;
    },
  ) =>
    request(
      "/settings/system",
      { method: "PATCH", body: JSON.stringify(input) },
      token,
    ),
  updatePreferences: (
    token: string,
    input: {
      emailNotifications: boolean;
      inAppNotifications: boolean;
      importantEmailNotifications: boolean;
      deadlineReminders: boolean;
      compactLayout: boolean;
      themeMode: "Dark" | "Light" | "System" | "Gold Grey" | "Navy Blue" | "PSC Slate" | "Low-Contrast Navy" | "Executive Gold" | "Sage Ivory";
      accentColor: "Gold" | "Blue" | "Green";
    },
  ) =>
    request(
      "/settings/preferences",
      { method: "PATCH", body: JSON.stringify(input) },
      token,
    ),
  alerts: (token: string) => request<NoticeItem[]>("/alerts", {}, token),
  submitNotice: (
    token: string,
    input: {
      title: string;
      body: string;
      severity: string;
      audienceRole: string | null;
      eventStart: string | null;
      eventEnd: string | null;
      expiresAt: string;
    },
  ) =>
    request<NoticeItem>(
      "/alerts",
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  reviewNotice: (
    token: string,
    id: string,
    approved: boolean,
    reason: string,
  ) =>
    request<NoticeItem>(
      `/alerts/${id}/review`,
      { method: "PATCH", body: JSON.stringify({ approved, reason }) },
      token,
    ),
  deleteNotice: (token: string, id: string) =>
    request<void>(`/alerts/${id}`, { method: "DELETE" }, token),
  pinNotice: (token:string,id:string,pinned:boolean) => request<NoticeItem>(`/alerts/${id}/pin`,{method:"PATCH",body:JSON.stringify({pinned})},token),
  noticeComments: (token:string,id:string) => request<NoticeComment[]>(`/alerts/${id}/comments`,{},token),
  commentOnNotice: (token:string,id:string,body:string) => request<NoticeComment>(`/alerts/${id}/comments`,{method:"POST",body:JSON.stringify({body})},token),
  calendar: (token: string) => request<CalendarItem[]>("/calendar", {}, token),
  createCalendarEvent: (token:string,input:{title:string;description:string;startAt:string;endAt:string|null;eventType:string}) => request<CalendarItem>("/calendar/events",{method:"POST",body:JSON.stringify(input)},token),
  updateCalendarEvent: (token:string,id:string,input:{title:string;description:string;startAt:string;endAt:string|null;eventType:string}) => request<CalendarItem>(`/calendar/events/${id}`,{method:"PATCH",body:JSON.stringify(input)},token),
  deleteCalendarEvent: (token:string,id:string) => request<void>(`/calendar/events/${id}`,{method:"DELETE"},token),
};

export const loadPulse = (token: string, signal?: AbortSignal) => request<import('./modules/dashboard/pulseTypes').PulseData>('/pulse', {signal}, token);

async function workflowFetch(input: RequestInfo | URL, options?: RequestInit) {
  const response = await fetch(input, options);
  const method = options?.method?.toUpperCase();
  if (response.ok && method && !["GET", "HEAD"].includes(method)) {
    const revision = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.dispatchEvent(new CustomEvent("app2:workflow-changed", {
      detail: { revision, method },
    }));
    try {
      window.localStorage.setItem("app2:workflow-revision", revision);
    } catch {
      // Storage can be unavailable in hardened/private browser contexts.
    }
  }
  return response;
}

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
const AI_API_URL = import.meta.env.VITE_AI_API_URL || `${API_URL}/felix`;
let unauthorizedHandler: (() => void) | null = null;

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  division: string;
  status: string;
  active: boolean;
  must_change_password?: boolean;
  active_assignments?: number;
  completed_assignments?: number;
};
export type ApiAssignment = {
  id: string;
  title: string;
  description: string;
  division: string;
  status: string;
  priority: string;
  due_date: string | null;
  created_at?: string;
  updated_at?: string;
  members: { id: string; name: string; role: string }[];
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
  division: string;
  dueDate: string | null;
  priority: string;
  memberIds: string[];
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
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  archived_by?: string | null;
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
  created_by_name: string;
  latest_version: number;
  original_name: string;
  size_bytes: number;
  source_type: string;
  source_url: string;
  reviewer_name?: string | null;
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
  created_by_name: string;
};
export type ResearchProject = {
  id: string;
  title: string;
  summary: string;
  research_question: string;
  objectives: string;
  methodology: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  assignment_id: string | null;
  lead_id: string;
  lead_name: string;
  collaborators: { id: string; name: string; role: string }[];
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
  template_version: number;
  context: "Assignment" | "Research";
  context_id: string;
  title: string;
  reference: string;
  classification: string;
  status: string;
  version: number;
  created_by_name: string;
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
export type GeneratedDocument = GeneratedDocumentSummary & {
  template_status: string;
  current_user_role?: "Lead" | "Contributor" | "Reviewer" | "Manager" | null;
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
export type ReviewItem = DocumentItem & {
  reviewer_id?: string;
  reviewer_name?: string;
  review_history: ReviewEvent[];
};
export type ApiNotification = {
  id: string;
  title: string;
  body: string;
  entity_type?: string;
  entity_id?: string;
  read_at: string | null;
  created_at: string;
};
export type DashboardWorkItem = {
  id: string;
  type:
    | "Assignment"
    | "Task"
    | "Research Project"
    | "Research Milestone"
    | "Review";
  title: string;
  status: string;
  dueDate: string | null;
  nextAction: string;
  destination: string;
  contextId: string;
  updatedAt?: string;
  days?: number;
  group?: "Overdue" | "Today" | "Tomorrow" | "This Week" | "Later";
};
export type DashboardResponse = {
  generatedAt: string;
  role: string;
  attention: {
    assignments: number;
    reviews: number;
    overdue: number;
    notifications: number;
    almostDue: number;
  };
  myWork: DashboardWorkItem[];
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
    team: { total: number; roles: Record<string, number> };
    assignments: { active: number; overdue: number };
    research: { active: number };
    repository: { awaitingPublication: number; published: number };
  };
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
    compact_layout: boolean;
    theme_mode: "Dark" | "Light" | "System" | "Gold Grey";
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
  const response = await fetch(`${API_URL}${path}`, {
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
  let data: any = null;
  if (response.status !== 204) {
    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text();
    if (contentType.includes("application/json")) {
      try {
        data = raw ? JSON.parse(raw.replace(/^\uFEFF/, "")) : null;
      } catch {
        throw new Error(
          `The App2 API returned malformed JSON for ${path} (HTTP ${response.status}). Restart the API service and try again.`,
        );
      }
    } else {
      const preview = raw.replace(/\s+/g, " ").trim().slice(0, 120);
      throw new Error(
        `The App2 API returned ${contentType || "an unknown response type"} for ${path} (HTTP ${response.status})${preview && !/[\u0000-\u0008]/.test(preview) ? `: ${preview}` : ""}.`,
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

async function aiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  try {
    const response = await fetch(`${AI_API_URL}${path}`, {
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
        "The separate AI Researcher service is offline. App2 is still available.",
      );
    throw error;
  }
}
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
    request<{ message: string; resetToken?: string }>("/auth/forgot-password", {
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
      temporaryPassword?: string;
    },
  ) =>
    request<ApiUser & { temporary_password: string }>(
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
  resetUserPassword: (token: string, id: string) =>
    request<{ message: string; temporaryPassword: string }>(
      `/users/${id}/reset-password`,
      { method: "POST" },
      token,
    ),
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
  deleteAssignmentTask: (token: string, assignmentId: string, taskId: string) =>
    request<void>(
      `/assignments/${assignmentId}/tasks/${taskId}`,
      { method: "DELETE" },
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
    input: Record<string, unknown>,
  ) =>
    request<ApiAssignmentTaskRequest>(
      `/assignments/${assignmentId}/task-requests/${requestId}`,
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
    const response = await fetch(
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
    const response = await fetch(
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
      sourceType: string;
      sourceUrl: string;
      originEntityId?: string;
      directorate: string;
      documentType: string;
      subject: string;
      classification: string;
      felixEnabled: boolean;
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
    const response = await fetch(`${API_URL}/knowledge`, {
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
        "X-Source-Type": encodeURIComponent(metadata.sourceType),
        "X-Source-Url": encodeURIComponent(metadata.sourceUrl),
        "X-Directorate": encodeURIComponent(metadata.directorate),
        "X-Document-Type": encodeURIComponent(metadata.documentType),
        "X-Subject": encodeURIComponent(metadata.subject),
        "X-Classification": metadata.classification,
        "X-Felix-Enabled": String(metadata.felixEnabled),
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
    const response = await fetch(`${API_URL}/knowledge/${id}/versions`, {
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
    const response = await fetch(
      `${API_URL}/knowledge/versions/${id}/download`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) throw new Error("Document could not be downloaded.");
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
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
  research: (token: string) =>
    request<ResearchProject[]>("/research", {}, token),
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
    request<GeneratedDocumentSection>(
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
  downloadDocumentTemplate: async (
    token: string,
    id: string,
    assignmentId: string,
    name: string,
  ) => {
    const response = await fetch(
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
    const response = await fetch(
      `${API_URL}/generated-documents/${id}/export?format=${format}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok)
      throw new Error(
        (await response.json()).error || "Report could not be downloaded.",
      );
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${name}.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  },
  generatedDocumentControl: (token: string, id: string) =>
    request<GeneratedDocumentControl>(
      `/generated-documents/${id}/control`,
      {},
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
  compileAssignmentReport: (
    token: string,
    assignmentId: string,
    input: {
      templateId: string;
      title: string;
      taskIds: string[];
      knowledgeIds: string[];
    },
  ) =>
    request<GeneratedDocumentSummary>(
      `/assignments/${assignmentId}/reports/compile`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  reviewAssignmentReport: (
    token: string,
    id: string,
    decision: string,
    comments: string,
  ) =>
    request(
      `/assignment-reports/${id}/review`,
      { method: "POST", body: JSON.stringify({ decision, comments }) },
      token,
    ),
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
    },
  ) =>
    request<ResearchReportSection>(
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
  dashboard: (token: string, signal?: AbortSignal) =>
    request<DashboardResponse>("/dashboard", { signal }, token),
  notifications: (token: string) =>
    request<ApiNotification[]>("/notifications", {}, token),
  readNotification: (token: string, id: string) =>
    request<ApiNotification>(
      `/notifications/${id}/read`,
      { method: "PATCH" },
      token,
    ),
  readAllNotifications: (token: string) =>
    request<{ updated: number }>(
      "/notifications/read-all",
      { method: "PATCH" },
      token,
    ),
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
    const response = await fetch(
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
  reportSchedules: (token: string) =>
    request<Record<string, unknown>[]>("/report-schedules", {}, token),
  createReportSchedule: (token: string, input: Record<string, unknown>) =>
    request<Record<string, unknown>>(
      "/report-schedules",
      { method: "POST", body: JSON.stringify(input) },
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
      compactLayout: boolean;
      themeMode: "Dark" | "Light" | "System" | "Gold Grey";
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

import type {PulseRow, PulseCalendar} from "./modules/dashboard/pulseTypes";
import ProgressiveDashboard, {PulseBell} from "./modules/dashboard/ProgressiveDashboard";
import DashboardRecordPickerModal from "./modules/dashboard/DashboardRecordPickerModal";
import {usePulse} from "./modules/dashboard/usePulse";
import {useDashboardLiveSync} from "./modules/dashboard/useDashboardLiveSync";
import "./modules/dashboard/dashboard-task-requests.css";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { NoticeFormState } from "./NoticeComposer";
import {startMessageRealtime,stopMessageRealtime,type MessageRealtimeEvent} from "./modules/messages/messageRealtime";
import AppLiveClock from "./components/runtime/AppLiveClock";
import WorkflowNextActionDialog from "./components/WorkflowNextActionDialog";
import "./components/workflow-next-action.css";
import { useVisiblePolling } from "./hooks/useVisiblePolling";
import {
  api,
  type AiResearchEngine,
  type AiResearchJob,
  type ApiAssignment,
  type ApiAssignmentMemberRequest,
  type ApiAssignmentReview,
  type ApiAssignmentSection,
  type ApiAssignmentTask,
  type ApiAssignmentTaskRequest,
  type ApiAttachment,
  type ApiHistory,
  type ApiNotification,
  type ApiUser,
  type AssignmentInput,
  type AuditLog,
  type CalendarItem,
  type DashboardResponse,
  CompletedWorkResponse,
  type DocumentDeletionRequest,
  type DocumentItem,
  type DocumentImprovementAssignment,
  type RepositoryRelationship,
  type DocumentProtectionPolicy,
  type DocumentTemplate,
  type EmailDeliveryStatus,
  type ExternalResearchImport,
  type FelixAction,
  type GeneratedDocument,
  type GeneratedDocumentControl,
  type GeneratedDocumentSection,
  type GeneratedDocumentSummary,
  type KnowledgeItem,
  type KnowledgeVersion,
  type NoticeItem,
  type PermanentAccountRole,
  type RepositoryOrigin,
  type ResearchActivity,
  type ResearchProject,
  type ResearchReportSection,
  type ResearchReportVersion,
  type ResearchRepositoryDocument,
  type ResearchSource,
  type ReviewItem,
  type SettingsResponse,
  type UpdateStatus,
} from "./api";
const CalendarView = lazy(() => import("./CalendarView"));
const MeetingsWorkspace = lazy(() => import("./modules/meetings/MeetingsWorkspace"));
const UserLeaveManagement = lazy(() => import("./modules/users/UserLeaveManagement"));
const NotificationCenter = lazy(() => import("./NotificationCenter"));
const MessagesWorkspace = lazy(() => import("./modules/messages/MessagesWorkspace"));
const IncomingMessagePopup = lazy(() => import("./modules/messages/IncomingMessagePopup"));
const FloatingChatWindow = lazy(() => import("./modules/messages/FloatingChatWindow"));
const NoticeBoardWorkspace = lazy(() => import("./NoticeBoardWorkspace"));
const AIResearchChat = lazy(() => import("./AIResearchChat"));
import ExternalResearchImportModal from "./ExternalResearchImportModal";
import ExternalResearchReader from "./ExternalResearchReader";
import ResearchSourceChoiceModal from "./modules/research/components/ResearchSourceChoiceModal";
import ResearchCreationWizard from "./modules/research/components/ResearchCreationWizard";
import ResearchProjectWorkspaceEntry from "./modules/research/ResearchProjectWorkspaceEntry";
import ResearchOverviewHome from "./modules/research/overview/ResearchOverviewHome";
import ResearchTeamPanel from "./modules/research/components/ResearchTeamPanel";
import ResearchBriefPanel from "./modules/research/components/ResearchBriefPanel";
import ResearchWorkPlanPanel from "./modules/research/components/ResearchWorkPlanPanel";
import ResearchReferencePanel from "./modules/research/components/ResearchReferencePanel";
import ResearchEvidencePanel from "./modules/research/components/ResearchEvidencePanel";
import ResearchActivityPanel from "./modules/research/components/ResearchActivityPanel";
import ResearchReviewHandoffPanel from "./modules/research/components/ResearchReviewHandoffPanel";
import ResearchFinalisationPanel from "./modules/research/components/ResearchFinalisationPanel";
import ResearchReportBuilderPanel from "./modules/research/components/ResearchReportBuilderPanel";
import ResearchDiscussionPanel from "./modules/research/components/ResearchDiscussionPanel";
import ResearchRelatedAssignmentsPanel from "./modules/research/components/ResearchRelatedAssignmentsPanel";
import RepositoryHeaderPanel from "./modules/repository/components/RepositoryHeaderPanel";
import RepositoryRecordsCommandCentre from "./modules/repository/components/RepositoryRecordsCommandCentre";
import RepositoryRecordWorkspace from "./modules/repository/components/RepositoryRecordWorkspace";
import RepositoryAdvancedSearch, { type RepositoryAdvancedFilters } from "./modules/repository/components/RepositoryAdvancedSearch";
import RepositoryBulkIntake from "./modules/repository/components/RepositoryBulkIntake";
import RepositoryOperationalQueues, {
  matchesRepositoryOperationalQueue,
  type RepositoryOperationalQueue,
} from "./modules/repository/components/RepositoryOperationalQueues";
import "./modules/repository/repository-operations-v2-3.css";
import RepositoryAssuranceOverview, { type RepositoryAssuranceFilter } from "./modules/repository/components/RepositoryAssuranceOverview";
import "./modules/repository/repository-assurance-overview-v2-7.css";
import RepositoryGovernanceReconciliation from "./modules/repository/components/RepositoryGovernanceReconciliation";
import "./modules/repository/repository-governance-reconciliation-v2-9-1.css";
import "./modules/repository/repository-records-v2.css";
import RepositoryDomainNavigator from "./modules/repository/RepositoryDomainNavigator";
import RepositoryDeletionApprovalQueue from "./modules/repository/components/RepositoryDeletionApprovalQueue";
import RepositoryReviewQueue from "./modules/repository/components/RepositoryReviewQueue";
import "./modules/repository/repository-private-drafts.css";
import "./research-dashboard-queue-scroll-v5.css";
import SecureRepositoryReader from "./modules/repository/components/SecureRepositoryReader";
import "./modules/repository/repository-security-v2-8.css";
const AssignmentReportReader = lazy(() => import("./modules/assignments/components/AssignmentReportReader"));
const ReportsModule = lazy(() => import("./ReportsModule"));
const ResearchWorkspaceEntry = lazy(() => import("./modules/research"));
import FelixAssistant from "./FelixAssistant";
const FelixAdmin = lazy(() => import("./FelixAdmin"));
import AppShell from "./components/AppShell";
import ThemeProvider from "./components/ThemeProvider";
import { readDeviceThemePreferences, writeDeviceThemePreferences, type ThemeMode, type AccentColor } from "./theme-preferences";
import DateInputPolicy from "./DateInputPolicy";
import WorkspaceHeader from "./components/WorkspaceHeader";
import ResearchReportWorkspace from "./modules/research/components/ResearchReportWorkspace";
import ResearchReportLockedPanel from "./modules/research/components/ResearchReportLockedPanel";
import ResearchReportPreviewModal from "./modules/research/components/ResearchReportPreviewModal";
import { normalizeResearchReportSnapshot } from "./modules/research/utils/normalizeResearchReportSnapshot";
import AssignmentSourceChoiceModal from "./modules/assignments/components/AssignmentSourceChoiceModal";
import AssignmentEditorModal from "./modules/assignments/components/AssignmentEditorModal";
import type { AssignmentWorkspaceTab } from "./modules/assignments/components/AssignmentWorkspaceShell";
const AssignmentWorkspaceEntry = lazy(() => import("./modules/assignments/AssignmentWorkspaceEntry"));
const TaskWorkspaceEntry = lazy(() => import("./modules/tasks/TaskWorkspaceEntry"));
const TaskReportAccessPanel = lazy(() => import("./modules/tasks/TaskReportAccessPanel"));
const TaskReviewDecisionPanel = lazy(() => import("./modules/tasks/TaskReviewDecisionPanel"));
const TaskReadOnlyPanel = lazy(() => import("./modules/tasks/TaskReadOnlyPanel"));
const TaskManagementPanel = lazy(() => import("./modules/tasks/TaskManagementPanel"));
const TaskReportPreviewPanel = lazy(() => import("./modules/tasks/TaskReportPreviewPanel"));
const TaskDeleteDialog = lazy(() => import("./modules/tasks/TaskDeleteDialog"));
const TaskWorkspaceFooter = lazy(() => import("./modules/tasks/TaskWorkspaceFooter"));
const TaskWorkflowStatusPanel = lazy(() => import("./modules/tasks/TaskWorkflowStatusPanel"));
const TaskReportSectionPanel = lazy(() => import("./modules/tasks/TaskReportSectionPanel"));

import type { TaskDashboardShortcut } from "./modules/tasks/taskDashboardShortcut";
import {
  shouldUseDraftTaskPreview,
  recoverTaskReportMarkup,
  taskReportTemplatePreferenceKey,
  syncTaskReportTemplateMode,
  type TaskReportDocumentMode,
} from "./modules/tasks/taskReportDraftWorkflow";
import { useTaskReportReviewerOptions } from "./modules/tasks/useTaskReportReviewerOptions";
import "./modules/tasks/task-report-workspace.css";
const AssignmentsControlCentreEntry = lazy(() => import("./modules/assignments/AssignmentsControlCentreEntry"));
const TasksWorkspaceEntry = lazy(() => import("./modules/tasks/TasksWorkspaceEntry"));
import { createTaskWorkspaceNavigation } from "./modules/tasks/taskWorkspaceNavigation";
import {
  mapTaskToWorkspaceForm,
  taskHasReportDraft as taskHasReportDraftMapped,
  taskReportOwnerActionLabel as taskReportOwnerActionLabelMapped,
} from "./modules/tasks/taskWorkspaceMapping";
import {
  buildTaskStartPayload,
  buildTaskWorkspaceUpdatePayload,
  resolveTaskReportAssignmentId,
  taskReportOpenRoute,
  taskWorkspaceSaveMessage,
  type TaskWorkspaceAction,
} from "./modules/tasks/taskWorkspaceWorkflow";
import { acquireTaskReportSaveQueue } from "./modules/tasks/taskReportSaveQueue";
import {
  buildTaskContributionPayload,
  loadTaskContributionReport,
  mapSavedTaskContribution,
  taskContributionSaveNotice,
  taskReportPreviewNotice,
  type TaskContributionStatus,
} from "./modules/tasks/taskReportOrchestration";
import {
  buildTaskReportSectionPatch,
  getTaskReportMissingSectionKeys,
  getTaskReportSectionValue,
  taskReportNextSection,
  taskReportPreviousSection,
  taskReportRequiredSectionKeys,
  taskReportSectionIndex,
  taskReportSectionName,
} from "./modules/tasks/taskReportSections";
import {
  deriveTaskAssigneeOptions,
  deriveTaskReviewerOptions,
} from "./modules/tasks/taskManagementOptions";
import {
  taskDateText,
  taskDateValue,
} from "./modules/tasks/taskDates";
import AssignmentOverview from "./modules/assignments/components/AssignmentOverview";
import AssignmentWorkspaceContext from "./modules/assignments/components/AssignmentWorkspaceContext";
import AssignmentTaskWorkspaceHeader from "./modules/assignments/components/AssignmentTaskWorkspaceHeader";
import AssignmentEvidencePanel from "./modules/assignments/components/AssignmentEvidencePanel";
import AssignmentActivityPanel from "./modules/assignments/components/AssignmentActivityPanel";
import { AssignmentReportBuilderSurface, AssignmentReportsWorkspace } from "./modules/assignments/components/AssignmentReportSurfaces";
import {
  assignmentReportTemplates,
  taskReportTemplates,
  researchReportTemplates,
  toResearchTemplateLibrary,
} from "./modules/report-builder";
import { assignmentRef, assignmentReportStatusLabel } from "./modules/assignments/utils/assignmentFormatting";
import { deriveAssignmentOverview } from "./modules/assignments/utils/deriveAssignmentOverview";
import { deadlineLabel, deadlineState, matchesDeadlineFilter } from "./utils/deadlines";
import ReviewsApprovalsWorkspace from "./modules/reviews/ReviewsApprovalsWorkspace";
import AdminGovernancePanel from "./modules/dashboard/AdminGovernancePanel";
import {
  displayFileName,
  normalizeDocument,
} from "./utils/documentDisplay";
import { safeReportSectionHtml } from "./modules/research/utils/safeReportSectionHtml";
import { normalizeReportDocumentForPreviewAsync } from "./modules/report-editor/reportHtml";
import TaskReportPreviewErrorBoundary from "./modules/tasks/TaskReportPreviewErrorBoundary";
import { BUILT_IN_RESEARCH_REPORT_TEMPLATES } from "./modules/research/researchReportTemplates";
type IconName = keyof typeof icons;
type Role = PermanentAccountRole;
type User = {
  id?: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
  rights: string[];
  mustChangePassword?: boolean;
  supervisorId?: string | null;
  supervisorName?: string | null;
  supervisorRole?: string | null;
};
type TeamMember = User & {
  id: string;
  division: string;
  active: number;
  enabled: boolean;
  completed: number;
  status: "Available" | "Busy" | "Away";
};
type StoredSession = { token: string; user: User };
const SESSION_KEY = "psc-app2-session";

const taskReportPlainText = (value: unknown) => {
  const raw = String(value ?? "");
  if (!raw.trim()) return "";
  const withBreaks = raw
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*li\b[^>]*>/gi, "• ")
    .replace(/<\/\s*(?:p|div|li|h[1-6]|tr|section|article)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  const decode = (text: string) => {
    if (typeof document === "undefined") {
      return text
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '\"')
        .replace(/&#0*39;|&apos;/gi, "'");
    }
    const textarea = document.createElement("textarea");
    textarea.innerHTML = text;
    return textarea.value;
  };
  return decode(withBreaks)
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const taskReportContainsRichMedia = (value: unknown) =>
  /<(?:img|table)\b/i.test(String(value ?? ""));
type PreferenceForm = {
  emailNotifications: boolean;
  inAppNotifications: boolean;
  importantEmailNotifications: boolean;
  deadlineReminders: boolean;
  compactLayout: boolean;
  themeMode: ThemeMode;
  accentColor: AccentColor;
};

const defaultPreferences: PreferenceForm = {
  emailNotifications: true,
  inAppNotifications: true,
  importantEmailNotifications: true,
  deadlineReminders: true,
  compactLayout: false,
  themeMode: "Executive Gold",
  accentColor: "Gold",
};

const readInitialPreferences = (): PreferenceForm => ({
  ...defaultPreferences,
  ...(readDeviceThemePreferences() || {}),
});

const localDateTimeToIso = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new Error("Choose a valid event date and time.");
  return parsed.toISOString();
};

const readStoredSession = (): StoredSession | null => {
  try {
    const raw =
      localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
};

const tokenExpiresAt = (token: string) => {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return Number(payload.exp) * 1000;
  } catch {
    return 0;
  }
};

const demoUsers: User[] = [
  {
    name: "Dominic Kibet",
    email: "dominic.kibet@publicservice.go.ke",
    role: "Researcher",
    initials: "DK",
    rights: [
      "View assignments",
      "Update assigned work",
      "Add knowledge",
      "Collaborate",
    ],
  },
  {
    name: "Mary Wanjiku",
    email: "mary.wanjiku@publicservice.go.ke",
    role: "Deputy Director",
    initials: "MW",
    rights: [
      "Create assignments",
      "Assign members",
      "Approve work",
      "Manage research",
    ],
  },
  {
    name: "Grace Muturi",
    email: "grace.muturi@publicservice.go.ke",
    role: "Researcher",
    initials: "GM",
    rights: [
      "Review submissions",
      "Comment",
      "Request changes",
      "Approve knowledge",
    ],
  },
  {
    name: "System Administrator",
    email: "admin@publicservice.go.ke",
    role: "System Admin",
    initials: "SA",
    rights: [
      "Manage users",
      "Manage roles",
      "Audit activity",
      "Full system access",
    ],
  },
];

const initialTeam: TeamMember[] = [
  {
    ...demoUsers[0],
    id: "1",
    division: "Digital Government",
    active: 3,
    enabled: true,
    completed: 8,
    status: "Busy",
  },
  {
    ...demoUsers[1],
    id: "2",
    division: "Research & Policy",
    active: 2,
    enabled: true,
    completed: 14,
    status: "Available",
  },
  {
    ...demoUsers[2],
    id: "3",
    division: "Quality Assurance",
    active: 4,
    enabled: true,
    completed: 11,
    status: "Busy",
  },
  {
    id: "4",
    name: "John Kamau",
    email: "john.kamau@publicservice.go.ke",
    role: "Researcher",
    initials: "JK",
    rights: ["View assignments", "Update assigned work", "Collaborate"],
    division: "HR Research",
    active: 1,
    enabled: true,
    completed: 9,
    status: "Available",
  },
  {
    id: "5",
    name: "Faith Njeri",
    email: "faith.njeri@publicservice.go.ke",
    role: "Researcher",
    initials: "FN",
    rights: ["Review submissions", "Comment", "Approve knowledge"],
    division: "Governance",
    active: 2,
    enabled: true,
    completed: 12,
    status: "Away",
  },
  {
    ...demoUsers[3],
    id: "6",
    division: "ICT",
    active: 0,
    enabled: true,
    completed: 3,
    status: "Available",
  },
];

const icons = {
  dashboard: "D",
  assignments: "A",
  knowledge: "K",
  research: "R",
  documents: "DOC",
  team: "T",
  reports: "RPT",
  notifications: "!",
  messages: "MSG",
  calendar: "C",
  audit: "LOG",
  settings: "S",
  plus: "+",
  upload: "UP",
  menu: "=",
  search: "?",
  bell: "!",
  arrow: ">",
  clock: "T",
  check: "✓",
  warning: "!",
  announce: "N",
};

const navItems: [IconName, string][] = [
  ["dashboard", "Dashboard"],
  ["assignments", "Assignments"],
  ["assignments", "Tasks"],
  ["check", "Reviews & Approvals"],
  ["knowledge", "Document Repository"],
  ["research", "Research Repository"],
  ["research", "AI Researcher"],
  ["settings", "Felix Administration"],
  ["documents", "Documents"],
  ["team", "Team & Users"],
  ["reports", "Reports & Analytics"],
  ["notifications", "Notifications"],
  ["messages", "Messages"],
  ["announce", "Notice Board"],
  ["calendar", "Calendar"],
  ["calendar", "Meetings"],
  ["audit", "Audit Logs"],
  ["settings", "Settings"],
];

const navGroups: { label: string; items: string[] }[] = [
  { label: "Main", items: ["Dashboard"] },
  {
    label: "Immediate Work",
    items: ["Assignments", "Tasks", "Research Repository", "Reviews & Approvals"],
  },
  {
    label: "Awareness",
    items: ["Notifications", "Notice Board", "Calendar", "Reports & Analytics"],
  },
  { label: "Collaboration", items: ["Messages", "Meetings"] },
  {
    label: "Tools & Knowledge",
    items: ["Document Repository", "Team & Users", "AI Researcher", "Felix Administration", "Audit Logs", "Settings"],
  },
];

const announcements = [
  [
    "announce",
    "Research Guidelines Updated",
    "The Research Department guidelines have been updated. Please review.",
    "28 Jul 2026",
  ],
  [
    "calendar",
    "Quarterly Research Review Meeting",
    "The Q3 review meeting is scheduled for 6th August 2026.",
    "27 Jul 2026",
  ],
  [
    "documents",
    "New Knowledge Upload Protocol",
    "All staff to follow the new knowledge upload protocol effective immediately.",
    "25 Jul 2026",
  ],
];

const knowledge = [
  [
    "Public Service Regulations 2024",
    "Regulations  |  Added by Mary Wanjiku",
    "27 Jul 2026",
  ],
  [
    "Performance Management Best Practices",
    "Best Practice  |  Added by John Kamau",
    "25 Jul 2026",
  ],
  [
    "Talent Management Handbook",
    "Handbook  |  Added by Grace Muturi",
    "24 Jul 2026",
  ],
];

const activity = [
  [
    "upload",
    "You uploaded a document",
    "Policy Review Framework.pdf",
    "2h ago",
    "green",
  ],
  [
    "assignments",
    "Assignment updated",
    "Research on Digital Transformation",
    "3h ago",
    "orange",
  ],
  [
    "team",
    "New user added",
    "Mary Wanjiku was added to the system",
    "5h ago",
    "yellow",
  ],
  [
    "check",
    "Assignment completed",
    "Benchmarking Report on PSCs",
    "1d ago",
    "green",
  ],
];

const roleNavigation: Record<Role, string[]> = {
  "System Admin": navItems.map(([, label]) => label),
  Director: navItems.map(([, label]) => label).filter((label) => label !== "Audit Logs" && label !== "Felix Administration"),
  "Deputy Director": navItems.map(([, label]) => label).filter((label) => label !== "Audit Logs" && label !== "Felix Administration"),
  "Assistant Director": navItems.map(([, label]) => label).filter((label) => label !== "Audit Logs" && label !== "Felix Administration"),
  Researcher: [
    "Dashboard",
    "Needs My Attention",
    "Tasks",
    "Document Repository",
    "Documents",
    "Research Repository",
    "AI Researcher",
    "Reports & Analytics",
    "Team & Users",
    "Notifications",
    "Messages",
    "Notice Board",
    "Calendar",
    "Meetings",
    "Settings",
  ],
};

const navigationDisplayLabel = (label: string) =>
  label === "Research Repository" ? "Research Workspace" : label === "Messages" ? "Team Chat" : label;

const canOpenAssignmentsNavigation = (
  role: Role,
  hasAssignmentLeadResponsibility: boolean,
) =>
  [
    "System Admin",
    "Director",
    "Deputy Director",
    "Assistant Director",
  ].includes(role) || hasAssignmentLeadResponsibility;

const navigationDescriptions: Record<string, string> = {
  Dashboard:
    "Open the department overview, workload summaries, announcements and recent activity.",
  "Needs My Attention":
    "Open overdue, returned and decision-ready work that requires action in your authorised scope.",
  Assignments: "Create, assign, track and complete departmental work.",
  Tasks: "Open your assigned tasks, task reviews and authorised team task workload.",
  "Reviews & Approvals":
    "Open your assigned reviews, completed review history and controlled finalisation work.",
  "Document Repository":
    "Centrally manage documents, versions, links, review, publication and retention.",
  "Research Repository":
    "Open the Research Workspace to plan, conduct, review and manage research projects, evidence and outputs.",
  "AI Researcher": "Open the separate AI-assisted research planning workspace.",
  Documents:
    "Upload, review, approve, retain and archive controlled documents.",
  "Felix Administration":
    "Monitor Felix health, evidence quality, repository indexes, automated reviews, approvals and immutable audit activity.",
  "Team & Users":
    "Manage staff accounts, roles, divisions, availability and workload.",
  "Reports & Analytics":
    "View live performance measures and export management reports.",
  Notifications:
    "Open your assignment, review, approval and security notification inbox.",
  Messages:
    "Send direct or small-group messages to active REDESY users.",
  "Notice Board":
    "Read approved public information or submit a notice for management approval.",
  Leave: "Request leave, review your balance and track your own leave history.",
  Calendar: "Open live assignment deadlines and approved notice events.",
  Meetings: "Schedule governed meetings, manage agendas and participants, transcribe recordings and prepare minutes and actions.",
  "Audit Logs": "Inspect the read-only record of security and system activity.",
  Settings:
    "Configure organization defaults, themes, email, maintenance and updates.",
  General:
    "Configure organization information, personal notifications and account security.",
  Themes: "Choose display theme, accent colour and layout density.",
  "Email Notifications":
    "Configure system email delivery and your personal notification channels.",
  Maintenance:
    "Review service health and control approved maintenance settings.",
  Updates:
    "Check installed REDESY component versions without downloading or installing software.",
};

const workspaceMeta: Record<
  string,
  { title: string; subtitle: string; icon: IconName }
> = {
  Dashboard: {
    title: "Dashboard",
    subtitle:
      "Operational overview of workload, deadlines and institutional activity.",
    icon: "dashboard",
  },
  Assignments: {
    title: "Assignments",
    subtitle:
      "Manage institutional assignments, accountability, deadlines and delivery.",
    icon: "assignments",
  },
  Tasks: {
    title: "Tasks",
    subtitle:
      "Work directly on assigned tasks without opening the parent Assignment.",
    icon: "assignments",
  },
  "Reviews & Approvals": {
    title: "Reviews & Approvals",
    subtitle:
      "Assigned decisions, completed review history and controlled finalisation.",
    icon: "check",
  },
  "Research Repository": {
    title: "Research Workspace",
    subtitle:
      "Plan, conduct, review and manage structured research work, evidence and outputs.",
    icon: "research",
  },
  Leave: {
    title: "Leave",
    subtitle:
      "Request leave, review your balance and track your own leave history.",
    icon: "calendar",
  },
  Calendar: {
    title: "Calendar",
    subtitle:
      "Review assignment deadlines, approved events and scheduled activity.",
    icon: "calendar",
  },
  Meetings: {
    title: "Meetings",
    subtitle:
      "Schedule, transcribe and govern meetings, minutes, decisions and actions.",
    icon: "calendar",
  },
  "Document Repository": {
    title: "Document Repository",
    subtitle: "One controlled home for institutional documents and evidence.",
    icon: "knowledge",
  },
  Documents: {
    title: "Documents",
    subtitle:
      "Control document review, versions, approval, retention and publication.",
    icon: "documents",
  },
  "Team & Users": {
    title: "Teams & Users",
    subtitle: "Manage people, roles, divisions and authorized access.",
    icon: "team",
  },
  "Notice Board": {
    title: "Notice Board",
    subtitle: "Publish and review approved organizational information.",
    icon: "announce",
  },
  "Reports & Analytics": {
    title: "Reports",
    subtitle: "Review live operational and management information.",
    icon: "reports",
  },
  "AI Researcher": {
    title: "Felix",
    subtitle: "Use permission-aware AI research and approved REDESY evidence.",
    icon: "research",
  },
  Notifications: {
    title: "Notifications",
    subtitle: "Review workflow alerts and activity requiring your attention.",
    icon: "notifications",
  },
  Messages: {
    title: "Team Chat",
    subtitle: "Communicate directly with colleagues inside REDESY.",
    icon: "messages",
  },
  Settings: {
    title: "Settings",
    subtitle: "Configure personal preferences and authorized system controls.",
    icon: "settings",
  },
  "Felix Administration": {
    title: "Felix Administration",
    subtitle:
      "Monitor Felix assurance, indexing, approvals and audit activity.",
    icon: "settings",
  },
  "Audit Logs": {
    title: "Audit Logs",
    subtitle: "Inspect the read-only accountability record for REDESY activity.",
    icon: "audit",
  },
};

function Icon({ name }: { name: IconName }) {
  return (
    <span className="icon" aria-hidden="true">
      {icons[name]}
    </span>
  );
}

export default function App() {
  const [felixLauncherDismissed, setFelixLauncherDismissed] = useState(false);
  const [now, setNow] = useState(new Date());
  const [active, setActive] = useState("Dashboard");
  const [dashboardModule,setDashboardModule] = useState("");
  const dashboardReturnRef=useRef<{url:string;scrolls:{element:Element;top:number}[];windowY:number}|null>(null);
  const closeAssignmentToOrigin=()=>{
    setSelectedAssignment(null);setSelectedAssignmentId(null);
    const origin=dashboardReturnRef.current;dashboardReturnRef.current=null;
    if(origin){setActive('Dashboard');window.history.replaceState({},'',origin.url);requestAnimationFrame(()=>{window.scrollTo(0,origin.windowY);origin.scrolls.forEach(({element,top})=>{element.scrollTop=top})})}
    else {setActive('Assignments');window.history.replaceState({},'','/assignments')}
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<{x:number;y:number}|null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [loginDirectory, setLoginDirectory] = useState<Array<{name:string;email:string;role:string}>>([]);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [token, setToken] = useState("");
  const [, setAuthLoading] = useState(true);
  const [rememberMe, setRememberMe] = useState(true);
  const [sessionMessage, setSessionMessage] = useState("");
  const [passwordMode, setPasswordMode] = useState<"change" | "forgot" | null>(
    null,
  );
  const [showLogout, setShowLogout] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  useEffect(() => {
    const fragment = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const linkToken = new URLSearchParams(fragment).get("resetToken");
    if (!linkToken) return;
    setResetToken(linkToken);
    setPasswordMode("forgot");
    setPasswordMessage("This secure link is ready. Choose a new password below.");
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, []);
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(
    null,
  );
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | null
  >(null);
  const [taskRequestAssignmentId, setTaskRequestAssignmentId] = useState<
    string | null
  >(null);
  const [taskRequestWorkspaceView, setTaskRequestWorkspaceView] = useState<"Task Requests" | "Requests for Approval" | null>(null);
  const [dashboardTaskRequestTarget, setDashboardTaskRequestTarget] = useState<{ requestId: string; intent: "approval" | "focus" } | null>(null);
  const [dashboardTaskShortcut, setDashboardTaskShortcut] = useState<TaskDashboardShortcut | null>(null);
  const [dashboardTaskRequests, setDashboardTaskRequests] = useState<ApiAssignmentTaskRequest[]>([]);
  const [dashboardRequestPicker, setDashboardRequestPicker] = useState<"approvals" | "mine" | null>(null);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<{
    id: string;
    author: string;
    text: string;
    created_at: string;
  }[]>([]);
  const [team, setTeam] = useState(initialTeam);
  const [alertText, setAlertText] = useState("");
  const [systemAlerts, setSystemAlerts] = useState([
    "Quarterly research review meeting is scheduled for 6 August 2026.",
  ]);
  const [workAllocation, setWorkAllocation] = useState([
    {
      id: "1",
      title: "Policy Review on Performance Management",
      assignee: "Dominic Kibet",
      status: "In Progress",
      division: "HR Policy & Governance",
      dueDate: "2026-08-02",
    },
    {
      id: "2",
      title: "Public Service Digital Transformation",
      assignee: "John Kamau",
      status: "In Progress",
      division: "Digital Government",
      dueDate: "2026-08-10",
    },
    {
      id: "3",
      title: "Establishment Register Analysis",
      assignee: "Grace Muturi",
      status: "Ready for Review",
      division: "Establishment Management",
      dueDate: "2026-08-15",
    },
  ]);
  const [dashboardAssignmentFilter, setDashboardAssignmentFilter] =
    useState("All");
  const [dashboardResearchFilter, setDashboardResearchFilter] = useState("All");
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(
    null,
  );
  const [managerCompletedWork, setManagerCompletedWork] =
    useState<CompletedWorkResponse>({
      assignments: [],
      tasks: [],
      research: [],
    });
  const [dashboardActionQueue, setDashboardActionQueue] = useState<string | null>(null);
  const [dashboardReportContext, setDashboardReportContext] = useState<{
    subject: string;
    scope: string;
    openedAt: string;
  } | null>(null);
  const [dashboardWorkloadMemberId, setDashboardWorkloadMemberId] = useState<string | null>(null);
  const [dashboardWorkloadDetail, setDashboardWorkloadDetail] =
    useState<Awaited<ReturnType<typeof api.dashboardTeamWorkload>> | null>(null);
  const [dashboardWorkloadLoading, setDashboardWorkloadLoading] = useState(false);
  const [dashboardWorkloadError, setDashboardWorkloadError] = useState("");
  const [dashboardRefreshState, setDashboardRefreshState] = useState<
    "idle" | "refreshing" | "failed"
  >("idle");
  const dashboardRequestRef = useRef<AbortController | null>(null);
  const [assignmentRows, setAssignmentRows] = useState<ApiAssignment[]>([]);
  const [assignmentEditor, setAssignmentEditor] = useState<
    ApiAssignment | "new" | null
  >(null);
  const [assignmentSourceChoiceOpen, setAssignmentSourceChoiceOpen] = useState(false);
  const [assignmentCreationMode, setAssignmentCreationMode] = useState<"Internal" | "External">("Internal");
  const [assignmentForm, setAssignmentForm] = useState<AssignmentInput>({
    title: "",
    description: "",
    objective: "",
    scope: "",
    instructions: "",
    expectedOutput: "Final Assignment Report",
    division: "",
    startDate: null,
    dueDate: null,
    priority: "Normal",
    memberIds: [],
    leadId: null,
  });
  const [externalAssignmentFile, setExternalAssignmentFile] = useState<File | null>(null);
  const [externalAssignmentReviewerId, setExternalAssignmentReviewerId] = useState("");
  const [externalAssignmentReviewNote, setExternalAssignmentReviewNote] = useState("");
  const [assignmentFiles, setAssignmentFiles] = useState<ApiAttachment[]>([]);
  const [assignmentHistory, setAssignmentHistory] = useState<ApiHistory[]>([]);
  const [assignmentTasks, setAssignmentTasks] = useState<ApiAssignmentTask[]>(
    [],
  );
  const [assignmentReviews, setAssignmentReviews] = useState<
    ApiAssignmentReview[]
  >([]);
  const [, setAssignmentSections] = useState<
    ApiAssignmentSection[]
  >([]);
  const [assignmentWorkspaceTab, setAssignmentWorkspaceTab] =
    useState<AssignmentWorkspaceTab>("Overview");
  const assignmentTaskReturnTabRef = useRef(assignmentWorkspaceTab);
  const taskReportPreviewReturnSectionRef = useRef<string | null>(null);
  const [assignmentAddOpen, setAssignmentAddOpen] = useState(false);
  const [assignmentDocumentFilter, setAssignmentDocumentFilter] = useState<
    "All" | "Documents" | "Research Notes"
  >("All");
  const [assignmentDocumentSearch, setAssignmentDocumentSearch] = useState("");
  const [assignmentRepositoryLinkId, setAssignmentRepositoryLinkId] = useState("");
  const [assignmentFelixOpen, setAssignmentFelixOpen] = useState(false);
  const [assignmentFelixQuestion, setAssignmentFelixQuestion] = useState("");
  const [assignmentFelixAnswer, setAssignmentFelixAnswer] = useState("");
  const [assignmentFelixBusy, setAssignmentFelixBusy] = useState(false);
  const [assignmentTaskDialogNotice, setAssignmentTaskDialogNotice] =
    useState("");
  const [assignmentMemberRequests, setAssignmentMemberRequests] = useState<
    ApiAssignmentMemberRequest[]
  >([]);
  const [assignmentMemberRequestOpen, setAssignmentMemberRequestOpen] =
    useState(false);
  const [assignmentMemberRequestSaving, setAssignmentMemberRequestSaving] =
    useState(false);
  const [assignmentMemberRequestForm, setAssignmentMemberRequestForm] = useState({
    userId: "",
    reason: "",
  });
  const [assignmentMemberRequestComments, setAssignmentMemberRequestComments] =
    useState<Record<string, string>>({});
  const [, setAssignmentCompiling] = useState(false);
  const [selectedAssignmentTask, setSelectedAssignmentTask] =
    useState<ApiAssignmentTask | null>(null);
  const [standaloneTaskOrigin, setStandaloneTaskOrigin] = useState(false);
  const [assignmentTaskWorkspaceSaving, setAssignmentTaskWorkspaceSaving] =
    useState(false);
  const [assignmentTaskWorkspaceForm, setAssignmentTaskWorkspaceForm] =
    useState({
      title: "",
      description: "",
      ownerId: "",
      priority: "Normal",
      status: "Not Started",
      progress: 0,
      startDate: "",
      dueDate: "",
      notes: "",
      expectedContribution: "",
      assignmentPart: "",
      assignmentSectionId: "",
      targetDocumentId: "",
      targetSectionId: "",
      taskPurpose: "",
      specificInstructions: "",
      expectedFindings: "",
      expectedOutput: "Standard Task Report",
      evidenceRequired: "",
      reviewerId: "",
      contributionTitle: "",
      contributionSummary: "",
      contributionFindings: "",
      contributionRecommendations: "",
      evidenceReviewed: "",
      contributionChallenges: "",
      contributionNextActions: "",
      contributionStatus: "Draft",
    });
  const [
    assignmentTaskContributionSaving,
    setAssignmentTaskContributionSaving,
  ] = useState(false);
  const assignmentTaskContributionSavingRef = useRef(false);
  const assignmentTaskContributionSaveQueueRef = useRef<Promise<void> | null>(null);
  const [taskReportSectionModal, setTaskReportSectionModal] = useState<{
    key: string;
    mode: "edit" | "review";
  } | null>(null);
  const taskReportLatestEditorValueRef = useRef<{
    taskId: string;
    sectionKey: string;
    value: string;
  } | null>(null);
  const taskReportRevisionFingerprint = (task: ApiAssignmentTask): string => JSON.stringify([
    String(task.contribution_title ?? ""),
    String(task.contribution_summary ?? ""),
    String(task.contribution_findings ?? ""),
    String(task.contribution_recommendations ?? ""),
    String(task.evidence_reviewed ?? ""),
    String(task.contribution_challenges ?? ""),
    String(task.contribution_next_actions ?? ""),
    String(task.notes ?? ""),
    String(task.report_mode ?? ""),
    String(task.blank_content ?? ""),
  ]);
  const taskReportRevisionSnapshot = (task: ApiAssignmentTask) => ({
    taskId: task.id,
    updatedAt: task.contribution_updated_at ?? null,
    fingerprint: taskReportRevisionFingerprint(task),
  });
  const taskReportAuthoritativeRevisionRef = useRef<ReturnType<typeof taskReportRevisionSnapshot> | null>(null);
  const [assignmentTaskReportPreviewOpen, setAssignmentTaskReportPreviewOpen] =
    useState(false);
  const [assignmentTaskReportPreviewHtml, setAssignmentTaskReportPreviewHtml] =
    useState("");
  const [
    assignmentTaskReportPreviewTitle,
    setAssignmentTaskReportPreviewTitle,
  ] = useState("");
  const [assignmentTaskReportPreviewBusy, setAssignmentTaskReportPreviewBusy] =
    useState(false);
  const [assignmentTaskReviewComment, setAssignmentTaskReviewComment] =
    useState("");
  const [assignmentTaskReviewSaving, setAssignmentTaskReviewSaving] =
    useState(false);
  const [assignmentTaskFinalizing, setAssignmentTaskFinalizing] =
    useState(false);
  const [assignmentTaskReviewResult, setAssignmentTaskReviewResult] = useState<{
    tone: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [assignmentTaskManagementBusy, setAssignmentTaskManagementBusy] =
    useState(false);
  const [assignmentTaskDeleteDialogOpen, setAssignmentTaskDeleteDialogOpen] =
    useState(false);
  const [assignmentTaskDeleteReason, setAssignmentTaskDeleteReason] =
    useState("");
  const [assignmentTaskDeleteConfirmed, setAssignmentTaskDeleteConfirmed] =
    useState(false);
  const [assignmentNotice, setAssignmentNotice] = useState("");
  const [workflowDecision, setWorkflowDecision] = useState<{title:string;outcome:string;nextAction:string;continueLabel?:string;onContinue?:()=>void} | null>(null);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [externalAssignmentActionStatus, setExternalAssignmentActionStatus] = useState("");
  const [knowledgeRows, setKnowledgeRows] = useState<KnowledgeItem[]>([]);
  const [knowledgeUploadOpen, setKnowledgeUploadOpen] = useState(false);
  const [knowledgeUploadStep, setKnowledgeUploadStep] = useState<1 | 2 | 3 | 4>(1);
  const [knowledgeFile, setKnowledgeFile] = useState<File | null>(null);
  const [knowledgeUploading, setKnowledgeUploading] = useState(false);
  const [knowledgeUploadProgress, setKnowledgeUploadProgress] = useState({
    progress: 0,
    label: "Ready to upload",
    state: "waiting",
  });
  const [knowledgeForm, setKnowledgeForm] = useState({
    title: "",
    description: "",
    category: "Administrative Records",
    tags: "",
    author: "",
    documentDate: "",
    sourceType: "App2 Upload",
    sourceUrl: "",
    originEntityId: "",
    directorate: "",
    documentType: "Reference",
    subject: "",
    classification: "INTERNAL",
    felixEnabled: true,
    reviewerId: "",
  });
  const [documentReviewerOptions, setDocumentReviewerOptions] = useState<ApiUser[]>([]);
  const [repositoryOrigins, setRepositoryOrigins] = useState<
    RepositoryOrigin[]
  >([]);
  const [deletionRequests, setDeletionRequests] = useState<
    DocumentDeletionRequest[]
  >([]);
  const [deletionRequestDocument, setDeletionRequestDocument] =
    useState<DocumentItem | null>(null);
  const [deletionRequestReason, setDeletionRequestReason] = useState("");
  const [deletionDecision, setDeletionDecision] =
    useState<DocumentDeletionRequest | null>(null);
  const [deletionDecisionComments, setDeletionDecisionComments] = useState("");
  const [knowledgeNotice, setKnowledgeNotice] = useState("");
  const [selectedKnowledge, setSelectedKnowledge] =
    useState<KnowledgeItem | null>(null);
  const [readerDocument, setReaderDocument] = useState<DocumentItem | null>(
    null,
  );
  const [readerVersionId, setReaderVersionId] = useState<string | undefined>();
  const [knowledgeVersions, setKnowledgeVersions] = useState<
    KnowledgeVersion[]
  >([]);
  const [knowledgeVersionDownloadId, setKnowledgeVersionDownloadId] = useState("");
  const [knowledgeVersionDownloadMessage, setKnowledgeVersionDownloadMessage] = useState("");
  const [documentActivityTarget, setDocumentActivityTarget] =
    useState<DocumentItem | null>(null);
  const [documentActivityRows, setDocumentActivityRows] = useState<
    Array<{
      id: number;
      action: string;
      created_at: string;
      user_name: string;
      details: Record<string, unknown>;
    }>
  >([]);
  const [documentActivityLoading, setDocumentActivityLoading] = useState(false);
  const [documentActivityError, setDocumentActivityError] = useState("");
  const [researchRows, setResearchRows] = useState<ResearchProject[]>([]);
  const [researchEntryModeRequest, setResearchEntryModeRequest] =
    useState<"Workspace" | "Imported">("Workspace");
  const [researchEntryModeRequestKey, setResearchEntryModeRequestKey] = useState(0);

  const requestResearchEntryMode = (mode: "Workspace" | "Imported") => {
    setResearchEntryModeRequest(mode);
    setResearchEntryModeRequestKey((current) => current + 1);
  };
  const [externalResearchRows, setExternalResearchRows] = useState<ExternalResearchImport[]>([]);
  const [externalResearchOpen, setExternalResearchOpen] = useState(false);
  const [selectedExternalResearch, setSelectedExternalResearch] = useState<ExternalResearchImport | null>(null);
  const [aiResearchJobs, setAiResearchJobs] = useState<AiResearchJob[]>([]);
  const [aiResearchEngine, setAiResearchEngine] =
    useState<AiResearchEngine | null>(null);
  const [aiResearchOpen, setAiResearchOpen] = useState(false);
  const [aiResearchNotice, setAiResearchNotice] = useState("");
  const [aiResearchForm, setAiResearchForm] = useState({
    title: "",
    question: "",
    scope: "",
    sourceMode: "App2 Documents",
    depth: "Standard",
  });
  const [researchOpen, setResearchOpen] = useState(false);
  const [researchCreateNotice, setResearchCreateNotice] = useState("");
  const [researchCreating, setResearchCreating] = useState(false);
  const [researchSourceChoiceOpen, setResearchSourceChoiceOpen] = useState(false);
  const [selectedResearch, setSelectedResearch] =
    useState<ResearchProject | null>(null);
  const [researchComments, setResearchComments] = useState<
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
  >([]);

  const [researchComment, setResearchComment] = useState("");
  const [researchCommentCategory, setResearchCommentCategory] = useState<
    "Update" | "Question" | "Decision" | "Review Note"
  >("Update");
  const [researchDiscussionFilter, setResearchDiscussionFilter] =
    useState("Open");
  const [researchReport, setResearchReport] = useState<ResearchReportSection[]>(
    [],
  );
  const [researchReportVersions, setResearchReportVersions] = useState<ResearchReportVersion[]>([]);
  const [researchReportReviewComments, setResearchReportReviewComments] = useState("");
  const [researchReportPreviewOpen, setResearchReportPreviewOpen] = useState(false);
  const [researchReportPreviewWarning, setResearchReportPreviewWarning] = useState("");
  const [researchReportSectionAccess, setResearchReportSectionAccess] = useState<Record<string, Awaited<ReturnType<typeof api.researchReportSectionAccess>>>>({});
  const [researchReportPdfDownloading, setResearchReportPdfDownloading] = useState(false);
  const [researchReportPdfMessage, setResearchReportPdfMessage] = useState("");
  const [researchReportSubmitting, setResearchReportSubmitting] = useState(false);
  const [researchReviewDecisionSubmitting, setResearchReviewDecisionSubmitting] = useState(false);
  const [researchSources, setResearchSources] = useState<ResearchSource[]>([]);
  const [researchRepositoryDocuments, setResearchRepositoryDocuments] = useState<ResearchRepositoryDocument[]>([]);
  const [researchRepositoryLinkId, setResearchRepositoryLinkId] = useState("");
  const [researchSourceSearch, setResearchSourceSearch] = useState("");
  const [researchSourceQuality, setResearchSourceQuality] = useState("All");
  const [researchSourceRelevance, setResearchSourceRelevance] = useState("All");
  const [researchActivity, setResearchActivity] = useState<ResearchActivity[]>(
    [],
  );
  const [researchActivitySearch, setResearchActivitySearch] = useState("");
  const [researchActivityFilter, setResearchActivityFilter] = useState("All");
  const [researchTab, setResearchTab] = useState<
    "Overview" | "Work" | "Resources" | "Report" | "Review" | "Activity"
  >("Overview");
  const [researchSourceForm, setResearchSourceForm] = useState({
    sourceType: "Report",
    title: "",
    author: "",
    publisher: "",
    publicationDate: null as string | null,
    url: "",
    identifier: "",
    notes: "",
    provenance: "External",
    quality: "Unrated",
    relevance: "Supporting",
  });
  const [researchMilestoneForm, setResearchMilestoneForm] = useState({
    title: "",
    description: "",
    ownerId: "",
    dueDate: "",
    priority: "Normal",
  });
  const [researchWorkspaceNotice, setResearchWorkspaceNotice] = useState("");
  const [researchPlanDraft, setResearchPlanDraft] = useState({
    summary: "",
    researchQuestion: "",
    objectives: "",
    methodology: "",
    startDate: "",
    endDate: "",
  });
  const [researchPlanSaving, setResearchPlanSaving] = useState(false);
  const [researchBriefOpen, setResearchBriefOpen] = useState(false);
  const [researchBriefEditing, setResearchBriefEditing] = useState(false);
  const [researchBriefRequestOpen, setResearchBriefRequestOpen] = useState(false);
  const [researchBriefChangeReason, setResearchBriefChangeReason] = useState("");
  const [researchBriefRequesting, setResearchBriefRequesting] = useState(false);
  const [researchTeamEditing, setResearchTeamEditing] = useState(false);
  const [researchTeamDraft, setResearchTeamDraft] = useState<{
    leadId: string;
    collaborators: { userId: string; role: string }[];
  }>({ leadId: "", collaborators: [] });
  const [researchTeamSaving, setResearchTeamSaving] = useState(false);
  const [builderTemplates, setBuilderTemplates] = useState<DocumentTemplate[]>(
    [],
  );
  const [researchTemplateDownloadId, setResearchTemplateDownloadId] =
    useState("");
  const [researchTemplateApplying, setResearchTemplateApplying] =
    useState(false);
  const researchDocumentTemplates = researchReportTemplates(builderTemplates);
  const researchTemplateLibrary = toResearchTemplateLibrary(
    builderTemplates,
    BUILT_IN_RESEARCH_REPORT_TEMPLATES,
  );
  const latestResearchReportVersion = researchReportVersions[0] || null;
  const latestApprovedResearchVersion =
    latestResearchReportVersion?.status === "Approved"
      ? latestResearchReportVersion
      : null;
  const researchReportIsLocked = Boolean(
    latestResearchReportVersion &&
      ["Submitted", "Approved"].includes(latestResearchReportVersion.status),
  ) || Boolean(
    selectedResearch?.status === "Under Review" &&
      !["Changes Requested", "Rejected"].includes(latestResearchReportVersion?.status || ""),
  );
  const researchReportLockReviewerName =
    latestResearchReportVersion?.reviewer_name ||
    selectedResearch?.reviewers?.find(
      (reviewer) => reviewer.reviewer_id === latestResearchReportVersion?.reviewer_id,
    )?.name ||
    selectedResearch?.reviewers?.[0]?.name ||
    "the assigned reviewer";
  // Submitted report snapshots exist in more than one historical storage shape.
  // Normalize them before rendering so older JSON/text payloads cannot crash
  // the entire Research workspace during mount.
  const normalizedResearchReportSnapshot = normalizeResearchReportSnapshot(
    latestResearchReportVersion?.report_snapshot,
  );
  const researchPreviewUsesVersionSnapshot = Boolean(
    normalizedResearchReportSnapshot.sections.length &&
      latestResearchReportVersion &&
      ["Submitted", "Approved"].includes(
        latestResearchReportVersion.status,
      ),
  );
  const researchPreviewSections = (
    researchPreviewUsesVersionSnapshot && !researchReportPreviewWarning
      ? normalizedResearchReportSnapshot.sections
      : researchReport
  ).map((section) => ({
    id: String(section.id || section.title || "section"),
    title: String(section.title || "Untitled section"),
    content: safeReportSectionHtml(String(section.content || "")),
  }));
  const researchReportDateValue = researchPreviewUsesVersionSnapshot
    ? latestResearchReportVersion?.submitted_at
    : researchReport.reduce<string | null>((latest, section) =>
        !latest || new Date(section.updated_at).getTime() > new Date(latest).getTime()
          ? section.updated_at
          : latest,
      null);
  const researchReportDate = researchReportDateValue
    ? new Date(researchReportDateValue).toLocaleDateString("en-KE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Not recorded";
  const researchPreviewTeam =
    researchPreviewUsesVersionSnapshot && normalizedResearchReportSnapshot.team.length
      ? normalizedResearchReportSnapshot.team
      : [
          ...(selectedResearch
            ? [
                {
                  id: selectedResearch.lead_id || "research-lead",
                  name: selectedResearch.lead_name || "Research Lead",
                  role: "Lead Researcher",
                },
              ]
            : []),
          ...(Array.isArray(selectedResearch?.collaborators)
            ? selectedResearch.collaborators
            : []
          ).filter(Boolean).map((member) => ({
            id: member.id || member.name || "researcher",
            name: member.name || "Researcher",
            role: member.role || "Researcher",
          })),
          ...(Array.isArray(selectedResearch?.reviewers)
            ? selectedResearch.reviewers
            : []
          ).filter(Boolean).map((reviewer) => ({
            id: reviewer.reviewer_id || reviewer.name || "reviewer",
            name: reviewer.name || "Reviewer",
            role: reviewer.review_role || "Formal Reviewer",
          })),
        ];
  const canGenerateApprovedResearchFinal = Boolean(
    latestApprovedResearchVersion &&
      latestApprovedResearchVersion.submitted_by !== user?.id &&
      latestApprovedResearchVersion.reviewed_by === user?.id,
  );
  const [workspaceDocuments, setWorkspaceDocuments] = useState<
    GeneratedDocumentSummary[]
  >([]);
  const [builderDocument, setBuilderDocument] =
    useState<GeneratedDocument | null>(null);
  const [externalAssignmentReaderDocument, setExternalAssignmentReaderDocument] =
    useState<GeneratedDocument | null>(null);
  const [meetingNotificationTarget, setMeetingNotificationTarget] = useState<{ id: string; tab: string; nonce: number } | null>(null);
  useEffect(() => {
    const handlePreviewCopy = (event: ClipboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const readerRoot = target.closest(
        ".document-reader-shell, .assignment-report-reader",
      );
      if (!readerRoot) return;

      const selected = window.getSelection()?.toString().trim() || "";
      if (!selected) return;

      // Permit the browser's native copy action while bypassing older
      // component-level copy blockers.
      event.stopPropagation();

      if (
        readerRoot.classList.contains("document-reader-shell") &&
        readerDocument?.id
      ) {
        void api
          .logPreviewCopy(token, {
            entityType: "knowledge",
            entityId: readerDocument.id,
            source: "Document Reader",
            characters: selected.length,
          })
          .catch(() => {});
        return;
      }

      if (
        readerRoot.classList.contains("assignment-report-reader") &&
        externalAssignmentReaderDocument?.id
      ) {
        void api
          .logPreviewCopy(token, {
            entityType: "generated_document",
            entityId: externalAssignmentReaderDocument.id,
            source: "Assignment Report Reader",
            characters: selected.length,
          })
          .catch(() => {});
      }
    };

    document.addEventListener("copy", handlePreviewCopy, true);

    return () => {
      document.removeEventListener("copy", handlePreviewCopy, true);
    };
  }, [
    token,
    readerDocument?.id,
    externalAssignmentReaderDocument?.id,
  ]);

  const [assignmentReportPreviewMode, setAssignmentReportPreviewMode] =
    useState(false);
  const [builderSection, setBuilderSection] =
    useState<GeneratedDocumentSection | null>(null);
  const [builderContent, setBuilderContent] = useState("");
  const [builderDirty, setBuilderDirty] = useState(false);
  const [builderSaving, setBuilderSaving] = useState(false);
  const [, setBuilderSaveMessage] =
    useState("All changes saved");
  const [, setBuilderCreate] = useState({
    templateId: "",
    title: "",
    classification: "Official",
  });
  const [builderControl, setBuilderControl] =
    useState<GeneratedDocumentControl | null>(null);
  const [builderControlTab, setBuilderControlTab] = useState<
    "Control" | "Review" | "References" | "Comments" | "Felix"
  >("Control");
  const [builderReviewNote, setBuilderReviewNote] = useState("");
  const [builderReviewerId, setBuilderReviewerId] = useState("");
  const [builderReviewDue, setBuilderReviewDue] = useState("");
  const [builderComment, setBuilderComment] = useState("");
  const [builderReference, setBuilderReference] = useState({
    sourceType: "Report",
    title: "",
    author: "",
    publicationYear: null as number | null,
    publisher: "",
    url: "",
    identifier: "",
    citationStyle: "APA",
  });
  const [builderFelixAction, setBuilderFelixAction] =
    useState("Improve clarity");
  const [builderFelixSuggestion, setBuilderFelixSuggestion] = useState("");
  const [builderFelixLoading, setBuilderFelixLoading] = useState(false);
  const [selectedReportSection, setSelectedReportSection] =
    useState<ResearchReportSection | null>(null);
  const [reportContent, setReportContent] = useState("");
  const [reportSaving, setReportSaving] = useState(false);
  const [, setResearchDraftRepositoryReceipt] = useState<{
    documentId: string;
    version: number;
  } | null>(null);
  const researchRepositorySyncResultRef = useRef<{
    status?: string;
    message?: string;
    documentId?: string;
    version?: number;
  } | null>(null);
  const researchSectionSaveErrorRef = useRef<string | null>(null);
  const [researchSectionWorkspaceMode, setResearchSectionWorkspaceMode] =
    useState<"edit" | "review" | null>(null);

  // Open the Report Builder directly for editable research. Never mount the
  // editor under a report review lock.
  useEffect(() => {
    if (researchReportIsLocked && researchSectionWorkspaceMode) {
      setResearchSectionWorkspaceMode(null);
    }
  }, [researchReportIsLocked, researchSectionWorkspaceMode]);

  const [researchReportGenerating, setResearchReportGenerating] =
    useState(false);
  const [researchFinalGenerationNotice, setResearchFinalGenerationNotice] =
    useState("");
  const [researchDraftReviewerId, setResearchDraftReviewerId] = useState("");
  const [eligibleResearchReviewerRows, setEligibleResearchReviewerRows] =
    useState<ApiUser[]>([]);
  const [eligibleResearchReviewersLoading, setEligibleResearchReviewersLoading] =
    useState(false);
  const [researchSupportingDocumentIds, setResearchSupportingDocumentIds] =
    useState<string[]>([]);

  // Keep report-version loading separate from editor navigation so returning
  // from the builder, previewing, or moving between sections cannot reopen it.
  useEffect(() => {
    if (
      !selectedResearch ||
      !["Report", "Review"].includes(researchTab)
    ) {
      if (!selectedResearch) setResearchReportVersions([]);
      return;
    }
    void api
      .researchReportVersions(token, selectedResearch.id)
      .then(setResearchReportVersions)
      .catch(() => setResearchReportVersions([]));
  }, [selectedResearch?.id, researchTab, token]);
  useEffect(() => {
    setResearchDraftRepositoryReceipt(null);
    setResearchReportPreviewOpen(false);
    if (!selectedResearch) {
      setResearchReviewerDraft([]);
      return;
    }
    setResearchReviewerDraft((selectedResearch.reviewers || []).map((item) => item.reviewer_id));
    setResearchAssignmentDraft((current) => ({
      ...current,
      division: current.division || team.find((member) => member.id === selectedResearch.lead_id)?.division || "",
      memberIds: current.memberIds.length ? current.memberIds : [selectedResearch.lead_id],
    }));
  }, [selectedResearch?.id]);
  const [researchForm, setResearchForm] = useState({
    title: "",
    summary: "",
    researchQuestion: "",
    objectives: "",
    methodology: "",
    startDate: "",
    endDate: "",
    leadId: "",
    assignmentId: "",
    collaboratorIds: [] as string[],
    reviewerIds: [] as string[],
    knowledgeIds: [] as string[],
  });
  const [researchFormStep, setResearchFormStep] = useState<1 | 2 | 3>(1);
  const [, setResearchReviewerDraft] = useState<string[]>([]);
  const [researchAssignmentLinkId, setResearchAssignmentLinkId] = useState("");
  const [researchAssignmentCreating, setResearchAssignmentCreating] = useState(false);
  const [researchAssignmentDraft, setResearchAssignmentDraft] = useState<AssignmentInput>({
    title: "",
    description: "",
    objective: "",
    scope: "",
    instructions: "",
    expectedOutput: "Final Assignment Report",
    division: "",
    startDate: null,
    dueDate: null,
    priority: "Normal",
    memberIds: [],
  });
  const [documentRows, setDocumentRows] = useState<DocumentItem[]>([]);
  const [documentImprovementAssignments, setDocumentImprovementAssignments] =
    useState<DocumentImprovementAssignment[]>([]);
  const [improvementDocument, setImprovementDocument] = useState<DocumentItem | null>(null);
  const [improvementForm, setImprovementForm] = useState({
    assigneeId: "",
    reviewerId: "",
    improvementType: "Content Update" as DocumentImprovementAssignment["improvement_type"],
    reason: "",
    dueDate: "",
  });
  const [improvementSaving, setImprovementSaving] = useState(false);
  const [recordsLifecycleFilter, setRecordsLifecycleFilter] = useState("All");
  const [protectionDocument, setProtectionDocument] = useState<DocumentItem | null>(null);
  const [documentProtection, setDocumentProtection] = useState<DocumentProtectionPolicy | null>(null);
  const [protectionSaving, setProtectionSaving] = useState(false);
  const [protectionForm, setProtectionForm] = useState({
    readerScope: "INHERITED" as DocumentProtectionPolicy["reader_scope"],
    allowDownload: true,
    allowCopy: true,
    allowPrint: true,
    allowLink: true,
    watermark: false,
    restrictionReason: "",
    expiresAt: "",
    userIds: [] as string[],
  });
  const [relationshipDocument, setRelationshipDocument] = useState<DocumentItem | null>(null);
  const [documentRelationships, setDocumentRelationships] = useState<RepositoryRelationship[]>([]);
  const [relationshipSaving, setRelationshipSaving] = useState(false);
  const [relationshipForm, setRelationshipForm] = useState({
    relationshipType: "Reference for" as RepositoryRelationship["relationship_type"],
    entityType: "assignment" as RepositoryRelationship["entity_type"],
    entityId: "",
    pinCurrentVersion: true,
    notes: "",
  });
  const [repositoryLibraryTab, setRepositoryLibraryTab] = useState<
    "All Records" | "Assignments" | "Tasks" | "Research" | "Reports" | "Drafts" | "Published"
  >("All Records");
  const [repositoryListPage, setRepositoryListPage] = useState(1);
  const repositoryPageSize = 12;
  const [repositoryWorkspaceDocument, setRepositoryWorkspaceDocument] = useState<DocumentItem | null>(null);
  const [repositoryAutoLockedDocumentId, setRepositoryAutoLockedDocumentId] = useState<string | null>(null);
  const [repositoryBulkIntakeOpen, setRepositoryBulkIntakeOpen] = useState(false);
  const [repositoryOperationalQueue, setRepositoryOperationalQueue] =
    useState<RepositoryOperationalQueue>("All");
  const [repositoryAssuranceFilter, setRepositoryAssuranceFilter] =
    useState<RepositoryAssuranceFilter>("ALL");
  const [repositoryAssuranceIds, setRepositoryAssuranceIds] = useState<string[]>([]);
  const emptyRepositoryAdvancedFilters: RepositoryAdvancedFilters = {purpose:"",recordClass:"",owner:"",directorate:"",reviewer:"",protection:"",from:"",to:""};
  const [repositoryAdvancedFilters, setRepositoryAdvancedFilters] = useState<RepositoryAdvancedFilters>(emptyRepositoryAdvancedFilters);
  const [documentSearch, setDocumentSearch] = useState("");
  const [documentStatus, setDocumentStatus] = useState("All");
  const [documentSource, setDocumentSource] = useState("All");
  const [documentMine, setDocumentMine] = useState(false);
  const [documentDraftView, setDocumentDraftView] = useState<
    "All" | "My Drafts" | "Supervised Drafts" | "Archived Drafts"
  >("All");
  const [documentDraftType, setDocumentDraftType] = useState("All");
  const [documentDraftOwner, setDocumentDraftOwner] = useState("All");
  const [documentDraftLifecycle, setDocumentDraftLifecycle] = useState("All");
  const [documentSort, setDocumentSort] = useState("Newest");
  const [documentNotice, setDocumentNotice] = useState("");

  useEffect(() => {
    setRepositoryListPage(1);
  }, [
    repositoryLibraryTab,
    documentSearch,
    documentStatus,
    documentSource,
    documentMine,
    documentDraftView,
    documentDraftType,
    documentDraftOwner,
    documentDraftLifecycle,
    documentSort,
    recordsLifecycleFilter,
    repositoryAdvancedFilters,
    repositoryOperationalQueue,
    repositoryAssuranceFilter,
  ]);
  const [felixReviewRequest, setFelixReviewRequest] = useState<{
    documentId: string;
    title: string;
    nonce: number;
  } | null>(null);
  const [retentionDocument, setRetentionDocument] =
    useState<DocumentItem | null>(null);
  const [retentionDate, setRetentionDate] = useState("");
  const [reviewDocument, setReviewDocument] = useState<DocumentItem | null>(
    null,
  );
  const [reviewDocumentReadId, setReviewDocumentReadId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewRows, setReviewRows] = useState<ReviewItem[]>([]);
  const [reviewers, setReviewers] = useState<ApiUser[]>([]);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const pulse = usePulse(token,setNotifications);
  useEffect(() => {
    if (!token || active !== "Dashboard") {
      setDashboardTaskRequests([]);
      return;
    }
    let live = true;
    const refreshTaskRequests = () => {
      void api.taskRequests(token).then((rows) => {
        if (live) setDashboardTaskRequests(rows);
      }).catch(() => {
        // Keep the last successful request summary visible if a transient refresh fails.
      });
    };
    refreshTaskRequests();
    const timer = window.setInterval(refreshTaskRequests, 30000);
    window.addEventListener("app2:workflow-changed", refreshTaskRequests);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener("app2:workflow-changed", refreshTaskRequests);
    };
  }, [token, active]);
  useDashboardLiveSync({
    enabled: Boolean(token),
    dashboardVisible: active === "Dashboard",
    refresh: pulse.refresh,
    intervalMs: 10000,
  });
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [messageUnreadCount,setMessageUnreadCount]=useState(0);
  const [incomingMessage,setIncomingMessage]=useState<import("./api").IncomingMessagePreview|null>(null);
  const seenMessagePopupIdsRef=useRef<Set<string>>(new Set());
  const [pinnedChat,setPinnedChat]=useState<{conversationId:string;name:string}|null>(null);
  useEffect(()=>{
    if(!token){setMessageUnreadCount(0);setIncomingMessage(null);return}
    let activePoll=true;
    const refresh=async()=>{
      try{
        const [countResult,previews]=await Promise.all([
          api.messageUnreadCount(token),
          api.recentUnreadMessages(token),
        ]);
        if(!activePoll)return;
        setMessageUnreadCount(Number(countResult.unread||0));
        const unseen=previews.find(item=>!seenMessagePopupIdsRef.current.has(item.id));
        if(unseen){
          seenMessagePopupIdsRef.current.add(unseen.id);
          setIncomingMessage(unseen);
        }
      }catch{}
    };
    void refresh();
    const timer=window.setInterval(refresh,30000);
    return()=>{activePoll=false;window.clearInterval(timer)};
  },[token]);

  useEffect(()=>{
    if(!token){stopMessageRealtime();return}
    startMessageRealtime(token);
    const handleRealtime=(event:Event)=>{
      const detail=(event as CustomEvent<MessageRealtimeEvent>).detail;if(!detail)return;
      if(detail.type==="message"){
        const data=detail.data as {id?:string;conversationId?:string;senderId?:string;senderName?:string;body?:string;createdAt?:string;kind?:string;title?:string|null};
        if(data.id&&data.conversationId&&data.senderId&&data.senderName){
          seenMessagePopupIdsRef.current.add(data.id);
          setIncomingMessage({id:data.id,conversation_id:data.conversationId,sender_id:data.senderId,sender_name:data.senderName,body:String(data.body||""),created_at:String(data.createdAt||new Date().toISOString()),kind:data.kind==="Group"?"Group":"Direct",title:data.title||null,members:[]});
          void api.messageUnreadCount(token).then(result=>setMessageUnreadCount(Number(result.unread||0))).catch(()=>{});
        }
      }
    };
    window.addEventListener("app2-message-realtime",handleRealtime as EventListener);
    const setVisibility=()=>void api.setMessagePresence(token,document.hidden?"Away":"Online").catch(()=>{});
    document.addEventListener("visibilitychange",setVisibility);
    void api.setMessagePresence(token,document.hidden?"Away":"Online").catch(()=>{});
    return()=>{window.removeEventListener("app2-message-realtime",handleRealtime as EventListener);document.removeEventListener("visibilitychange",setVisibility);stopMessageRealtime()};
  },[token]);


  useEffect(()=>{
    const handlePin=(event:Event)=>{
      const detail=(event as CustomEvent<{conversationId:string;name:string}>).detail;
      if(detail?.conversationId)setPinnedChat(detail);
    };
    window.addEventListener("app2-pin-chat",handlePin as EventListener);
    return()=>window.removeEventListener("app2-pin-chat",handlePin as EventListener);
  },[]);

  const [focusedNoticeId, setFocusedNoticeId] = useState<string | null>(null);
  const [noticeRows, setNoticeRows] = useState<NoticeItem[]>([]);
  const [calendarRows, setCalendarRows] = useState<CalendarItem[]>([]);
  useEffect(()=>{if(pulse.data)setCalendarRows(pulse.data.calendarAll)},[pulse.data]);
  const [noticeForm, setNoticeForm] = useState<NoticeFormState>({
    title: "",
    body: "",
    severity: "Information",
    audienceRole: "",
    audienceRules: [{ type: "ORGANISATION", value: "*" }],
    acknowledgementRequired: false,
    eventStart: "",
    eventEnd: "",
    expiresAt: "",
  });
  const [noticeNotice, setNoticeNotice] = useState("");
  const [reviewingNotice, setReviewingNotice] = useState<NoticeItem | null>(
    null,
  );
  const [noticeReason, setNoticeReason] = useState("");

  const [userRows, setUserRows] = useState<ApiUser[]>([]);
  const noticeAudienceLookupStarted = useRef(false);
  useEffect(() => {
    if (
      active !== "Notice Board" ||
      !token ||
      !user ||
      !["System Admin", "Director"].includes(user.role) ||
      userRows.length ||
      noticeAudienceLookupStarted.current
    ) return;
    noticeAudienceLookupStarted.current = true;
    void api.users(token).then(setUserRows).catch((error) => {
      noticeAudienceLookupStarted.current = false;
      setNoticeNotice(
        error instanceof Error
          ? `Recipient directory could not be loaded: ${error.message}`
          : "Recipient directory could not be loaded.",
      );
    });
  }, [active, token, user?.role, userRows.length]);

  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("All");
  const [userStatusFilter, setUserStatusFilter] = useState("All");
  const [userDivisionFilter, setUserDivisionFilter] = useState("All");
  const [userWorkspaceTab, setUserWorkspaceTab] = useState<"Users" | "Teams" | "Leave" | "Approvals" | "Calendar" | "Administration">("Users");
  const [userEditor, setUserEditor] = useState<ApiUser | "new" | null>(null);
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    role: "Researcher",
    division: "",
    supervisorId: "",
    status: "Available",
    active: true,
  });
  const [userNotice, setUserNotice] = useState("");
  const [createdAccount, setCreatedAccount] = useState<{
    id: string;
    name: string;
    email: string;
    setupEmailSent: boolean;
  } | null>(null);
  const [savingSetupLink, setSavingSetupLink] = useState(false);
  const [accountSetupMessage, setAccountSetupMessage] = useState("");
  const [savingUser, setSavingUser] = useState(false);
  const [userFormError, setUserFormError] = useState("");
  const [auditRows, setAuditRows] = useState<AuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditActions, setAuditActions] = useState<string[]>([]);
  const [auditEntityTypes, setAuditEntityTypes] = useState<string[]>([]);
  const [auditFilters, setAuditFilters] = useState({
    search: "",
    userId: "",
    action: "",
    entityType: "",
    from: "",
    to: "",
  });
  const [selectedAudit, setSelectedAudit] = useState<AuditLog | null>(null);
  const [auditNotice, setAuditNotice] = useState("");
  const [settingsData, setSettingsData] = useState<SettingsResponse | null>(
    null,
  );
  const [settingsTab, setSettingsTab] = useState<
    "General" | "Themes" | "Email Notifications" | "Maintenance" | "Updates"
  >("General");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [emailDelivery, setEmailDelivery] =
    useState<EmailDeliveryStatus | null>(null);
  const [testingEmail, setTestingEmail] = useState(false);
  const [systemForm, setSystemForm] = useState({
    organizationName: "",
    departmentName: "",
    supportEmail: "",
    sessionMinutes: 480,
    maxUploadMb: 100,
    defaultRetentionDays: 2555,
    documentCategories: "",
    maintenanceMode: false,
    emailNotifications: true,
  });
  const [preferenceForm, setPreferenceForm] =
    useState<PreferenceForm>(readInitialPreferences);
  const updateDeviceAppearance = (patch: Partial<Pick<PreferenceForm, "themeMode" | "accentColor" | "compactLayout">>) => {
    setPreferenceForm((current) => {
      const next = { ...current, ...patch };
      writeDeviceThemePreferences(next);
      return next;
    });
  };
  const [settingsNotice, setSettingsNotice] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const isManager =
    Boolean(user && ["System Admin", "Director", "Deputy Director", "Assistant Director"].includes(user.role));
  const hasAssignmentLeadResponsibility = Boolean(
    user?.id &&
      assignmentRows.some((assignment) =>
        (assignment.members || []).some(
          (member) => member.id === user.id && member.role === "Lead",
        ),
      ),
  );
  const canAccessAssignmentsWorkspace = Boolean(
    user &&
      canOpenAssignmentsNavigation(
        user.role,
        hasAssignmentLeadResponsibility,
      ),
  );
  const canSeeNavigationItem = (label: string) =>
    Boolean(
      user &&
        !(user.role === "Researcher" && label === "Team & Users") &&
        (label === "Leave" || roleNavigation[user.role].includes(label) || label === "Reviews & Approvals" ||
          (label === "Assignments" && canAccessAssignmentsWorkspace)),
    );
  const assignedResearchReviewerIds = new Set(
    (selectedResearch?.reviewers || []).map((reviewer) => reviewer.reviewer_id),
  );
  const isResearchReportBuilder = Boolean(
    selectedResearch?.collaborators?.some(
      (member) =>
        member.id === user?.id &&
        (member.role || "Researcher") !== "Reviewer",
    ),
  );  const selectedResearchSectionAccess = selectedReportSection
    ? researchReportSectionAccess[selectedReportSection.id]
    : undefined;
  const canEditSelectedResearchSection = selectedResearchSectionAccess?.can_edit === true;
  const canChooseResearchReviewer = Boolean(
    selectedResearch &&
      (selectedResearch.lead_id === user?.id ||
        selectedResearch.oversight_manager_id === user?.id ||
        isManager),
  );
  const eligibleResearchReviewers = eligibleResearchReviewerRows
    .filter(
      (candidate) =>
        candidate.active &&
        candidate.id !== selectedResearch?.lead_id,
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const researchReportReviewerOptions = Array.from(
    new Map(
      [
        ...eligibleResearchReviewers.map((reviewer) => ({
          id: reviewer.id,
          name: reviewer.name,
          role: reviewer.role,
        })),
        ...(selectedResearch?.reviewers || []).map((reviewer) => ({
          id: reviewer.reviewer_id,
          name: reviewer.name,
          role: reviewer.role || reviewer.review_role || "Formal Reviewer",
        })),
      ].map((reviewer) => [reviewer.id, reviewer]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));
  useEffect(() => {
    if (!selectedResearch || !canChooseResearchReviewer || !token) {
      setEligibleResearchReviewerRows([]);
      setEligibleResearchReviewersLoading(false);
      return;
    }

    let cancelled = false;
    setEligibleResearchReviewersLoading(true);
    void api
      .eligibleResearchReviewers(token, selectedResearch.id)
      .then((rows) => {
        if (!cancelled) setEligibleResearchReviewerRows(rows);
      })
      .catch((error) => {
        if (!cancelled) {
          setEligibleResearchReviewerRows([]);
          setResearchWorkspaceNotice(
            error instanceof Error
              ? error.message
              : "Eligible reviewers could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setEligibleResearchReviewersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedResearch?.id, canChooseResearchReviewer, token]);
  const canAdministerUsers = user?.role === "System Admin";
  const canManageTeamUsers = Boolean(user && ["System Admin","Director","Deputy Director","Assistant Director"].includes(user.role));
  const canReview = ["System Admin", "Deputy Director", "Reviewer"].includes(
    user?.role || "",
  );

  useEffect(() => {
    if (user) return;
    let current = true;
    void api.loginDirectory()
      .then((rows) => { if (current) setLoginDirectory(rows); })
      .catch(() => { if (current) setLoginDirectory([]); });
    return () => { current = false; };
  }, [user]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(()=>{
    if(!user)return;
    const open=(event:MouseEvent)=>{
      const target=event.target as HTMLElement;
      if(!target.closest('.app-shell'))return;
      const editableTarget=target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
      const selectedText=window.getSelection()?.toString().trim();
      // Keep the browser's native Cut/Copy/Paste menu anywhere the user is
      // editing or has highlighted text. App2's action menu is only for the
      // remaining non-text workspace surface.
      if(editableTarget||selectedText)return;
      event.preventDefault();
      setContextMenu({x:Math.min(event.clientX,window.innerWidth-210),y:Math.min(event.clientY,window.innerHeight-270)});
    };
    const close=()=>setContextMenu(null);
    document.addEventListener('contextmenu',open);
    document.addEventListener('click',close);
    window.addEventListener('blur',close);
    return()=>{document.removeEventListener('contextmenu',open);document.removeEventListener('click',close);window.removeEventListener('blur',close)};
  },[user]);

  const clearSession = (message = "") => {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
    setToken("");
    setPassword("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMode(null);
    setActive("Dashboard");
    setSessionMessage(message);
  };

  useEffect(() => {
    api.onUnauthorized(() =>
      clearSession("Your session expired. Please sign in again."),
    );
    const stored = readStoredSession();
    if (!stored || tokenExpiresAt(stored.token) <= Date.now()) {
      clearSession(stored ? "Your session expired. Please sign in again." : "");
      setAuthLoading(false);
      return () => api.onUnauthorized(null);
    }
    setToken(stored.token);
    setUser(stored.user);
    api
      .me(stored.token)
      .then((member) => {
        const profile = mapUser(member);
        setUser(profile);
        if (profile.mustChangePassword) {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          setPasswordMode("change");
          setPasswordMessage("Set a private password before continuing.");
          return;
        }
        return loadLiveData(stored.token, profile);
      })
      .catch(() =>
        clearSession(
          "Your saved session is no longer valid. Please sign in again.",
        ),
      )
      .finally(() => setAuthLoading(false));
    return () => api.onUnauthorized(null);
  }, []);

  useEffect(() => {
    if (!token) return;
    const remaining = tokenExpiresAt(token) - Date.now();
    if (remaining <= 0) {
      clearSession("Your session expired. Please sign in again.");
      return;
    }
    const timer = window.setTimeout(
      () => clearSession("Your session expired. Please sign in again."),
      remaining,
    );
    return () => window.clearTimeout(timer);
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    if (!token || !selectedResearch?.id) {
      setResearchRepositoryDocuments([]);
      setResearchRepositoryLinkId("");
      return () => { cancelled = true; };
    }
    api.researchRepositoryDocuments(token, selectedResearch.id)
      .then((rows) => { if (!cancelled) setResearchRepositoryDocuments(rows); })
      .catch(() => { if (!cancelled) setResearchRepositoryDocuments([]); });
    return () => { cancelled = true; };
  }, [token, selectedResearch?.id]);

  useEffect(() => {
    if (active === "Documents" || active === "Knowledge Repository") {
      setActive("Document Repository");
      return;
    }
    if (
      user &&
      active !== "Profile" &&
      !canSeeNavigationItem(active)
    )
      setActive("Dashboard");
  }, [active, user, canAccessAssignmentsWorkspace]);

  useEffect(() => {
    if (active === "Document Repository" && token)
      api
        .knowledge(token)
        .then(setKnowledgeRows)
        .catch((error) =>
          setKnowledgeNotice(
            error instanceof Error
              ? error.message
              : "Document repository could not be loaded.",
          ),
        );
  }, [active, token]);
  useEffect(() => {
    if (active === "Document Repository" && token)
      api.documentReviewers(token).then(setDocumentReviewerOptions).catch(() => setDocumentReviewerOptions([]));
  }, [active, token]);
  useEffect(() => {
    if (active === "Document Repository" && token)
      api.documentImprovements(token)
        .then(setDocumentImprovementAssignments)
        .catch(() => setDocumentImprovementAssignments([]));
  }, [active, token]);
  useEffect(() => {
    if (active === "Document Repository" && token)
      api
        .repositoryOrigins(token)
        .then(setRepositoryOrigins)
        .catch(() => setRepositoryOrigins([]));
  }, [active, token]);
  useEffect(() => {
    if (active === "Document Repository" && token)
      api
        .documentDeletionRequests(token)
        .then(setDeletionRequests)
        .catch(() => setDeletionRequests([]));
  }, [active, token]);
  useEffect(() => {
    if (selectedResearch && token)
      api
        .knowledge(token)
        .then(setKnowledgeRows)
        .catch(() => {});
  }, [selectedResearch?.id, token]);
  useEffect(() => {
    if (active === "Dashboard" && token)
      api
        .research(token)
        .then(setResearchRows)
        .catch(() => setResearchRows([]));
  }, [active, token]);
  useEffect(() => {
    if (active === "Research Repository" && token)
      api.externalResearchImports(token).then(setExternalResearchRows).catch(() => setExternalResearchRows([]));
  }, [active, token]);
  useEffect(() => {
    if (active === "Dashboard" && token)
      api
        .documentReviews(token)
        .then((rows) => setReviewRows(rows.map(normalizeDocument)))
        .catch(() => setReviewRows([]));
  }, [active, token, canReview]);
  useEffect(() => {
    if (!["Dashboard", "Reviews & Approvals"].includes(active) || !token) return;
    let mounted = true;
    const load = async () => {
      if (dashboardRequestRef.current) return;
      const controller = new AbortController();
      dashboardRequestRef.current = controller;
      try {
        const data = await api.dashboard(token, controller.signal);
        if (mounted) {
          setDashboardData(data);
          setDashboardRefreshState("idle");
        }
      } catch (error) {
        if (
          mounted &&
          !(error instanceof DOMException && error.name === "AbortError")
        )
          setDashboardRefreshState("failed");
      } finally {
        if (dashboardRequestRef.current === controller)
          dashboardRequestRef.current = null;
      }
    };
    load();
    const timer = window.setInterval(load, 30000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      dashboardRequestRef.current?.abort();
      dashboardRequestRef.current = null;
    };
  }, [active, token]);
  useEffect(() => {
    if (active !== "Dashboard" || !token || !isManager) {
      if (!isManager) {
        setManagerCompletedWork({
          assignments: [],
          tasks: [],
          research: [],
        });
      }
      return;
    }

    let mounted = true;
    const loadCompletedWork = async () => {
      try {
        const completed = await api.completedWork(token);
        if (mounted) setManagerCompletedWork(completed);
      } catch (error) {
        if (mounted) {
          setUserNotice(
            error instanceof Error
              ? `Completed Work could not be loaded: ${error.message}`
              : "Completed Work could not be loaded.",
          );
        }
      }
    };

    void loadCompletedWork();
    const timer = window.setInterval(loadCompletedWork, 30000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [active, token, isManager]);
  useEffect(() => {
    if (active === "AI Researcher" && token)
      Promise.all([api.aiResearchJobs(token), api.aiResearchEngine(token)])
        .then(([jobs, engine]) => {
          setAiResearchJobs(jobs);
          setAiResearchEngine(engine);
        })
        .catch((error) => setAiResearchNotice(error.message));
  }, [active, token]);
  useVisiblePolling(Boolean(token) && active === "AI Researcher", async () => {
    if (!token) return;
    try {
      setAiResearchEngine(await api.aiResearchEngine(token));
    } catch {
      // Engine health is advisory here; the workspace keeps its last known state.
    }
  }, 30000);
  useVisiblePolling(Boolean(token) && active === "Document Repository", async () => {
    if (!token) return;
    try {
      const documents = await api.documents(token);
      setDocumentRows(documents.map(normalizeDocument));
    } catch (error) {
      setDocumentNotice(

          (error instanceof Error ? error.message : "Documents could not be loaded."),
      );
      return;
    }

    try {
      const reviews = await api.documentReviews(token);
      setReviewRows(reviews.map(normalizeDocument));

      // APP2_CLEAR_STALE_REPOSITORY_LOAD_ERROR
      setDocumentNotice((current) =>
        current.includes("could not determine data type of parameter")
          ? ""
          : current,
      );
    } catch (error) {
      setDocumentNotice(

          (error instanceof Error ? error.message : "Reviews could not be loaded."),
      );
      return;
    }

    setDocumentNotice((current) =>
      current.startsWith("DOCUMENTS API:") ||
      current.startsWith("REVIEWS API:") ||
      current.includes("could not determine data type of parameter")
        ? ""
        : current,
    );
  }, 30000);

  useEffect(() => {
    if (!builderDirty || !builderDocument || !builderSection) return;
    const timer = window.setTimeout(async () => {
      try {
        setBuilderSaving(true);
        setBuilderSaveMessage("Saving...");
        const status =
          builderSection.section_status === "Ready"
            ? "Ready"
            : builderContent.trim()
              ? "In Progress"
              : "Not Started";
        await api.saveGeneratedDocumentSection(
          token,
          builderDocument.id,
          builderSection.id,
          builderContent,
          builderSection.completion,
          status,
        );
        const refreshed = await api.generatedDocument(
          token,
          builderDocument.id,
        );
        setBuilderDocument(refreshed);
        const current =
          refreshed.sections.find((item) => item.id === builderSection.id) ||
          null;
        setBuilderSection(current);
        setBuilderDirty(false);
        setBuilderSaveMessage(
          `Saved ${new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}`,
        );
      } catch (error) {
        setBuilderSaveMessage(
          error instanceof Error
            ? error.message
            : "Changes could not be saved.",
        );
      } finally {
        setBuilderSaving(false);
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [
    builderContent,
    builderDirty,
    builderDocument?.id,
    builderSection?.id,
    token,
  ]);
  useEffect(() => {
    if (token && active === "Notice Board")
      api
        .alerts(token)
        .then(setNoticeRows)
        .catch((error) =>
          setNoticeNotice(
            error instanceof Error
              ? error.message
              : "Notice Board could not be loaded.",
          ),
        );
  }, [token, active]);

  useEffect(() => {
    if (token && isManager && active === "Document Repository")
      api
        .documentReviewers(token)
        .then(setReviewers)
        .catch(() => {});
  }, [token, active]);
  useEffect(() => {
    if (token && isManager && active === "Team & Users")
      api
        .users(token)
        .then(setUserRows)
        .catch((error) =>
          setUserNotice(
            error instanceof Error
              ? error.message
              : "Users could not be loaded.",
          ),
        );
  }, [token, active]);
  useEffect(() => {
    if (token && user?.role === "System Admin" && active === "Audit Logs")
      api
        .auditLogs(token, auditFilters)
        .then((result) => {
          setAuditRows(result.items);
          setAuditTotal(result.total);
          setAuditActions(result.actions);
          setAuditEntityTypes(result.entityTypes);
        })
        .catch((error) =>
          setAuditNotice(
            error instanceof Error
              ? error.message
              : "Audit logs could not be loaded.",
          ),
        );
  }, [token, active, auditFilters, user?.role]);
  useEffect(() => {
    if (token)
      api
        .settings(token)
        .then((result) => {
          const system = result.system || {
            organization_name: "Public Service Commission",
            department_name: "Research Department",
            support_email: "support@publicservice.go.ke",
            session_minutes: 480,
            max_upload_mb: 100,
            default_retention_days: 2555,
            document_categories: ["Policy", "Report", "Circular", "Research Paper", "Book", "Template"],
            maintenance_mode: false,
            email_notifications: true,
            updated_at: new Date(0).toISOString(),
          };
          const preferences = result.preferences || {
            email_notifications: true,
            in_app_notifications: true,
            important_email_notifications: true,
            deadline_reminders: true,
            compact_layout: false,
            theme_mode: "Executive Gold" as const,
            accent_color: "Gold" as const,
          };
          setSettingsData({ ...result, system, preferences });
          setSystemForm({
            organizationName: system.organization_name,
            departmentName: system.department_name,
            supportEmail: system.support_email,
            sessionMinutes: system.session_minutes,
            maxUploadMb: system.max_upload_mb,
            defaultRetentionDays: system.default_retention_days,
            documentCategories: (system.document_categories || []).join(", "),
            maintenanceMode: system.maintenance_mode,
            emailNotifications: system.email_notifications,
          });
          const serverPreferences: PreferenceForm = {
            emailNotifications: preferences.email_notifications,
            inAppNotifications: preferences.in_app_notifications,
            importantEmailNotifications: preferences.important_email_notifications ?? true,
            deadlineReminders: preferences.deadline_reminders ?? true,
            compactLayout: preferences.compact_layout,
            themeMode: preferences.theme_mode || "Executive Gold",
            accentColor: preferences.accent_color || "Gold",
          };

          const localPreferences = readDeviceThemePreferences();
          const effectivePreferences: PreferenceForm = localPreferences
            ? {
                ...serverPreferences,
                themeMode: localPreferences.themeMode,
                accentColor: localPreferences.accentColor,
                compactLayout: localPreferences.compactLayout,
              }
            : serverPreferences;

          setPreferenceForm(effectivePreferences);

          if (!localPreferences) {
            writeDeviceThemePreferences(effectivePreferences);
          } else if (
            serverPreferences.themeMode !== effectivePreferences.themeMode ||
            serverPreferences.accentColor !== effectivePreferences.accentColor ||
            serverPreferences.compactLayout !== effectivePreferences.compactLayout
          ) {
            void api.updatePreferences(token, effectivePreferences).catch(() => {
              // Keep this device preference active; server sync can retry later.
            });
          }

          setSettingsNotice("");
        })
        .catch((error) =>
          setSettingsNotice(
            error instanceof Error
              ? error.message
              : "Settings could not be loaded.",
          ),
        );
  }, [token]);
  useEffect(() => {
    if (token && active === "Settings" && user?.role === "System Admin")
      api
        .emailDeliveryStatus(token)
        .then(setEmailDelivery)
        .catch(() => setEmailDelivery(null));
  }, [token, active, user?.role]);
  useEffect(() => {
    localStorage.setItem(
      "psc-app2-sidebar-collapsed",
      String(sidebarCollapsed),
    );
  }, [sidebarCollapsed]);
  useEffect(() => {
    const describeElement = (element: HTMLElement) => {
      if (element.title || !element.matches('button,[role="tab"],select')) return;
      const label = (
        element.getAttribute("aria-label") ||
        element.textContent ||
        ""
      )
        .trim()
        .replace(/\s+/g, " ");
      const exact = navigationDescriptions[label];
      if (exact) element.title = exact;
      else if (element.tagName === "SELECT")
        element.title = `Choose ${label || "an option"} from this dropdown menu.`;
      else if (label)
        element.title = `Use ${label} to continue to the described action.`;
    };

    const describeTree = (root: ParentNode) => {
      if (root instanceof HTMLElement) describeElement(root);
      root.querySelectorAll<HTMLElement>('button,[role="tab"],select').forEach(describeElement);
    };

    describeTree(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) describeTree(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const rightsFor = (role: Role) =>
    role === "System Admin"
      ? ["Manage users", "Manage roles", "Audit activity", "Full system access"]
      : ["Director", "Deputy Director", "Assistant Director"].includes(role)
        ? [
            "Create assignments",
            "Assign members",
            "Approve work",
            "Manage research",
          ]
        : [
              "View assignments",
              "Update assigned work",
              "Add knowledge",
              "Collaborate",
            ];
  const initialsFor = (name: string) =>
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  const mapUser = (member: ApiUser): User => ({
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role as Role,
    initials: initialsFor(member.name),
    rights: rightsFor(member.role as Role),
    mustChangePassword: member.must_change_password,
    supervisorId: member.supervisor_id,
    supervisorName: member.supervisor_name,
    supervisorRole: member.supervisor_role,
  });
  const mapTeamMember = (member: ApiUser): TeamMember => ({
    ...mapUser(member),
    id: member.id,
    division: member.division,
    active: member.active_assignments || 0,
    enabled: member.active,
    completed: member.completed_assignments || 0,
    status: member.status as TeamMember["status"],
  });
  const navigateTo = (destination: string) => {
    if (
      destination === "Assignments" &&
      user &&
      !canAccessAssignmentsWorkspace
    ) {
      setActive("Tasks");
      return;
    }

    setDashboardActionQueue(null);
    setActive(
      destination === "Documents" || destination === "Knowledge Repository"
        ? "Document Repository"
        : destination,
    );
    setMenuOpen(false);
  };
  const navigateSidebar = (destination:string) => {
    dashboardReturnRef.current=null;
    if(destination==='Notifications'){navigateTo('Notifications');return;}
    const shared=['Assignments','Tasks','Research Repository','Reviews & Approvals','Reports & Analytics','Document Repository','Notice Board','Calendar','Team & Users'];
    if(destination==='Dashboard'||shared.includes(destination)){
      setDashboardModule(destination==='Dashboard'?'':destination);
      setDashboardActionQueue(null);
      setActive('Dashboard');
      setMenuOpen(false);
    }else navigateTo(destination);
  };
  const openDashboardReports = (subject: string) => {
    const scope =
      user?.role === "System Admin"
        ? "System-wide scope"
        : dashboardData?.management?.scope?.label === "My reporting team"
          ? "Team scope"
          : "Directorate scope";

    setDashboardReportContext({
      subject,
      scope,
      openedAt: new Date().toISOString(),
    });
    navigateTo("Reports & Analytics");
  };
  const openKnowledgeUpload = () => {
    setKnowledgeUploadStep(1);
    setKnowledgeUploadProgress({
      progress: 0,
      label: "Ready to upload",
      state: "waiting",
    });
    setKnowledgeUploadOpen(true);
  };

  const loadLiveData = async (accessToken: string, profile: User) => {
    const [assignmentRows, alertRows] = await Promise.all([
      api.assignments(accessToken),
      api.alerts(accessToken),
    ]);
    setAssignmentRows(assignmentRows);
    setWorkAllocation(
      assignmentRows.map((item: ApiAssignment) => ({
        id: item.id,
        title: item.title,
        assignee: item.members[0]?.name || "Unassigned",
        status: item.status,
        division: item.division,
        dueDate: item.due_date || "",
      })),
    );
    setSystemAlerts(
      alertRows
        .filter((item) => item.status === "Published")
        .map((item) => item.body),
    );
    if (["System Admin", "Director", "Deputy Director", "Assistant Director"].includes(profile.role)) {
      const members = await api.users(accessToken);
      setTeam(members.map(mapTeamMember));
      setUserRows(members);
    }
  };

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    try {
      const result = await api.login(email, password);
      const profile = mapUser(result.user);
      const session = { token: result.token, user: profile };
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      (rememberMe ? localStorage : sessionStorage).setItem(
        SESSION_KEY,
        JSON.stringify(session),
      );
      setToken(result.token);
      setUser(profile);
      setSessionMessage("");
      if (result.user.must_change_password) {
        setCurrentPassword(password);
        setPasswordMode("change");
        setPasswordMessage("Set a private password before continuing.");
        return;
      }
      await loadLiveData(result.token, profile);
    } catch (error) {
      setLoginError(
        error instanceof Error
          ? error.message
          : "The PSC service could not complete your login.",
      );
    } finally {
      setLoggingIn(false);
    }
  };

  const signOut = async () => {
    const accessToken = token;
    clearSession();
    if (accessToken)
      try {
        await api.logout(accessToken);
      } catch {
        /* Local sign-out still succeeds. */
      }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    const completingMandatoryChange = user?.mustChangePassword === true;
    if (newPassword !== confirmPassword)
      return setPasswordMessage("New passwords do not match.");
    setSavingPassword(true);
    setPasswordMessage("");
    try {
      const result = await api.changePassword(
        token,
        currentPassword,
        newPassword,
      );
      const profile = mapUser(result.user);
      const session = { token: result.token, user: profile };
      const storage = localStorage.getItem(SESSION_KEY)
        ? localStorage
        : sessionStorage;
      storage.setItem(SESSION_KEY, JSON.stringify(session));
      setToken(result.token);
      setUser(profile);
      setPasswordMessage("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      if (completingMandatoryChange) {
        setPasswordMode(null);
        setPasswordMessage("");
        try {
          await loadLiveData(result.token, profile);
        } catch {
          setSessionMessage("Password changed successfully. Refresh the page if workspace data does not load.");
        }
      }
    } catch (error) {
      setPasswordMessage(
        error instanceof Error
          ? error.message
          : "Password could not be changed.",
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const requestReset = async () => {
    if (!email.trim()) return setPasswordMessage("Enter your official PSC email address first.");
    setSavingPassword(true);
    setPasswordMessage("");
    try {
      const result = await api.forgotPassword(email.trim());
      setPasswordMessage(result.message);
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : "Reset request could not be submitted.");
    } finally {
      setSavingPassword(false);
    }
  };

  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) return setPasswordMessage("New passwords do not match.");
    if (!resetToken) return requestReset();
    setSavingPassword(true);
    setPasswordMessage("");
    try {
      const result = await api.resetPassword(resetToken, newPassword);
      setPasswordMode(null);
      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
      setSessionMessage(result.message);
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : "Password could not be reset. Request a new link and try again.");
    } finally {
      setSavingPassword(false);
    }
  };

  const addComment = async () => {
    if (!comment.trim() || !user || !token || !selectedAssignmentId) return;
    try {
      await api.addComment(token, selectedAssignmentId, comment.trim());
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Comment could not be saved.",
      );
      return;
    }
    const [history, discussion] = await Promise.all([
      api.history(token, selectedAssignmentId),
      api.comments(token, selectedAssignmentId),
    ]).catch((error) => {
      setAssignmentNotice(error instanceof Error ? error.message : "Activity could not be refreshed.");
      return [null, null] as const;
    });
    if (history && discussion) {
      setAssignmentHistory(history);
      setComments(discussion.map((item) => ({
        id: item.id,
        author: item.author_name,
        text: item.body,
        created_at: item.created_at,
      })));
    }
    setComment("");
  };

  const updateMemberRole = async (emailAddress: string, role: Role) => {
    const member = team.find((item) => item.email === emailAddress);
    if (!member || !token) return;
    try {
      await api.updateRole(token, member.id, role);
      setTeam(
        team.map((item) =>
          item.email === emailAddress ? { ...item, role } : item,
        ),
      );
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Role could not be updated.",
      );
    }
  };
  const updateAllocation = async (
    index: number,
    field: "assignee" | "status",
    value: string,
  ) => {
    const item = workAllocation[index];
    if (!token) return;
    try {
      if (field === "status") await api.updateStatus(token, item.id, value);
      else {
        const member = team.find((person) => person.name === value);
        if (member) await api.addMember(token, item.id, member.id);
      }
      setWorkAllocation(
        workAllocation.map((row, itemIndex) =>
          itemIndex === index ? { ...row, [field]: value } : row,
        ),
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Assignment could not be updated.",
      );
    }
  };
  const markNoticeNotificationsRead = async (noticeId: string) => {
    if (!token || !noticeId) return;
    const matches = notifications.filter(
      (item) => item.entity_type === "notice" && item.entity_id === noticeId && !item.read_at,
    );
    if (matches.length) {
      await Promise.all(matches.map((item) => api.readNotification(token, item.id)));
      await refreshNotifications();
    }
  };
  const publishAlert = async () => {
    if (!alertText.trim() || !token) return;
    try {
      await api.submitNotice(token, {
        title: "Management update",
        body: alertText.trim(),
        severity: "Important",
        audienceRole: null,
        eventStart: null,
        eventEnd: null,
        expiresAt: new Date(Date.now()+7*86400000).toISOString(),
      });
      setNoticeNotice("Notice submitted for approval.");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Notice could not be submitted.",
      );
      return;
    }
    setAlertText("");
  };
  const refreshCompletedWork = async () => {
    if (!token || !isManager) return;
    try {
      setManagerCompletedWork(await api.completedWork(token));
    } catch (error) {
      setUserNotice(
        error instanceof Error
          ? `Completed Work could not be loaded: ${error.message}`
          : "Completed Work could not be loaded.",
      );
    }
  };

  const refreshDashboard = async () => {
    if (!token || dashboardRequestRef.current) return;
    const controller = new AbortController();
    dashboardRequestRef.current = controller;
    setDashboardRefreshState("refreshing");
    try {
      setDashboardData(await api.dashboard(token, controller.signal));
      setDashboardRefreshState("idle");
      void refreshCompletedWork();
    } catch {
      setDashboardRefreshState("failed");
    } finally {
      if (dashboardRequestRef.current === controller)
        dashboardRequestRef.current = null;
    }
  };
  const refreshNotifications = async () => {
    setNotificationsLoading(true);
    try {
      setNotifications(await api.notifications(token));
    } finally {
      setNotificationsLoading(false);
    }
  };
  const openNotification = async (item: ApiNotification) => {
    if (!item.read_at) {
      await api.readNotification(token, item.id);
      await refreshNotifications();
    }
  };
  const resolveActionNotifications = async (
    _entityType: string,
    entityId: string,
  ) => {
    const matches = notifications.filter(
      (item) => !item.read_at && item.entity_id === entityId,
    );
    if (matches.length)
      await Promise.all(
        matches.map((item) => api.readNotification(token, item.id)),
      );
    await refreshNotifications();
  };
  const navigateNotification = async (item: ApiNotification) => {
    const text = `${item.title} ${item.body}`.toLowerCase();
    try {
      const notificationEntityType = String(item.entity_type || "").trim().toLowerCase();
      if (notificationEntityType.includes("meeting") && item.entity_id) {
        const notificationText = `${item.title || ""} ${item.body || ""} ${item.target_tab || ""}`.toLowerCase();
        if (
          /schedule.*approval|approval.*schedule|meeting_schedule_approval|schedule_approval/.test(`${notificationEntityType} ${notificationText}`) ||
          (String(item.target_workspace || "").toLowerCase().includes("reviews") && /approval|approve|review/.test(notificationText))
        ) {
          setActive("Reviews & Approvals");
          await openNotification(item);
          return;
        }
        const supportedMeetingTabs = ["Overview", "Agenda", "Participants", "Transcript", "Minutes", "Decisions & Actions", "Documents", "Audit"];
        const requestedMeetingTab = String(item.target_tab || "").trim();
        const matchedMeetingTab = supportedMeetingTabs.find((tab) => tab.toLowerCase() === requestedMeetingTab.toLowerCase());
        const targetMeetingTab = matchedMeetingTab || (/minutes/.test(notificationText) ? "Minutes" : /transcript/.test(notificationText) ? "Transcript" : /participant|attendance/.test(notificationText) ? "Participants" : /agenda/.test(notificationText) ? "Agenda" : /decision|action item/.test(notificationText) ? "Decisions & Actions" : "Overview");
        setMeetingNotificationTarget({ id: item.entity_id, tab: targetMeetingTab, nonce: Date.now() });
        setActive("Meetings");
        await openNotification(item);
        return;
      }
      if (item.entity_type === "research_report_section" && item.entity_id) {
        const projects = researchRows.length ? researchRows : await api.research(token, isManager ? "team" : "my");
        if (!researchRows.length) setResearchRows(projects);
        const project = projects.find((row) => row.id === item.entity_id);
        if (!project) throw new Error("The related research workspace is not available to this account.");
        const opened = await openResearchWorkspace(project, "Report");
        const report = opened?.report || [];
        const section =
          report.find((row) => item.body.includes(`“${row.title}”`) || item.body.includes(`â€œ${row.title}â€`)) ||
          report.find((row) => row.status === "Ready for Review") ||
          report[0];
        setSelectedReportSection(section || null);
        setReportContent(section?.content || "");
        await openNotification(item);
        return;
      }
      if (item.entity_type === "research" && item.entity_id) {
        const projects = researchRows.length ? researchRows : await api.research(token, isManager ? "team" : "my");
        if (!researchRows.length) setResearchRows(projects);
        const project = projects.find((row) => row.id === item.entity_id);
        if (!project) throw new Error("The related research workspace is not available to this account.");
        const targetTab = /review|approve|decision|changes|rejected|submitted|publish|final report/i.test(text)
          ? "Review"
          : /milestone|deadline|due|overdue|work/i.test(text)
            ? "Work"
            : /evidence|source|document/i.test(text)
              ? "Resources"
              : "Overview";
        await openResearchWorkspace(project, targetTab);
        await openNotification(item);
        return;
      }
      if (item.entity_type === "generated_document" && item.entity_id) {
        setActive("Assignments");
        await openGeneratedDocument(item.entity_id);
        return;
      }
      if (item.entity_type === "assignment_member_request" && item.entity_id) {
        const assignments = assignmentRows.length
          ? assignmentRows
          : await api.assignments(token);
        if (!assignmentRows.length) setAssignmentRows(assignments);
        for (const assignment of assignments) {
          try {
            const requests = await api.assignmentMemberRequests(
              token,
              assignment.id,
            );
            if (!requests.some((request) => request.id === item.entity_id))
              continue;
            setActive("Assignments");
            await openAssignmentDetails(assignment);
            setAssignmentMemberRequests(requests);
            setAssignmentWorkspaceTab("Overview");
            await openNotification(item);
            return;
          } catch {
            // Continue until an accessible assignment contains this request.
          }
        }
        setActive("Assignments");
        return;
      }
      if (item.entity_type === "assignment_task_request" && item.entity_id) {
        // TASK REQUEST is a standalone TASKS object. The Tasks module resolves
        // requester/approver scope and presents the appropriate queue.
        setActive("Tasks");
        await openNotification(item);
        return;
      }
      if (item.entity_type === "document_deletion_request") {
        setActive("Document Repository");
        await openNotification(item);
        return;
      }
      if (["assignment_task", "task"].includes(item.entity_type || "") && item.entity_id) {
        // First try the narrow contextual-review route. It succeeds only for the
        // task's assigned reviewer (or a manager) and does not expose the rest
        // of the assignment.
        try {
          await openContextualTaskReview(item.entity_id);
          await openNotification(item);
          return;
        } catch {
          // Not a contextual reviewer: preserve the existing owner/team fallback.
        }

        const assignedReview = (dashboardData?.myWork || []).find(
          (row) => row.type === "Review" && row.id === item.entity_id,
        );
        if (assignedReview) {
          await openDashboardWork(assignedReview);
          await openNotification(item);
          return;
        }

        try {
          await openStandaloneTask(item.entity_id);
          await openNotification(item);
          return;
        } catch {
          setActive("Tasks");
          await openNotification(item);
          return;
        }
      }
      if (item.entity_type === "leave_request" && item.entity_id) {
        const isLeaveApproval = item.notification_category === "Review" ||
          /leave request awaiting review/i.test(item.title || "");
        setActive(isLeaveApproval ? "Reviews & Approvals" : "Leave");
        await openNotification(item);
        return;
      }
      if (item.entity_type?.startsWith("assignment") && item.entity_id) {
        setActive("Assignments");
        const rows = assignmentRows.length
          ? assignmentRows
          : await api.assignments(token);
        if (!assignmentRows.length) setAssignmentRows(rows);
        const assignment = rows.find((row) => row.id === item.entity_id);
        if (assignment) {
          await openAssignmentDetails(assignment);

          // Task-review notices must open the task report workflow, never the
          // assignment-level Final Assignment Report review screen. Some older
          // notifications used an assignment entity id even though the action
          // required was a task report decision, so resolve the actionable task
          // from the live assignment tasks before falling back to formal review.
          const looksLikeReview = /review|approve|changes|correction/.test(text);
          const looksLikeTaskReview = looksLikeReview && /task|contribution/.test(text);
          if (looksLikeTaskReview) {
            try {
              const tasks = await api.assignmentTasks(token, assignment.id);
              setAssignmentTasks(tasks);
              const candidates = tasks.filter(
                (task) =>
                  task.reviewer_id === user?.id &&
                  ["Ready for Integration", "Integrated"].includes(task.contribution_status),
              );
              const task =
                candidates.find((candidate) =>
                  text.includes(String(candidate.title || "").toLowerCase()),
                ) || candidates[0];
              if (task) {
                setAssignmentWorkspaceTab("Overview");
                await openAssignmentTaskWorkspace(task, true);
                await openNotification(item);
                return;
              }
            } catch {
              // If task resolution fails, keep the existing assignment routing
              // rather than trapping the user in notifications.
            }
          }

          setAssignmentWorkspaceTab(
            looksLikeReview
              ? "Reports"
              : /task|work/.test(text)
                ? "Overview"
                : /document|report|output/.test(text)
                  ? "Documents"
                  : "Overview",
          );
          if (/assigned|responsib/.test(text) && !looksLikeReview)
            await openNotification(item);
        }
        return;
      }
      if (item.entity_type === "external_research_import" && item.entity_id) {
        setActive("Research Repository");
        requestResearchEntryMode("Imported");
        const imports = externalResearchRows.length ? externalResearchRows : await api.externalResearchImports(token);
        if (!externalResearchRows.length) setExternalResearchRows(imports);
        const target = imports.find((row) => row.id === item.entity_id) || await api.externalResearchImport(token, item.entity_id);
        setSelectedExternalResearch(target);
        await openNotification(item);
        return;
      }
      if (item.entity_type === "knowledge" || item.entity_type === "document") {
        setActive("Document Repository");
        if (item.entity_id) {
          const [liveReviews, liveDocuments] = await Promise.all([
            reviewRows.length ? Promise.resolve(reviewRows) : api.documentReviews(token),
            documentRows.length ? Promise.resolve(documentRows) : api.documents(token),
          ]);
          if (!reviewRows.length) setReviewRows(liveReviews);
          if (!documentRows.length) setDocumentRows(liveDocuments.map(normalizeDocument));
          const reviewTarget = liveReviews.find((row) => row.id === item.entity_id);
          const documentTarget = liveDocuments.find((row) => row.id === item.entity_id);
          if (reviewTarget && /review|approve|correction|reject/.test(text)) { setReviewDocument(reviewTarget); setReviewDocumentReadId(null); }
          else if (documentTarget) setReaderDocument(documentTarget);
        }
        await openNotification(item);
        return;
      }
      if (item.entity_type === "notice") {
        setActive("Notice Board");
        if(item.entity_id)setFocusedNoticeId(item.entity_id);
        await openNotification(item);
        if (item.entity_id && /review|approve/.test(text)) {
          const target = noticeRows.find((row) => row.id === item.entity_id);
          if (target) setReviewingNotice(target);
        }
        return;
      }
      setActive("Notifications");
    } catch (error) {
      setSessionMessage(
        error instanceof Error
          ? error.message
          : "The notification target could not be opened.",
      );
    }
  };
  const markAllNotificationsRead = async () => {
    setNotificationsLoading(true);
    try {
      await api.readAllNotifications(token);
      setNotifications(await api.notifications(token));
    } finally {
      setNotificationsLoading(false);
    }
  };
  const updateNotificationState = async (
    id: string,
    state: { read?: boolean; important?: boolean; archived?: boolean },
  ) => {
    if (!token) return;
    const updated = await api.updateNotificationState(token, id, state);
    setNotifications((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
  };
  const archiveReadNotifications = async () => {
    if (!token) return;
    await api.archiveReadNotifications(token);
    setNotifications(await api.notifications(token));
  };
  const submitNotice = async (event: React.FormEvent) => {
    event.preventDefault();
    setNoticeNotice("");
    try {
      if (!noticeForm.expiresAt) throw new Error("Choose when this notice should expire.");
      if (noticeForm.eventEnd && !noticeForm.eventStart)
        throw new Error("Choose an event start before choosing an end.");
      if (
        noticeForm.eventStart &&
        noticeForm.eventEnd &&
        noticeForm.eventEnd < noticeForm.eventStart
      )
        throw new Error("Event end must be after the event start.");
      await api.submitNotice(token, {
        title: noticeForm.title,
        body: noticeForm.body,
        severity: noticeForm.severity,
        audienceRole: noticeForm.audienceRole || null,
        audienceRules: noticeForm.audienceRules,
        acknowledgementRequired: noticeForm.acknowledgementRequired,
        eventStart: noticeForm.eventStart
          ? localDateTimeToIso(noticeForm.eventStart)
          : null,
        eventEnd: noticeForm.eventEnd
          ? localDateTimeToIso(noticeForm.eventEnd)
          : null,
        expiresAt: localDateTimeToIso(noticeForm.expiresAt),
      });
      setNoticeForm({
        title: "",
        body: "",
        severity: "Information",
        audienceRole: "",
        audienceRules: [{ type: "ORGANISATION", value: "*" }],
        acknowledgementRequired: false,
        eventStart: "",
        eventEnd: "",
        expiresAt: "",
      });
      setNoticeRows(await api.alerts(token));
      setNoticeNotice(
        "Notice submitted successfully and is awaiting approval.",
      );
    } catch (error) {
      setNoticeNotice(
        error instanceof Error
          ? error.message
          : "Notice could not be submitted.",
      );
    }
  };
  const reviewNotice = async (approved: boolean) => {
    if (!reviewingNotice) return;
    try {
      const reviewedId = reviewingNotice.id;
      await api.reviewNotice(token, reviewedId, approved, noticeReason);
      await resolveActionNotifications("notice", reviewedId);
      setReviewingNotice(null);
      setNoticeReason("");
      const [alerts, notifications, calendar] = await Promise.all([
        api.alerts(token),
        api.notifications(token),
        api.calendar(token),
      ]);
      setNoticeRows(alerts);
      setNotifications(notifications);
      setCalendarRows(calendar);
      const nextOutcome = approved ? "The notice is published and synchronized with Calendar." : "The notice is rejected and the author has been notified.";
      setWorkflowDecision({
        title: approved ? "Notice approved" : "Notice rejected",
        outcome: nextOutcome,
        nextAction: approved
          ? "No further approval action is required. The notice is published for its selected audience."
          : "The notice author must revise the content and submit it again if publication is still needed.",
      });
      setNoticeNotice(
        approved
          ? "Notice approved, published and synchronized with Calendar."
          : "Notice returned to its author.",
      );
    } catch (error) {
      setNoticeNotice(
        error instanceof Error
          ? error.message
          : "Notice review could not be saved.",
      );
    }
  };
  const deleteNotice = async (item: NoticeItem) => {
    if (!window.confirm(`Delete notice "${item.title}"?`)) return;
    try {
      await api.deleteNotice(token, item.id);
      setNoticeRows(await api.alerts(token));
      setCalendarRows(await api.calendar(token));
      setNoticeNotice("Notice deleted.");
    } catch (error) {
      setNoticeNotice(
        error instanceof Error ? error.message : "Notice could not be deleted.",
      );
    }
  };
  const openAssignment = async (title: string, id?: string) => {
    setSelectedAssignment(title);
    setSelectedAssignmentId(id || null);
    if (id && token) {
      try {
        const rows = await api.comments(token, id);
        setComments(rows.map((item) => ({
          id: item.id,
          author: item.author_name,
          text: item.body,
          created_at: item.created_at,
        })));
      } catch {
        setComments([]);
      }
    }
  };

  const refreshAssignments = async () => {
    if (!token) return;
    const rows = await api.assignments(token);
    setAssignmentRows(rows);
    setWorkAllocation(
      rows.map((item) => ({
        id: item.id,
        title: item.title,
        assignee: item.members[0]?.name || "Unassigned",
        status: item.status,
        division: item.division,
        dueDate: item.due_date || "",
      })),
    );
  };

  const beginAssignmentCreation = async (mode: "Internal" | "External") => {
    setAssignmentSourceChoiceOpen(false);
    setAssignmentCreationMode(mode);
    setAssignmentNotice("");
    setExternalAssignmentFile(null);
    setExternalAssignmentReviewerId("");
    setExternalAssignmentReviewNote("");
    setExternalAssignmentActionStatus("");
    if (mode === "External" && token) {
      try {
        setUserRows(await api.users(token));
      } catch (error) {
        setAssignmentNotice(
          error instanceof Error
            ? error.message
            : "Reviewer options could not be loaded.",
        );
      }
    }
    setAssignmentEditor("new");
    setAssignmentForm({
      title: "",
      description: "",
      objective: "",
      scope: "",
      instructions: "",
      expectedOutput: "Final Assignment Report",
      division: "",
      startDate: null,
      dueDate: null,
      priority: "Normal",
      memberIds: [],
      leadId: null,
    });
  };

  const startAssignment = (assignment?: ApiAssignment) => {
    if (!isManager) {
      setAssignmentNotice(
        "Only authorised management roles can create or edit assignments within their organisational scope.",
      );
      setAssignmentEditor(null);
      return;
    }
    setAssignmentNotice("");
    if (!assignment) {
      setAssignmentSourceChoiceOpen(true);
      setAssignmentEditor(null);
      return;
    }
    setAssignmentCreationMode("Internal");
    setAssignmentEditor(assignment);
    setAssignmentForm({
      title: assignment.title,
      description: assignment.description,
      objective: assignment.objective || "",
      scope: assignment.scope || "",
      instructions: assignment.instructions || "",
      expectedOutput: assignment.expected_output || "Final Assignment Report",
      division: assignment.division,
      startDate: assignment.start_date || null,
      dueDate: assignment.due_date,
      priority: assignment.priority,
      memberIds: assignment.members.map((member) => member.id),
      leadId: assignment.members.find((member) => member.role === "Lead")?.id || null,
    });
  };

  const saveAssignment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;

    const isExternalRegistration =
      assignmentEditor === "new" && assignmentCreationMode === "External";
    if (
      assignmentEditor === "new" &&
      assignmentCreationMode === "Internal" &&
      !assignmentForm.leadId
    ) {
      setAssignmentNotice("Select one accountable Assignment Lead before creating the assignment.");
      return;
    }
    if (isExternalRegistration) {
      const failExternalRegistration = (message: string) => {
        setAssignmentNotice(message);
        setExternalAssignmentActionStatus(`Cannot continue: ${message}`);
      };
      if (assignmentForm.title.trim().length < 4) {
        failExternalRegistration("Enter an assignment title of at least 4 characters.");
        return;
      }
      if (!assignmentForm.division.trim()) {
        failExternalRegistration("Enter the responsible division.");
        return;
      }
      if (!externalAssignmentFile) {
        failExternalRegistration("Select the completed PDF or DOCX report before continuing.");
        return;
      }
      const externalFileName = externalAssignmentFile.name.toLowerCase();
      if (!externalFileName.endsWith(".pdf") && !externalFileName.endsWith(".docx")) {
        failExternalRegistration("The completed report must be a PDF or DOCX file.");
        return;
      }
      if (!externalAssignmentReviewerId) {
        failExternalRegistration("Select the reviewer who will receive this external report.");
        return;
      }
      if (externalAssignmentReviewerId === user?.id) {
        failExternalRegistration("You cannot assign yourself as reviewer for a report you are submitting.");
        return;
      }
    }

    setSavingAssignment(true);
    setAssignmentNotice("");
    if (isExternalRegistration) setExternalAssignmentActionStatus("Registering assignment...");
    let createdExternalAssignmentId: string | null = null;
    let createdExternalReportId: string | null = null;
    let externalSubmissionCommitted = false;
    try {
      if (assignmentEditor === "new") {
        const created = await api.createAssignment(
          token,
          assignmentCreationMode === "External"
            ? { ...assignmentForm, memberIds: [] }
            : assignmentForm,
        );
        if (assignmentCreationMode === "External")
          createdExternalAssignmentId = created.id;

        if (assignmentCreationMode === "External") {
          setExternalAssignmentActionStatus("Checking the approved assignment report template...");
          const templates = await api.documentTemplates(token, "Assignment");
          setBuilderTemplates(templates);
          const finalTemplate = templates.find(
            (item) =>
              item.template_key === "assignment-final-report" &&
              item.active &&
              ["Approved", "Standard"].includes(item.governance_status),
          );

          if (!finalTemplate)
            throw new Error(
              "The approved Final Assignment Report control template is unavailable. The external assignment was not registered.",
            );

          setExternalAssignmentActionStatus("Creating the controlled report record...");
          const report = await api.createGeneratedDocument(token, {
            templateId: finalTemplate.id,
            context: "Assignment",
            contextId: created.id,
            title: `${created.title} — Final Assignment Report`,
            classification: "Official",
          });
          createdExternalReportId = report.id;

          setExternalAssignmentActionStatus("Uploading the completed report...");
          await api.importAssignmentReport(token, report.id, externalAssignmentFile!);
          setExternalAssignmentActionStatus("Submitting the locked review copy to the selected reviewer...");
          await api.submitAssignmentReport(token, report.id, {
            reviewerId: externalAssignmentReviewerId,
            reviewDueDate: null,
            comments: externalAssignmentReviewNote.trim(),
          });
          externalSubmissionCommitted = true;
          setExternalAssignmentActionStatus("Submitted successfully. Opening the read-only report...");

          setAssignmentEditor(null);
          setExternalAssignmentFile(null);
          setExternalAssignmentReviewerId("");
          setExternalAssignmentReviewNote("");
          setAssignmentNotice(
            "External assignment registered and submitted to the selected reviewer. The imported report is locked as the review copy.",
          );

          try {
            await refreshAssignments();
            await refreshNotifications();
            await openAssignmentDetails(created);
            setAssignmentWorkspaceTab("Reports");
            const submittedReport = await api.generatedDocument(token, report.id);
            setExternalAssignmentReaderDocument(submittedReport);
          } catch (navigationError) {
            setAssignmentNotice(
              `External assignment submitted successfully, but the reader could not be opened automatically. ${navigationError instanceof Error ? navigationError.message : "Open the assignment Review tab to read the submitted report."}`,
            );
          }
          return;
        }

        setAssignmentEditor(null);
        await refreshAssignments();
        await openAssignmentDetails(created);
        setAssignmentWorkspaceTab("Overview");
        setAssignmentNotice(
          `Assignment created. ${assignmentForm.leadId ? "The accountable lead and team can now begin work." : "This direct assignment is ready for report preparation."}`,
        );
      } else if (assignmentEditor) {
        await api.updateAssignment(token, assignmentEditor.id, assignmentForm);
        for (const memberId of assignmentForm.memberIds)
          await api.addMember(token, assignmentEditor.id, memberId);
        await refreshAssignments();
        setAssignmentEditor(null);
        setAssignmentNotice("Assignment saved successfully.");
      }
    } catch (error) {
      if (createdExternalAssignmentId && !externalSubmissionCommitted) {
        if (createdExternalReportId) {
          try {
            await api.discardImportedAssignmentReport(token, createdExternalReportId);
          } catch {
            // There may be no stored import yet; continue with assignment rollback.
          }
        }
        try {
          await api.deleteAssignment(token, createdExternalAssignmentId);
          await refreshAssignments();
        } catch {
          // Preserve the primary workflow error. Any cleanup failure remains auditable server-side.
        }
      }
      const assignmentErrorMessage =
        error instanceof Error ? error.message : "Assignment could not be saved.";
      setAssignmentNotice(assignmentErrorMessage);
      if (isExternalRegistration)
        setExternalAssignmentActionStatus(`Failed: ${assignmentErrorMessage}`);
    } finally {
      setSavingAssignment(false);
    }
  };

  const removeAssignment = async (assignment: ApiAssignment) => {
    if (
      !token ||
      !window.confirm(`Delete "${assignment.title}"? This cannot be undone.`)
    )
      return;
    try {
      await api.deleteAssignment(token, assignment.id);
      await refreshAssignments();
      setAssignmentNotice("Assignment deleted.");
    } catch (error) {
      setAssignmentNotice(
        error instanceof Error
          ? error.message
          : "Assignment could not be deleted.",
      );
    }
  };

  const archiveSelectedResearch = async () => {
    if (!token || !selectedResearch || !isManager) return;
    if (!window.confirm(`Archive "${selectedResearch.title}"? It will leave active research views but retain its institutional record.`)) return;
    try {
      await api.updateResearchStatus(token, selectedResearch.id, "Archived");
      const refreshed = await api.research(token);
      setResearchRows(refreshed);
      setSelectedResearch(refreshed.find((item) => item.id === selectedResearch.id) || null);
      setResearchWorkspaceNotice("Research project archived. It can now be permanently deleted from the danger zone if required.");
    } catch (error) {
      setResearchWorkspaceNotice(error instanceof Error ? error.message : "Research project could not be archived.");
    }
  };

  const deleteSelectedResearch = async () => {
    if (!token || !selectedResearch || !isManager) return;
    if (selectedResearch.status !== "Archived") {
      setResearchWorkspaceNotice("Archive this research project before permanently deleting it.");
      return;
    }
    const reason = window.prompt(`Give the reason for permanently deleting "${selectedResearch.title}". This action cannot be undone.`)?.trim();
    if (!reason || reason.length < 5) {
      setResearchWorkspaceNotice("A deletion reason of at least 5 characters is required.");
      return;
    }
    if (!window.confirm(`Permanently delete "${selectedResearch.title}" and its related research records? This cannot be undone.`)) return;
    try {
      await api.deleteResearch(token, selectedResearch.id, reason);
      setSelectedResearch(null);
      setResearchRows(await api.research(token));
      setResearchWorkspaceNotice("Research project permanently deleted.");
      setActive("Research Repository");
    } catch (error) {
      setResearchWorkspaceNotice(error instanceof Error ? error.message : "Research project could not be deleted.");
    }
  };

  const openAssignmentDetails = async (assignment: ApiAssignment) => {
    setSelectedAssignment(assignment.title);
    setSelectedAssignmentId(assignment.id);
    setBuilderCreate((current) => ({ ...current, title: assignment.title }));
    setAssignmentWorkspaceTab("Overview");
    window.history.replaceState(
      {},
      "",
      `/assignments/${assignment.id}/overview`,
    );
    setAssignmentNotice("");
    try {
      const [assignments, tasks, reviews, memberRequests] = await Promise.all([
        api.assignments(token),
        api.assignmentTasks(token, assignment.id),
        api.assignmentReviews(token, assignment.id),
        api.assignmentMemberRequests(token, assignment.id),
      ]);
      setAssignmentRows(assignments);
      setAssignmentTasks(tasks);
      setAssignmentReviews(reviews);
      setAssignmentMemberRequests(memberRequests);
        setAssignmentMemberRequests([]);
      setAssignmentSections([]);
      setAssignmentFiles([]);
      setAssignmentHistory([]);
      setComments([]);
      setWorkspaceDocuments([]);
      if (isManager)
        api
          .users(token)
          .then(setUserRows)
          .catch(() => {});
    } catch (error) {
      setAssignmentNotice(
        error instanceof Error
          ? error.message
          : "Assignment details could not be loaded.",
      );
    }
  };

  const openResearchWorkspace = async (
    project: ResearchProject,
    initialTab: "Overview" | "Work" | "Resources" | "Report" | "Review" | "Activity" = "Overview",
  ) => {
    setActive("Research Repository");
    setResearchWorkspaceNotice("");

    // A Research Workspace must never inherit project-specific state from the
    // previously opened project. Clear it before resolving the authoritative
    // project record and loading its governed workspace data.
    setSelectedResearch(null);
    setResearchComments([]);
    setResearchComment("");
    setResearchReport([]);
    setResearchReportVersions([]);
    setResearchSources([]);
    setResearchRepositoryDocuments([]);
    setResearchActivity([]);
    setBuilderTemplates([]);
    setWorkspaceDocuments([]);
    setSelectedReportSection(null);
    setReportContent("");
    setResearchSectionWorkspaceMode(null);
    setResearchSupportingDocumentIds([]);
    setResearchDraftReviewerId("");

    try {
      // Always resolve the project by ID. The list views have different RBAC
      // scopes (my/team/reviews), while the workspace requires one fully
      // hydrated, access-controlled project object.
      const hydratedProject = await api.researchProject(token, project.id);

      setSelectedResearch(hydratedProject);
      setResearchPlanDraft({
        summary: hydratedProject.summary || "",
        researchQuestion: hydratedProject.research_question || "",
        objectives: hydratedProject.objectives || "",
        methodology: hydratedProject.methodology || "",
        startDate: hydratedProject.start_date || "",
        endDate: hydratedProject.end_date || "",
      });
      setResearchTeamDraft({
        leadId: hydratedProject.lead_id,
        collaborators: (hydratedProject.collaborators || []).map((person) => ({
          userId: person.id,
          role: ["Researcher", "Analyst", "Reviewer", "Subject Matter Expert"].includes(person.role)
            ? person.role
            : "Researcher",
        })),
      });
      setResearchTab(initialTab);
      window.history.replaceState(
        {},
        "",
        `/research/${hydratedProject.id}/${initialTab.toLowerCase() === "resources" ? "evidence" : initialTab.toLowerCase()}`,
      );

      const [comments, report, versions, sources, activityRows, templates, documents] = await Promise.all([
        api.researchComments(token, hydratedProject.id),
        api.researchReport(token, hydratedProject.id),
        api.researchReportVersions(token, hydratedProject.id),
        api.researchSources(token, hydratedProject.id),
        api.researchActivity(token, hydratedProject.id),
        api.documentTemplates(token, "Research"),
        api.generatedDocuments(token, "Research", hydratedProject.id),
      ]);
      setResearchComments(comments);
      setResearchReport(report);
      setResearchReportVersions(versions);
      setResearchSources(sources);
      setResearchActivity(activityRows);
      setBuilderTemplates(templates);
      setWorkspaceDocuments(documents);
      setBuilderCreate({
        templateId: templates[0]?.id || "",
        title: "",
        classification: "Official",
      });
      if (report.length) {
        setSelectedReportSection(report[0]);
        setReportContent(report[0].content || "");

        const latestVersion = versions[0];
        const versionIsLocked = Boolean(
          latestVersion && ["Submitted", "Approved"].includes(latestVersion.status),
        ) || Boolean(
          hydratedProject.status === "Under Review" &&
            !["Changes Requested", "Rejected"].includes(latestVersion?.status || ""),
        );
        if (initialTab === "Report" && !versionIsLocked) {
          await loadResearchSectionAccess(hydratedProject.id, report[0].id);
          setResearchSectionWorkspaceMode(
            report[0].status === "Approved" ? "review" : "edit",
          );
        }
      }
      return { project: hydratedProject, report, versions };
    } catch (error) {
      setSelectedResearch(null);
      setResearchWorkspaceNotice(
        error instanceof Error ? error.message : "Research workspace could not be loaded.",
      );
    }
  };

  useEffect(() => {
    if (!token || builderDocument) return;
    const match = window.location.pathname.match(
      /^\/assignments\/([0-9a-f-]+)\/reports\/([0-9a-f-]+)\/edit$/i,
    );
    if (!match) return;
    const [, assignmentId, reportId] = match;
    setActive("Assignments");
    setSelectedAssignmentId(assignmentId);
    setAssignmentWorkspaceTab("Documents");
    api
      .generatedDocument(token, reportId)
      .then(setBuilderDocument)
      .catch((error) =>
        setAssignmentNotice(
          error instanceof Error
            ? error.message
            : "Report could not be opened.",
        ),
      );
  }, [token, builderDocument]);
  const selectedAssignmentRecord =
    assignmentRows.find((item) => item.id === selectedAssignmentId) || null;
  const {
    latestFinalReport: latestFinalAssignmentReport,
    acceptedTaskReportCount,
    completedTaskCount,
    allTaskReportsAccepted,
    finalReportIsFinal: finalAssignmentReportIsFinal,
    completion: assignmentCompletion,
    daysRemaining: assignmentDays,
    lead: assignmentLead,
    isLead: isAssignmentLead,
    nextAction: assignmentNextAction,
    operationalStatus: assignmentOperationalStatus,
  } = deriveAssignmentOverview({
    assignment: selectedAssignmentRecord,
    tasks: assignmentTasks,
    documents: workspaceDocuments,
    reviews: assignmentReviews,
    user,
  });
  const isSelectedTaskOwner = Boolean(
    user?.id && selectedAssignmentTask?.owner_id === user.id,
  );
  const canManageTaskOwner = (task: ApiAssignmentTask | null | undefined) => Boolean(
    task && isManager && (
      user?.role === "System Admin" ||
      user?.role === "Director" ||
      userRows.some((member) => member.id === task.owner_id)
    ),
  );
  const canEditSelectedTaskReport = isSelectedTaskOwner || canManageTaskOwner(selectedAssignmentTask);
  const isSelectedTaskReviewer = Boolean(
    user?.id && selectedAssignmentTask?.reviewer_id === user.id,
  );
  const canReviewSelectedTask = Boolean(
    selectedAssignmentTask &&
      !isSelectedTaskOwner &&
      (isSelectedTaskReviewer ||
        (selectedAssignmentTask.status === "Blocked" && (isAssignmentLead || isManager))),
  );
  const latestSelectedTaskReview = selectedAssignmentTask
    ? assignmentHistory.find((item) => {
        const taskId = String(item.details?.taskId || "");
        return (
          taskId === selectedAssignmentTask.id &&
          ["TASK_REPORT_CHANGES_REQUESTED", "TASK_REPORT_REJECTED", "TASK_REPORT_REOPENED", "TASK_REPORT_APPROVED", "TASK_FINAL_REPORT_GENERATED"].includes(
            item.action,
          )
        );
      })
    : undefined;
  const assignedTaskReviewerAccount = selectedAssignmentTask?.reviewer_id
    ? userRows.find((member) => member.id === selectedAssignmentTask.reviewer_id)
    : undefined;
  const authorizedTaskReviewers = selectedAssignmentTask?.reviewer_id &&
    assignedTaskReviewerAccount?.active !== false
    ? [
        {
          id: selectedAssignmentTask.reviewer_id,
          name: selectedAssignmentTask.reviewer_name || assignedTaskReviewerAccount?.name || "Assigned reviewer",
          role: assignedTaskReviewerAccount?.role || "Assigned reviewer",
        },
      ]
    : [];
  const taskReportReviewerAuthority = useTaskReportReviewerOptions({
    token,
    assignmentId: selectedAssignmentTask?.assignment_id || selectedAssignmentId,
    ownerId: selectedAssignmentTask?.owner_id || null,
    enabled: Boolean(
      selectedAssignmentTask &&
        selectedAssignmentTask.contribution_status === "Draft" &&
        canEditSelectedTaskReport,
    ),
  });
  const taskReportReviewerCandidates = taskReportReviewerAuthority.options.filter(
    (reviewer) => reviewer.id !== user?.id,
  );
  const assignmentReportReviewerCandidates = [
    ...(selectedAssignmentRecord?.members || []).map((member) => {
      const account = userRows.find((userRow) => userRow.id === member.id);
      return {
        id: member.id,
        name: member.name,
        role: account?.role || (member.role === "Lead" ? "Assignment Lead" : "Researcher"),
      };
    }),
    ...userRows
      .filter(
        (member) =>
          member.active &&
          member.role !== "System Admin" &&
          Boolean(
            assignmentLead?.supervisor_id &&
              (member.id === assignmentLead.supervisor_id ||
                member.supervisor_id === assignmentLead.supervisor_id),
          ),
      )
      .map((member) => ({ id: member.id, name: member.name, role: member.role })),
  ].filter(
    (person, index, people) =>
      people.findIndex((candidate) => candidate.id === person.id) === index,
  );

  const selectedTaskResponsibility = !selectedAssignmentTask
    ? null
    : selectedAssignmentTask.contribution_status === "Accepted"
      ? {
          stage: "Completed",
          responsible: "No further task action",
          action: "The final approved task report is available to the Assignment Lead for the Final Assignment Report.",
        }
      : selectedAssignmentTask.contribution_status === "Integrated"
        ? {
            stage: "Approved · Final Report Pending",
            responsible: selectedAssignmentTask.reviewer_name || assignmentLead?.name || "Assigned reviewer or Assignment Lead",
            action: "Generate the final task report and publish the controlled copy to the Repository.",
          }
        : selectedAssignmentTask.contribution_status === "Ready for Integration"
          ? {
              stage: isSelectedTaskReviewer
                ? "Submitted · Locked for Your Review"
                : "Submitted · Locked for Reviewer",
              responsible: selectedAssignmentTask.reviewer_name || "Assigned reviewer",
              action: isSelectedTaskReviewer
                ? "Open the frozen submitted report, review it, then Approve, Request Changes, or Reject it."
                : `The submitted version is frozen. ${selectedAssignmentTask.reviewer_name || "The assigned reviewer"} must record the next decision.`,
            }
          : {
              stage: selectedAssignmentTask.status === "Not Started" ? "Assigned" : "Work in Progress",
              responsible: selectedAssignmentTask.owner_name || "Task owner",
              action: selectedAssignmentTask.status === "Not Started"
                ? "Start the task, complete the work, and prepare the task report."
                : "Complete the task report, Save Draft, Preview, and Submit to the assigned reviewer.",
            };
  const taskHasReportDraft = (task: ApiAssignmentTask) =>
    taskHasReportDraftMapped(task, taskReportPlainText);

  const taskReportOwnerActionLabel = (task: ApiAssignmentTask) =>
    taskReportOwnerActionLabelMapped(task, taskReportPlainText);
  const focusTaskReportEditor = () => {
    window.setTimeout(() => {
      const report = document.getElementById("task-report-editor");
      if (!report) return;
      report.scrollIntoView({ behavior: "smooth", block: "start" });
      const firstEditable = report.querySelector<HTMLElement>(
        'input:not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled])',
      );
      firstEditable?.focus({ preventScroll: true });
    }, 80);
  };
  const selectAssignmentWorkspaceTab = (
    tab:
      | "Overview"
      | "Documents"
      | "Reports"
      | "Activity"
  ) => {
    setAssignmentWorkspaceTab(tab);
    setAssignmentNotice("");
  };

  useEffect(() => {
    if (!selectedAssignmentId || !token) return;

    let cancelled = false;

    const refreshAssignmentWorkspaceTab = async () => {
      try {
        switch (assignmentWorkspaceTab) {
          // ASSIGNMENT V1.10.1: no "Tasks" branch exists here.
          // TASK execution and refresh belong to the standalone Tasks module.

          case "Activity": {
            const [historyResult, discussionResult] = await Promise.allSettled([
              api.history(token, selectedAssignmentId),
              api.comments(token, selectedAssignmentId),
            ]);
            if (!cancelled) {
              if (historyResult.status === "fulfilled") setAssignmentHistory(historyResult.value);
              if (discussionResult.status === "fulfilled") {
                setComments(discussionResult.value.map((item) => ({
                  id: item.id,
                  author: item.author_name,
                  text: item.body,
                  created_at: item.created_at,
                })));
              }
              const failedResult = historyResult.status === "rejected"
                ? historyResult
                : discussionResult.status === "rejected" ? discussionResult : null;
              if (failedResult) throw failedResult.reason;
            }
            break;
          }

          case "Reports": {
            const [templates, documents, repository, tasks] = await Promise.all([
              api.documentTemplates(token, "Assignment"),
              api.generatedDocuments(token, "Assignment", selectedAssignmentId),
              api.knowledge(token),
              api.assignmentTasks(token, selectedAssignmentId),
            ]);
            if (!cancelled) {
              setBuilderTemplates(templates);
              setWorkspaceDocuments(documents);
              setKnowledgeRows(repository);
              setAssignmentTasks(tasks);
            }
            break;
          }

          case "Documents": {
            setExternalAssignmentActionStatus("Checking the approved assignment report template...");
          const templates = await api.documentTemplates(token, "Assignment");
            if (!cancelled) {
              setBuilderTemplates(templates);
              const eligibleTemplates = templates.filter(
                (template) =>
                  template.context === "Assignment" &&
                  template.active &&
                  ["Standard", "Approved"].includes(template.governance_status),
              );
              setBuilderCreate((current) => ({
                ...current,
                templateId: eligibleTemplates.some((template) => template.id === current.templateId)
                  ? current.templateId
                  : eligibleTemplates[0]?.id || "",
                title: assignmentRows.find((assignment) => assignment.id === selectedAssignmentId)?.title || current.title,
              }));
            }
            const [documents, files, repository, tasks] = await Promise.all([
                api.generatedDocuments(
                  token,
                  "Assignment",
                  selectedAssignmentId,
                ),
                api.attachments(token, selectedAssignmentId),
                api.knowledge(token),
                api.assignmentTasks(token, selectedAssignmentId),
              ]);

            if (!cancelled) {
              setWorkspaceDocuments(documents);
              setKnowledgeRows(repository);
              setAssignmentTasks(tasks);
              setAssignmentFiles(
                files.map((file) => ({
                  ...file,
                  original_name: displayFileName(file.original_name),
                })),
              );
            }
            break;
          }

          case "Overview":
            {
              const [assignments, tasks, reviews] = await Promise.all([
                api.assignments(token),
                api.assignmentTasks(token, selectedAssignmentId),
                api.assignmentReviews(token, selectedAssignmentId),
              ]);
              if (!cancelled) {
                setAssignmentRows(assignments);
                setAssignmentTasks(tasks);
                setAssignmentReviews(reviews);
              }
            }
            break;
        }
      } catch (error) {
        if (!cancelled) {
          setAssignmentNotice(
            error instanceof Error
              ? error.message
              : `${assignmentWorkspaceTab} could not be refreshed.`,
          );
        }
      }
    };

    void refreshAssignmentWorkspaceTab();

    return () => {
      cancelled = true;
    };
  }, [assignmentWorkspaceTab, selectedAssignmentId, token]);

  // ASSIGNMENT V1.13: team membership governance remains here.
  // TASK creation and TASK REQUEST approval are owned by the standalone Tasks module.
  const openAssignmentMemberRequest = async () => {
    if (!selectedAssignmentId) return;
    setAssignmentMemberRequestForm({ userId: "", reason: "" });
    setAssignmentTaskDialogNotice("");
    setAssignmentMemberRequestOpen(true);
    try {
      const ownerId = assignmentLead?.id || user?.id || "";
      if (!ownerId) return;
      const candidates = await api.assignmentReviewerCandidates(
        token,
        selectedAssignmentId,
        ownerId,
      );
      setUserRows((current) => [
        ...current,
        ...candidates.filter(
          (candidate) => !current.some((member) => member.id === candidate.id),
        ),
      ]);
    } catch (error) {
      setAssignmentTaskDialogNotice(
        error instanceof Error
          ? error.message
          : "Available team members could not be loaded.",
      );
    }
  };

  const submitAssignmentMemberRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !selectedAssignmentId ||
      !assignmentMemberRequestForm.userId ||
      assignmentMemberRequestForm.reason.trim().length < 5 ||
      assignmentMemberRequestSaving
    )
      return;
    setAssignmentMemberRequestSaving(true);
    setAssignmentNotice("");
    try {
      await api.createAssignmentMemberRequest(token, selectedAssignmentId, {
        userId: assignmentMemberRequestForm.userId,
        reason: assignmentMemberRequestForm.reason.trim(),
      });
      const requests = await api.assignmentMemberRequests(
        token,
        selectedAssignmentId,
      );
      setAssignmentMemberRequests(requests);
      setAssignmentMemberRequestOpen(false);
      setAssignmentNotice(
        `Request sent to ${assignmentLead?.supervisor_name || "the Assignment Lead's immediate supervisor"} for approval.`,
      );
    } catch (error) {
      setAssignmentTaskDialogNotice(
        error instanceof Error
          ? error.message
          : "The team-member request could not be sent.",
      );
    } finally {
      setAssignmentMemberRequestSaving(false);
    }
  };

  const decideAssignmentMemberRequest = async (
    request: ApiAssignmentMemberRequest,
    decision: "Approved" | "Rejected",
  ) => {
    if (!selectedAssignmentId || assignmentMemberRequestSaving) return;
    const comments = assignmentMemberRequestComments[request.id]?.trim() || "";
    if (decision === "Rejected" && !comments) {
      setAssignmentNotice("Add a reason before declining the team-member request.");
      return;
    }
    setAssignmentMemberRequestSaving(true);
    setAssignmentNotice("");
    try {
      await api.decideAssignmentMemberRequest(
        token,
        selectedAssignmentId,
        request.id,
        { decision, comments },
      );
      const [assignments, requests] = await Promise.all([
        api.assignments(token),
        api.assignmentMemberRequests(token, selectedAssignmentId),
      ]);
      setAssignmentRows(assignments);
      setAssignmentMemberRequests(requests);
      setAssignmentNotice(
        decision === "Approved"
          ? `${request.requested_user_name} was added to the assignment team.`
          : `The request for ${request.requested_user_name} was declined.`,
      );
    } catch (error) {
      setAssignmentNotice(
        error instanceof Error
          ? error.message
          : "The team-member request could not be decided.",
      );
    } finally {
      setAssignmentMemberRequestSaving(false);
    }
  };

  // TASK V1.15: live workflow orchestration only.
  // Dead embedded-list/quick-output/target-cache plumbing has been removed.
  const openAssignmentTaskWorkspace = async (
    task: ApiAssignmentTask,
    openReport = false,
  ) => {
    assignmentTaskReturnTabRef.current = assignmentWorkspaceTab;

    // Read the task's own authoritative row before opening its editor. A task
    // carried in an Assignment list may have an older body/revision than the
    // user's last save or a write completed from another page.
    try {
      const latestTask = (await api.taskContext(token, task.id)).task;
      if (latestTask.assignment_id === task.assignment_id) task = latestTask;
    } catch {
      setAssignmentNotice("The latest saved Task could not be loaded. Check your connection and reopen it before editing.");
      return;
    }

    // Always re-read the task before deciding which workflow controls to render.
    // Task list rows can be stale immediately after submit/review transitions; the
    // workspace must use the backend state as the authority so Draft controls can
    // never reappear on a locked submission.
    if (selectedAssignmentId) {
      try {
        const latestTasks = await api.assignmentTasks(token, selectedAssignmentId);
        const authoritativeTask = latestTasks.find((row) => row.id === task.id);
        if (authoritativeTask) {
          task = authoritativeTask;
          setAssignmentTasks(latestTasks);
        }
      } catch {
        // Keep the already loaded row if refresh is temporarily unavailable.
      }
    }

    const shouldOpenEditableReport = Boolean(
      openReport &&
        (task.owner_id === user?.id || canManageTaskOwner(task)) &&
        task.contribution_status === "Draft",
    );
    if (shouldOpenEditableReport) {
      const assignmentTitle = selectedAssignmentRecord?.title || selectedAssignment || "Assignment";
      syncTaskReportTemplateMode(
        `${assignmentTitle} — ${task.title}`,
        task.report_mode,
        window.localStorage,
      );
    }
    let taskTemplateLoadError = "";
    if (shouldOpenEditableReport) {
      try {
        const templates = await api.documentTemplates(token, "Assignment");
        setBuilderTemplates(templates);
      } catch (error) {
        taskTemplateLoadError = error instanceof Error
            ? `Task report templates could not be loaded: ${error.message}`
            : "Task report templates could not be loaded.";
      }
    }
    taskReportAuthoritativeRevisionRef.current = taskReportRevisionSnapshot(task);
    setSelectedAssignmentTask(task);
    setAssignmentTaskWorkspaceForm(
      mapTaskToWorkspaceForm(task, taskReportPlainText, taskDateValue),
    );
    setTaskReportSectionModal(
      shouldOpenEditableReport
        ? {
            key: "title",
            mode: "edit",
          }
        : null,
    );
    setAssignmentTaskReviewComment("");
    setAssignmentTaskReviewResult(null);
    setAssignmentTaskReportPreviewOpen(false);
    setAssignmentTaskReportPreviewHtml("");
    const delegatedReportEditor = shouldOpenEditableReport && task.owner_id !== user?.id;
    setAssignmentNotice(
      taskTemplateLoadError || (shouldOpenEditableReport
        ? delegatedReportEditor
          ? `You are completing ${task.owner_name || "the task owner"}'s Task Report. Your changes and submission will be recorded under your account.`
          : taskHasReportDraft(task)
            ? "Continue your saved task report. Save Draft and Preview Report before submission."
            : "Task report ready. Start writing, then Save Draft and Preview Report before submission."
        : task.contribution_status === "Ready for Integration"
          ? `Submitted report locked. ${task.reviewer_name || "The assigned reviewer"} is responsible for the next decision.`
          : task.contribution_status === "Integrated"
            ? `Report approved. ${task.reviewer_name || "The assigned reviewer or Assignment Lead"} is responsible for generating the final task report.`
            : task.contribution_status === "Accepted"
              ? "Task complete. The final approved report is available to the Assignment Lead."
              : ""),
    );

    if (
      (openReport || task.reviewer_id === user?.id) &&
      task.reviewer_id === user?.id &&
      task.contribution_status === "Ready for Integration"
    ) {
      window.setTimeout(() => {
        void openTaskReportPreviewForTask(task, true);
      }, 0);
      return;
    }

    if (openReport || shouldOpenEditableReport) focusTaskReportEditor();
  };
  const openAssignmentTaskReport = async (task: ApiAssignmentTask) => {
    if (!selectedAssignmentId) return;

    const route = taskReportOpenRoute(task, user?.id);

    if (route === "preview-final") {
      await openTaskReportPreviewForTask(task, false);
      return;
    }

    if (route === "open-workspace") {
      await openAssignmentTaskWorkspace(task, true);
      return;
    }

    let reportTask = task;

    if (task.status === "Not Started") {
      setAssignmentNotice("Starting task and opening your report...");
      try {
        const updated = await api.updateAssignmentTask(
          token,
          selectedAssignmentId,
          task.id,
          buildTaskStartPayload(
            task,
            new Date().toISOString().slice(0, 10),
          ),
        );

        const [tasks, history] = await Promise.all([
          api.assignmentTasks(token, selectedAssignmentId),
          api.history(token, selectedAssignmentId),
        ]);

        setAssignmentTasks(tasks);
        setAssignmentHistory(history);
        reportTask = tasks.find((row) => row.id === task.id) || updated;
      } catch (error) {
        setAssignmentNotice(
          error instanceof Error
            ? error.message
            : "The task could not be started before opening the report.",
        );
        return;
      }
    }

    await openAssignmentTaskWorkspace(reportTask, true);
  };
  const saveAssignmentTaskWorkspace = async (
    action: TaskWorkspaceAction = "save",
  ) => {
    if (
      !selectedAssignmentId ||
      !selectedAssignmentTask ||
      assignmentTaskWorkspaceSaving
    )
      return;

    setAssignmentTaskWorkspaceSaving(true);
    setAssignmentNotice("");

    try {
      const { payload } = buildTaskWorkspaceUpdatePayload(
        selectedAssignmentTask,
        assignmentTaskWorkspaceForm,
        isManager,
        action,
        new Date().toISOString().slice(0, 10),
      );

      const saved = await api.updateAssignmentTask(
        token,
        selectedAssignmentId,
        selectedAssignmentTask.id,
        payload,
      );

      // A successful PATCH is the primary save result. Refresh/history reads are secondary
      // and must not turn a committed write into a reported save failure.
      setSelectedAssignmentTask(saved);
      setAssignmentTasks((current) => current.some((task) => task.id === saved.id)
        ? current.map((task) => task.id === saved.id ? { ...task, ...saved } : task)
        : [...current, saved]);
      setAssignmentTaskWorkspaceForm(mapTaskToWorkspaceForm(saved, taskReportPlainText, taskDateValue));

      let refreshWarning = "";
      try {
        const tasks = await api.assignmentTasks(token, selectedAssignmentId);
        setAssignmentTasks(tasks);
        const refreshed = tasks.find((task) => task.id === saved.id) || saved;
        setSelectedAssignmentTask(refreshed);
        setAssignmentTaskWorkspaceForm(mapTaskToWorkspaceForm(refreshed, taskReportPlainText, taskDateValue));
      } catch {
        refreshWarning = " The Task was saved, but the task list could not be refreshed.";
      }
      try {
        setAssignmentHistory(await api.history(token, selectedAssignmentId));
      } catch {
        refreshWarning += " Activity history could not be refreshed.";
      }

      const repositoryPending = Boolean(saved.repository_sync_status && !["done", "not_requested"].includes(saved.repository_sync_status));
      setAssignmentNotice(repositoryPending
        ? (saved.repository_sync_message || "Task saved. Repository synchronization is queued for automatic retry.") + refreshWarning
        : taskWorkspaceSaveMessage(action) + refreshWarning);

    } catch (error) {
      setAssignmentNotice(
        error instanceof Error ? error.message : "Task could not be saved.",
      );
    } finally {
      setAssignmentTaskWorkspaceSaving(false);
    }
  };
  const applySavedTaskContribution = (saved: ApiAssignmentTask) => {
    taskReportAuthoritativeRevisionRef.current = taskReportRevisionSnapshot(saved);
    setSelectedAssignmentTask(saved);
    setAssignmentTasks((current) =>
      current.map((task) => (task.id === saved.id ? saved : task)),
    );
    setAssignmentTaskWorkspaceForm((current) => ({
      ...current,
      ...mapSavedTaskContribution(saved, taskReportPlainText),
    }));
  };

  const currentTaskReportDocumentMode = (): TaskReportDocumentMode => {
    // The saved report mode owns the editor's backing fields. Template choice
    // remains a separate preference, except for an explicit Blank document choice.
    const assignmentTitle = selectedAssignmentRecord?.title || selectedAssignment || "Assignment";
    const taskTitle = selectedAssignmentTask?.title || "";
    const contextIdentity = `${assignmentTitle} — ${taskTitle}`;
    // Read the previous preference key once so correcting its corrupted separator
    // does not discard a user's saved Task Report template choice.
    const legacyContextIdentity = `${assignmentTitle} ${String.fromCharCode(0x00e2, 0x20ac, 0x201d)} ${taskTitle}`;
    let preferredTemplateId = "";
    try {
      const preferenceKey = taskReportTemplatePreferenceKey(contextIdentity);
      const legacyPreference = taskReportTemplatePreferenceKey(legacyContextIdentity);
      preferredTemplateId = window.localStorage.getItem(preferenceKey) ||
        window.localStorage.getItem(legacyPreference) || "";
      if (preferredTemplateId && !window.localStorage.getItem(preferenceKey)) {
        window.localStorage.setItem(preferenceKey, preferredTemplateId);
      }
    } catch {
      // Continue with the server-persisted mode when browser storage is unavailable.
    }
    // Selecting an approved template is only a preference; it must never
    // switch the active document store and replace a rich blank draft with
    // the legacy structured fields. Only the explicit Blank document choice
    // overrides the persisted mode while the user is editing.
    if (preferredTemplateId === "__blank__") return "blank";
    if (selectedAssignmentTask?.report_mode === "blank") return "blank";
    if (selectedAssignmentTask?.report_mode === "structured") return "structured";
    return "blank";
  };

  const saveAssignmentTaskContribution = async (
    statusOverride?: TaskContributionStatus,
    sectionOverride?: { key: string; value: string },
    options?: { throwOnError?: boolean; autoSave?: boolean },
  ) => {
    if (!selectedAssignmentTask) {
      const message = "No active Task Report is selected.";
      if (options?.throwOnError) throw new Error(message);
      return false;
    }
    // Explicit Task Report writes are serialized and revision-checked.
    const taskAssignmentId =
      selectedAssignmentTask.assignment_id || selectedAssignmentId;

    if (!taskAssignmentId) {
      const message =
        "This TASK REPORT is missing its ASSIGNMENT context. Close it and reopen the TASK from My Tasks.";
      setAssignmentNotice(message);
      if (options?.throwOnError) throw new Error(message);
      return false;
    }

    const releaseSaveQueue = await acquireTaskReportSaveQueue(
      assignmentTaskContributionSaveQueueRef,
    );

    assignmentTaskContributionSavingRef.current = true;
    setAssignmentTaskContributionSaving(true);
    if (!options?.autoSave) setAssignmentNotice("");

    try {
      // Save against the last server-confirmed revision. The backend checks this
      // token atomically and rejects stale writes; never silently rebase a draft.
      const confirmedRevision = taskReportAuthoritativeRevisionRef.current;
      if (!confirmedRevision || confirmedRevision.taskId !== selectedAssignmentTask.id) {
        throw new Error("The Task Report revision is not confirmed. Close and reopen this Task Report before saving.");
      }
      const taskForSave = selectedAssignmentTask;
      const richTitleMigration = sectionOverride?.key === "title" &&
        taskReportContainsRichMedia(sectionOverride.value);
      const reportMode = richTitleMigration ? "blank" : currentTaskReportDocumentMode();
      const structuredSectionOverride =
        reportMode === "blank" ? undefined : sectionOverride;
      const { status, payload } = buildTaskContributionPayload(
        taskForSave,
        assignmentTaskWorkspaceForm,
        taskReportPlainText,
        statusOverride,
        structuredSectionOverride,
      );
      const governedPayload = {
        ...payload,
        contributionTitle: taskReportSafeTitle(richTitleMigration
          ? selectedAssignmentTask.contribution_title || `${selectedAssignmentTask.title} - Task Report`
          : payload.contributionTitle),
        reportMode,
        blankContent:
          reportMode === "blank"
            ? sectionOverride?.value ?? taskForSave.blank_content ?? ""
            : "",
        expectedContributionUpdatedAt: confirmedRevision.updatedAt,
      };

      const saved = await api.updateAssignmentTaskContribution(
        token,
        taskAssignmentId,
        selectedAssignmentTask.id,
        governedPayload,
      );
      if (saved.persistence_status !== "saved") {
        throw new Error(saved.persistence_warning || "The server did not confirm that this Task Report draft was saved. Your workspace remains open.");
      }
      if (
        statusOverride === "Ready for Integration" &&
        (saved.contribution_status !== "Ready for Integration" || !saved.reviewer_id)
      ) {
        throw new Error("The server did not confirm submission to the assigned reviewer. Your draft is still available; retry Submit to Reviewer.");
      }
      const persistedSection = reportMode === "blank"
        ? saved.blank_content || ""
        : ({
            title: saved.contribution_title,
            workCompleted: saved.contribution_summary,
            findings: saved.contribution_findings,
            recommendations: saved.contribution_recommendations,
            evidence: saved.evidence_reviewed,
            challenges: saved.contribution_challenges,
            nextActions: saved.contribution_next_actions,
          } as Record<string, string | undefined>)[sectionOverride?.key || ""] || "";
      const expectedSection = reportMode === "blank"
        ? governedPayload.blankContent
        : sectionOverride?.key === "title"
          ? governedPayload.contributionTitle
          : sectionOverride?.value || "";
      const normalizePersistedText = (value: unknown) => taskReportPlainText(value).replace(/\s+/g, " ").trim();
      if (sectionOverride && normalizePersistedText(persistedSection) !== normalizePersistedText(expectedSection)) {
        throw new Error("The save response did not contain the latest Task Report content. Your edits are still open; retry Save Draft.");
      }
      taskReportAuthoritativeRevisionRef.current = taskReportRevisionSnapshot(saved);

      applySavedTaskContribution(saved);
      if (!options?.autoSave) {
        // History is secondary to the report write. Do not turn a successful
        // save/submission into a reported failure if history refresh is delayed.
        void api.history(token, taskAssignmentId).then(setAssignmentHistory).catch(() => undefined);
        const time = new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
        setAssignmentNotice(taskContributionSaveNotice(
          status, saved, selectedAssignmentTask.reviewer_name, time, assignmentReportStatusLabel,
        ));
      }

      if (["Integrated", "Accepted"].includes(status))
        await resolveActionNotifications(
          "assignment_task",
          selectedAssignmentTask.id,
        );

      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Contribution could not be saved.";
      setAssignmentNotice(message);
      if (options?.throwOnError || options?.autoSave) {
        throw error instanceof Error ? error : new Error(message);
      }
      return false;
    } finally {
      releaseSaveQueue();
      assignmentTaskContributionSavingRef.current = false;
      setAssignmentTaskContributionSaving(false);
    }
  };

  const finalizeAssignmentTaskContribution = async () => {
    if (!selectedAssignmentTask || assignmentTaskFinalizing) return;
    const finalizationAssignmentId =
      selectedAssignmentTask.assignment_id || selectedAssignmentId;
    if (!finalizationAssignmentId) {
      const message =
        "This approved report is missing its assignment context. Reopen it from My Reviews and try again.";
      setAssignmentNotice(message);
      setAssignmentTaskReviewResult({ tone: "error", message });
      return;
    }

    setAssignmentTaskFinalizing(true);
    setAssignmentNotice("");
    setAssignmentTaskReviewResult({
      tone: "info",
      message:
        "Generating the approved DOCX, publishing it to the Document Repository and completing the task…",
    });

    try {
      const updated = await api.finalizeAssignmentTaskContribution(
        token,
        finalizationAssignmentId,
        selectedAssignmentTask.id,
      );

      if (updated.contribution_status !== "Accepted" || updated.status !== "Completed") {
        throw new Error(
          `Final report generation returned an unexpected state: ${assignmentReportStatusLabel(updated.contribution_status)} / ${updated.status}. Refresh the task and try again.`,
        );
      }

      setSelectedAssignmentId(finalizationAssignmentId);
      applySavedTaskContribution(updated);

      const report = await api.assignmentTaskContributionReport(
        token,
        finalizationAssignmentId,
        selectedAssignmentTask.id,
      );

      let refreshed = updated;
      try {
        const context = await api.taskReviewContext(token, updated.id);
        refreshed = {
          ...context.task,
          repository_document_id:
            context.task.repository_document_id || updated.repository_document_id || null,
          repository_document_title:
            context.task.repository_document_title || updated.repository_document_title || null,
        };
        setAssignmentRows((current) => {
          const withoutCurrent = current.filter((item) => item.id !== context.assignment.id);
          return [...withoutCurrent, context.assignment];
        });
        setAssignmentTasks([refreshed]);
      } catch {
        setAssignmentTasks((current) => {
          const withoutCurrent = current.filter((task) => task.id !== updated.id);
          return [...withoutCurrent, updated];
        });
      }

      taskReportAuthoritativeRevisionRef.current = taskReportRevisionSnapshot(refreshed);
      setSelectedAssignmentTask(refreshed);
      applySavedTaskContribution(refreshed);

      const message = updated.repository_document_title
        ? `Final approved task report generated and published to the Document Repository as "${updated.repository_document_title}". The task is complete and now counts toward assignment progress.`
        : "Final approved task report generated and published to the Document Repository. The task is complete and now counts toward assignment progress.";
      setAssignmentNotice(message);
      setAssignmentTaskReviewResult({ tone: "success", message });

      setAssignmentTaskReportPreviewTitle(report.title);
      setAssignmentTaskReportPreviewHtml(await normalizeReportDocumentForPreviewAsync(report.html));
      setAssignmentTaskReportPreviewOpen(true);

      await resolveActionNotifications(
        "assignment_task",
        selectedAssignmentTask.id,
      ).catch(() => undefined);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The final task report could not be generated.";
      setAssignmentNotice(message);
      setAssignmentTaskReviewResult({ tone: "error", message });
    } finally {
      setAssignmentTaskFinalizing(false);
    }
  };

  const reopenRejectedAssignmentTaskForRevision = async () => {
    if (!selectedAssignmentTask || assignmentTaskReviewSaving) return;

    const taskAssignmentId =
      selectedAssignmentTask.assignment_id || selectedAssignmentId;

    if (!taskAssignmentId) {
      setAssignmentNotice(
        "This TASK REPORT is missing its ASSIGNMENT context. Close it and reopen the TASK from My Tasks.",
      );
      return;
    }

    setAssignmentTaskReviewSaving(true);
    setAssignmentNotice("");

    try {
      const reopened = await api.reopenRejectedAssignmentTask(
        token,
        taskAssignmentId,
        selectedAssignmentTask.id,
      );

      const [tasks, history] = await Promise.all([
        api.assignmentTasks(token, taskAssignmentId),
        api.history(token, taskAssignmentId),
      ]);

      setAssignmentTasks(tasks);
      setAssignmentHistory(history);

      const refreshed =
        tasks.find((task) => task.id === reopened.id) || reopened;

      setSelectedAssignmentTask(refreshed);
      applySavedTaskContribution(refreshed);
      setAssignmentTaskWorkspaceForm((current) => ({
        ...current,
        status: refreshed.status,
        progress: Number(refreshed.progress || 0),
        contributionStatus: refreshed.contribution_status,
      }));

      setAssignmentNotice(
        "Rejected task reopened for revision. The task owner can edit, preview and resubmit it.",
      );
    } catch (error) {
      setAssignmentNotice(
        error instanceof Error
          ? error.message
          : "The rejected task could not be reopened.",
      );
    } finally {
      setAssignmentTaskReviewSaving(false);
    }
  };

  const renderTaskReviewDecision = () => {
    if (!selectedAssignmentTask || assignmentTaskReportPreviewOpen) return null;

    const rejectionReason =
      selectedAssignmentTask.status === "Blocked" &&
      latestSelectedTaskReview?.action === "TASK_REPORT_REJECTED"
        ? String(latestSelectedTaskReview.details?.comments || "")
        : "";

    return (
      <Suspense fallback={<div className="report-loading">Loading review controls...</div>}>
        <TaskReviewDecisionPanel
          task={selectedAssignmentTask}
          canReview={canReviewSelectedTask}
          contributionStatus={assignmentTaskWorkspaceForm.contributionStatus}
          reviewComment={assignmentTaskReviewComment}
          reviewSaving={assignmentTaskReviewSaving}
          finalizing={assignmentTaskFinalizing}
          previewBusy={assignmentTaskReportPreviewBusy}
          reviewResult={assignmentTaskReviewResult}
          rejectionReason={rejectionReason}
          canReopenRejected={Boolean(isManager || isAssignmentLead)}
          onReviewCommentChange={setAssignmentTaskReviewComment}
          onPreviewReport={openSavedAssignmentTaskContributionReport}
          onDecision={(decision) =>
            void reviewAssignmentTaskContribution(decision)
          }
          onFinalize={() => void finalizeAssignmentTaskContribution()}
          onReopenRejected={() =>
            void reopenRejectedAssignmentTaskForRevision()
          }
        />
      </Suspense>
    );
  };

  const taskReportTitleNeedsRepair = (candidate: unknown): boolean => {
    const value = String(candidate ?? "");
    const headings = value.match(/\b(?:Field Activity Title|Activity Completed|Observations and Evidence|Findings|Recommended Action|Limitations|Follow-up Actions)\b/gi) || [];
    return headings.length >= 2 || /<[a-z][\s\S]*>/i.test(value) || /\u00c3\u00a2/.test(value);
  };

  const taskReportSafeTitle = (candidate: unknown): string => {
    const value = String(candidate ?? "").trim();
    if (!taskReportTitleNeedsRepair(value)) return value;
    return `${selectedAssignmentTask?.title || "Task"} - TASK Report`;
  };

  const taskReportEscapePlainText = (value: string): string =>
    value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  const taskReportLegacyDocument = (): string => {
    const task = selectedAssignmentTask;
    if (!task) return "";
    const form = assignmentTaskWorkspaceForm;
    const htmlForContent = (candidate: unknown): string => {
      const raw = recoverTaskReportMarkup(candidate).trim();
      if (!raw) return "";
      if (/<\/?[a-z][^>]*>/i.test(raw)) return raw;
      return `<p>${taskReportEscapePlainText(raw).replace(/\r?\n/g, "<br>")}</p>`;
    };
    const output: string[] = [];

    // If an older save placed the whole document in the title field, recover its
    // recognisable template headings and the text between them into the body.
    const rawTitle = String(form.contributionTitle || task.contribution_title || "").trim();
    // Older Task Report editing could put rich body content in the first
    // "Output title" editor. Keep embedded media visible so the next save can
    // migrate it into blank_content instead of silently reducing it to a title.
    if (taskReportContainsRichMedia(rawTitle)) {
      output.push(htmlForContent(rawTitle));
    } else if (taskReportTitleNeedsRepair(rawTitle)) {
      let recovered = rawTitle;
      const taskTitle = String(task.title || "").trim();
      if (taskTitle && recovered.toLocaleLowerCase().startsWith(taskTitle.toLocaleLowerCase())) {
        recovered = recovered.slice(taskTitle.length).replace(/^[\s:;\u2014\u2013-]+/, "");
      }
      const headingPattern = /\b(Field Activity Title|Activity Completed|Observations and Evidence|Findings|Recommended Action|Limitations|Follow-up Actions)\b/gi;
      const headings = Array.from(recovered.matchAll(headingPattern));
      if (headings.length >= 2) {
        const leading = recovered.slice(0, headings[0].index ?? 0).trim();
        if (leading) output.push(`<p>${taskReportEscapePlainText(leading)}</p>`);
        headings.forEach((match, index) => {
          const heading = String(match[0] || "").trim();
          const bodyStart = (match.index ?? 0) + heading.length;
          const bodyEnd = index + 1 < headings.length ? (headings[index + 1].index ?? recovered.length) : recovered.length;
          const body = recovered.slice(bodyStart, bodyEnd).trim();
          output.push(`<h2>${taskReportEscapePlainText(heading)}</h2>`);
          if (body) output.push(htmlForContent(body));
        });
      }
    }

    // Preserve any legacy structured body fields when migrating to the whole-document store.
    const legacySections = [
      { title: "Activity Completed", content: form.contributionSummary || task.contribution_summary },
      { title: "Observations and Evidence", content: form.evidenceReviewed || task.evidence_reviewed },
      { title: "Findings", content: form.contributionFindings || task.contribution_findings },
      { title: "Recommended Action", content: form.contributionRecommendations || task.contribution_recommendations },
      { title: "Limitations", content: form.contributionChallenges || task.contribution_challenges },
      { title: "Follow-up Actions", content: form.contributionNextActions || task.contribution_next_actions },
    ];
    for (const section of legacySections) {
      const content = htmlForContent(section.content);
      if (content) output.push(`<h2>${taskReportEscapePlainText(section.title)}</h2>${content}`);
    }
    return output.join("\n");
  };

  const taskReportSectionValue = (_key: string) => {
    if (currentTaskReportDocumentMode() !== "blank") {
      return taskReportLegacyDocument();
    }
    const savedWholeDocument = recoverTaskReportMarkup(
      selectedAssignmentTask?.blank_content,
    );
    return savedWholeDocument.trim()
      ? savedWholeDocument
      : taskReportLegacyDocument();
  };

  const taskReportDocumentMode = currentTaskReportDocumentMode();

  // Task Reports are governed whole documents. Legacy structured fields remain
  // readable for old records, but are never used as a submission gate.
  const taskReportMissingSectionKeys: string[] = [];
  const taskReportMissingSectionNames: string[] = [];

  const taskReportSubmissionReady =
    authorizedTaskReviewers.length > 0 &&
    taskReportPlainText(
      taskReportSectionValue(taskReportSectionModal?.key || "workCompleted") || "",
    ).trim().length > 0;

  const setTaskReportSectionValue = (key: string, value: string) => {
    const migrateRichTitleToDocument = key === "title" && taskReportContainsRichMedia(value);
    if (currentTaskReportDocumentMode() === "blank" || migrateRichTitleToDocument) {
      setSelectedAssignmentTask((current) =>
        current
          ? {
              ...current,
              report_mode: "blank",
              blank_content: value,
            }
          : current,
      );
      setAssignmentTasks((current) =>
        current.map((task) =>
          task.id === selectedAssignmentTask?.id
            ? {
                ...task,
                report_mode: "blank",
                blank_content: value,
              }
            : task,
        ),
      );
      return;
    }

    setAssignmentTaskWorkspaceForm((current) => ({
      ...current,
      ...buildTaskReportSectionPatch(key, value),
    }));
  };

  const openTaskReportPreviewForTask = async (
    task: ApiAssignmentTask,
    reviewMode = false,
  ) => {
    if (assignmentTaskReportPreviewBusy) return;
    taskReportPreviewReturnSectionRef.current = null;
    const assignmentId = resolveTaskReportAssignmentId(
      task,
      selectedAssignmentId,
    );
    if (!assignmentId) {
      setAssignmentNotice("This Task Report is missing its assignment context.");
      return;
    }

    setSelectedAssignmentId(assignmentId);
    taskReportAuthoritativeRevisionRef.current = taskReportRevisionSnapshot(task);
    setSelectedAssignmentTask(task);
    setAssignmentTaskWorkspaceForm(
      mapTaskToWorkspaceForm(task, taskReportPlainText, taskDateValue),
    );
    setTaskReportSectionModal(null);
    setAssignmentTaskReviewComment("");
    setAssignmentTaskReviewResult(null);
    setAssignmentTaskReportPreviewBusy(true);
    setAssignmentNotice("");

    try {
      const report = await loadTaskContributionReport(
        token,
        assignmentId,
        task.id,
      );
      setAssignmentTaskReportPreviewTitle(report.title);
      setAssignmentTaskReportPreviewHtml(await normalizeReportDocumentForPreviewAsync(report.html));
      setAssignmentTaskReportPreviewOpen(true);

      const previewNotice = taskReportPreviewNotice(task, reviewMode);
      if (previewNotice) setAssignmentNotice(previewNotice);
    } catch (error) {
      setAssignmentNotice(
        error instanceof Error
          ? error.message
          : "The Task Report could not be opened.",
      );
    } finally {
      setAssignmentTaskReportPreviewBusy(false);
    }
  };

  const openAssignmentTaskContributionPreview = async (
    sectionOverride?: { key: string; value: string; throwOnError?: boolean },
  ): Promise<boolean> => {
    if (!selectedAssignmentTask) {
      const message = "No active Task Report is selected for preview.";
      if (sectionOverride?.throwOnError) throw new Error(message);
      return false;
    }
    if (assignmentTaskReportPreviewBusy) {
      const message = "A Task Report preview is already opening.";
      if (sectionOverride?.throwOnError) throw new Error(message);
      return false;
    }

    const taskAssignmentId =
      selectedAssignmentTask.assignment_id || selectedAssignmentId;

    if (!taskAssignmentId) {
      const message =
        "This TASK REPORT is missing its ASSIGNMENT context. Close it and reopen the TASK from My Tasks.";
      setAssignmentNotice(message);
      if (sectionOverride?.throwOnError) throw new Error(message);
      return false;
    }

    setAssignmentTaskReportPreviewBusy(true);
    setAssignmentNotice("");
    try {
      let report: { html: string; title: string };
      if (shouldUseDraftTaskPreview(selectedAssignmentTask, user?.id)) {
        const richTitleMigration = sectionOverride?.key === "title" &&
          taskReportContainsRichMedia(sectionOverride.value);
        const reportMode = richTitleMigration ? "blank" : currentTaskReportDocumentMode();
        const structuredSectionOverride =
          reportMode === "blank" ? undefined : sectionOverride;
        const { payload } = buildTaskContributionPayload(
          selectedAssignmentTask,
          assignmentTaskWorkspaceForm,
          taskReportPlainText,
          "Draft",
          structuredSectionOverride,
        );
        const { contributionStatus: _contributionStatus, ...previewPayload } = payload;
        if (richTitleMigration) {
          previewPayload.contributionTitle = taskReportSafeTitle(
            selectedAssignmentTask.contribution_title || `${selectedAssignmentTask.title} - Task Report`,
          );
        }
        report = await api.previewAssignmentTaskContribution(
          token,
          taskAssignmentId,
          selectedAssignmentTask.id,
          {
            ...previewPayload,
            reportMode,
            blankContent:
              reportMode === "blank"
                ? sectionOverride?.value ?? selectedAssignmentTask.blank_content ?? ""
                : "",
          },
        );
      } else {
        report = await loadTaskContributionReport(
          token,
          taskAssignmentId,
          selectedAssignmentTask.id,
        );
      }
      setAssignmentTaskReportPreviewTitle(report.title);
      setAssignmentTaskReportPreviewHtml(await normalizeReportDocumentForPreviewAsync(report.html));
      setAssignmentTaskReportPreviewOpen(true);
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Contribution report could not be opened.";
      setAssignmentNotice(message);
      setAssignmentTaskReviewResult({ tone: "error", message });
      if (sectionOverride?.throwOnError) {
        throw error instanceof Error ? error : new Error(message);
      }
      return false;
    } finally {
      setAssignmentTaskReportPreviewBusy(false);
    }
  };

  const openSavedAssignmentTaskContributionReport = async (): Promise<boolean> =>
    openAssignmentTaskContributionPreview();

  const selectAssignmentTaskReviewer = async (reviewerId: string): Promise<boolean> => {
    if (!selectedAssignmentTask || assignmentTaskReviewSaving) return false;
    if (selectedAssignmentTask.contribution_status !== "Draft") {
      const message = "The reviewer can only be changed while the Task Report is still a Draft.";
      setAssignmentNotice(message);
      setAssignmentTaskReviewResult({ tone: "error", message });
      return false;
    }

    const reviewer = taskReportReviewerCandidates.find(
      (candidate) => candidate.id === reviewerId,
    );
    if (!reviewer) {
      const message = "Choose an eligible reviewer for this Task Report.";
      setAssignmentNotice(message);
      setAssignmentTaskReviewResult({ tone: "error", message });
      return false;
    }

    const taskAssignmentId =
      selectedAssignmentTask.assignment_id || selectedAssignmentId;
    if (!taskAssignmentId) {
      const message =
        "This Task Report is missing its assignment context. Reopen the Task and try again.";
      setAssignmentNotice(message);
      setAssignmentTaskReviewResult({ tone: "error", message });
      return false;
    }

    if (reviewerId === selectedAssignmentTask.reviewer_id) return true;

    setAssignmentTaskReviewResult({
      tone: "info",
      message: `Selecting ${reviewer.name} as the Task Report reviewer...`,
    });
    setAssignmentTaskReviewSaving(true);

    try {
      const updated = await api.assignAssignmentTaskReviewer(
        token,
        taskAssignmentId,
        selectedAssignmentTask.id,
        reviewerId,
      );
      setSelectedAssignmentTask((current) => current?.id === updated.id
        ? { ...current, ...updated, reviewer_name: reviewer.name }
        : current);
      setAssignmentTasks((current) => current.map((task) => task.id === updated.id
        ? { ...task, ...updated, reviewer_name: reviewer.name }
        : task));
      setAssignmentNotice(`Reviewer selected: ${reviewer.name}.`);
      setAssignmentTaskReviewResult({
        tone: "success",
        message: `${reviewer.name} will receive this Task Report when you submit it.`,
      });
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The Task Report reviewer could not be updated.";
      setAssignmentNotice(message);
      setAssignmentTaskReviewResult({ tone: "error", message });
      return false;
    } finally {
      setAssignmentTaskReviewSaving(false);
    }
  };

  const selectAssignmentTaskReviewerFromPreview = selectAssignmentTaskReviewer;

  const approveAndSendAssignmentTaskContribution = async () => {
    if (!authorizedTaskReviewers.length) {
      const message =
        "A reviewer must be assigned before this TASK REPORT can be submitted.";
      setAssignmentNotice(message);
      setAssignmentTaskReviewResult({ tone: "error", message });
      return;
    }

    setAssignmentTaskReviewResult({
      tone: "info",
      message: `Submitting TASK REPORT to ${
        selectedAssignmentTask?.reviewer_name || "the assigned reviewer"
      }...`,
    });

    try {
      /* APP2_TASK_REPORT_PREVIEW_SUBMIT_LATEST_EDITOR_R2 */
      const latestEditorValue = taskReportLatestEditorValueRef.current;
      const currentTaskId = selectedAssignmentTask?.id;
      const currentSection = taskReportSectionModal;
      const sectionOverride =
        latestEditorValue &&
        currentTaskId &&
        currentSection &&
        latestEditorValue.taskId === currentTaskId &&
        latestEditorValue.sectionKey === currentSection.key
          ? { key: currentSection.key, value: latestEditorValue.value }
          : undefined;

      const ok = await saveAssignmentTaskContribution(
        "Ready for Integration",
        sectionOverride,
        { throwOnError: true },
      );
      if (!ok) throw new Error("The report was not submitted. Confirm the reviewer and report content, then try again.");
      setAssignmentTaskReportPreviewOpen(false);
      setAssignmentTaskReviewResult({
        tone: "success",
        message: "The report was submitted and locked for reviewer action.",
      });
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "The report could not be submitted. It remains an editable draft.";
      setAssignmentNotice(message);
      setAssignmentTaskReviewResult({ tone: "error", message });
    }
  };

  const {
    closeTaskReportPreview: closeAssignmentTaskReportPreviewBase,
    closeTaskWorkspace: closeAssignmentTaskWorkspace,
  } = createTaskWorkspaceNavigation({
    selectedTask: selectedAssignmentTask,
    standaloneTaskOrigin,
    returnTab: () => assignmentTaskReturnTabRef.current,
    setReportPreviewOpen: setAssignmentTaskReportPreviewOpen,
    clearTaskReportSectionModal: () => setTaskReportSectionModal(null),
    clearSelectedTask: () => setSelectedAssignmentTask(null),
    setStandaloneTaskOrigin,
    clearSelectedAssignment: () => setSelectedAssignment(null),
    clearSelectedAssignmentId: () => setSelectedAssignmentId(null),
    setActiveWorkspace: setActive,
    selectAssignmentTab: selectAssignmentWorkspaceTab,
  });
  const closeAssignmentTaskWorkspaceSafely = async () => {
    const openSection = taskReportSectionModal;
    const task = selectedAssignmentTask;
    if (openSection && task && task.owner_id === user?.id && task.contribution_status === "Draft") {
      if (assignmentTaskContributionSavingRef.current) {
        setAssignmentNotice("The Task Report is still saving. Wait for the save to finish, then close the task.");
        return;
      }
      const latestEditorValue = taskReportLatestEditorValueRef.current;
      const value = latestEditorValue?.taskId === task.id && latestEditorValue.sectionKey === openSection.key
        ? latestEditorValue.value
        : taskReportSectionValue(openSection.key);
      try {
        setAssignmentNotice("Saving the latest Task Report before closing the task...");
        const saved = await saveAssignmentTaskContribution(
          "Draft",
          { key: openSection.key, value },
          { throwOnError: true },
        );
        if (!saved) return;
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : "The latest Task Report could not be saved. The task remains open.";
        setAssignmentNotice(message);
        setAssignmentTaskReviewResult({ tone: "error", message });
        return;
      }
    }
    taskReportLatestEditorValueRef.current = null;
    closeAssignmentTaskWorkspace();
  };
  const closeAssignmentTaskReportPreview = () => {
    setAssignmentTaskReportPreviewOpen(false);
    setAssignmentTaskReviewResult(null);

    const returnSection = taskReportPreviewReturnSectionRef.current;
    taskReportPreviewReturnSectionRef.current = null;

    if (
      returnSection &&
      selectedAssignmentTask?.owner_id === user?.id &&
      selectedAssignmentTask?.contribution_status === "Draft"
    ) {
      setTaskReportSectionModal({ key: returnSection, mode: "edit" });
      return;
    }

    // A reviewer or an owner who opened a saved/locked preview should return to
    // the current Task workspace, not be ejected to the Assignment Overview.
    if (selectedAssignmentTask) {
      setTaskReportSectionModal(null);
      return;
    }

    closeAssignmentTaskReportPreviewBase();
  };

  const reviewAssignmentTaskContribution = async (
    decision: "Changes Requested" | "Rejected" | "Approved",
  ) => {
    if (!selectedAssignmentTask || assignmentTaskReviewSaving) return;
    const reviewAssignmentId =
      selectedAssignmentTask.assignment_id || selectedAssignmentId;
    if (!reviewAssignmentId) {
      setAssignmentTaskReviewResult({
        tone: "error",
        message: "This review is missing its assignment context. Close it and reopen the review from My Reviews.",
      });
      return;
    }
    if (!isSelectedTaskReviewer) {
      setAssignmentTaskReviewResult({
        tone: "error",
        message: "Only the reviewer assigned to this task can record the formal decision.",
      });
      return;
    }
    if (
      ["Changes Requested", "Rejected"].includes(decision) &&
      !assignmentTaskReviewComment.trim()
    ) {
      const message =
        decision === "Rejected"
          ? "Add a clear reason before rejecting this submission."
          : "Add clear reviewer comments before requesting changes.";
      setAssignmentNotice(message);
      setAssignmentTaskReviewResult({ tone: "error", message });
      return;
    }
    setAssignmentTaskReviewSaving(true);
    setAssignmentTaskReviewResult({
      tone: "info",
      message:
        decision === "Approved"
          ? "Recording approval…"
          : "Recording reviewer decision…",
    });
    setAssignmentNotice("");
    try {
      const updated = await api.reviewAssignmentTaskContribution(
        token,
        reviewAssignmentId,
        selectedAssignmentTask.id,
        {
          decision,
          comments: assignmentTaskReviewComment.trim(),
        },
      );
      let refreshed = updated;
      try {
        const context = await api.taskReviewContext(token, updated.id);
        refreshed = context.task;
        setAssignmentRows((current) => {
          const withoutCurrent = current.filter((item) => item.id !== context.assignment.id);
          return [...withoutCurrent, context.assignment];
        });
        setAssignmentTasks([context.task]);
      } catch {
        // The decision response is already authoritative. Do not fail a valid
        // review merely because assignment-wide data is intentionally restricted.
        setAssignmentTasks((current) => {
          const withoutCurrent = current.filter((task) => task.id !== updated.id);
          return [...withoutCurrent, updated];
        });
      }

      if (decision === "Approved" && refreshed.contribution_status !== "Integrated") {
        throw new Error(
          `Approval was not completed. The task is still ${assignmentReportStatusLabel(refreshed.contribution_status)}. Refresh and try again.`,
        );
      }

      let automaticFinalizationError = "";
      if (decision === "Approved") {
        try {
          const finalised = await api.finalizeAssignmentTaskContribution(
            token,
            reviewAssignmentId,
            refreshed.id,
          );
          if (
            finalised.contribution_status !== "Accepted" ||
            finalised.status !== "Completed"
          ) {
            throw new Error(
              `Approval was recorded, but automatic final-report publication returned ${assignmentReportStatusLabel(finalised.contribution_status)} / ${finalised.status}.`,
            );
          }

          refreshed = finalised;
          try {
            const finalContext = await api.taskReviewContext(token, finalised.id);
            refreshed = {
              ...finalContext.task,
              repository_document_id:
                finalContext.task.repository_document_id ||
                finalised.repository_document_id ||
                null,
              repository_document_title:
                finalContext.task.repository_document_title ||
                finalised.repository_document_title ||
                null,
            };
            setAssignmentRows((current) => {
              const withoutCurrent = current.filter(
                (item) => item.id !== finalContext.assignment.id,
              );
              return [...withoutCurrent, finalContext.assignment];
            });
          } catch {
            // The finalization response is authoritative if the follow-up
            // context read is restricted or temporarily unavailable.
          }
          setAssignmentTasks((current) => [
            ...current.filter((task) => task.id !== refreshed.id),
            refreshed,
          ]);
        } catch (error) {
          // Approval is already committed. Keep the approved Integrated state
          // visible so the reviewer can retry final generation manually.
          automaticFinalizationError =
            error instanceof Error
              ? error.message
              : "Automatic final-report publication failed. Use Generate final report to retry.";
        }
      }

      setSelectedAssignmentId(reviewAssignmentId);
      setSelectedAssignmentTask(refreshed);
      applySavedTaskContribution(refreshed);
      setAssignmentTaskWorkspaceForm((current) => ({
        ...current,
        status: refreshed.status,
        progress: Number(refreshed.progress || 0),
        contributionStatus: refreshed.contribution_status,
      }));
      setAssignmentTaskReviewComment("");
      // The submitted version is immutable after a decision. Close the review
      // preview so the reviewer returns to the assignment while the global
      // next-action dialog remains visible.
      setAssignmentTaskReportPreviewOpen(false);
      const message =
        decision === "Approved"
          ? automaticFinalizationError
            ? `Task report approved, but automatic final-report publication failed: ${automaticFinalizationError} Use Generate final report to retry.`
            : `Task report approved, generated as a PDF, published to the Document Repository, and the task completed.${refreshed.repository_document_title ? ` Repository record: "${refreshed.repository_document_title}".` : ""}`
          : decision === "Rejected"
            ? "Submission rejected. It is locked until the assignment lead or a manager reopens it for revision or reassignment."
            : "Changes requested. The report has returned to the researcher as a draft for revision.";
      setAssignmentNotice(message);
      setAssignmentTaskReviewResult({
        tone: decision === "Approved" && automaticFinalizationError ? "info" : "success",
        message,
      });
      setWorkflowDecision({
        title: decision === "Approved" ? "Task report approved" : decision === "Rejected" ? "Task report rejected" : "Changes requested",
        outcome: message,
        nextAction: decision === "Approved"
          ? automaticFinalizationError ? "A manager must resolve the publication issue and retry final report generation." : "No further reviewer action is required. The task is complete and the final report is in the Document Repository."
          : decision === "Rejected"
            ? `The Assignment Team Lead or manager must reopen the rejected task before ${refreshed.owner_name || "the task owner"} can revise and resubmit it. The owner and responsible lead or manager have been notified.`
            : "The report author can edit the returned draft and resubmit it for review.",
        ...(decision === "Rejected" ? {continueLabel:"Reopen task for revision",onContinue:()=>void reopenRejectedAssignmentTaskForRevision()} : {}),
      });
      await resolveActionNotifications(
        "assignment_task",
        selectedAssignmentTask.id,
      );
      await refreshDashboard();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The review decision could not be recorded.";
      setAssignmentNotice(message);
      setAssignmentTaskReviewResult({ tone: "error", message });
    } finally {
      setAssignmentTaskReviewSaving(false);
    }
  };

  const archiveSelectedAssignmentTask = async () => {
    if (
      !selectedAssignmentId ||
      !selectedAssignmentTask ||
      !isManager ||
      assignmentTaskManagementBusy
    )
      return;
    if (
      !window.confirm(
        `Archive "${selectedAssignmentTask.title}"? It will leave the active task list but remain in the audit trail.`,
      )
    )
      return;
    setAssignmentTaskManagementBusy(true);
    setAssignmentNotice("");
    try {
      await api.archiveAssignmentTask(
        token,
        selectedAssignmentId,
        selectedAssignmentTask.id,
      );
      const [tasks, history] = await Promise.all([
        api.assignmentTasks(token, selectedAssignmentId),
        api.history(token, selectedAssignmentId),
      ]);
      setAssignmentTasks(tasks);
      setAssignmentHistory(history);
      setSelectedAssignmentTask(null);
      setAssignmentNotice(
        "Task archived. Its audit history has been preserved.",
      );
    } catch (error) {
      setAssignmentNotice(
        error instanceof Error ? error.message : "Task could not be archived.",
      );
    } finally {
      setAssignmentTaskManagementBusy(false);
    }
  };
  const deleteSelectedAssignmentTask = async () => {
    if (
      !selectedAssignmentId ||
      !selectedAssignmentTask ||
      !isManager ||
      assignmentTaskManagementBusy
    )
      return;
    const reason = assignmentTaskDeleteReason.trim();
    if (reason.length < 10 || !assignmentTaskDeleteConfirmed) {
      setAssignmentNotice(
        "Enter a clear deletion reason (at least 10 characters) and confirm the deletion.",
      );
      return;
    }
    setAssignmentTaskManagementBusy(true);
    setAssignmentNotice("");
    try {
      await api.deleteAssignmentTask(
        token,
        selectedAssignmentId,
        selectedAssignmentTask.id,
        reason,
      );
      const [tasks, history] = await Promise.all([
        api.assignmentTasks(token, selectedAssignmentId),
        api.history(token, selectedAssignmentId),
      ]);
      setAssignmentTasks(tasks);
      setAssignmentHistory(history);
      setAssignmentTaskDeleteDialogOpen(false);
      setAssignmentTaskDeleteReason("");
      setAssignmentTaskDeleteConfirmed(false);
      setSelectedAssignmentTask(null);
      setAssignmentNotice("Task deleted. The reason remains in the audit trail.");
    } catch (error) {
      setAssignmentNotice(
        error instanceof Error ? error.message : "Task could not be deleted.",
      );
    } finally {
      setAssignmentTaskManagementBusy(false);
    }
  };

  const openGeneratedDocument = async (id: string, previewOnly = false) => {
    try {
      const [document, control] = await Promise.all([
        api.generatedDocument(token, id),
        api.generatedDocumentControl(token, id),
      ]);
      setBuilderDocument(document);
      setAssignmentReportPreviewMode(previewOnly);
      setBuilderControl(control);
      setBuilderControlTab("Control");
      setBuilderFelixSuggestion("");
      const assigned = document.sections.find(
        (section) =>
          section.owner_name === user?.name &&
          section.section_status !== "Complete",
      );
      const first =
        assigned ||
        document.sections.find(
          (section) => section.section_status !== "Complete",
        ) ||
        document.sections[0] ||
        null;
      setBuilderSection(first);
      setBuilderContent(first?.content || "");
      setBuilderDirty(false);
      setBuilderSaveMessage("All changes saved");
      if (
        first &&
        document.context === "Assignment" &&
        !["Submitted", "Under Review", "Approved", "Final"].includes(
          document.status,
        )
      ) {
        try {
          await api.lockGeneratedDocumentSection(token, document.id, first.id);
        } catch (error) {
          setBuilderSaveMessage(
            error instanceof Error ? error.message : "Section is read-only.",
          );
        }
      }
      if (canReview || isManager)
        api
          .users(token)
          .then((rows) =>
            setReviewers(
              rows.filter((member) =>
                ["Reviewer", "Deputy Director", "System Admin"].includes(
                  member.role,
                ),
              ),
            ),
          )
          .catch(() => {});
    } catch (error) {
      setAssignmentNotice(
        error instanceof Error
          ? error.message
          : "Document could not be opened.",
      );
    }
  };
  const compileAssignmentReport = async (
    reportType: "Progress" | "Final",
    taskIds: string[],
    knowledgeIds: string[],
  ) => {
    if (!selectedAssignmentId || !selectedAssignmentRecord) {
      throw new Error("The assignment context is not loaded. Reopen the assignment and try again.");
    }
    try {
      setAssignmentCompiling(true);
      setAssignmentNotice("");

      const currentTemplates = await api.documentTemplates(token, "Assignment");
      setBuilderTemplates(currentTemplates);

      const template =
        reportType === "Final"
          ? currentTemplates.find(
              (item) =>
                item.template_key === "assignment-final-report" &&
                item.active &&
                ["Approved", "Standard"].includes(item.governance_status),
            )
          : currentTemplates.find(
              (item) =>
                item.template_key === "progress-report" &&
                item.active &&
                ["Approved", "Standard"].includes(item.governance_status),
            );

      if (!template) {
        throw new Error(
          reportType === "Final"
            ? "The controlled Final Assignment Report template is unavailable."
            : "No approved Progress Report template is available.",
        );
      }

      const title =
        reportType === "Final"
          ? `${selectedAssignmentRecord.title} — Final Assignment Report`
          : `${selectedAssignmentRecord.title} — Progress Report — ${new Date().toLocaleDateString("en-KE", { month: "long", year: "numeric" })}`;

      const created = await api.compileAssignmentReport(
        token,
        selectedAssignmentId,
        {
          templateId: template.id,
          title,
          taskIds,
          knowledgeIds,
          reportType,
        },
      );

      const refreshedDocuments = await api.generatedDocuments(
        token,
        "Assignment",
        selectedAssignmentId,
      );
      setWorkspaceDocuments(refreshedDocuments);
      setAssignmentWorkspaceTab("Reports");
      setAssignmentNotice(
        `${reportType} assignment draft created. Continue editing, preview it, choose a reviewer and submit it for formal review.`,
      );

      await openGeneratedDocument(created.id, false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The assignment report could not be created.";
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setAssignmentCompiling(false);
    }
  };
  const submitAssignmentReportForReview = async (
    documentId: string,
    reviewerId: string,
    comments: string,
  ) => {
    const reviewerName =
      assignmentReportReviewerCandidates.find((candidate) => candidate.id === reviewerId)?.name ||
      "the assigned reviewer";
    await api.submitAssignmentReport(token, documentId, {
      reviewerId,
      reviewDueDate: null,
      comments,
    });
    if (selectedAssignmentId)
      setWorkspaceDocuments(
        await api.generatedDocuments(token, "Assignment", selectedAssignmentId),
      );
    await refreshAssignments();
    await refreshNotifications();
    setBuilderDocument(null);
    setAssignmentReportPreviewMode(false);
    setAssignmentWorkspaceTab("Reports");
    if (selectedAssignmentId)
      window.history.pushState({}, "", `/assignments/${selectedAssignmentId}/reports`);
    setAssignmentNotice(
      `Final Assignment Report sent to ${reviewerName} for review. Approval will publish the controlled final copy automatically.`,
    );
  };
  const reviewAssignmentReportDecision = async (
    documentId: string,
    decision: "Changes Requested" | "Rejected" | "Approved",
    comments: string,
  ) => {
    const result = await api.reviewAssignmentReport(token, documentId, decision, comments);
    if (selectedAssignmentId) {
      const [documents, assignments] = await Promise.all([
        api.generatedDocuments(token, "Assignment", selectedAssignmentId),
        decision === "Approved" ? api.assignments(token) : Promise.resolve(null),
      ]);
      setWorkspaceDocuments(documents);
      if (assignments) setAssignmentRows(assignments);
    }
    await resolveActionNotifications("generated_document", documentId);
    setAssignmentNotice(
      decision === "Approved"
        ? result.publication
          ? `Assignment report approved and published to the Document Repository as “${result.publication.repository_document_title || "Final Assignment Report"}”.`
          : `Approval was recorded, but automatic publication could not complete: ${result.publicationError || "Please contact a manager to resolve the publication blocker."}`
        : decision === "Rejected"
          ? "Assignment report rejected. The rejected version remains in review history and cannot be finalized."
          : "Changes requested. The report has been returned for revision.",
    );
    const publicationReady = decision === "Approved" && Boolean(result.publication);
    setWorkflowDecision({
      title: decision === "Approved" ? "Report approved" : decision === "Rejected" ? "Report rejected" : "Changes requested",
      outcome: decision === "Approved"
        ? publicationReady ? "The approved report was published to the Document Repository." : `Approval was recorded, but publication needs follow-up: ${result.publicationError || "a manager must resolve the publication issue."}`
        : decision === "Rejected" ? "The rejected version is locked and preserved in the review history." : "The submitted version is locked and preserved; an editable revision is available to the report author.",
      nextAction: decision === "Approved"
        ? publicationReady ? "No further reviewer action is required. The Assignment Lead can continue the assignment using the published report." : "A manager must resolve the publication issue, then retry final publication."
        : "The report author must revise the report and submit a new version for review.",
      ...(decision === "Approved" && !publicationReady ? {continueLabel:"Open final publication",onContinue:()=>setAssignmentWorkspaceTab("Reports")} : {}),
    });
  };

  const saveBuilderSection = async (next = false) => {
    if (!builderDocument || !builderSection) return;
    try {
      setBuilderSaving(true);
      setBuilderSaveMessage("Saving...");
      await api.saveGeneratedDocumentSection(
        token,
        builderDocument.id,
        builderSection.id,
        builderContent,
        builderSection.completion,
        builderSection.section_status,
      );
      const refreshed = await api.generatedDocument(token, builderDocument.id);
      setBuilderDocument(refreshed);
      const index = refreshed.sections.findIndex(
        (item) => item.id === builderSection.id,
      );
      const target = next
        ? refreshed.sections[Math.min(refreshed.sections.length - 1, index + 1)]
        : refreshed.sections[index];
      setBuilderSection(target);
      setBuilderContent(target?.content || "");
      setBuilderDirty(false);
      setBuilderSaveMessage(
        `Saved ${new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}`,
      );
    } catch (error) {
      setBuilderSaveMessage(
        error instanceof Error ? error.message : "Changes could not be saved.",
      );
    } finally {
      setBuilderSaving(false);
    }
  };
  const refreshBuilderControl = async () => {
    if (builderDocument)
      setBuilderControl(
        await api.generatedDocumentControl(token, builderDocument.id),
      );
  };
  const submitBuilderDocument = async () => {
    if (!builderDocument) return;
    await api.submitGeneratedDocument(token, builderDocument.id, {
      reviewerId: builderReviewerId || null,
      reviewDueDate: builderReviewDue || null,
      comments: builderReviewNote,
    });
    await openGeneratedDocument(builderDocument.id);
    await refreshNotifications();
  };
  const reviewBuilderDocument = async (decision: string) => {
    if (!builderDocument) return;
    await api.reviewGeneratedDocument(
      token,
      builderDocument.id,
      decision,
      builderReviewNote,
    );
    await openGeneratedDocument(builderDocument.id);
    await resolveActionNotifications("generated_document", builderDocument.id);
  };
  const addBuilderReference = async () => {
    if (!builderDocument || !builderReference.title.trim()) return;
    await api.addGeneratedDocumentReference(
      token,
      builderDocument.id,
      builderReference,
    );
    setBuilderReference({
      ...builderReference,
      title: "",
      author: "",
      publisher: "",
      url: "",
      identifier: "",
      publicationYear: null,
    });
    await refreshBuilderControl();
  };
  const askBuilderFelix = async () => {
    if (!builderDocument || !builderSection) return;
    setBuilderFelixLoading(true);
    setBuilderFelixSuggestion("");
    try {
      const response = await api.askFelix(
        token,
        `${builderFelixAction} for the controlled ${builderDocument.context} document section "${builderSection.title}". Return a suggestion only; do not claim to edit, approve, or publish it. Use approved REDESY evidence when evidence is needed and identify any evidence gap.\n\nCurrent section:\n${builderContent}`,
        [],
        "App2 Expert",
      );
      setBuilderFelixSuggestion(response.answer);
    } catch (error) {
      setBuilderFelixSuggestion(
        error instanceof Error
          ? error.message
          : "Felix could not prepare a suggestion.",
      );
    } finally {
      setBuilderFelixLoading(false);
    }
  };

  const uploadAssignmentFile = async (file?: File) => {
    if (!file || !selectedAssignmentId || !token) return;
    try {
      await api.uploadAttachment(token, selectedAssignmentId, file);
      setAssignmentFiles(
        (await api.attachments(token, selectedAssignmentId)).map((item) => ({
          ...item,
          original_name: displayFileName(item.original_name),
        })),
      );
      setAssignmentHistory(await api.history(token, selectedAssignmentId));
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Attachment could not be uploaded.",
      );
    }
  };

  const attachWorkspaceReport = async (
    file: File | undefined,
    sourceType: "Assignment" | "Research" | "Task",
    originEntityId: string | null | undefined,
  ) => {
    if (!file || !originEntityId || !token || knowledgeUploading) return;
    const title = displayFileName(file.name).replace(/\.[^.]+$/, "");
    try {
      setKnowledgeUploading(true);
      if (sourceType === "Research") setResearchWorkspaceNotice(`Attaching “${file.name}”…`);
      await api.uploadKnowledge(token, file, {
        title: title || "Workspace report",
        description: `${sourceType} workspace report attachment.`,
        category: "Reports",
        tags: `${sourceType.toLowerCase()},report,workspace`,
        sourceType,
        sourceUrl: "",
        originEntityId,
        directorate: selectedAssignmentRecord?.division || "Research & Policy",
        documentType: "Report",
        subject: sourceType === "Research" ? selectedResearch?.title || "Research report" : selectedAssignmentRecord?.title || "Assignment report",
        classification: "INTERNAL",
        felixEnabled: true,
      });
      const refreshedKnowledge = await api.knowledge(token);
      setKnowledgeRows(refreshedKnowledge);
      const message = `${sourceType === "Research" ? "Document" : "Report"} “${file.name}” attached successfully.`;
      if (sourceType === "Research") setResearchWorkspaceNotice(message);
      else setAssignmentNotice(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Report could not be attached.";
      if (sourceType === "Research") setResearchWorkspaceNotice(message);
      else setAssignmentNotice(message);
    } finally {
      setKnowledgeUploading(false);
    }
  };

  const dashboardNow = new Date();
  const myActivityNotifications = notifications.filter(
    (item) =>
      !/completed|research completed|task completed|assignment completed/i.test(
        `${item.title} ${item.body}`,
      ) &&
      item.entity_type !== "assignment_completed",
  );

  const actionRequiredNotifications = notifications
    .filter((item) => {
      if (item.read_at) return false;
      const text = `${item.title} ${item.body}`;
      if (
        !/(review|approve|approval|changes requested|correction|overdue|due|assigned|responsible|action required|attention|publish|final report)/i.test(
          text,
        )
      )
        return false;
      if (item.entity_type === "knowledge" || item.entity_type === "document")
        return Boolean(
          item.entity_id && reviewRows.some((row) => row.id === item.entity_id),
        );
      if (item.entity_type === "notice")
        return Boolean(
          item.entity_id &&
            noticeRows.some(
              (row) =>
                row.id === item.entity_id && row.status === "Pending Approval",
            ),
        );
      if (item.entity_type === "assignment_status") return false;
      if (item.entity_type === "assignment_task")
        return Boolean(
          item.entity_id &&
            (dashboardData?.myWork || []).some(
              (work) =>
                work.id === item.entity_id &&
                (work.type === "Review" || work.type === "Finalization"),
            ),
        );
      if (item.entity_type?.startsWith("assignment")) {
        const assignment =
          item.entity_id &&
          assignmentRows.find((row) => row.id === item.entity_id);
        if (!assignment) return false;
        if (/overdue/i.test(text))
          return (
            assignment.status !== "Completed" &&
            Boolean(assignment.due_date) &&
            new Date(String(assignment.due_date)).getTime() < Date.now()
          );
        return assignment.status !== "Completed";
      }
      return true;
    })
    .slice(0, 5);
  const activeDashboardAssignments = assignmentRows.filter(
    (item) => item.status !== "Completed",
  );
  const dashboardDaysUntilDue = (dateValue: string | null | undefined) => {
    if (!dateValue) return null;
    const dateOnly =
      String(dateValue).match(/^\d{4}-\d{2}-\d{2}/)?.[0] || String(dateValue);
    const due = new Date(`${dateOnly}T23:59:59`);
    if (Number.isNaN(due.getTime())) return null;
    return Math.ceil((due.getTime() - dashboardNow.getTime()) / 86400000);
  };
  const dashboardDeadlineText = (dateValue: string | null | undefined) => {
    const days = dashboardDaysUntilDue(dateValue);
    if (days === null) return "No deadline";
    if (days < 0)
      return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    return `Due in ${days} days`;
  };
  const dueSoonDashboardAssignments = activeDashboardAssignments.filter(
    (item) => {
      const days = dashboardDaysUntilDue(item.due_date);
      return days !== null && days >= 0 && days <= 7;
    },
  );
  const overdueDashboardAssignments = activeDashboardAssignments.filter(
    (item) => {
      const days = dashboardDaysUntilDue(item.due_date);
      return days !== null && days < 0;
    },
  );
  const managerAttentionAssignments = activeDashboardAssignments
    .filter((item) => {
      const days = dashboardDaysUntilDue(item.due_date);
      return (
        (days !== null && days < 0) ||
        (days !== null && days >= 0 && days <= 7) ||
        ["Critical", "High"].includes(item.priority) ||
        ["Blocked", "Ready for Review"].includes(item.status)
      );
    })
    .sort((left, right) => {
      const leftDays = dashboardDaysUntilDue(left.due_date);
      const rightDays = dashboardDaysUntilDue(right.due_date);
      const leftRank =
        leftDays !== null && leftDays < 0
          ? 0
          : leftDays !== null && leftDays <= 7
            ? 1
            : left.priority === "Critical"
              ? 2
              : left.priority === "High"
                ? 3
                : 4;
      const rightRank =
        rightDays !== null && rightDays < 0
          ? 0
          : rightDays !== null && rightDays <= 7
            ? 1
            : right.priority === "Critical"
              ? 2
              : right.priority === "High"
                ? 3
                : 4;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return (leftDays ?? 9999) - (rightDays ?? 9999);
    });
  const managerMixedAttentionItems = (() => {
    if (!isManager) return [];

    const deadlineItems = (dashboardData?.deadlines || [])
      .filter(
        (item) =>
          ["Assignment", "Task", "Research", "Research Project"].includes(
            item.type,
          ) &&
          typeof item.days === "number" &&
          item.days <= 7,
      );

    const deadlineAssignmentIds = new Set(
      deadlineItems
        .filter((item) => item.type === "Assignment")
        .map((item) => item.id),
    );

    const assignmentEscalations = managerAttentionAssignments
      .filter((item) => !deadlineAssignmentIds.has(item.id))
      .map((item) => ({
        id: item.id,
        type: "Assignment",
        title: item.title,
        status: item.status,
        dueDate: item.due_date || null,
        destination: "Assignments",
        contextId: item.id,
        contextTitle: item.division || "Assignment",
        ownerName:
          item.members.find((member) => member.role === "Lead")?.name ||
          item.members[0]?.name ||
          null,
        teamName: item.division || null,
        reason:
          (dashboardDaysUntilDue(item.due_date) ?? 9999) < 0
            ? "Past deadline"
            : (dashboardDaysUntilDue(item.due_date) ?? 9999) <= 7
              ? "Deadline approaching"
              : item.status === "Blocked"
                ? "Work is blocked"
                : item.status === "Ready for Review"
                  ? "Ready for management/reviewer attention"
                  : ["Critical", "High"].includes(item.priority)
                    ? `${item.priority} priority`
                    : "Management attention",
        nextAction:
          item.status === "Ready for Review"
            ? "Open review state"
            : item.status === "Blocked"
              ? "Resolve blocker"
              : "Open assignment",
        days: dashboardDaysUntilDue(item.due_date),
      }));

    return [...deadlineItems, ...assignmentEscalations]
      .sort((left, right) => {
        const leftDays =
          typeof left.days === "number" ? left.days : 9999;
        const rightDays =
          typeof right.days === "number" ? right.days : 9999;

        return leftDays - rightDays;
      })
      .slice(0, 5);
  })();
  const upcomingDashboardAssignments = activeDashboardAssignments
    .filter((item) => {
      const days = dashboardDaysUntilDue(item.due_date);
      return days !== null && days >= 0 && days <= 30;
    })
    .sort(
      (left, right) =>
        (dashboardDaysUntilDue(left.due_date) ?? 9999) -
        (dashboardDaysUntilDue(right.due_date) ?? 9999),
    );
  const isResearcherDashboard = user?.role === "Researcher";
  const personalDashboardTasks = (dashboardData?.myWork || []).filter(
    (item) => item.type === "Task",
  );
  const personalDashboardReviews = (dashboardData?.myWork || []).filter(
    (item) => item.type === "Review",
  );
  const isReviewerDashboard = !isManager && personalDashboardReviews.length > 0;
  const personalDashboardFinalizations = (dashboardData?.myWork || []).filter(
    (item) => item.type === "Finalization",
  );
  const personalTaskDeadlines = (dashboardData?.deadlines || []).filter(
    (item) => item.type === "Task",
  );
  const personalReviewDeadlines = (dashboardData?.deadlines || []).filter(
    (item) => item.type === "Review" || item.type === "Finalization",
  );
  const dashboardReviewNotifications = notifications.filter((item) => {
    const text = `${item.title} ${item.body}`;

    // Current App2 reviewer workflows carry explicit entity metadata.
    if (
      item.entity_type === "assignment_task" ||
      item.entity_type === "generated_document" ||
      item.entity_type === "research_report_section" ||
      item.entity_type === "research"
    ) {
      return /(review|reviewer|submitted|approval|approved|changes requested|rejected|final report)/i.test(text);
    }

    // Repository notifications qualify only when they are genuinely review-related.
    if (item.entity_type === "knowledge" || item.entity_type === "document") {
      return /(review|approved|rejected|returned for correction|changes requested)/i.test(text);
    }

    // Notice approval is a separate governance workflow, not reviewer-dashboard activity.
    if (item.entity_type === "notice") return false;

    // Administrative assignment/task-request events are not contextual reviews.
    if (
      item.entity_type === "assignment" ||
      item.entity_type === "assignment_status" ||
      item.entity_type === "assignment_completed" ||
      item.entity_type === "assignment_task_request" ||
      item.entity_type === "document_deletion_request"
    ) {
      return false;
    }

    // Backward-compatible fallback for legacy notifications lacking modern entity metadata.
    return (
      !item.entity_type &&
      /(review|reviewer|changes requested|approved|approval|rejected)/i.test(text)
    );
  });
  const personalDashboardResearch = (dashboardData?.myWork || []).filter(
    (item) => item.type === "Research Project",
  );
  const personalResearchDeadlines = (dashboardData?.deadlines || []).filter(
    (item) => item.type === "Research Project" || item.type === "Research Milestone",
  );
  const researcherDueSoonCount = [...personalTaskDeadlines, ...personalResearchDeadlines].filter(
    (item) => typeof item.days === "number" && item.days >= 0 && item.days <= 7,
  ).length;
  const researcherOverdueCount = [...personalTaskDeadlines, ...personalResearchDeadlines].filter(
    (item) => typeof item.days === "number" && item.days < 0,
  ).length;
  const researcherAwaitingReviewCount = personalDashboardTasks.filter(
    (item) => item.status === "Ready for Review",
  ).length;
  const researcherActiveResearch = personalDashboardResearch.length
    ? personalDashboardResearch.map((item) => ({ ...item, end_date: item.dueDate || null }))
    : researchRows.filter((item) => !["Completed", "Archived"].includes(item.status)).map((item) => ({
        id: item.id,
        type: "Research Project",
        title: item.title,
        status: item.status,
        destination: "Research Repository",
        contextId: item.id,
        contextTitle: item.title,
        dueDate: item.end_date || null,
        end_date: item.end_date || null,
      }));
  const reviewerDueSoonCount = personalReviewDeadlines.filter(
    (item) => typeof item.days === "number" && item.days >= 0 && item.days <= 7,
  ).length;
  const reviewerOverdueCount = personalReviewDeadlines.filter(
    (item) => typeof item.days === "number" && item.days < 0,
  ).length;
  const reviewerInProgressCount = personalDashboardReviews.filter(
    (item) => item.status === "Under Review",
  ).length;

  const personalReviewHistory = (dashboardData?.reviewHistory || []).filter(
    (item) =>
      ["Approved", "Changes Requested", "Rejected", "Returned", "Finalized"].includes(
        item.status,
      ),
  );
  const researcherAttentionTasks = [...personalDashboardTasks].sort(
    (left, right) => {
      const leftDays = dashboardDaysUntilDue(left.dueDate);
      const rightDays = dashboardDaysUntilDue(right.dueDate);
      const leftRank =
        left.status === "Changes Requested"
          ? -2
          : leftDays !== null && leftDays < 0
            ? -1
            : leftDays !== null && leftDays <= 7
              ? 0
              : 1;
      const rightRank =
        right.status === "Changes Requested"
          ? -2
          : rightDays !== null && rightDays < 0
            ? -1
            : rightDays !== null && rightDays <= 7
              ? 0
              : 1;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return (leftDays ?? 9999) - (rightDays ?? 9999);
    },
  );
  const reviewerAttentionItems = [...personalDashboardReviews].sort(
    (left, right) =>
      (dashboardDaysUntilDue(left.dueDate) ?? 9999) -
      (dashboardDaysUntilDue(right.dueDate) ?? 9999),
  );
  const openStandaloneTask = async (taskId: string) => {
    setDashboardTaskShortcut(null);
    setTaskRequestWorkspaceView(null);
    setDashboardTaskRequestTarget(null);
    const context = await api.taskContext(token, taskId);

    setStandaloneTaskOrigin(true);
    setActive("Tasks");

    setAssignmentRows((current) => {
      const withoutCurrent = current.filter(
        (item) => item.id !== context.assignment.id,
      );
      return [...withoutCurrent, context.assignment];
    });

    // Standalone TASK context keeps the parent ASSIGNMENT id for traceability/API calls,
    // but must not select the ASSIGNMENT Workspace shell.
    setSelectedAssignment(null);
    setSelectedAssignmentId(context.assignment.id);
    setBuilderCreate((current) => ({
      ...current,
      title: context.assignment.title,
    }));

    // "Start Task" must start the operational TASK and open its workspace.
    // It must not bypass TASK execution by jumping directly into the Report builder.
    let workspaceTask = context.task;

    if (
      context.task.status === "Not Started" &&
      context.task.owner_id === user?.id
    ) {
      try {
        workspaceTask = await api.updateAssignmentTask(
          token,
          context.assignment.id,
          context.task.id,
          buildTaskStartPayload(
            context.task,
            new Date().toISOString().slice(0, 10),
          ),
        );

        setAssignmentNotice(
          "Task started. Continue the work in the TASK workspace; open Report when you are ready to prepare the TASK Report.",
        );
      } catch (error) {
        setAssignmentNotice(
          error instanceof Error
            ? `Task could not be started: ${error.message}`
            : "Task could not be started. The TASK remains Not Started.",
        );
        return;
      }
    }

    // Load only the explicit TASK context needed by the standalone Task Workspace.
    // The related ASSIGNMENT remains a governance reference only.
    setAssignmentTasks([workspaceTask]);
    setAssignmentReviews([]);
    setAssignmentMemberRequests([]);
    setAssignmentSections([]);
    setAssignmentFiles([]);
    setAssignmentHistory([]);
    setComments([]);
    setWorkspaceDocuments([]);

    await openAssignmentTaskWorkspace(workspaceTask, false);
  };

  const openContextualTaskReview = async (taskId: string) => {
    const context = await api.taskReviewContext(token, taskId);

    setStandaloneTaskOrigin(true);
    setActive("Tasks");
    setAssignmentRows((current) => {
      const withoutCurrent = current.filter((item) => item.id !== context.assignment.id);
      return [...withoutCurrent, context.assignment];
    });

    // TASK review is review-scoped. Keep ASSIGNMENT context internally without opening
    // the ASSIGNMENT Workspace shell.
    setSelectedAssignment(null);
    setSelectedAssignmentId(context.assignment.id);
    setBuilderCreate((current) => ({ ...current, title: context.assignment.title }));
    // A contextual TASK reviewer gets only the explicitly assigned TASK review item.
    // The related ASSIGNMENT remains context only and is not opened as a workspace.
    // Do not load assignment-wide tasks, comments, history, attachments or reviews.
    setAssignmentTasks([context.task]);
    setAssignmentReviews([]);
    setAssignmentMemberRequests([]);
    setAssignmentSections([]);
    setAssignmentFiles([]);
    setAssignmentHistory([]);
    setComments([]);
    setWorkspaceDocuments([]);

    if (context.task.contribution_status === "Ready for Integration") {
      await openTaskReportPreviewForTask(context.task, true);
      return;
    }

    if (context.task.contribution_status === "Integrated") {
      await openAssignmentTaskWorkspace(context.task, true);
      return;
    }

    if (context.task.contribution_status === "Accepted") {
      await openTaskReportPreviewForTask(context.task, false);
      return;
    }

    await openAssignmentTaskWorkspace(context.task, true);
  };

  const openDashboardWork = async (item: {
    id: string;
    type: string;
    destination: string;
    contextId: string;
    reviewKind?: "Task Report" | "Research Report" | "Generated Document" | "Knowledge" | "Meeting Schedule Approval" | "Meeting Minutes" | "Leave Request" | "Notice" | "Assignment Member Request" | "Assignment Task Request" | "Research Assignment Request" | "Document Deletion Request" | "Assignment Review" | null;
  }) => {
    if (
      (item.type === "Review" || item.type === "Finalization") &&
      item.reviewKind === "Task Report"
    ) {
      try {
        await openContextualTaskReview(item.id);
        return;
      } catch (error) {
        setAssignmentNotice(
          error instanceof Error
            ? error.message
            : "Assigned Task Report action could not be opened.",
        );
        return;
      }
    }

    if ((item.type === "Review" || item.type === "Finalization") && item.reviewKind === "Research Report") {
      try {
        const project = await api.researchProject(token, item.contextId);
        await openResearchWorkspace(project, "Review");
      } catch (error) {
        setResearchWorkspaceNotice(
          error instanceof Error
            ? error.message
            : "The assigned Research Report action could not be loaded.",
        );
      }
      return;
    }

    if (
      item.type === "Review" &&
      item.reviewKind === "Generated Document" &&
      item.destination === "Assignments"
    ) {
      try {
        const assignments = assignmentRows.length
          ? assignmentRows
          : await api.assignments(token);

        if (!assignmentRows.length) setAssignmentRows(assignments);

        const assignment = assignments.find(
          (row) => row.id === item.contextId,
        );

        if (!assignment) {
          setAssignmentNotice(
            "The assignment linked to this review could not be loaded.",
          );
          setActive("Assignments");
          return;
        }

        setActive("Assignments");
        await openAssignmentDetails(assignment);
        setAssignmentWorkspaceTab("Reports");

        const submittedReport = await api.generatedDocument(token, item.id);
        setExternalAssignmentReaderDocument(submittedReport);
        return;
      } catch (error) {
        setAssignmentNotice(
          error instanceof Error
            ? error.message
            : "The assigned report review could not be opened.",
        );
        setActive("Assignments");
        return;
      }
    }

    if (item.type === "Assignment") {
      const assignments = assignmentRows.length
        ? assignmentRows
        : await api.assignments(token);
      if (!assignmentRows.length) setAssignmentRows(assignments);
      const assignment = assignments.find(
        (row) => row.id === item.contextId || row.id === item.id,
      );
      if (!assignment) {
        setAssignmentNotice("The assignment behind this dashboard item could not be loaded.");
        return;
      }
      setActive("Assignments");
      await openAssignmentDetails(assignment);
      setAssignmentWorkspaceTab("Overview");
      return;
    }

    if (item.reviewKind === "Notice") {
      setFocusedNoticeId(item.id);
      setActive("Notice Board");
      return;
    }

    if (item.reviewKind === "Assignment Member Request") {
      const assignments = assignmentRows.length ? assignmentRows : await api.assignments(token);
      if (!assignmentRows.length) setAssignmentRows(assignments);
      for (const assignment of assignments) {
        try {
          const requests = await api.assignmentMemberRequests(token, assignment.id);
          if (!requests.some((request) => request.id === item.id)) continue;
          setActive("Assignments");
          await openAssignmentDetails(assignment);
          setAssignmentMemberRequests(requests);
          return;
        } catch { /* Continue until the reviewed request is found. */ }
      }
      setActive("Assignments");
      return;
    }

    if (item.reviewKind === "Assignment Task Request") {
      setActive("Tasks");
      return;
    }

    if (item.reviewKind === "Document Deletion Request") {
      setActive("Document Repository");
      return;
    }

    if (["Leave Request", "Research Assignment Request"].includes(item.reviewKind || "")) {
      navigateTo(item.destination);
      return;
    }

    if (item.reviewKind === "Assignment Review") {
      const assignments = assignmentRows.length ? assignmentRows : await api.assignments(token);
      if (!assignmentRows.length) setAssignmentRows(assignments);
      const assignment = assignments.find((row) => row.id === item.contextId);
      if (assignment) {
        setActive("Assignments");
        await openAssignmentDetails(assignment);
        setAssignmentWorkspaceTab("Activity");
      } else {
        setAssignmentNotice("The assignment linked to this review history could not be loaded.");
        setActive("Assignments");
      }
      return;
    }

    if (item.type === "Task") {
      await openStandaloneTask(item.id);
      return;
    }

    if (item.type === "Research Project" || item.type === "Research Milestone") {
      try {
        const projectId = item.contextId || item.id;
        const project = await api.researchProject(token, projectId);
        await openResearchWorkspace(project, item.type === "Research Milestone" ? "Work" : "Overview");
      } catch (error) {
        setResearchWorkspaceNotice(
          error instanceof Error
            ? error.message
            : "The research record behind this dashboard item could not be loaded.",
        );
      }
      return;
    }

    // APP2_UNIVERSAL_MEETING_OPEN_OPTION_B_R3
    // Reuse the existing notification-originated target mechanism so the selected meeting opens directly.
    if (String(item.destination || "").toLowerCase() === "meetings" && (item.contextId || item.id)) {
      setMeetingNotificationTarget({
        id: item.contextId || item.id,
        tab: item.type === "Finalization" || item.reviewKind === "Meeting Minutes" ? "Minutes" : "Overview",
        nonce: Date.now(),
      });
      setActive("Meetings");
      return;
    }
    // Preserve the existing modules for document/repository reviews.
    navigateTo(item.destination);
  };

  const openPulseWork = async (row: PulseRow) => {
    if(active==='Dashboard')dashboardReturnRef.current={url:window.location.pathname+window.location.search,windowY:window.scrollY,scrolls:Array.from(document.querySelectorAll('main,.dashboard-content')).map(element=>({element,top:element.scrollTop}))};
    if(row.type === 'Notification'){const item=notifications.find(n=>n.id===row.id);if(item)await navigateNotification(item);else navigateTo('Notifications');return;}
    if (row.type === 'Notice') { setFocusedNoticeId(row.id); navigateTo('Notice Board'); return; }
    if (row.type === 'Knowledge' || row.reviewKind === 'Knowledge') {
      await navigateNotification({id:'',title:row.reviewKind === 'Knowledge' ? 'Review document' : row.title,body:'',entity_type:'knowledge',entity_id:row.id,read_at:new Date().toISOString(),created_at:new Date().toISOString()}); return;
    }
    if (row.type === 'Report' || row.reviewKind === 'Generated Document') {setActive('Assignments'); await openGeneratedDocument(row.id); return;}
    await openDashboardWork(row);
  };
  const openPulseCalendar = async (row: PulseCalendar | CalendarItem) => {
    const types:Record<string,string>={task:'Task',assignment:'Assignment',research_deadline:'Research Project',research_milestone:'Research Milestone',document_review:'Report',notice:'Notice'};
    const type=types[row.type];
    if(!type){navigateTo('Calendar');return;}
    await openPulseWork({id:row.id,type,title:row.title,status:row.status,contextId:row.type==='task'?row.entity_id||row.id:row.entity_id||row.id,destination:type==='Task'?'Tasks':type.startsWith('Research')?'Research Repository':'Assignments',module:'',key:row.id,buckets:[]});
  };

  const openDashboardMetric = (label: string, destination: string) => {
    const key =
      label === "Active Tasks"
        ? isManager
          ? "management-active-tasks"
          : "active-tasks"
        : label === "Due Soon"
          ? isResearcherDashboard
            ? "task-due-soon"
            : isReviewerDashboard
              ? "review-due-soon"
              : isManager
                ? "management-due-soon"
                : "assignment-due-soon"
          : label === "Overdue"
            ? isResearcherDashboard
              ? "task-overdue"
              : isReviewerDashboard
                ? "review-overdue"
                : isManager
                  ? "management-overdue"
                  : "assignment-overdue"
            : label === "Awaiting Review"
              ? "task-awaiting-review"
              : label === "Needs My Decision"
                ? "waiting-for-review"
                : label === "My Review History"
                  ? "my-reviews"
                  : label === "Final Reports"
                    ? "my-finalizations"
                    : label === "In Review"
                      ? "reviews-in-progress"
                      : label === "Review Notices"
                        ? "review-notices"
                        : label === "Active Assignments"
                          ? "active-assignments"
                          : label === "Repository Reviews"
                            ? "document-reviews"
                            : label === "Active Research"
                              ? "active-research"
                              : label === "Current Research"
                                ? "current-research"
                                : null;

    if (key) setDashboardActionQueue(key);
    else navigateTo(destination);
  };
  const openDashboardWorkloadMember = async (memberId: string) => {
    setDashboardWorkloadMemberId(memberId);
    setDashboardWorkloadDetail(null);
    setDashboardWorkloadError("");
    setDashboardWorkloadLoading(true);

    try {
      const detail = await api.dashboardTeamWorkload(token, memberId);
      setDashboardWorkloadDetail(detail);
    } catch (error) {
      setDashboardWorkloadError(
        error instanceof Error
          ? error.message
          : "Team member workload could not be loaded.",
      );
    } finally {
      setDashboardWorkloadLoading(false);
    }
  };
  const selectedDashboardWorkloadMember =
    dashboardWorkloadMemberId
      ? dashboardData?.management?.team.workload.find(
          (member) => member.id === dashboardWorkloadMemberId,
        ) ?? null
      : null;
  const dashboardQueueTitle = (() => {
    switch (dashboardActionQueue) {
      case "management-attention": return "Work needing management attention";
      case "active-assignments": return "Active assignments";
      case "assignment-due-soon": return "Assignments due soon";
      case "assignment-overdue": return "Overdue assignments";
      case "active-tasks": return "My active tasks";
      case "management-active-tasks": return "Active tasks in management scope";
      case "management-due-soon": return "Work due within seven days";
      case "management-overdue": return "Overdue work";
      case "task-due-soon": return "My tasks due soon";
      case "task-overdue": return "My overdue tasks";
      case "task-awaiting-review": return "My work awaiting review";
      case "waiting-for-review": return "Needs my decision";
      case "my-reviews": return "My review history";
      case "my-finalizations": return "Approved reports awaiting final generation";
      case "review-due-soon": return "Reviews due soon";
      case "review-overdue": return "Overdue reviews";
      case "reviews-in-progress": return "Reviews in progress";
      case "review-notices": return "Review notifications";
      case "document-reviews": return "Documents awaiting review";
      case "active-research": return "Active research";
      case "current-research": return "Current research";
      default: return "Action queue";
    }
  })();

  const dashboardQueueWorkItems = (() => {
    if (dashboardActionQueue === "management-attention")
      return managerMixedAttentionItems;

    if (dashboardActionQueue === "management-active-tasks")
      return (dashboardData?.myWork || []).filter(
        (item) => item.type === "Task",
      );

    if (dashboardActionQueue === "management-due-soon")
      return (dashboardData?.deadlines || []).filter(
        (item) =>
          typeof item.days === "number" &&
          item.days >= 0 &&
          item.days <= 7,
      );

    if (dashboardActionQueue === "management-overdue")
      return (dashboardData?.deadlines || []).filter(
        (item) =>
          typeof item.days === "number" &&
          item.days < 0,
      );

    if (dashboardActionQueue === "active-tasks") return personalDashboardTasks;
    if (dashboardActionQueue === "task-due-soon") return personalTaskDeadlines.filter((item) => typeof item.days === "number" && item.days >= 0 && item.days <= 7);
    if (dashboardActionQueue === "task-overdue") return personalTaskDeadlines.filter((item) => typeof item.days === "number" && item.days < 0);
    if (dashboardActionQueue === "task-awaiting-review") return personalDashboardTasks.filter((item) => item.status === "Ready for Review");
    if (dashboardActionQueue === "waiting-for-review") return personalDashboardReviews;
    if (dashboardActionQueue === "my-reviews")
      return personalReviewHistory;
    if (dashboardActionQueue === "my-finalizations") return personalDashboardFinalizations;
    if (dashboardActionQueue === "review-due-soon") return personalReviewDeadlines.filter((item) => typeof item.days === "number" && item.days >= 0 && item.days <= 7);
    if (dashboardActionQueue === "review-overdue") return personalReviewDeadlines.filter((item) => typeof item.days === "number" && item.days < 0);
    if (dashboardActionQueue === "reviews-in-progress") return personalDashboardReviews.filter((item) => item.status === "Under Review");
    return [];
  })();

  const dashboardQueueAssignments = (() => {

    if (dashboardActionQueue === "active-assignments") return activeDashboardAssignments;
    if (dashboardActionQueue === "assignment-due-soon") return dueSoonDashboardAssignments;
    if (dashboardActionQueue === "assignment-overdue") return overdueDashboardAssignments;
    return [];
  })();

  const dashboardQueueDocumentReviews = dashboardActionQueue === "document-reviews"
    ? isManager
      ? dashboardData?.management?.repository.pendingItems ?? []
      : reviewRows
    : [];
  const dashboardQueueResearch = dashboardActionQueue === "active-research"
    ? (dashboardData?.management?.research.items ?? []).filter((item) => item.status === "Active")
    : dashboardActionQueue === "current-research"
      ? dashboardData?.management?.research.items ?? []
      : [];
  const dashboardQueueNotifications = dashboardActionQueue === "review-notices"
    ? dashboardReviewNotifications.filter((item) => !item.read_at)
    : [];

  const uploadKnowledge = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!knowledgeFile || !token)
      return setKnowledgeNotice(
        "Choose a PDF, DOCX, TXT or MD document first.",
      );
    if (!knowledgeForm.documentType)
      return setKnowledgeNotice("Choose what this record is being added as.");
    if (!knowledgeForm.category)
      return setKnowledgeNotice("Choose a records class.");
    if (!knowledgeForm.title.trim())
      return setKnowledgeNotice("Enter a clear record title.");
    if (
      ["Research", "Assignment", "Task", "App2 Report"].includes(
        knowledgeForm.sourceType,
      ) &&
      !knowledgeForm.originEntityId
    )
      return setKnowledgeNotice("Select the originating REDESY record.");
    if (!knowledgeForm.reviewerId)
      return setKnowledgeNotice("Select the reviewer who will be responsible for this document.");
    if (knowledgeForm.reviewerId === user?.id)
      return setKnowledgeNotice("You cannot review your own repository document.");
    setKnowledgeUploading(true);
    setKnowledgeUploadProgress({
      progress: 18,
      label: "Uploading and validating document",
      state: "active",
    });
    try {
      const created = await api.uploadKnowledge(
        token,
        knowledgeFile,
        knowledgeForm,
      );
      setKnowledgeUploadProgress({
        progress: 34,
        label: "Creating secure REDESY record",
        state: "active",
      });
      await api.submitKnowledge(token, created.id);
      setKnowledgeUploadProgress({
        progress: 45,
        label: "Awaiting document review",
        state: "waiting",
      });
      const [knowledge] = await Promise.all([
        api.knowledge(token),
        refreshDocuments(),
        ...(canReview ? [refreshReviews()] : []),
      ]);
      setKnowledgeRows(knowledge);
      setKnowledgeUploadOpen(false);
      setKnowledgeFile(null);
      setKnowledgeForm({
        title: "",
        description: "",
        category: "Administrative Records",
        tags: "",
        author: "",
        documentDate: "",
        sourceType: "App2 Upload",
        sourceUrl: "",
        originEntityId: "",
        directorate: "",
        documentType: "Reference",
        subject: "",
        classification: "INTERNAL",
        felixEnabled: true,
        reviewerId: "",
      });
      setKnowledgeUploadStep(1);
      setKnowledgeNotice(
        "Upload complete and submitted to the assigned reviewer. Felix remains separate until approval.",
      );
    } catch (error) {
      setKnowledgeUploadProgress({
        progress: 100,
        label: "Upload failed",
        state: "failed",
      });
      setKnowledgeNotice(
        error instanceof Error
          ? error.message
          : "Document could not be uploaded.",
      );
    } finally {
      setKnowledgeUploading(false);
    }
  };
  const openRepositoryDocumentReader = async (
    itemOrId: KnowledgeItem | string,
    markReviewRead = false,
  ) => {
    try {
      let item =
        typeof itemOrId === "string"
          ? knowledgeRows.find((row) => row.id === itemOrId)
          : itemOrId;

      if (!item) {
        const refreshed = await api.knowledge(token);
        setKnowledgeRows(refreshed);
        item =
          typeof itemOrId === "string"
            ? refreshed.find((row) => row.id === itemOrId)
            : itemOrId;
      }

      if (!item) {
        throw new Error("The repository document could not be found.");
      }

      const versions = await api.knowledgeVersions(token, item.id);
      const latest = [...versions].sort(
        (a, b) => Number(b.version_number || 0) - Number(a.version_number || 0),
      )[0];

      if (!latest) {
        throw new Error("This repository document has no readable version.");
      }

      // Reading actions open the current stored version directly.
      // Version management remains in the Repository module.
      setReaderVersionId(latest.id);
      setReaderDocument(item as DocumentItem);
      if (markReviewRead) setReviewDocumentReadId(item.id);
      setSelectedKnowledge(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The document could not be opened in the reader.";
      if (selectedResearch) setResearchWorkspaceNotice(message);
      else setAssignmentNotice(message);
    }
  };

  const formatRepositoryActivityAction = (action: string) =>
    action
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const repositoryActivityCategory = (action: string) => {
    const key = action.toLowerCase();
    if (/publish|published/.test(key)) return "Publication";
    if (/approve|approved/.test(key)) return "Approval";
    if (/review|reviewer|reject|return/.test(key)) return "Review";
    if (/protect|copy|security|permission|access denied|restriction/.test(key)) return "Security";
    if (/retention|archive|delete|governance|hold|reindex/.test(key)) return "Governance";
    if (/version|upload|edit|update|checkout|checkin|check out|check in/.test(key)) return "Edit";
    return "Access";
  };

  const repositoryActivityLabel = (action: string) => {
    const key = action.toLowerCase();
    if (key.includes("private repository operational draft archived")) return "Working draft archived";
    if (key.includes("document viewed")) return "Document viewed";
    if (key.includes("document downloaded")) return "Document downloaded";
    if (key.includes("copy")) return "Document copy activity";
    if (key.includes("publish")) return "Record published";
    if (key.includes("approve")) return "Record approved";
    if (key.includes("reject")) return "Review rejected";
    if (key.includes("return")) return "Returned for changes";
    if (key.includes("reviewer")) return "Reviewer changed";
    if (key.includes("protection")) return "Protection changed";
    if (key.includes("retention")) return "Retention updated";
    if (key.includes("checkout") || key.includes("check out")) return "Record locked for editing";
    if (key.includes("checkin") || key.includes("check in")) return "Record released";
    return formatRepositoryActivityAction(action);
  };

  const repositoryActivitySummary = (action: string, details: Record<string, unknown>) => {
    const key = action.toLowerCase();
    if (key.includes("private repository operational draft archived")) {
      const reason = String(details?.reason || "").trim();
      if (/final governed report published/i.test(reason)) return "Final governed report published and working draft archived.";
      return "Working draft archived as part of the governed records lifecycle.";
    }
    if (key.includes("document viewed")) return "The stored document was opened for read-only viewing.";
    if (key.includes("download")) return "The document was downloaded through the governed repository endpoint.";
    if (key.includes("copy")) return "A governed copy-related action was recorded for this document.";
    if (key.includes("publish")) return "The governed record was published.";
    if (key.includes("approve")) return "The governed record was approved.";
    if (key.includes("reject")) return "The review decision rejected this record.";
    if (key.includes("return")) return "The record was returned for revision.";
    if (key.includes("reviewer")) return "Reviewer responsibility changed for this record.";
    if (key.includes("protection")) return "Document protection or access controls changed.";
    if (key.includes("retention")) return "Retention governance was updated.";
    if (key.includes("checkout") || key.includes("check out")) return "The record was locked for active editing.";
    if (key.includes("checkin") || key.includes("check in")) return "The active editing lock was released.";
    return "A governed repository event was recorded.";
  };

  const formatRepositoryActivityDetails = (details: Record<string, unknown>) => {
    const entries = Object.entries(details || {}).filter(
      ([, value]) => value !== null && value !== undefined && value !== "",
    );
    if (!entries.length) return "No additional details recorded.";
    return entries
      .map(([key, value]) => {
        const label = key.replace(/[_-]+/g, " ");
        const rendered =
          typeof value === "object" ? JSON.stringify(value) : String(value);
        return `${label}: ${rendered}`;
      })
      .join(" · ");
  };

  const repositoryActivityDayLabel = (createdAt: string) => {
    const value = new Date(createdAt);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
    if (sameDay(value, today)) return "Today";
    if (sameDay(value, yesterday)) return "Yesterday";
    return value.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
  };

  const groupedRepositoryActivityRows = (rows: typeof documentActivityRows) => {
    const grouped: Array<(typeof documentActivityRows)[number] & { repeat_count: number }> = [];
    for (const row of rows) {
      const previous = grouped[grouped.length - 1];
      const isRepeatView =
        previous &&
        /document viewed/i.test(previous.action) &&
        /document viewed/i.test(row.action) &&
        previous.user_name === row.user_name &&
        String(previous.details?.version || "") === String(row.details?.version || "");
      if (isRepeatView) {
        previous.repeat_count += 1;
        continue;
      }
      grouped.push({ ...row, repeat_count: 1 });
    }
    return grouped;
  };

  const openRepositoryDocumentActivity = async (item: DocumentItem) => {
    setDocumentActivityTarget(item);
    setDocumentActivityRows([]);
    setDocumentActivityError("");
    setDocumentActivityLoading(true);
    try {
      const rows = await api.documentActivity(token, item.id);
      setDocumentActivityRows(rows);
    } catch (error) {
      setDocumentActivityError(
        error instanceof Error
          ? error.message
          : "Document activity could not be loaded.",
      );
    } finally {
      setDocumentActivityLoading(false);
    }
  };

  const removeKnowledge = async (item: KnowledgeItem) => {
    if (
      !window.confirm(
        `Delete "${item.title}" and every uploaded version? This cannot be undone.`,
      )
    )
      return;
    try {
      await api.deleteKnowledge(token, item.id);
      setSelectedKnowledge(null);
      setKnowledgeRows(await api.knowledge(token));
      await refreshDocuments();
      setKnowledgeNotice("Document and all of its versions were deleted.");
    } catch (error) {
      setKnowledgeNotice(
        error instanceof Error
          ? error.message
          : "Document could not be deleted.",
      );
    }
  };
  const researchBriefComplete =
    researchForm.title.trim().length >= 4 &&
    researchForm.summary.trim().length >= 10 &&
    researchForm.researchQuestion.trim().length >= 10 &&
    researchForm.objectives.trim().length >= 10 &&
    researchForm.methodology.trim().length >= 10;
  const researchTimelineComplete =
    Boolean(researchForm.startDate && researchForm.endDate) &&
    researchForm.endDate >= researchForm.startDate;
  const researchBriefMissing = [
    researchForm.title.trim().length < 4 && "project title (4 characters)",
    researchForm.summary.trim().length < 10 && "executive summary (10 characters)",
    researchForm.researchQuestion.trim().length < 10 && "research question (10 characters)",
    researchForm.objectives.trim().length < 10 && "objectives (10 characters)",
    researchForm.methodology.trim().length < 10 && "methodology (10 characters)",
  ].filter(Boolean) as string[];
  const saveResearch = async (event: React.FormEvent) => {
    event.preventDefault();
    setResearchCreateNotice("");
    if (!researchBriefComplete || !researchForm.leadId || !researchTimelineComplete) {
      setResearchCreateNotice("Complete the research brief, accountable lead, start date and finish date before creating the project.");
      return;
    }
    if (
      researchForm.startDate &&
      researchForm.endDate &&
      researchForm.endDate < researchForm.startDate
    ) {
      alert("Research end date must be on or after its start date.");
      return;
    }
    try {
      setResearchCreating(true);
      const created = await api.createResearch(token, {
        ...researchForm,
        startDate: researchForm.startDate,
        endDate: researchForm.endDate,
        leadId: researchForm.leadId,
        assignmentId: researchForm.assignmentId || null,
      });
      const projects = await api.research(token);
      setResearchRows(projects);
      await openResearchWorkspace(created);
      setResearchWorkspaceNotice("Research project created. The workspace is ready.");
      setResearchForm({
        title: "", summary: "", researchQuestion: "", objectives: "", methodology: "",
        startDate: "", endDate: "", leadId: "", assignmentId: "",
        collaboratorIds: [], reviewerIds: [], knowledgeIds: [],
      });
      setResearchFormStep(1);
      setResearchOpen(false);
    } catch (error) {
      setResearchCreateNotice(error instanceof Error ? error.message : "The research project could not be created.");
    } finally {
      setResearchCreating(false);
    }
  };
  const saveAiResearch = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api.createAiResearchJob(token, aiResearchForm);
      setAiResearchJobs(await api.aiResearchJobs(token));
      setAiResearchOpen(false);
      setAiResearchForm({
        title: "",
        question: "",
        scope: "",
        sourceMode: "App2 Documents",
        depth: "Standard",
      });
      setAiResearchNotice("Research plan created with zero API cost.");
    } catch (error) {
      setAiResearchNotice(
        error instanceof Error
          ? error.message
          : "The research plan could not be created.",
      );
    }
  };
  const askAiResearch = (
    question: string,
    history: { role: "user" | "assistant"; content: string }[],
    mode: import("./api").FelixMode,
    documentId?: string,
  ) => api.askFelix(token, question, history, mode, documentId);
  const listChangeProposals = () => api.changeProposals(token);
  const createChangeProposal = (findingId: string) =>
    api.createChangeProposal(token, findingId);
  const decideChangeProposal = (
    id: string,
    decision: "Approved" | "Rejected",
    comments: string,
  ) => api.decideChangeProposal(token, id, decision, comments);
  const runFelixAction = async (action: FelixAction) => {
    if (action.type === "navigate") {
      setActive(action.target);
      return `${action.target} opened.`;
    }
    if (action.type === "draft_notice") {
      setNoticeForm({
        title: action.payload.title || "",
        body: action.payload.body || "",
        severity: "Information",
        audienceRole: "",
        audienceRules: [{ type: "ORGANISATION", value: "*" }],
        acknowledgementRequired: false,
        eventStart: "",
        eventEnd: "",
        expiresAt: "",
      });
      setActive("Notice Board");
      return "Notice draft prepared. Review its wording and submit it for management approval.";
    }
    if (action.type === "draft_assignment") {
      if (!isManager) throw new Error("Your role cannot create assignments.");
      setAssignmentForm({
        title: action.payload.title || "",
        description: action.payload.description || "",
        objective: "",
        scope: "",
        instructions: "",
        expectedOutput: "Final Assignment Report",
        division: "",
        startDate: null,
        dueDate: null,
        priority: "Normal",
        memberIds: [],
        leadId: null,
      });
      setAssignmentEditor("new");
      setActive("Assignments");
      return "Assignment draft prepared. Complete the division, due date and assignees before saving.";
    }
    if (action.type === "update_assignment_status") {
      await api.updateStatus(token, action.payload.id, action.payload.status);
      await refreshAssignments();
      return `Assignment "${action.payload.title}" updated to ${action.payload.status}. The change was recorded in its history.`;
    }
    throw new Error("Felix proposed an unsupported action.");
  };
  const startAiResearch = async (job: AiResearchJob) => {
    try {
      setAiResearchNotice("Checking the free local research engine...");
      await api.startAiResearchJob(token, job.id);
    } catch (error) {
      setAiResearchNotice(
        error instanceof Error
          ? error.message
          : "The local research engine could not be started.",
      );
    }
  };
  const openFelixDocumentReview = (item: DocumentItem) => {
    if (item.felix_index_status !== "Completed") return;
    setFelixReviewRequest({
      documentId: item.id,
      title: item.title,
      nonce: Date.now(),
    });
    setActive("AI Researcher");
  };
  const refreshDocuments = async () => {
    const [documents, improvements] = await Promise.all([
      api.documents(token),
      api.documentImprovements(token).catch(() => []),
    ]);
    setDocumentRows(documents.map(normalizeDocument));
    setDocumentImprovementAssignments(improvements);
  };
  const updateImprovementStatus = async (
    assignment: DocumentImprovementAssignment,
    status: DocumentImprovementAssignment["status"],
  ) => {
    try {
      await api.updateDocumentImprovementStatus(token, assignment.id, status);
      await refreshDocuments();
      setDocumentNotice(
        status === "Completed"
          ? "The assigned reviewer approved and published the improved version."
          : status === "Submitted"
            ? "The improved version is now with its assigned reviewer."
            : "Improvement status updated.",
      );
    } catch (error) {
      setDocumentNotice(error instanceof Error ? error.message : "The improvement status could not be updated.");
    }
  };
  const openDocumentProtection = async (item: DocumentItem) => {
    setProtectionDocument(item);
    try {
      const policy = await api.documentProtection(token, item.id);
      setDocumentProtection(policy);
      setProtectionForm({
        readerScope: policy.reader_scope,
        allowDownload: policy.allow_download,
        allowCopy: policy.allow_copy,
        allowPrint: policy.allow_print,
        allowLink: policy.allow_link,
        watermark: policy.watermark,
        restrictionReason: policy.restriction_reason || "",
        expiresAt: policy.expires_at ? policy.expires_at.slice(0, 16) : "",
        userIds: policy.grants.map((grant) => grant.user_id),
      });
    } catch (error) {
      setDocumentProtection(null);
      setDocumentNotice(error instanceof Error ? error.message : "Protection settings could not be loaded.");
    }
  };

  const saveDocumentProtection = async () => {
    if (!protectionDocument || protectionSaving) return;
    try {
      setProtectionSaving(true);
      const policy = await api.updateDocumentProtection(token, protectionDocument.id, {
        ...protectionForm,
        expiresAt: protectionForm.expiresAt ? new Date(protectionForm.expiresAt).toISOString() : null,
      });
      setDocumentProtection(policy);
      setDocumentNotice(`Protection updated for “${protectionDocument.title}”.`);
      setProtectionDocument(null);
      await refreshDocuments();
    } catch (error) {
      setDocumentNotice(error instanceof Error ? error.message : "Protection settings could not be saved.");
    } finally {
      setProtectionSaving(false);
    }
  };

  const openDocumentRelationships = async (item: DocumentItem) => {
    setRelationshipDocument(item);
    setRelationshipForm({
      relationshipType: item.document_type === "Evidence" ? "Evidence for" : "Reference for",
      entityType: "assignment",
      entityId: "",
      pinCurrentVersion: true,
      notes: "",
    });
    try {
      setDocumentRelationships(await api.documentRelationships(token, item.id));
    } catch (error) {
      setDocumentRelationships([]);
      setDocumentNotice(error instanceof Error ? error.message : "Relationships could not be loaded.");
    }
  };

  const saveDocumentRelationship = async () => {
    if (!relationshipDocument || !relationshipForm.entityId || relationshipSaving) return;
    try {
      setRelationshipSaving(true);
      await api.createDocumentRelationship(token, relationshipDocument.id, relationshipForm);
      setDocumentRelationships(await api.documentRelationships(token, relationshipDocument.id));
      await refreshDocuments();
      setRelationshipForm({...relationshipForm, entityId: "", notes: ""});
      setDocumentNotice(`Relationship saved for “${relationshipDocument.title}”.`);
    } catch (error) {
      setDocumentNotice(error instanceof Error ? error.message : "Relationship could not be saved.");
    } finally {
      setRelationshipSaving(false);
    }
  };

  const removeDocumentRelationship = async (relationshipId: string) => {
    if (!relationshipDocument) return;
    try {
      await api.deleteDocumentRelationship(token, relationshipDocument.id, relationshipId);
      setDocumentRelationships((rows) => rows.filter((row) => row.id !== relationshipId));
    } catch (error) {
      setDocumentNotice(error instanceof Error ? error.message : "Relationship could not be removed.");
    }
  };

  const openDocumentImprovement = (item: DocumentItem) => {
    setImprovementDocument(item);
    setImprovementForm({
      assigneeId: "",
      reviewerId: item.reviewer_id || "",
      improvementType: "Content Update",
      reason: "",
      dueDate: "",
    });
  };
  const saveDocumentImprovement = async () => {
    if (
      !improvementDocument ||
      !improvementForm.assigneeId ||
      !improvementForm.reviewerId ||
      improvementForm.reason.trim().length < 5 ||
      improvementSaving
    )
      return;
    try {
      setImprovementSaving(true);
      await api.createDocumentImprovement(token, improvementDocument.id, {
        assigneeId: improvementForm.assigneeId,
        reviewerId: improvementForm.reviewerId,
        improvementType: improvementForm.improvementType,
        reason: improvementForm.reason.trim(),
        dueDate: improvementForm.dueDate || null,
      });
      await refreshDocuments();
      setDocumentNotice(
        `Improvement assigned for “${improvementDocument.title}”. The current official version remains traceable while the new version is prepared.`,
      );
      setImprovementDocument(null);
    } catch (error) {
      setDocumentNotice(
        error instanceof Error ? error.message : "Document improvement could not be assigned.",
      );
    } finally {
      setImprovementSaving(false);
    }
  };

  const submitDeletionRequest = async () => {
    if (!deletionRequestDocument || deletionRequestReason.trim().length < 5)
      return;
    try {
      await api.requestDocumentDeletion(
        token,
        deletionRequestDocument.id,
        deletionRequestReason.trim(),
      );
      setDeletionRequests(await api.documentDeletionRequests(token));
      setDeletionRequestDocument(null);
      setDeletionRequestReason("");
      setDocumentNotice(
        "Deletion request sent to Research Managers and Administrators for approval.",
      );
    } catch (error) {
      setDocumentNotice(
        error instanceof Error
          ? error.message
          : "Deletion request could not be submitted.",
      );
    }
  };
  const decideDeletionRequest = async (approved: boolean) => {
    if (!deletionDecision) return;
    try {
      await api.decideDocumentDeletion(
        token,
        deletionDecision.id,
        approved,
        deletionDecisionComments.trim(),
      );
      await refreshDocuments();
      setDeletionRequests(await api.documentDeletionRequests(token));
      setDeletionDecision(null);
      setDeletionDecisionComments("");
      setDocumentNotice(
        approved
          ? "Deletion approved. The document and every stored version were removed."
          : "Deletion request rejected. The document remains available.",
      );
    } catch (error) {
      setDocumentNotice(
        error instanceof Error
          ? error.message
          : "Deletion decision could not be saved.",
      );
    }
  };
  const openRepositoryWorkspace = async (item: DocumentItem) => {
    const currentUserName = user?.name?.trim();
    if (!currentUserName) {
      setRepositoryAutoLockedDocumentId(null);
      setDocumentNotice("Your signed-in user could not be resolved, so REDESY did not acquire a record lock.");
      return;
    }

    try {
      if (!item.locked_by_name) {
        await api.checkoutDocument(token, item.id);
        setRepositoryAutoLockedDocumentId(item.id);
        setRepositoryWorkspaceDocument({ ...item, locked_by_name: currentUserName });
        setDocumentNotice(`“${item.title}” was locked automatically while you work on it.`);
        void refreshDocuments().catch(() => {});
        return;
      }

      if (item.locked_by_name !== currentUserName) {
        setRepositoryAutoLockedDocumentId(null);
        setDocumentNotice(`“${item.title}” is already locked by ${item.locked_by_name}. Existing Repository lock rules remain in force.`);
        return;
      }

      setRepositoryAutoLockedDocumentId(null);
      setRepositoryWorkspaceDocument(item);
      setDocumentNotice(`You are already working on “${item.title}”.`);
    } catch (error) {
      setRepositoryAutoLockedDocumentId(null);
      setDocumentNotice(
        error instanceof Error
          ? error.message
          : "The record workspace could not acquire its automatic lock.",
      );
    }
  };

  const closeRepositoryWorkspace = async () => {
    const item = repositoryWorkspaceDocument;
    setRepositoryWorkspaceDocument(null);
    if (!item || repositoryAutoLockedDocumentId !== item.id) return;

    try {
      await api.checkinDocument(token, item.id);
      setDocumentNotice(`“${item.title}” was checked in automatically when the workspace closed.`);
      await refreshDocuments();
    } catch (error) {
      setDocumentNotice(
        error instanceof Error
          ? `Workspace closed, but automatic check-in needs attention: ${error.message}`
          : "Workspace closed, but automatic check-in could not be completed.",
      );
    } finally {
      setRepositoryAutoLockedDocumentId(null);
    }
  };

  const toggleDocumentLock = async (item: DocumentItem) => {
    try {
      if (item.locked_by_name) await api.checkinDocument(token, item.id);
      else await api.checkoutDocument(token, item.id);
      await refreshDocuments();
      setDocumentNotice(
        item.locked_by_name
          ? "Document checked in."
          : "Document checked out for two hours.",
      );
    } catch (error) {
      setDocumentNotice(
        error instanceof Error
          ? error.message
          : "Document lock could not be changed.",
      );
    }
  };
  const openDocumentVersions = async (item: DocumentItem) => {
    setSelectedKnowledge(normalizeDocument(item));
    setKnowledgeVersions(
      (await api.knowledgeVersions(token, item.id)).map((version) => ({
        ...version,
        original_name: displayFileName(version.original_name),
        created_by_name: displayFileName(version.created_by_name),
      })),
    );
  };

  const privateDraftSourceLabel = (item: DocumentItem) => {
    if (item.document_type === "Assignment Draft") return "Open Assignment";
    if (item.document_type === "Task Draft") return "Open Task";
    if (item.document_type === "Task Report Draft") return "Open Report";
    if (item.document_type === "Assignment Report Draft") return "Open Report";
    return "Open source";
  };

  const privateDraftSourceObject = (item: DocumentItem) => {
    if (item.document_type === "Assignment Draft") return "ASSIGNMENT";
    if (item.document_type === "Task Draft") return "TASK";
    if (item.document_type === "Task Report Draft") return "TASK REPORT";
    if (item.document_type === "Assignment Report Draft")
      return "ASSIGNMENT REPORT";
    return "REDESY RECORD";
  };

  const privateDraftVisibilityText = (item: DocumentItem) =>
    item.created_by === user?.id
      ? "Owner + authorised supervisors"
      : "Authorised supervisory scope";

  const repositoryPrimaryOrigin = (item: DocumentItem) => {
    const links = item.origin_links || [];
    const priority = ["task", "assignment", "research", "report"];
    for (const type of priority) {
      const match = links.find((link) => String(link.type || "").toLowerCase() === type);
      if (match) return match;
    }
    return links[0] || null;
  };

  const repositoryOriginDisplay = (item: DocumentItem) => {
    const origin = repositoryPrimaryOrigin(item);
    if (!origin) return null;
    const type = String(origin.type || "record").replaceAll("_", " ");
    return {
      ...origin,
      typeLabel: type.replace(/\b\w/g, (value) => value.toUpperCase()),
      titleLabel: origin.title || origin.id,
    };
  };

  const repositoryTraceLabel = (item: DocumentItem) => {
    const origin = repositoryOriginDisplay(item);
    const start = origin?.typeLabel || item.source_type || "App2 Upload";
    const end = item.status === "Published" ? "Final / Published" : item.status;
    return `${start} → Repository → ${end}`;
  };

  const openRepositoryOrigin = async (item: DocumentItem) => {
    if (isPrivateRepositoryDraft(item)) {
      await openPrivateDraftSource(item);
      return;
    }

    const origin = repositoryPrimaryOrigin(item);
    if (!origin) {
      setDocumentNotice(`No originating REDESY workspace is linked to “${item.title}”.`);
      return;
    }

    const type = String(origin.type || "").toLowerCase();
    try {
      if (type === "task") {
        await openStandaloneTask(origin.id);
        return;
      }
      if (type === "assignment") {
        if (!canAccessAssignmentsWorkspace)
          throw new Error("Your account does not have access to the linked Assignment workspace.");
        const rows = assignmentRows.length ? assignmentRows : await api.assignments(token);
        if (!assignmentRows.length) setAssignmentRows(rows);
        const assignment = rows.find((row) => row.id === origin.id);
        if (!assignment) throw new Error("The linked Assignment is outside your current authorised scope.");
        setActive("Assignments");
        await openAssignmentDetails(assignment);
        return;
      }
      if (type === "research") {
        const rows = researchRows.length ? researchRows : await api.research(token, isManager ? "team" : "my");
        if (!researchRows.length) setResearchRows(rows);
        const project = rows.find((row) => row.id === origin.id);
        if (!project) throw new Error("The linked Research workspace is outside your current authorised scope.");
        await openResearchWorkspace(project, "Overview");
        return;
      }
      if (type === "report") {
        setActive("Assignments");
        await openGeneratedDocument(origin.id);
        return;
      }
      throw new Error(`The linked ${origin.type || "record"} does not expose a direct workspace action.`);
    } catch (error) {
      setDocumentNotice(error instanceof Error ? error.message : "The originating workspace could not be opened.");
    }
  };


  const privateDraftVersionLabel = (item: DocumentItem) =>
    `v${Math.max(1, Number(item.current_version || 1))}`;

  const privateDraftDate = (value?: string | null) => {
    if (!value) return "Not recorded";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Not recorded";
    return parsed.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const openPrivateDraftSource = async (item: DocumentItem) => {
    const origins = item.origin_links || [];

    try {
      if (item.document_type === "Assignment Report Draft") {
        const reportOrigin = origins.find((link) => link.type === "report");
        if (!reportOrigin)
          throw new Error("This draft has no linked ASSIGNMENT REPORT source.");

        setActive("Assignments");
        await openGeneratedDocument(reportOrigin.id);
        return;
      }

      if (
        item.document_type === "Task Draft" ||
        item.document_type === "Task Report Draft"
      ) {
        const taskOrigin = origins.find((link) => link.type === "task");
        if (!taskOrigin) throw new Error("This draft has no linked TASK source.");

        await openStandaloneTask(taskOrigin.id);

        if (item.document_type === "Task Report Draft") {
          window.setTimeout(() => focusTaskReportEditor(), 0);
        }
        return;
      }

      if (item.document_type === "Assignment Draft") {
        const assignmentOrigin = origins.find(
          (link) => link.type === "assignment",
        );

        if (!assignmentOrigin)
          throw new Error("This draft has no linked ASSIGNMENT source.");

        if (!canAccessAssignmentsWorkspace) {
          throw new Error(
            "Your account can read this supervised draft, but it does not have ASSIGNMENT Workspace authority.",
          );
        }

        const rows = assignmentRows.length
          ? assignmentRows
          : await api.assignments(token);

        if (!assignmentRows.length) setAssignmentRows(rows);

        const assignment = rows.find(
          (row) => row.id === assignmentOrigin.id,
        );

        if (!assignment)
          throw new Error("The linked ASSIGNMENT is outside your current scope.");

        setActive("Assignments");
        await openAssignmentDetails(assignment);
        return;
      }

      throw new Error("No supported source action is available for this draft.");
    } catch (error) {
      setKnowledgeNotice(
        error instanceof Error
          ? error.message
          : "The private draft source could not be opened.",
      );
    }
  };

  const isPrivateRepositoryDraft = (item: DocumentItem) =>
    item.status === "Draft" &&
    [
      "Assignment Draft",
      "Task Draft",
      "Task Report Draft",
      "Assignment Report Draft",
    ].includes(item.document_type || "");

  const isArchivedOperationalDraft = (item: DocumentItem) =>
    item.status === "Archived" &&
    Boolean(item.is_archived) &&
    ["Assignment Draft", "Task Draft"].includes(item.document_type || "");

  // A Task Report Draft is the visible working document once it exists.
  // Keep the linked Task Draft data internally, but don't show two working
  // documents for the same task in the Repository list.
  const repositoryTaskReportOriginIds = new Set(
    documentRows
      .map(normalizeDocument)
      .filter(
        (item) =>
          item.document_type === "Task Report Draft" &&
          isPrivateRepositoryDraft(item),
      )
      .flatMap((item) =>
        (item.origin_links || [])
          .filter((link) => String(link.type || "").toLowerCase() === "task")
          .map((link) => String(link.id)),
      ),
  );

  const shouldHideRedundantTaskDraft = (item: DocumentItem) =>
    item.document_type === "Task Draft" &&
    (item.origin_links || []).some(
      (link) =>
        String(link.type || "").toLowerCase() === "task" &&
        repositoryTaskReportOriginIds.has(String(link.id)),
    );

  const repositoryDisplayRows = documentRows.filter(
    (item) => !shouldHideRedundantTaskDraft(normalizeDocument(item)),
  );
  const archivedOperationalDrafts = repositoryDisplayRows
    .map(normalizeDocument)
    .filter(isArchivedOperationalDraft);

  const repositoryDraftRows = repositoryDisplayRows
    .map(normalizeDocument)
    .filter(
      (item) =>
        isPrivateRepositoryDraft(item) || isArchivedOperationalDraft(item),
    );

  const repositoryDraftOwners = Array.from(
    new Map(
      repositoryDraftRows
        .filter((item) => Boolean(item.created_by))
        .map((item) => [
          String(item.created_by),
          item.created_by_name || "Unknown user",
        ]),
    ).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1]));

  const repositoryDraftTypes = [
    "Assignment Draft",
    "Task Draft",
    "Task Report Draft",
    "Assignment Report Draft",
  ].filter((type) =>
    repositoryDraftRows.some((item) => item.document_type === type),
  );

  const archivedDraftFinalType = (item: DocumentItem) =>
    item.document_type === "Task Draft"
      ? "Task Final Report"
      : item.document_type === "Assignment Draft"
        ? "Assignment Final Report"
        : "";

  const archivedDraftPrimaryOrigin = (item: DocumentItem) => {
    const expected =
      item.document_type === "Task Draft" ? "task" : "assignment";
    return (item.origin_links || []).find((link) => link.type === expected) || null;
  };

  const findArchivedDraftFinalRecord = (item: DocumentItem) => {
    const origin = archivedDraftPrimaryOrigin(item);
    const expectedFinalType = archivedDraftFinalType(item);

    if (!origin || !expectedFinalType) return null;

    return (
      documentRows
        .map(normalizeDocument)
        .find(
          (candidate) =>
            candidate.status === "Published" &&
            candidate.document_type === expectedFinalType &&
            (candidate.origin_links || []).some(
              (link) => link.type === origin.type && link.id === origin.id,
            ),
        ) || null
    );
  };

  const privateRepositoryDrafts = repositoryDisplayRows
    .map(normalizeDocument)
    .filter(isPrivateRepositoryDraft);

  const draftUpdatedAt = (item: DocumentItem) =>
    new Date(item.updated_at || item.created_at).getTime();

  const nowMs = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

  const activeRepositoryDrafts = privateRepositoryDrafts;

  const recentlyUpdatedDrafts = repositoryDraftRows.filter(
    (item) => nowMs - draftUpdatedAt(item) <= twoDaysMs,
  );

  const staleRepositoryDrafts = activeRepositoryDrafts.filter(
    (item) => nowMs - draftUpdatedAt(item) >= sevenDaysMs,
  );

  const multiRevisionDrafts = repositoryDraftRows.filter(
    (item) => Number(item.current_version || 0) >= 3,
  );

  const highestDraftVersion = repositoryDraftRows.reduce(
    (highest, item) =>
      Math.max(highest, Number(item.current_version || 0)),
    0,
  );

  const draftSignalLabels = (item: DocumentItem) => {
    const labels: string[] = [];

    if (
      isPrivateRepositoryDraft(item) &&
      nowMs - draftUpdatedAt(item) >= sevenDaysMs
    ) {
      labels.push("No update in 7+ days");
    }

    if (Number(item.current_version || 0) >= 3) {
      labels.push("Multiple revisions");
    }

    return labels;
  };

  const myPrivateRepositoryDrafts = privateRepositoryDrafts.filter(
    (item) => item.created_by === user?.id,
  );

  const supervisedPrivateRepositoryDrafts = privateRepositoryDrafts.filter(
    (item) => item.created_by !== user?.id,
  );

  const applyRepositorySummaryStatus = (status: string) => {
    setDocumentStatus(status);
    setDocumentSearch("");
    setDocumentSource("All");
    setDocumentMine(false);
    setDocumentDraftView("All");
    setDocumentDraftType("All");
    setDocumentDraftOwner("All");
    setDocumentDraftLifecycle("All");
    setDocumentSort("Newest");
  };

  const repositoryDocumentTab = (item: DocumentItem) => {
    const source = `${item.source_type || ""} ${item.document_type || ""} ${item.category || ""}`.toLowerCase();
    const linkTypes = (item.origin_links || []).map((link) => String(link.type || "").toLowerCase());
    if (
      isPrivateRepositoryDraft(item) ||
      isArchivedOperationalDraft(item) ||
      ["Draft", "Rejected"].includes(item.status)
    ) return "Drafts";
    if (item.status === "Published") return "Published";
    if (source.includes("assignment") || linkTypes.some((type) => type.includes("assignment")))
      return "Assignments";
    if (source.includes("task") || linkTypes.some((type) => type.includes("task")))
      return "Tasks";
    if (source.includes("research") || linkTypes.some((type) => type.includes("research")))
      return "Research";
    if (
      source.includes("report") ||
      /report/i.test(item.title || "") ||
      linkTypes.some((type) => type.includes("report"))
    ) return "Reports";
    return "All Records";
  };

  const repositoryLibraryCounts = {
    "All Records": repositoryDisplayRows.length,
    Assignments: repositoryDisplayRows.filter((item) => repositoryDocumentTab(normalizeDocument(item)) === "Assignments").length,
    Tasks: repositoryDisplayRows.filter((item) => repositoryDocumentTab(normalizeDocument(item)) === "Tasks").length,
    Research: repositoryDisplayRows.filter((item) => repositoryDocumentTab(normalizeDocument(item)) === "Research").length,
    Reports: repositoryDisplayRows.filter((item) => repositoryDocumentTab(normalizeDocument(item)) === "Reports").length,
    Drafts: repositoryDisplayRows.filter((item) => repositoryDocumentTab(normalizeDocument(item)) === "Drafts").length,
    Published: repositoryDisplayRows.filter((item) => normalizeDocument(item).status === "Published").length,
  };

  const repositoryReviewerRequiredCount = documentRows
    .map(normalizeDocument)
    .filter((item) =>
      item.status !== "Published" &&
      !isPrivateRepositoryDraft(item) &&
      !isArchivedOperationalDraft(item) &&
      !item.reviewer_id
    ).length;

  const repositoryPrimaryTabs = ["Tasks", "Assignments", "Research", "Published"] as const;
  const repositorySecondaryTabs = ["All Records", "Reports", "Drafts"] as const;

  const repositoryActiveFilterCount =
    (documentSearch.trim() ? 1 : 0) +
    (documentStatus !== "All" ? 1 : 0) +
    (documentSource !== "All" ? 1 : 0) +
    (documentMine ? 1 : 0) +
    (documentDraftView !== "All" ? 1 : 0) +
    (documentDraftType !== "All" ? 1 : 0) +
    (documentDraftOwner !== "All" ? 1 : 0) +
    (documentDraftLifecycle !== "All" ? 1 : 0) +
    (recordsLifecycleFilter !== "All" ? 1 : 0) +
    (repositoryOperationalQueue !== "All" ? 1 : 0) +
    (repositoryAssuranceFilter !== "ALL" ? 1 : 0) +
    Object.values(repositoryAdvancedFilters).filter(Boolean).length;

  const resetRepositoryRetrievalView = () => {
    setDocumentSearch("");
    setDocumentStatus("All");
    setDocumentSource("All");
    setDocumentMine(false);
    setDocumentDraftView("All");
    setDocumentDraftType("All");
    setDocumentDraftOwner("All");
    setDocumentDraftLifecycle("All");
    setDocumentSort("Newest");
    setRecordsLifecycleFilter("All");
    setRepositoryAdvancedFilters(emptyRepositoryAdvancedFilters);
    setRepositoryOperationalQueue("All");
    setRepositoryAssuranceFilter("ALL");
    setRepositoryLibraryTab("All Records");
    setRepositoryListPage(1);
  };

  const filteredDocuments = repositoryDisplayRows
    .map(normalizeDocument)
    .filter((item) => {
      const searchText =
        `${item.title} ${item.description} ${item.category} ${item.source_type || ""} ${item.document_type || ""} ${item.created_by_name || ""} ${item.reviewer_name || ""} ${item.reviewed_by_name || ""} ${item.status || ""} ${item.record_number || ""} ${item.record_class || ""} ${item.records_lifecycle_state || ""}`
          .toLowerCase();

      const matchesSearch = searchText.includes(
        documentSearch.trim().toLowerCase(),
      );

      const itemLibraryTab = repositoryDocumentTab(item);
      const matchesLibraryTab =
        repositoryLibraryTab === "All Records" ||
        (repositoryLibraryTab === "Published" && item.status === "Published") ||
        itemLibraryTab === repositoryLibraryTab;

      const matchesStatus =
        documentStatus === "All" ||
        (documentStatus === "Drafts & changes"
          ? ["Draft", "Rejected"].includes(item.status)
          : item.status === documentStatus);

      const matchesSource =
        documentSource === "All" || item.source_type === documentSource;

      const matchesMine =
        !documentMine || item.created_by === user?.id;

      const matchesDraftView =
        documentDraftView === "All" ||
        (documentDraftView === "My Drafts" &&
          isPrivateRepositoryDraft(item) &&
          item.created_by === user?.id) ||
        (documentDraftView === "Supervised Drafts" &&
          isPrivateRepositoryDraft(item) &&
          item.created_by !== user?.id) ||
        (documentDraftView === "Archived Drafts" &&
          isArchivedOperationalDraft(item));

      const draftCandidate =
        isPrivateRepositoryDraft(item) || isArchivedOperationalDraft(item);

      const matchesDraftType =
        documentDraftType === "All" ||
        (draftCandidate && item.document_type === documentDraftType);

      const matchesDraftOwner =
        documentDraftOwner === "All" ||
        (draftCandidate && item.created_by === documentDraftOwner);

      const matchesDraftLifecycle =
        documentDraftLifecycle === "All" ||
        (documentDraftLifecycle === "Active" &&
          isPrivateRepositoryDraft(item)) ||
        (documentDraftLifecycle === "Archived" &&
          isArchivedOperationalDraft(item));

      const activeImprovementIds = new Set(
        documentImprovementAssignments
          .filter((assignment) =>
            ["Assigned", "In Progress", "Submitted"].includes(assignment.status),
          )
          .map((assignment) => assignment.knowledge_id),
      );
      const reviewDueSoon = item.review_due_at
        ? new Date(item.review_due_at).getTime() <=
          Date.now() + 30 * 24 * 60 * 60 * 1000
        : false;
      const retentionDue = item.retention_until
        ? new Date(item.retention_until).getTime() <= Date.now()
        : false;
      const repositoryDateMs = new Date(item.updated_at || item.created_at).getTime();
      const advanced = repositoryAdvancedFilters;
      const matchesAdvanced =
        (!advanced.purpose || String(item.document_type || "").toLowerCase().includes(advanced.purpose.toLowerCase())) &&
        (!advanced.recordClass || String(item.record_class || item.category || "").toLowerCase().includes(advanced.recordClass.toLowerCase())) &&
        (!advanced.owner || String(item.created_by_name || "").toLowerCase().includes(advanced.owner.toLowerCase())) &&
        (!advanced.directorate || String(item.directorate || "").toLowerCase().includes(advanced.directorate.toLowerCase())) &&
        (!advanced.reviewer || String(item.reviewer_name || "").toLowerCase().includes(advanced.reviewer.toLowerCase())) &&
        (!advanced.protection || String(item.protection_scope || "INHERITED") === advanced.protection) &&
        (!advanced.from || repositoryDateMs >= new Date(`${advanced.from}T00:00:00`).getTime()) &&
        (!advanced.to || repositoryDateMs <= new Date(`${advanced.to}T23:59:59`).getTime());

      const matchesOperationalQueue =
        user?.id
          ? matchesRepositoryOperationalQueue(
              item,
              repositoryOperationalQueue,
              user.id,
              documentImprovementAssignments,
            )
          : repositoryOperationalQueue === "All";

      const matchesAssurance =
        repositoryAssuranceFilter === "ALL" ||
        repositoryAssuranceIds.includes(item.id);

      const matchesRecordsLifecycle =
        recordsLifecycleFilter === "All" ||
        (recordsLifecycleFilter === "Published" && item.status === "Published") ||
        (recordsLifecycleFilter === "Under Improvement" &&
          activeImprovementIds.has(item.id)) ||
        (recordsLifecycleFilter === "Review Due" && reviewDueSoon) ||
        (recordsLifecycleFilter === "Retention Review" &&
          (retentionDue || item.records_lifecycle_state === "Disposition Review")) ||
        (recordsLifecycleFilter === "Legal Hold" && item.legal_hold === true);

      return (
        matchesSearch &&
        matchesLibraryTab &&
        matchesStatus &&
        matchesSource &&
        matchesMine &&
        matchesDraftView &&
        matchesDraftType &&
        matchesDraftOwner &&
        matchesDraftLifecycle &&
        matchesRecordsLifecycle &&
        matchesAdvanced &&
        matchesOperationalQueue &&
        matchesAssurance
      );
    })
    .sort((a, b) => {
      if (documentSort === "Oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }

      if (documentSort === "LastSavedNewest") {
        return (
          new Date(b.updated_at || b.created_at).getTime() -
          new Date(a.updated_at || a.created_at).getTime()
        );
      }

      if (documentSort === "LastSavedOldest") {
        return (
          new Date(a.updated_at || a.created_at).getTime() -
          new Date(b.updated_at || b.created_at).getTime()
        );
      }

      if (documentSort === "VersionHigh") {
        return Number(b.current_version || 0) - Number(a.current_version || 0);
      }

      if (documentSort === "VersionLow") {
        return Number(a.current_version || 0) - Number(b.current_version || 0);
      }

      if (documentSort === "OwnerAZ") {
        return (a.created_by_name || "").localeCompare(b.created_by_name || "");
      }

      if (documentSort === "TitleAZ") {
        return a.title.localeCompare(b.title);
      }

      if (documentSort === "TitleZA") {
        return b.title.localeCompare(a.title);
      }

      if (documentSort === "Reviewed") {
        return (
          new Date(b.reviewed_at || b.updated_at || b.created_at).getTime() -
          new Date(a.reviewed_at || a.updated_at || a.created_at).getTime()
        );
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const repositoryTotalPages = Math.max(
    1,
    Math.ceil(filteredDocuments.length / repositoryPageSize),
  );
  const repositorySafePage = Math.min(repositoryListPage, repositoryTotalPages);
  const visibleRepositoryDocuments = filteredDocuments.slice(
    (repositorySafePage - 1) * repositoryPageSize,
    repositorySafePage * repositoryPageSize,
  );

  useEffect(() => {
    setRepositoryListPage(1);
  }, [
    repositoryLibraryTab,
    documentSearch,
    documentStatus,
    documentSource,
    documentMine,
    documentDraftView,
    documentDraftType,
    documentDraftOwner,
    documentDraftLifecycle,
    documentSort,
    recordsLifecycleFilter,
    repositoryAdvancedFilters,
    repositoryOperationalQueue,
    repositoryAssuranceFilter,
    repositoryAssuranceIds,
  ]);

  const canManageResearchTeam = Boolean(
    selectedResearch && (isManager || selectedResearch.lead_id === user?.id),
  );
  const researchNextAction = !selectedResearch
    ? null
    : researchTab === "Overview"
      ? selectedResearch.status === "Planning"
        ? {
            title: "Confirm the Research Brief",
            detail: "Check the research question, objectives, methodology, team and timeline before starting work.",
            label: "Preview Research Brief",
            tab: "Overview" as const,
          }
        : {
            title: "Move into the work plan",
            detail: "Update milestones and record the project work that is now underway.",
            label: "Open Work",
            tab: "Work" as const,
          }
      : researchTab === "Work"
        ? {
            title: "Gather and verify evidence",
            detail: "Link Repository documents and record the sources that support the research.",
            label: "Open Evidence",
            tab: "Resources" as const,
          }
        : researchTab === "Resources"
          ? {
              title: "Prepare the research report",
              detail: "Use the controlled evidence and completed work to draft the report.",
              label: "Open Report Builder",
              tab: "Report" as const,
            }
          : researchTab === "Report"
            ? {
                title: "Move the complete draft to review",
                detail: "Preview the report, confirm the formal reviewer and submit a locked version when ready.",
                label: "Open Review",
                tab: "Review" as const,
              }
            : researchTab === "Review"
              ? {
                  title:
                    selectedResearch.status === "Completed"
                      ? "Review the completed project record"
                      : "Check the project audit trail",
                  detail:
                    selectedResearch.status === "Completed"
                      ? "The controlled final report is complete. Review the recorded project history."
                      : "Use Activity to verify important project, evidence, report and review events.",
                  label: "View Activity",
                  tab: "Activity" as const,
                }
              : null;

  const refreshReviews = async () => {
    setReviewRows((await api.documentReviews(token)).map(normalizeDocument));
  };
  const reviewDocumentAction = async (approved: boolean) => {
    if (!reviewDocument) return;
    if (!reviewDocument.reviewer_id) {
      setDocumentNotice("Assign an explicit reviewer before a review decision can be recorded.");
      return;
    }
    try {
      await api.decideDocumentReview(
        token,
        reviewDocument.id,
        approved,
        rejectionReason,
      );
      await Promise.all([refreshDocuments(), refreshReviews()]);
      setKnowledgeRows(await api.knowledge(token));
      await resolveActionNotifications("document", reviewDocument.id);
      const outcome = approved ? "Document approved and published. The author has been notified." : "Document rejected and returned for correction. The author has been notified.";
      setDocumentNotice(outcome);
      setWorkflowDecision({
        title: approved ? "Document approved" : "Document rejected",
        outcome,
        nextAction: approved
          ? "No further review action is required. The approved record is published in the Document Repository."
          : "The document author must correct the record and submit a new version for review. The rejected version remains in the audit history.",
      });
      setReviewDocument(null);
      setReviewDocumentReadId(null);
      setRejectionReason("");
    } catch (error) {
      setDocumentNotice(
        error instanceof Error
          ? error.message
          : "Review could not be completed.",
      );
    }
  };
  const openRepositoryReview = (item: DocumentItem | ReviewItem) => {
    if (!item.reviewer_id) {
      setDocumentNotice("Reviewer required. Assign an explicit reviewer before opening the review decision.");
      return;
    }
    setReviewDocument(item as DocumentItem);
    setReviewDocumentReadId(null);
    setRejectionReason("");
  };
  const assignReviewer = async (item: ReviewItem, reviewerId: string) => {
    if (!reviewerId) {
      setDocumentNotice("Reviewer assignment cannot be cleared. Choose an authorised reviewer.");
      return;
    }
    try {
      await api.assignDocumentReviewer(token, item.id, reviewerId);
      await refreshReviews();
      setDocumentNotice("Reviewer assigned and notified.");
    } catch (error) {
      setDocumentNotice(
        error instanceof Error
          ? error.message
          : "Reviewer could not be assigned.",
      );
    }
  };
  const filteredUsers = userRows.filter(
    (member) => {
      const accountStatus = !member.active
        ? "Inactive"
        : member.availability_status === "On Leave"
          ? "On Leave"
          : "Active";
      return (
        `${member.name} ${member.email} ${member.division}`
          .toLowerCase()
          .includes(userSearch.toLowerCase()) &&
        (userRoleFilter === "All" || member.role === userRoleFilter) &&
        (userWorkspaceTab !== "Users" || userStatusFilter === "All" || accountStatus === userStatusFilter) &&
        (userWorkspaceTab !== "Users" || userDivisionFilter === "All" || (member.division || "Unassigned") === userDivisionFilter)
      );
    },
  );
  const openUserEditor = (member?: ApiUser) => {
    if (member) {
      setUserEditor(member);
      setUserForm({
        name: member.name,
        email: member.email,
        role: member.role,
        division: member.division,
        supervisorId: member.supervisor_id || "",
        status: member.status,
        active: member.active,
      });
    } else {
      setUserEditor("new");
      setUserForm({
        name: "",
        email: "",
        role: "Researcher",
        division: "",
        supervisorId: "",
        status: "Available",
        active: true,
      });
    }
    setAccountSetupMessage("");
    setUserFormError("");
    setSavingUser(false);
  };
  const saveUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingUser) return;
    setSavingUser(true);
    setUserFormError("");
    try {
      if (userEditor === "new") {
        const created = await api.createUser(token, {
          name: userForm.name,
          email: userForm.email,
          role: userForm.role,
          division: userForm.division,
          supervisorId: userForm.supervisorId || null,
        });
        setCreatedAccount({
          id: created.id,
          name: created.name,
          email: created.email,
          setupEmailSent: created.setup_email_sent,
        });
        setAccountSetupMessage(created.setup_email_sent
          ? "The setup link was accepted by the email server. Inbox delivery is not confirmed."
          : "The account is created, but the setup email could not be sent. Check email settings and resend the link.");
        setUserNotice("Account created successfully.");
        setUserEditor(null);
      } else if (userEditor) {
        await api.updateUser(token, userEditor.id, {
          name: userForm.name,
          email: userForm.email,
          role: userForm.role,
          division: userForm.division,
          supervisorId: userForm.supervisorId || null,
          status: userForm.status,
          active: userForm.active,
        });
        setUserNotice("Account updated and audited.");
        setUserEditor(null);
      }
      setUserRows(await api.users(token));
    } catch (error) {
      setUserFormError(
        error instanceof Error ? error.message : "Account could not be saved.",
      );
    } finally {
      setSavingUser(false);
    }
  };
  const resendCreatedAccountSetup = async () => {
    if (!createdAccount || savingSetupLink) return;
    setSavingSetupLink(true);
    setAccountSetupMessage("");
    try {
      const result = await api.resetUserPassword(token, createdAccount.id, "setup");
      setCreatedAccount({ ...createdAccount, setupEmailSent: true });
      setAccountSetupMessage(result.message);
    } catch (error) {
      setAccountSetupMessage(error instanceof Error ? error.message : "The setup link could not be sent.");
    } finally {
      setSavingSetupLink(false);
    }
  };

  const resetMemberPassword = async (member: ApiUser) => {
    if (!canManageTeamUsers) {
      setUserNotice("You do not have authority to reset this account.");
      return;
    }
    const confirmed = window.confirm(
      `Send a secure password reset link to ${member.name} (${member.email})?\n\nThis will end all existing sessions. The link expires after 30 minutes and can only be used once.`,
    );
    if (!confirmed) return;
    try {
      setUserNotice(`Sending a secure reset link to ${member.name}...`);
      const result = await api.resetUserPassword(token, member.id, "reset");
      setUserNotice(result.message);
      setUserRows(await api.users(token));
    } catch (error) {
      setUserNotice(error instanceof Error ? error.message : "The password reset link could not be sent.");
    }
  };

  const auditLabel = (action: string) =>
    action
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const auditDescription = (item: AuditLog) => {
    const subject =
      item.entity_type === "session"
        ? "the system"
        : `${item.entity_type} record${item.entity_id ? ` ${item.entity_id.slice(0, 8)}` : ""}`;
    return `${item.user_name} performed "${auditLabel(item.action)}" on ${subject}.`;
  };
  const isSecurityAudit = (action: string) =>
    [
      "LOGIN_FAILED",
      "ROLE_CHANGED",
      "USER_PASSWORD_RESET",
      "USER_UPDATED",
      "USER_CREATED",
      "LOGOUT",
    ].includes(action);
  const exportAuditCsv = () => {
    const rows = [
      ["Date", "User", "Email", "Action", "Module", "Record", "Details"],
      ...auditRows.map((item) => [
        new Date(item.created_at).toISOString(),
        item.user_name,
        item.user_email || "",
        auditLabel(item.action),
        item.entity_type,
        item.entity_id || "",
        JSON.stringify(item.details),
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `psc-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setAuditNotice("Filtered audit records exported to CSV.");
  };
  const saveSystemSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingSettings(true);
    setSettingsNotice("");
    try {
      await api.updateSystemSettings(token, {
        ...systemForm,
        documentCategories: systemForm.documentCategories
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      });
      setSettingsData(await api.settings(token));
      setSettingsNotice(
        "System settings saved and recorded in the audit log. Runtime limits take effect after service restart.",
      );
    } catch (error) {
      setSettingsNotice(
        error instanceof Error
          ? error.message
          : "System settings could not be saved.",
      );
    } finally {
      setSavingSettings(false);
    }
  };
  const savePreferences = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingSettings) return;
    setSavingSettings(true);
    setSettingsNotice("");
    const requestedPreferences = { ...preferenceForm };

    // Device appearance is authoritative locally and is persisted before network sync.
    writeDeviceThemePreferences(requestedPreferences);
    setPreferenceForm(requestedPreferences);

    try {
      await api.updatePreferences(token, requestedPreferences);
      setSettingsNotice(
        `Theme saved: ${requestedPreferences.themeMode}. It will remain active across logout, login and refresh.`,
      );
    } catch {
      setSettingsNotice(
        `Theme saved on this device as ${requestedPreferences.themeMode}. Server synchronization can retry later.`,
      );
    } finally {
      setSavingSettings(false);
    }
  };
  const checkUpdates = async () => {
    setCheckingUpdates(true);
    setSettingsNotice("");
    try {
      setUpdateStatus(await api.settingsUpdateStatus(token));
      setSettingsNotice(
        "Installed components checked successfully. No update was downloaded or installed.",
      );
    } catch (error) {
      setSettingsNotice(
        error instanceof Error
          ? error.message
          : "Update status could not be checked.",
      );
    } finally {
      setCheckingUpdates(false);
    }
  };
  const sendTestEmail = async () => {
    if (!user) return;
    setTestingEmail(true);
    setSettingsNotice("");
    try {
      const result = await api.sendTestEmail(token, user.email);
      setSettingsNotice(result.message);
    } catch (error) {
      setSettingsNotice(
        error instanceof Error
          ? error.message
          : "Test email could not be sent.",
      );
    } finally {
      setTestingEmail(false);
    }
  };
  const loadResearchSectionAccess = async (projectId: string, sectionId: string) => {
    try {
      const access = await api.researchReportSectionAccess(token, projectId, sectionId);
      setResearchReportSectionAccess((current) => ({ ...current, [sectionId]: access }));
      return access;
    } catch (error) {
      const access = {
        can_edit: false,
        owner_id: null,
        owner_name: null,
        reviewer_id: null,
        reviewer_name: null,
        locked: false,
        reason: error instanceof Error
          ? `Section permissions could not be verified (${error.message}). Editing remains disabled.`
          : "Section permissions could not be verified. Editing remains disabled.",
      };
      setResearchReportSectionAccess((current) => ({ ...current, [sectionId]: access }));
      return access;
    }
  };
  const saveResearchSectionStatus = async (
    status: ResearchReportSection["status"],
  ) => {
    if (!selectedResearch || !selectedReportSection) return;
    if (status === "Ready for Review" && !selectedReportSection.reviewer_id) {
      setResearchWorkspaceNotice(
        "Select the section reviewer before marking it ready for review.",
      );
      return;
    }
    try {
      setReportSaving(true);
      await api.updateResearchReportSection(
        token,
        selectedResearch.id,
        selectedReportSection.id,
        {
          content: reportContent,
          status,
          ownerId: selectedReportSection.owner_id,
          reviewerId: selectedReportSection.reviewer_id,
        },
      );
      const refreshed = await api.researchReport(token, selectedResearch.id);
      setResearchReport(refreshed);
      const current = refreshed.find(
        (section) => section.id === selectedReportSection.id,
      );
      if (current) {
        setSelectedReportSection(current);
        setReportContent(current.content || "");
      }
      setResearchActivity(
        await api.researchActivity(token, selectedResearch.id),
      );
      setNotifications(await api.notifications(token));
      setResearchWorkspaceNotice(
        status === "Approved"
          ? `“${selectedReportSection.title}” approved.`
          : status === "Ready for Review"
            ? `“${selectedReportSection.title}” sent to ${selectedReportSection.reviewer_name || "the assigned reviewer"} with an action notification.`
            : `“${selectedReportSection.title}” returned to ${status}.`,
      );
    } catch (error) {
      setResearchWorkspaceNotice(
        error instanceof Error
          ? error.message
          : "Report section status could not be updated.",
      );
    } finally {
      setReportSaving(false);
    }
  };
  const saveResearchSectionDraft = async (
    contentOverride?: string,
    persistRepository = false,
  ) => {
    researchSectionSaveErrorRef.current = null;
    if (!selectedResearch || !selectedReportSection) {
      const message = "No research project or report section is selected. Reopen the section and try again.";
      researchSectionSaveErrorRef.current = message;
      setResearchWorkspaceNotice(message);
      return false;
    }
    const access = await loadResearchSectionAccess(selectedResearch.id, selectedReportSection.id);
    if (!access.can_edit) {
      const reason = access.reason || "You do not have permission to edit this report section.";
      researchSectionSaveErrorRef.current = reason;
      setResearchWorkspaceNotice(reason);
      return false;
    }    const contentToSave =
      typeof contentOverride === "string" ? contentOverride : reportContent;
    try {
      setReportSaving(true);
      const draftStatus: ResearchReportSection["status"] = contentToSave.trim()
        ? "In Progress"
        : "Draft";
      const savedSection = await api.updateResearchReportSection(
        token,
        selectedResearch.id,
        selectedReportSection.id,
        {
          content: contentToSave,
          status: draftStatus,
          ownerId: selectedReportSection.owner_id,
          reviewerId: selectedReportSection.reviewer_id,
          persistDraft: persistRepository,
        },
      );
      researchRepositorySyncResultRef.current = persistRepository ? {
        status: savedSection.repository_sync_status || (savedSection.repository_document_id ? "done" : "pending"),
        message: savedSection.repository_sync_message,
        documentId: savedSection.repository_document_id,
        version: savedSection.repository_version,
      } : null;
      if (
        persistRepository &&
        savedSection.repository_document_id &&
        savedSection.repository_version
      ) {
        setResearchDraftRepositoryReceipt({
          documentId: savedSection.repository_document_id,
          version: savedSection.repository_version,
        });
      }
      let refreshWarning = "";
      try {
        const refreshed = await api.researchReport(token, selectedResearch.id);
        setResearchReport(refreshed);
        const current = refreshed.find((section) => section.id === selectedReportSection.id);
        if (current) {
          setSelectedReportSection(current);
          setReportContent(current.content || "");
        }
      } catch {
        refreshWarning = " The section was saved, but the latest report data could not be refreshed.";
      }
      try {
        setResearchActivity(await api.researchActivity(token, selectedResearch.id));
      } catch {
        refreshWarning += " Research activity could not be refreshed.";
      }
      const syncResult = researchRepositorySyncResultRef.current;
      const repositoryPending = Boolean(persistRepository && syncResult?.status && syncResult.status !== "done");
      setResearchWorkspaceNotice(persistRepository
        ? (repositoryPending
          ? (syncResult?.message || "Section saved. Repository synchronization is queued for automatic retry.")
          : `Draft saved for “${selectedReportSection.title}” and synchronized to the Document Repository. It has not been submitted for review.`) + refreshWarning
        : `Changes saved for “${selectedReportSection.title}”.` + refreshWarning);
      return true;
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : persistRepository
          ? "The Repository draft could not be saved."
          : "The section changes could not be saved.";
      researchSectionSaveErrorRef.current = message;
      setResearchWorkspaceNotice(message);
      return false;
    } finally {
      setReportSaving(false);
    }
  };

  const submitCompleteResearchReport = async () => {
    if (!selectedResearch || !researchDraftReviewerId) return;
    if (!researchSources.length && !researchRepositoryDocuments.length) {
      setResearchTab("Resources");
      setResearchWorkspaceNotice("Before submission, add a controlled research source or link a published Repository document. Your report remains an editable draft.");
      return;
    }
    try {
      setResearchReportSubmitting(true);
      const assignedReviewerName =
        eligibleResearchReviewers.find((reviewer) => reviewer.id === researchDraftReviewerId)?.name ||
        selectedResearch.reviewers?.find((reviewer) => reviewer.reviewer_id === researchDraftReviewerId)?.name ||
        "the assigned reviewer";

      if (
        canChooseResearchReviewer &&
        !assignedResearchReviewerIds.has(researchDraftReviewerId)
      ) {
        const nextReviewerIds = [
          ...new Set([
            ...(selectedResearch.reviewers || []).map(
              (reviewer) => reviewer.reviewer_id,
            ),
            researchDraftReviewerId,
          ]),
        ];
        await api.updateResearchReviewers(
          token,
          selectedResearch.id,
          nextReviewerIds,
        );
        const refreshedProjects = await api.research(token);
        setResearchRows(refreshedProjects);
        setSelectedResearch(
          refreshedProjects.find(
            (item) => item.id === selectedResearch.id,
          ) || selectedResearch,
        );
      }

      await api.submitResearchReport(token, selectedResearch.id, {
        title: `${selectedResearch.title} — Research Report`,
        reviewerId: researchDraftReviewerId,
      });
      setResearchTab("Review");
      window.history.replaceState({}, "", `/research/${selectedResearch.id}/review`);
      setResearchReportVersions(await api.researchReportVersions(token, selectedResearch.id));
      setResearchReport(await api.researchReport(token, selectedResearch.id));
      const projects = await api.research(token);
      setResearchRows(projects);
      setSelectedResearch(projects.find((item) => item.id === selectedResearch.id) || selectedResearch);
      setResearchActivity(await api.researchActivity(token, selectedResearch.id));
      setNotifications(await api.notifications(token));
      setResearchWorkspaceNotice(`Research report submitted as a locked version. The project is now Under Review and awaits ${assignedReviewerName}’s decision.`);
    } catch (error) {
      setResearchWorkspaceNotice(error instanceof Error ? error.message : "Research report could not be submitted.");
    } finally {
      setResearchReportSubmitting(false);
    }
  };

  const decideCompleteResearchReport = async (decision: "Approved" | "Changes Requested" | "Rejected") => {
    if (!selectedResearch || !researchReportVersions[0]) return;
    try {
      setResearchReviewDecisionSubmitting(true);
      await api.decideResearchReport(token, selectedResearch.id, researchReportVersions[0].id, {
        decision,
        comments: researchReportReviewComments.trim(),
      });
      setResearchReportReviewComments("");
      setResearchReportVersions(await api.researchReportVersions(token, selectedResearch.id));
      const refreshed = await api.researchReport(token, selectedResearch.id);
      setResearchReport(refreshed);
      if (selectedReportSection) {
        const current = refreshed.find((row) => row.id === selectedReportSection.id);
        if (current) { setSelectedReportSection(current); setReportContent(current.content || ""); }
      }
      const refreshedProjects = await api.research(token);
      setResearchRows(refreshedProjects);
      setSelectedResearch(
        refreshedProjects.find((item) => item.id === selectedResearch.id) ||
          selectedResearch,
      );
      setResearchActivity(await api.researchActivity(token, selectedResearch.id));
      setNotifications(await api.notifications(token));
      let reviewOutcomeNotice =
        decision === "Approved"
          ? "Research report approved."
          : decision === "Changes Requested"
            ? "Changes requested. The submitted version remains locked and a new editable revision is open."
            : "Research report rejected. The rejected version remains preserved in history and a new editable revision is open.";
      const researchNextPerson = selectedResearch.lead_name || "Research Lead";
      if (decision === "Approved") {
        try {
          const publication = await api.generateResearchReport(token, selectedResearch.id, {
            title: `${selectedResearch.title} — Final Research Report`,
            classification: "Official",
            templateId: null,
            mode: "Final",
            knowledgeIds: researchSupportingDocumentIds,
          });
          reviewOutcomeNotice = publication.repository_document_id
            ? `Research report approved and published to the Document Repository as “${publication.repository_document_title || publication.reference}”.`
            : "Research report approved and final report generated, but no Repository record was returned. Use Generate final report to retry publication.";
          setResearchFinalGenerationNotice(reviewOutcomeNotice);
          const refreshResults = await Promise.allSettled([
            api.generatedDocuments(token, "Research", selectedResearch.id),
            api.documents(token),
            api.knowledge(token),
            api.research(token),
          ]);
          if (refreshResults[0].status === "fulfilled") setWorkspaceDocuments(refreshResults[0].value);
          if (refreshResults[1].status === "fulfilled") setDocumentRows(refreshResults[1].value);
          if (refreshResults[2].status === "fulfilled") setKnowledgeRows(refreshResults[2].value);
          if (refreshResults[3].status === "fulfilled") {
            setResearchRows(refreshResults[3].value);
            const completed = refreshResults[3].value.find((item) => item.id === selectedResearch.id);
            if (completed) setSelectedResearch(completed);
          }
        } catch (publicationError) {
          const reason = publicationError instanceof Error
            ? publicationError.message
            : "The approved report could not be published automatically.";
          reviewOutcomeNotice = !researchSources.length && !researchRepositoryDocuments.length
            ? `Research report approved, but final publication needs controlled evidence. Open Resources, add a controlled source or link a published Repository document, then return to Review and use Generate Final Report to retry. Details: ${reason}`
            : `Research report approved, but automatic Repository publication could not complete: ${reason} Resolve the listed issue, then use Generate Final Report to retry.`;
          setResearchFinalGenerationNotice(reviewOutcomeNotice);
        }
      }
      setResearchWorkspaceNotice(reviewOutcomeNotice);
      const published = decision === "Approved" && reviewOutcomeNotice.includes("published to the Document Repository");
      setWorkflowDecision({
        title: decision === "Approved" ? "Research report approved" : decision === "Rejected" ? "Research report rejected" : "Changes requested",
        outcome: reviewOutcomeNotice,
        nextAction: decision === "Approved"
          ? published ? "No further review action is required. The final report is available in the Document Repository." : "The Research Lead or a research manager must resolve the publication requirement and use Generate Final Report to finish the workflow."
          : decision === "Rejected"
            ? `${researchNextPerson} must revise the report in the new editable version and submit it again if the work is to continue. The rejected version remains locked in history.`
            : `${researchNextPerson} must address the review comments in the editable revision and submit a new version for review.`,
        ...(decision === "Approved" && !published ? {continueLabel:"Open finalisation",onContinue:()=>setResearchTab("Review")} : {}),
      });
    } catch (error) {
      setResearchWorkspaceNotice(error instanceof Error ? error.message : "Reviewer decision could not be recorded.");
    } finally {
      setResearchReviewDecisionSubmitting(false);
    }
  };

  const generateApprovedResearchFinalReport = async () => {
    if (!selectedResearch) {
      setResearchFinalGenerationNotice("No Research project is open. Re-open the approved Research project and try again.");
      return;
    }
    if (!latestApprovedResearchVersion) {
      setResearchFinalGenerationNotice("Final publication is unavailable because there is no approved locked Research report version.");
      return;
    }
    if (!canGenerateApprovedResearchFinal) {
      setResearchFinalGenerationNotice(
        `Only ${latestApprovedResearchVersion.reviewed_by_name || latestApprovedResearchVersion.reviewer_name || "the recorded approver"} can publish this approved Research report.`,
      );
      return;
    }
    const projectId = selectedResearch.id;
    try {
      setResearchReportGenerating(true);
      setResearchFinalGenerationNotice("Publication request started. Generating the immutable final DOCX and saving it to the Document Repository…");
      const generated = await api.generateResearchReport(
        token,
        projectId,
        {
          title: `${selectedResearch.title} — Final Research Report`,
          classification: "Official",
          // Final publication must not depend on stale editor/template state.
          // The backend resolves the active governed Research template.
          templateId: null,
          mode: "Final",
          knowledgeIds: researchSupportingDocumentIds,
        },
      );
      const completedMessage = generated.repository_document_id
        ? `Final report ${generated.reference} published to the Document Repository. Research completed successfully.`
        : `Final report ${generated.reference} generated. Research completed successfully.`;

      setResearchFinalGenerationNotice(completedMessage);
      setResearchWorkspaceNotice(completedMessage);
      setKnowledgeNotice(completedMessage);

      const completedProject = {
        ...selectedResearch,
        status: "Completed" as const,
      };
      setResearchRows((current) =>
        current.map((item) =>
          item.id === projectId ? completedProject : item,
        ),
      );
      setSelectedResearch(completedProject);

      const refreshResults = await Promise.allSettled([
        api.generatedDocuments(token, "Research", projectId),
        api.researchActivity(token, projectId),
        api.documents(token),
        api.knowledge(token),
        api.research(token),
        api.notifications(token),
      ]);

      const [
        generatedResult,
        activityResult,
        documentsResult,
        knowledgeResult,
        projectsResult,
        notificationsResult,
      ] = refreshResults;

      if (generatedResult.status === "fulfilled")
        setWorkspaceDocuments(generatedResult.value);
      if (activityResult.status === "fulfilled")
        setResearchActivity(activityResult.value);
      if (documentsResult.status === "fulfilled")
        setDocumentRows(documentsResult.value);
      if (knowledgeResult.status === "fulfilled")
        setKnowledgeRows(knowledgeResult.value);
      if (projectsResult.status === "fulfilled") {
        setResearchRows(projectsResult.value);
        const refreshedProject = projectsResult.value.find((item) => item.id === projectId);
        if (refreshedProject) setSelectedResearch(refreshedProject);
      }
      if (notificationsResult.status === "fulfilled")
        setNotifications(notificationsResult.value);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Controlled report could not be generated.";
      setResearchFinalGenerationNotice(message);
      setResearchWorkspaceNotice(message);
    } finally {
      setResearchReportGenerating(false);
    }
  };

  const normalizedGlobalQuery = query.trim().toLocaleLowerCase();
  const globalSearchResults = normalizedGlobalQuery.length < 2
    ? []
    : [
        ...assignmentRows.map((item) => ({
          key: `assignment-${item.id}`,
          type: "Assignment",
          title: item.title,
          detail: `${item.status} · ${item.division || "No division"}`,
          search: `${item.title} ${item.description || ""} ${item.status} ${item.division || ""}`,
          open: () => { setQuery(""); setActive("Assignments"); void openAssignmentDetails(item); },
        })),
        ...researchRows.map((item) => ({
          key: `research-${item.id}`,
          type: "Research",
          title: item.title,
          detail: `${item.status} · ${item.lead_name || "No lead"}`,
          search: `${item.title} ${item.summary || ""} ${item.research_question || ""} ${item.lead_name || ""}`,
          open: () => { setQuery(""); void openResearchWorkspace(item); },
        })),
        ...documentRows.map((item) => ({
          key: `document-${item.id}`,
          type: "Document",
          title: item.title,
          detail: `${item.status} · ${item.category || "Repository"}`,
          search: `${item.title} ${item.description || ""} ${item.category || ""} ${item.status}`,
          open: () => { setQuery(""); setActive("Document Repository"); void openDocumentVersions(item); },
        })),
        ...noticeRows.map((item) => ({
          key: `notice-${item.id}`,
          type: "Notice",
          title: item.title,
          detail: item.status || "Notice Board",
          search: `${item.title} ${item.body || ""} ${item.status || ""}`,
          open: () => { setQuery(""); setActive("Notice Board"); },
        })),
      ]
        .filter((item) => item.search.toLocaleLowerCase().includes(normalizedGlobalQuery))
        .slice(0, 8);

  if (!user) {
    return (
      <ThemeProvider
        mode={preferenceForm.themeMode}
        accent={preferenceForm.accentColor}
      >
        <div className="login-theme-boundary">
          <div className="login-page">
        <div className="login-glow one" />
        <div className="login-glow two" />
        <section className="login-brand">
          <div className="dual-logos">
            <img src="/psc-logo.png" alt="Public Service Commission logo" />
            <img src="/gok-logo.png" alt="Government of Kenya coat of arms" />
          </div>
          <p className="login-kicker">PUBLIC SERVICE COMMISSION | KENYA</p>
          <h1>Research Department</h1>
          <h2>Assignment & Knowledge Management System</h2>
          <div className="login-purpose">
            <article><span>OUR VISION</span><strong>A values-driven, citizen-centric public service.</strong></article>
            <article><span>OUR MISSION</span><p>To ensure an efficient, effective, ethical and inclusive public service for delivery of quality services to the citizenry.</p></article>
            <div><span>CORE VALUES</span><p>{["Integrity","Transparency & Accountability","Innovation & Agility","Diversity, Equity & Inclusivity","Responsiveness","Teamwork"].map(value=><b key={value}>{value}</b>)}</p></div>
          </div>
        </section>
        <section className="login-card">
          <div className="login-time">
            <AppLiveClock variant="login" />
          </div>
          <p className="login-kicker">MEMBER ACCESS</p>
          <h2>Welcome back</h2>
          <p>Sign in using your official PSC email address.</p>
          <form onSubmit={signIn}>
            <label>
              Staff account
              <input
                type="email"
                list="app2-login-directory"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Search or enter an official email"
                autoComplete="username"
                required
              />
              <datalist id="app2-login-directory">
                {loginDirectory.map((member) => (
                  <option key={member.email} value={member.email}>{member.name} — {member.role}</option>
                ))}
              </datalist>
              <small className="login-account-help">Choose an active REDESY account or enter an official email address.</small>
            </label>
            <label className="login-password-field">
              Password
              <span><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required/><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={()=>setShowPassword(value=>!value)}>{showPassword ? "Hide" : "Show"}</button></span>
            </label>
            <div className="form-options">
              <label>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />{" "}
                Remember me
              </label>
              <button
                type="button"
                onClick={() => {
                  setPasswordMode("forgot");
                  setPasswordMessage("");
                  setResetToken("");
                }}
              >
                Forgot password?
              </button>
            </div>
            {sessionMessage && (
              <div className="session-message" role="status">
                {sessionMessage}
              </div>
            )}
            {loginError && (
              <div className="login-error" role="alert">
                <strong>Login unsuccessful</strong>
                {loginError}
              </div>
            )}
            <button className="sign-in" type="submit" disabled={loggingIn}>
              {loggingIn ? "Connecting securely..." : "Sign in securely"}{" "}
              {!loggingIn && <Icon name="arrow" />}
            </button>
          </form>
          {loginDirectory.length > 0 && (
            <div className="login-directory-status" aria-live="polite">
              <strong>{loginDirectory.length} active staff accounts available</strong>
              <span>Usernames are populated from REDESY. Passwords remain private and are never displayed.</span>
            </div>
          )}
        </section>
        {passwordMode === "forgot" && (
          <div className="modal-backdrop">
            <section
              className="profile-modal password-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <button className="close" onClick={() => setPasswordMode(null)}>
                ×
              </button>
              <h2>{resetToken ? "Set a new password" : "Reset password"}</h2>
              <p>
                {resetToken
                  ? "Choose a new password to finish securing your PSC account."
                  : "Request a secure, single-use reset link for your official PSC account."}
              </p>
              <form onSubmit={resetPassword}>
                {!resetToken && (
                  <label>
                    Email address
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </label>
                )}
                {resetToken && (
                  <>
                    <label>
                      New password
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        minLength={10}
                        required
                      />
                    </label>
                    <label>
                      Confirm new password
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        minLength={10}
                        required
                      />
                    </label>
                  </>
                )}
                {passwordMessage && (
                  <div className="session-message" role="status">
                    {passwordMessage}
                  </div>
                )}
                {!resetToken ? (
                  <button
                    className="sign-in"
                    type="button"
                    disabled={savingPassword}
                    onClick={requestReset}
                  >
                    {savingPassword
                      ? "Sending reset link..."
                      : "Send password reset link"}
                  </button>
                ) : (
                  <button
                    className="sign-in"
                    type="submit"
                    disabled={savingPassword}
                  >
                    {savingPassword ? "Updating..." : "Set new password"}
                  </button>
                )}
              </form>
            </section>
          </div>
        )}
          </div>
        </div>
      </ThemeProvider>
    );
  }

  const currentWorkspace = workspaceMeta[active === "Dashboard" && dashboardModule ? dashboardModule : active] || workspaceMeta.Dashboard;

  return (
    <ThemeProvider
      mode={preferenceForm.themeMode}
      accent={preferenceForm.accentColor}
    >
      <DateInputPolicy />
      <AppShell
        compact={preferenceForm.compactLayout}
        collapsed={sidebarCollapsed}
      >
        <aside className={menuOpen ? "sidebar open" : "sidebar"}>
          <div className="brand">
            <img src="/psc-logo.png" alt="Public Service Commission logo" />
            <button
              className="sidebar-collapse"
              type="button"
              aria-label={
                sidebarCollapsed ? "Expand navigation" : "Collapse navigation"
              }
              aria-expanded={!sidebarCollapsed}
              onClick={() => setSidebarCollapsed((value) => !value)}
            >
              {sidebarCollapsed ? ">" : "<"}
            </button>
            <div>
              <strong>PUBLIC SERVICE COMMISSION</strong>
              <span>KENYA</span>
              <small>HONOUR | COMMITMENT | TRUST</small>
            </div>
          </div>
          <nav aria-label="Main navigation">
            {navGroups.map((group) => {
              const visible = group.items
                .map((label) => navItems.find(([, item]) => item === label))
                .filter((item): item is [IconName, string] =>
                  Boolean(item && canSeeNavigationItem(item[1])),
                );
              return visible.length ? (
                <section
                  className="nav-section"
                  key={group.label}
                  aria-labelledby={`nav-${group.label.toLowerCase()}`}
                >
                  <span
                    className="nav-section-title"
                    id={`nav-${group.label.toLowerCase()}`}
                  >
                    {group.label}
                  </span>
                  {visible.map(([icon, label]) => {
                    const navigationCount =
                      Number(
                        pulse.data?.cardCounts?.[label] ??
                          (label === "Needs My Attention"
                            ? pulse.data?.attention.length
                            : label === "Notifications"
                              ? pulse.data?.unread.length
                              : label === "Calendar"
                                ? pulse.data?.calendar.length
                                : pulse.data?.modules[label]?.counts?.All) ??
                          0
                      );
                    const navigationBadge =
                      Number(pulse.data?.badges[label] || 0);
                    const navigationUnread =
                      label === "Notifications"
                        ? Number(pulse.data?.unread.length || 0)
                        : label === "Messages"
                          ? Number(messageUnreadCount || 0)
                          : navigationBadge;
                    const navigationHighlighted =
                      label === "Needs My Attention"
                        ? navigationCount > 0
                        : navigationUnread > 0;
                    return (
                      <button
                        key={label}
                        title={navigationDescriptions[label]}
                        data-tooltip={navigationDescriptions[label]}
                        aria-current={(active === "Dashboard" ? dashboardModule || "Dashboard" : active) === label ? "page" : undefined}
                        className={`${(active === "Dashboard" ? dashboardModule || "Dashboard" : active) === label ? "active" : ""} ${navigationHighlighted ? "pulse-nav-highlight" : ""}`}
                        onClick={() => navigateSidebar(label)}
                      >
                        <Icon name={icon} />
                        <span>{navigationDisplayLabel(label)}</span>
                        {!!navigationCount && <b className="pulse-nav-badge" title={`${navigationCount} items in the dashboard card`}>{navigationCount}</b>}
                      </button>
                    );
                  })}
                </section>
              ) : null;
            })}
            {user && (
              <section
                className="nav-section nav-self-service"
                aria-labelledby="nav-self-service"
              >
                <span className="nav-section-title" id="nav-self-service">Self Service</span>
                <button
                  type="button"
                  title={navigationDescriptions.Leave}
                  data-tooltip={navigationDescriptions.Leave}
                  aria-current={active === "Leave" ? "page" : undefined}
                  className={active === "Leave" ? "active" : ""}
                  onClick={() => navigateSidebar("Leave")}
                >
                  <Icon name="calendar" />
                  <span>Leave</span>
                </button>
              </section>
            )}
          </nav>
          <section className="quick-access">
            <h3>Quick Access</h3>
            {(
              [
                ["plus", "Create Assignment"],
                ["upload", "Upload Document"],
                ["knowledge", "Add Knowledge"],
                ["documents", "New Research"],
              ] as [IconName, string][]
            )
              .filter(([, label]) => label !== "Create Assignment" || isManager)
              .map(([icon, label]) => (
                <button
                  key={label}
                  title={
                    label === "Create Assignment"
                      ? "Open the assignment form and allocate work to staff."
                      : label === "Upload Document"
                        ? "Open Documents and select a file for controlled review."
                        : label === "Add Knowledge"
                          ? "Open the knowledge upload form for a new institutional record."
                          : "Open the form for a new research project."
                  }
                  onClick={() => {
                    if (label === "Create Assignment") {
                      setActive("Assignments");
                      startAssignment();
                    } else if (label === "Upload Document") {
                      setActive("Documents");
                      openKnowledgeUpload();
                    } else if (label === "Add Knowledge") {
                      setActive("Knowledge Repository");
                      openKnowledgeUpload();
                    } else if (label === "New Research") {
                      setActive("Research Repository");
                      setResearchOpen(true);
                    }
                    setMenuOpen(false);
                  }}
                >
                  <Icon name={icon} />
                  {label}
                </button>
              ))}
          </section>
        </aside>

        {sidebarCollapsed && (
          <button
            className="sidebar-restore"
            type="button"
            aria-label="Show full side menu"
            title="Show full side menu"
            onClick={() => {
              setSidebarCollapsed(false);
              setMenuOpen(true);
            }}
          >
            <Icon name="menu" />
            <span>Show menu</span>
          </button>
        )}

        <a className="skip-to-main" href="#app-main-content">Skip to main content</a>
        <main id="app-main-content" tabIndex={-1}>
          <header className="topbar">
            <button
              className="menu-button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle navigation"
            >
              <Icon name="menu" />
            </button>
            <div className="title">
              {active === "Dashboard" ? <>
                <h1>Good {now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening"}, {user.name.split(" ")[0]}</h1>
                <p>{now.toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {user.role}</p>
              </> : <>
                <h1>RESEARCH DEPARTMENT</h1>
                <p>ASSIGNMENT & KNOWLEDGE MANAGEMENT SYSTEM</p>
              </>}
            </div>
            <div className="header-actions">
              {active === "Dashboard" && <div className="header-dashboard-live">
                <span className={Boolean(pulse.error) ? "failed" : "live"}><i/>{Boolean(pulse.error) ? "Refresh failed" : "Live"}</span>
                <small>{pulse.data ? `Updated ${new Date(pulse.data.generatedAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}` : "Loading..."}</small>
                <button onClick={pulse.refresh}>Refresh</button>
              </div>}
              <AppLiveClock variant="header" />
              <div className="header-search-wrap">
                <label className="header-search">
                  <Icon name="search" />
                  <input
                    aria-label="Search REDESY"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && globalSearchResults[0]) globalSearchResults[0].open();
                      if (event.key === "Escape") setQuery("");
                    }}
                    placeholder="Search REDESY"
                    autoComplete="off"
                  />
                </label>
                {normalizedGlobalQuery.length >= 2 && (
                  <div className="header-search-results" role="listbox" aria-label="REDESY search results">
                    {globalSearchResults.map((result) => (
                      <button key={result.key} type="button" role="option" onClick={result.open}>
                        <span><small>{result.type}</small><strong>{result.title}</strong></span>
                        <em>{result.detail}</em>
                      </button>
                    ))}
                    {!globalSearchResults.length && <p>No matching assignments, research, documents or notices.</p>}
                  </div>
                )}
              </div>
              <PulseBell data={pulse.data} arrival={pulse.arrival} onNavigate={()=>navigateTo("Notifications")} onOpen={async(id)=>{const rows=await api.notifications(token);setNotifications(rows);const item=rows.find(n=>n.id===id);if(item){await navigateNotification(item);if(item.entity_id)await resolveActionNotifications(item.entity_type||"",item.entity_id);}}} />
              <button
                className="user"
                title="Open your profile menu to review access rights, change your password or sign out."
                aria-expanded={profileMenuOpen}
                onClick={() => setProfileMenuOpen((open) => !open)}
              >
                <span className="user-icon">{user.initials}</span>
                <div>
                  <strong>{user.name}</strong>
                  <small>{user.role}</small>
                </div>
                <span aria-hidden="true">&#9662;</span>
              </button>
            </div>
          </header>

          <div
            className={`dashboard-content ${active === "Dashboard" ? "dashboard-active" : active === "Assignments" ? "assignments-active" : active === "Document Repository" || active === "Documents" ? "documents-active" : active === "Research Repository" ? "research-active" : active === "AI Researcher" ? "ai-research-active" : active === "Felix Administration" ? "felix-admin-active" : active === "Notifications" ? "notifications-active" : active === "Messages" ? "messages-active" : active === "Notice Board" ? "notice-board-active" : active === "Calendar" ? "calendar-active" : active === "Meetings" ? "meetings-active" : active === "Reports & Analytics" ? "reports-active" : active === "Leave" ? "users-active" : active === "Team & Users" ? "users-active" : active === "Audit Logs" ? "audit-active" : active === "Settings" ? "settings-active" : ""}`}
          >
            {active !== "Profile" && active !== "Dashboard" && active !== "Messages" && active !== "Meetings" && (
              <WorkspaceHeader
                eyebrow={active === "Dashboard" ? "REDESY" : "WORKSPACE"}
                title={currentWorkspace.title}
                subtitle={currentWorkspace.subtitle}
                icon={<Icon name={currentWorkspace.icon} />}
                breadcrumbs={
                  active === "Dashboard"
                    ? [{ label: "Dashboard" }]
                    : [
                        {
                          label: "Dashboard",
                          onClick: () => navigateTo("Dashboard"),
                        },
                        { label: currentWorkspace.title },
                      ]
                }
                onBack={
                  active === "Dashboard"
                    ? undefined
                    : () => navigateTo("Dashboard")
                }
                onDashboard={
                  active === "Dashboard"
                    ? undefined
                    : () => navigateTo("Dashboard")
                }
                onClose={
                  active === "Dashboard"
                    ? undefined
                    : () => navigateTo("Dashboard")
                }
              />
            )}
            {active === "Reviews & Approvals" && (
              <ReviewsApprovalsWorkspace
                token={token}
                currentUserId={user?.id || ""}
                isManager={isManager}
                onDomainDecisionComplete={() => {
                  void refreshDashboard();
                  void refreshNotifications();
                  void api.users(token).then(setUserRows).catch(() => undefined);
                }}
                reviews={personalDashboardReviews}
                history={personalReviewHistory}
                finalizations={personalDashboardFinalizations}
                management={dashboardData?.management || null}
                onOpen={openDashboardWork}
                onOpenRepositoryReview={openRepositoryReview}
              />
            )}

            <section className="settings-management-view">
              <div className="assignment-page-head">
                <div>
                  <p>SETTINGS</p>
                  <h2>System configuration and preferences</h2>
                  <span>
                    Administrator controls are separated from your personal
                    notification and display preferences.
                  </span>
                </div>
              </div>
              {settingsNotice && (
                <div className="session-message">{settingsNotice}</div>
              )}
              <div className="settings-tabs" role="tablist">
                {(
                  [
                    "General",
                    "Themes",
                    "Email Notifications",
                    "Maintenance",
                    "Updates",
                  ] as const
                )
                  .filter(
                    (tab) =>
                      !["Maintenance", "Updates"].includes(tab) ||
                      user?.role === "System Admin",
                  )
                  .map((tab) => (
                    <button
                      role="tab"
                      title={navigationDescriptions[tab]}
                      data-tooltip={navigationDescriptions[tab]}
                      aria-selected={settingsTab === tab}
                      className={settingsTab === tab ? "active" : ""}
                      key={tab}
                      onClick={() => setSettingsTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
              </div>
              {settingsData && (
                <>
                  {settingsTab === "Email Notifications" &&
                    user?.role === "System Admin" && (
                      <div
                        className={`email-delivery-banner ${emailDelivery?.ready ? "ready" : "pending"}`}
                      >
                        <div>
                          <strong>
                            {emailDelivery?.ready
                              ? "SMTP delivery ready"
                              : "SMTP delivery not yet active"}
                          </strong>
                          <span>
                            {emailDelivery?.ready
                              ? `${emailDelivery.provider || "SMTP"}  |  ${emailDelivery.host}:${emailDelivery.port}  |  ${emailDelivery.from}`
                              : "Configure Gmail or another approved SMTP transport in the backend environment, then restart the backend. Credentials stay server-side."}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={!emailDelivery?.ready || testingEmail}
                          onClick={sendTestEmail}
                        >
                          {testingEmail
                            ? "Sending..."
                            : "Send test email to me"}
                        </button>
                      </div>
                    )}
                  {settingsTab === "Email Notifications" && (
                    <div className="settings-grid email-notification-settings">
                      {user?.role === "System Admin" && (
                        <form
                          className="settings-panel"
                          onSubmit={saveSystemSettings}
                        >
                          <header>
                            <div>
                              <p>ADMINISTRATOR</p>
                              <h3>Email delivery policy</h3>
                            </div>
                            <span data-tooltip="This master switch controls workflow email. Delivery also requires an approved mail service.">
                              System-wide
                            </span>
                          </header>
                          <div
                            className={`maintenance-status ${systemForm.emailNotifications ? "normal" : "enabled"}`}
                          >
                            <strong>
                              {systemForm.emailNotifications
                                ? "Email notifications allowed"
                                : "Email notifications disabled"}
                            </strong>
                            <span>
                              {systemForm.emailNotifications
                                ? "Workflow emails may be delivered after the mail service is configured."
                                : "REDESY will continue creating in-app notifications only."}
                            </span>
                          </div>
                          <label className="setting-toggle">
                            <input
                              type="checkbox"
                              checked={systemForm.emailNotifications}
                              onChange={(event) =>
                                setSystemForm({
                                  ...systemForm,
                                  emailNotifications: event.target.checked,
                                })
                              }
                            />
                            <span>
                              <strong>Enable system email notifications</strong>
                              <small>
                                Allow assignment, review, approval, rejection
                                and security workflows to generate email
                                notices.
                              </small>
                            </span>
                          </label>
                          <label>
                            Reply and support address
                            <input
                              type="email"
                              value={systemForm.supportEmail}
                              onChange={(event) =>
                                setSystemForm({
                                  ...systemForm,
                                  supportEmail: event.target.value,
                                })
                              }
                              required
                            />
                          </label>
                          <button
                            className="settings-save"
                            disabled={savingSettings}
                          >
                            {savingSettings ? "Saving..." : "Save email policy"}
                          </button>
                        </form>
                      )}
                      <form
                        className="settings-panel"
                        onSubmit={savePreferences}
                      >
                        <header>
                          <div>
                            <p>PERSONAL</p>
                            <h3>My notification channels</h3>
                          </div>
                          <span data-tooltip="Your personal choice cannot override a system-wide email shutdown.">
                            Your account
                          </span>
                        </header>
                        <label className="setting-toggle">
                          <input
                            type="checkbox"
                            checked={preferenceForm.emailNotifications}
                            onChange={(event) =>
                              setPreferenceForm({
                                ...preferenceForm,
                                emailNotifications: event.target.checked,
                              })
                            }
                          />
                          <span>
                            <strong>Email notifications</strong>
                            <small>
                              Send important workflow updates to {user.email}{" "}
                              when system email delivery is available.
                            </small>
                          </span>
                        </label>
                        <label className="setting-toggle">
                          <input
                            type="checkbox"
                            checked={preferenceForm.importantEmailNotifications}
                            disabled={!preferenceForm.emailNotifications}
                            onChange={(event) =>
                              setPreferenceForm({
                                ...preferenceForm,
                                importantEmailNotifications: event.target.checked,
                              })
                            }
                          />
                          <span>
                            <strong>Immediate important emails</strong>
                            <small>
                              Email High-priority assignments, reviews, returned work,
                              overdue actions and urgent notices immediately.
                            </small>
                          </span>
                        </label>
                        <label className="setting-toggle">
                          <input
                            type="checkbox"
                            checked={preferenceForm.deadlineReminders}
                            disabled={!preferenceForm.emailNotifications}
                            onChange={(event) =>
                              setPreferenceForm({
                                ...preferenceForm,
                                deadlineReminders: event.target.checked,
                              })
                            }
                          />
                          <span>
                            <strong>Deadline reminder emails</strong>
                            <small>
                              Send one reminder the day before a deadline and one
                              first-overdue reminder while the work is still open.
                            </small>
                          </span>
                        </label>
                        <label className="setting-toggle">
                          <input
                            type="checkbox"
                            checked={preferenceForm.inAppNotifications}
                            onChange={(event) =>
                              setPreferenceForm({
                                ...preferenceForm,
                                inAppNotifications: event.target.checked,
                              })
                            }
                          />
                          <span>
                            <strong>In-app notifications</strong>
                            <small>
                              Keep a notification copy inside REDESY for
                              assignments, reviews and decisions.
                            </small>
                          </span>
                        </label>
                        <div className="email-event-list">
                          <strong>Important email events</strong>
                          <ul>
                            <li>Critical account and security notifications</li>
                            <li>New assignment, task or reviewer responsibility</li>
                            <li>Due-tomorrow and first-overdue reminders</li>
                            <li>Approval required, rejection or changes requested</li>
                            <li>Urgent institutional notices and governed actions</li>
                          </ul>
                        </div>
                        <button
                          className="settings-save"
                          disabled={savingSettings}
                        >
                          {savingSettings
                            ? "Saving..."
                            : "Save notification preferences"}
                        </button>
                      </form>
                    </div>
                  )}
                  {settingsTab === "General" && (
                    <div className="settings-grid">
                      {user?.role === "System Admin" && (
                        <form
                          className="settings-panel system-settings"
                          onSubmit={saveSystemSettings}
                        >
                          <header>
                            <div>
                              <p>ADMINISTRATOR</p>
                              <h3>Organization defaults</h3>
                            </div>
                            <span data-tooltip="Shared labels and document classifications used throughout REDESY.">
                              Application scope
                            </span>
                          </header>
                          <div className="form-pair">
                            <label>
                              Organization name
                              <input
                                value={systemForm.organizationName}
                                onChange={(event) =>
                                  setSystemForm({
                                    ...systemForm,
                                    organizationName: event.target.value,
                                  })
                                }
                                required
                                minLength={3}
                              />
                            </label>
                            <label>
                              Department name
                              <input
                                value={systemForm.departmentName}
                                onChange={(event) =>
                                  setSystemForm({
                                    ...systemForm,
                                    departmentName: event.target.value,
                                  })
                                }
                                required
                                minLength={3}
                              />
                            </label>
                          </div>
                          <label>
                            Support email
                            <input
                              type="email"
                              value={systemForm.supportEmail}
                              onChange={(event) =>
                                setSystemForm({
                                  ...systemForm,
                                  supportEmail: event.target.value,
                                })
                              }
                              required
                            />
                          </label>
                          <label>
                            Document categories
                            <textarea
                              value={systemForm.documentCategories}
                              onChange={(event) =>
                                setSystemForm({
                                  ...systemForm,
                                  documentCategories: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="setting-toggle">
                            <input
                              type="checkbox"
                              checked={systemForm.emailNotifications}
                              onChange={(event) =>
                                setSystemForm({
                                  ...systemForm,
                                  emailNotifications: event.target.checked,
                                })
                              }
                            />
                            <span>
                              <strong>System email notifications</strong>
                              <small>
                                Allow workflows to generate email notices when a
                                mail service is connected.
                              </small>
                            </span>
                          </label>
                          <button
                            className="settings-save"
                            disabled={savingSettings}
                          >
                            {savingSettings
                              ? "Saving..."
                              : "Save general settings"}
                          </button>
                        </form>
                      )}
                      <form
                        className="settings-panel preference-settings"
                        onSubmit={savePreferences}
                      >
                        <header>
                          <div>
                            <p>PERSONAL</p>
                            <h3>Notifications and security</h3>
                          </div>
                          <span data-tooltip="These choices apply only to your account.">
                            Personal scope
                          </span>
                        </header>
                        <label className="setting-toggle">
                          <input
                            type="checkbox"
                            checked={preferenceForm.inAppNotifications}
                            onChange={(event) =>
                              setPreferenceForm({
                                ...preferenceForm,
                                inAppNotifications: event.target.checked,
                              })
                            }
                          />
                          <span>
                            <strong>In-app notifications</strong>
                            <small>
                              Show assignments, decisions and system activity in
                              your inbox.
                            </small>
                          </span>
                        </label>
                        <label className="setting-toggle">
                          <input
                            type="checkbox"
                            checked={preferenceForm.emailNotifications}
                            onChange={(event) =>
                              setPreferenceForm({
                                ...preferenceForm,
                                emailNotifications: event.target.checked,
                              })
                            }
                          />
                          <span>
                            <strong>Email notifications</strong>
                            <small>
                              Receive email updates when the mail service is
                              configured.
                            </small>
                          </span>
                        </label>
                        <button
                          className="settings-save"
                          disabled={savingSettings}
                        >
                          {savingSettings ? "Saving..." : "Save my preferences"}
                        </button>
                        <div className="settings-account">
                          <h4>Account security</h4>
                          <p>
                            Change your password regularly and sign out from
                            shared devices.
                          </p>
                          <button
                            type="button"
                            onClick={() => setPasswordMode("change")}
                          >
                            Change my password
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                  {settingsTab === "Themes" && (
                    <form
                      className="settings-panel theme-settings"
                      onSubmit={savePreferences}
                    >
                      <header>
                        <div>
                          <p>APPEARANCE</p>
                          <h3>Theme and display</h3>
                        </div>
                        <span data-tooltip="Preview changes immediately, then save them to your account.">
                          Personal scope
                        </span>
                      </header>
                      <h4>Colour theme</h4>
                      <div className="theme-options">
                        {(
                          ["Dark", "Light", "System", "Gold Grey", "Navy Blue", "PSC Slate", "Low-Contrast Navy", "Executive Gold", "Sage Ivory"] as const
                        ).map((theme) => (
                          <button
                            type="button"
                            className={
                              preferenceForm.themeMode === theme
                                ? "selected"
                                : ""
                            }
                            onClick={() => updateDeviceAppearance({ themeMode: theme })}
                            key={theme}
                          >
                            <i
                              className={`theme-preview ${theme.toLowerCase().replaceAll(" ", "-")}`}
                            />
                            <strong>{theme === "Executive Gold" ? "PSC Executive" : theme}</strong>
                            <small>
                              {theme === "Navy Blue"
                                ? "Low-contrast, eye-friendly navy"
                                : theme === "Low-Contrast Navy"
                                  ? "Restrained dark institutional workspace"
                                : theme === "PSC Slate"
                                  ? "Professional light institutional workspace"
                                : theme === "Executive Gold"
                                  ? "Warm light workspace with refined gold accents"
                                : theme === "Sage Ivory"
                                  ? "Calm ivory workspace with comfortable sage accents"
                                : theme === "System"
                                  ? "Follow this device"
                                  : `${theme} dashboard`}
                            </small>
                          </button>
                        ))}
                      </div>
                      <h4>Accent colour</h4>
                      <div className="accent-options">
                        {(["Gold", "Blue", "Green"] as const).map((accent) => (
                          <button
                            type="button"
                            className={
                              preferenceForm.accentColor === accent
                                ? "selected"
                                : ""
                            }
                            onClick={() => updateDeviceAppearance({ accentColor: accent })}
                            key={accent}
                          >
                            <i className={accent.toLowerCase()} />
                            <span>{accent}</span>
                          </button>
                        ))}
                      </div>
                      <label className="setting-toggle">
                        <input
                          type="checkbox"
                          checked={preferenceForm.compactLayout}
                          onChange={(event) => updateDeviceAppearance({ compactLayout: event.target.checked })}
                        />
                        <span>
                          <strong>Compact layout</strong>
                          <small>
                            Use denser tables and shorter spacing on supported
                            screens.
                          </small>
                        </span>
                      </label>
                      <button
                        className="settings-save"
                        disabled={savingSettings}
                      >
                        {savingSettings ? "Saving..." : "Save theme"}
                      </button>
                    </form>
                  )}
                  {settingsTab === "Maintenance" &&
                    user?.role === "System Admin" && (
                      <>
                        <div className="settings-health">
                          <article>
                            <span>API service</span>
                            <strong className="healthy">
                              {settingsData.health.api}
                            </strong>
                          </article>
                          <article>
                            <span>PostgreSQL</span>
                            <strong className="healthy">
                              {settingsData.health.database}
                            </strong>
                          </article>
                          <article>
                            <span>Environment</span>
                            <strong>{settingsData.health.environment}</strong>
                          </article>
                          <article>
                            <span>Configured session</span>
                            <strong>
                              {settingsData.health.configured_session}
                            </strong>
                          </article>
                          <article>
                            <span>Runtime upload limit</span>
                            <strong>
                              {settingsData.health.configured_upload_limit_mb}{" "}
                              MB
                            </strong>
                          </article>
                          <article>
                            <span>Database time</span>
                            <strong>
                              {new Date(
                                settingsData.health.database_time,
                              ).toLocaleString("en-KE")}
                            </strong>
                          </article>
                        </div>
                        <form
                          className="settings-panel maintenance-settings"
                          onSubmit={saveSystemSettings}
                        >
                          <header>
                            <div>
                              <p>ADMINISTRATOR</p>
                              <h3>Maintenance and operational limits</h3>
                            </div>
                            <span data-tooltip="Use maintenance mode only during an approved service window. Runtime limits require a backend restart.">
                              Restricted controls
                            </span>
                          </header>
                          <div
                            className={`maintenance-status ${systemForm.maintenanceMode ? "enabled" : "normal"}`}
                          >
                            <strong>
                              {systemForm.maintenanceMode
                                ? "Maintenance mode prepared"
                                : "System operating normally"}
                            </strong>
                            <span>
                              {systemForm.maintenanceMode
                                ? "Save to record the planned maintenance state."
                                : "Users can access all available services."}
                            </span>
                          </div>
                          <label className="setting-toggle maintenance">
                            <input
                              type="checkbox"
                              checked={systemForm.maintenanceMode}
                              onChange={(event) =>
                                setSystemForm({
                                  ...systemForm,
                                  maintenanceMode: event.target.checked,
                                })
                              }
                            />
                            <span>
                              <strong>Maintenance mode</strong>
                              <small>
                                Record REDESY as undergoing planned maintenance.
                                Existing administrators retain access.
                              </small>
                            </span>
                          </label>
                          <div className="form-triple">
                            <label>
                              Session minutes
                              <input
                                type="number"
                                min={15}
                                max={1440}
                                value={systemForm.sessionMinutes}
                                onChange={(event) =>
                                  setSystemForm({
                                    ...systemForm,
                                    sessionMinutes: Number(event.target.value),
                                  })
                                }
                              />
                            </label>
                            <label>
                              Upload limit (MB)
                              <input
                                type="number"
                                min={1}
                                max={500}
                                value={systemForm.maxUploadMb}
                                onChange={(event) =>
                                  setSystemForm({
                                    ...systemForm,
                                    maxUploadMb: Number(event.target.value),
                                  })
                                }
                              />
                            </label>
                            <label>
                              Retention days
                              <input
                                type="number"
                                min={30}
                                max={7300}
                                value={systemForm.defaultRetentionDays}
                                onChange={(event) =>
                                  setSystemForm({
                                    ...systemForm,
                                    defaultRetentionDays: Number(
                                      event.target.value,
                                    ),
                                  })
                                }
                              />
                            </label>
                          </div>
                          <button
                            className="settings-save"
                            disabled={savingSettings}
                          >
                            {savingSettings
                              ? "Saving..."
                              : "Save maintenance settings"}
                          </button>
                        </form>
                      </>
                    )}
                  {settingsTab === "Updates" &&
                    user?.role === "System Admin" && (
                      <section className="settings-panel update-settings">
                        <header>
                          <div>
                            <p>ADMINISTRATOR</p>
                            <h3>Application updates</h3>
                          </div>
                          <span data-tooltip="This check reads installed component versions only. It never downloads or installs software.">
                            Safe check
                          </span>
                        </header>
                        <div className="update-banner">
                          <div>
                            <strong>
                              {updateStatus?.status ||
                                "Ready to check installed components"}
                            </strong>
                            <span>
                              Updates remain manual and require administrator
                              approval.
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={checkUpdates}
                            disabled={checkingUpdates}
                          >
                            {checkingUpdates
                              ? "Checking..."
                              : "Check for updates"}
                          </button>
                        </div>
                        {updateStatus && (
                          <div className="update-details">
                            <article>
                              <span>Application</span>
                              <strong>
                                {updateStatus.application}{" "}
                                {updateStatus.applicationVersion}
                              </strong>
                            </article>
                            <article>
                              <span>API</span>
                              <strong>Version {updateStatus.apiVersion}</strong>
                            </article>
                            <article>
                              <span>Runtime</span>
                              <strong>Node {updateStatus.runtime}</strong>
                            </article>
                            <article>
                              <span>Database</span>
                              <strong>{updateStatus.databaseVersion}</strong>
                            </article>
                            <article>
                              <span>Update channel</span>
                              <strong>{updateStatus.updateChannel}</strong>
                            </article>
                            <article>
                              <span>Last checked</span>
                              <strong>
                                {new Date(
                                  updateStatus.checkedAt,
                                ).toLocaleString("en-KE")}
                              </strong>
                            </article>
                          </div>
                        )}
                        <div className="update-policy">
                          <strong>Update policy</strong>
                          <ul>
                            <li>No automatic downloads or installations.</li>
                            <li>
                              Back up REDESY and PostgreSQL before applying an
                              update.
                            </li>
                            <li>
                              Test updates locally before publishing them to
                              staff.
                            </li>
                            <li>
                              Record production updates in the audit and
                              maintenance log.
                            </li>
                          </ul>
                        </div>
                      </section>
                    )}
                </>
              )}
            </section>
            <section className="audit-management-view">
              <div className="assignment-page-head">
                <div>
                  <p>AUDIT LOGS</p>
                  <h2>System accountability record</h2>
                  <span>
                    Read-only evidence of security events and changes across
                    every module.
                  </span>
                </div>
                <div className="audit-export">
                  <button
                    data-tooltip="Download the currently filtered audit records as a CSV file."
                    onClick={exportAuditCsv}
                  >
                    Export CSV
                  </button>
                  <button
                    data-tooltip="Open the print dialog. Select Save as PDF to create a protected report copy."
                    onClick={() => window.print()}
                  >
                    Print / PDF
                  </button>
                </div>
              </div>
              <div className="audit-summary">
                <article>
                  <span>Matching events</span>
                  <strong>{auditTotal}</strong>
                </article>
                <article>
                  <span>Security-sensitive</span>
                  <strong>
                    {
                      auditRows.filter((item) => isSecurityAudit(item.action))
                        .length
                    }
                  </strong>
                </article>
                <article>
                  <span>Displayed</span>
                  <strong>{auditRows.length}</strong>
                </article>
              </div>
              <div className="audit-filters">
                <label className="audit-search">
                  <Icon name="search" />
                  <input
                    value={auditFilters.search}
                    onChange={(event) =>
                      setAuditFilters({
                        ...auditFilters,
                        search: event.target.value,
                      })
                    }
                    placeholder="Search user, action, module or details"
                  />
                </label>
                <select
                  aria-label="Audit user"
                  value={auditFilters.userId}
                  onChange={(event) =>
                    setAuditFilters({
                      ...auditFilters,
                      userId: event.target.value,
                    })
                  }
                >
                  <option value="">All users</option>
                  {userRows.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Audit action"
                  value={auditFilters.action}
                  onChange={(event) =>
                    setAuditFilters({
                      ...auditFilters,
                      action: event.target.value,
                    })
                  }
                >
                  <option value="">All actions</option>
                  {auditActions.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                <select
                  aria-label="Audit module"
                  value={auditFilters.entityType}
                  onChange={(event) =>
                    setAuditFilters({
                      ...auditFilters,
                      entityType: event.target.value,
                    })
                  }
                >
                  <option value="">All modules</option>
                  {auditEntityTypes.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                <input
                  aria-label="Audit from date"
                  type="date"
                  value={auditFilters.from}
                  onChange={(event) =>
                    setAuditFilters({
                      ...auditFilters,
                      from: event.target.value,
                    })
                  }
                />
                <input
                  aria-label="Audit to date"
                  type="date"
                  value={auditFilters.to}
                  onChange={(event) =>
                    setAuditFilters({ ...auditFilters, to: event.target.value })
                  }
                />
                <button
                  onClick={() =>
                    setAuditFilters({
                      search: "",
                      userId: "",
                      action: "",
                      entityType: "",
                      from: "",
                      to: "",
                    })
                  }
                >
                  Clear
                </button>
              </div>
              {auditNotice && (
                <div className="session-message">{auditNotice}</div>
              )}
              <div className="audit-list">
                <div className="audit-list-head">
                  <span>Time</span>
                  <span>Activity</span>
                  <span>User</span>
                  <span>Module</span>
                  <span>Record</span>
                  <span>Details</span>
                </div>
                {auditRows.map((item) => (
                  <article
                    className={
                      isSecurityAudit(item.action) ? "security-event" : ""
                    }
                    key={item.id}
                  >
                    <time>
                      {new Date(item.created_at).toLocaleString("en-KE")}
                    </time>
                    <div>
                      <strong>{auditLabel(item.action)}</strong>
                      <small>{auditDescription(item)}</small>
                    </div>
                    <div>
                      <strong>{item.user_name}</strong>
                      <small>{item.user_email || "No account email"}</small>
                    </div>
                    <span>{item.entity_type}</span>
                    <code>{item.entity_id?.slice(0, 12) || "-"}</code>
                    <button onClick={() => setSelectedAudit(item)}>
                      Inspect
                    </button>
                  </article>
                ))}
              </div>
              {!auditRows.length && (
                <div className="assignment-empty">
                  <Icon name="audit" />
                  <h3>No audit records match</h3>
                  <p>Clear the filters or choose a broader date range.</p>
                </div>
              )}
            </section>
            {active === "Team & Users" && (
            <section className="user-management-view" data-user-tab={userWorkspaceTab}>
              <div className="assignment-page-head">
                <div>
                  <p>USER & ROLE MANAGEMENT</p>
                  <h2>People, access and workload</h2>
                  <span>
                    Manage active accounts, organizational roles, divisions and
                    secure access.
                  </span>
                </div>
                {canAdministerUsers && userWorkspaceTab === "Administration" ? (
                  <button onClick={() => openUserEditor()}>
                    + Create account
                  </button>
                ) : isManager ? (
                  <span className="user-admin-access-note">
                    Team management access
                  </span>
                ) : null}
              </div>
              {isManager && <nav className="user-workspace-tabs" aria-label="Team and users workspace">
                {([
                  ["Users", "Users", userRows.length],
                  ["Teams", "Teams", userRows.filter((member) => member.active).length],
                  ["Leave", "Leave", userRows.filter((member) => member.availability_status === "On Leave").length],
                  ...(isManager ? [["Approvals", "Approvals", null] as const] : []),
                  ["Calendar", "Calendar", null],
                  ...(canAdministerUsers ? [["Administration", "Administration", null] as const] : []),
                ] as const).map(([value,label,count]) => (
                  <button
                    key={value}
                    type="button"
                    className={userWorkspaceTab === value ? "active" : ""}
                    aria-current={userWorkspaceTab === value ? "page" : undefined}
                    onClick={() => setUserWorkspaceTab(value)}
                  >
                    <span>{label}</span>
                    {typeof count === "number" && <b>{count}</b>}
                  </button>
                ))}
              </nav>}
              {!isManager ? (
                <div className="assignment-empty">
                  <Icon name="team" />
                  <h3>Staff directory access only</h3>
                  <p>
                    Staff directory access is available here. Account creation,
                    role changes, activation and password resets are restricted
                    to administrators.
                  </p>
                </div>
              ) : (
                <>
                  {(userWorkspaceTab === "Users" || userWorkspaceTab === "Teams") && (
                    <div className="assignment-toolbar">
                      <label>
                        <Icon name="search" />
                        <input
                          value={userSearch}
                          onChange={(event) => setUserSearch(event.target.value)}
                          placeholder="Search name, email or division"
                        />
                      </label>
                      <select
                        value={userRoleFilter}
                        onChange={(event) =>
                          setUserRoleFilter(event.target.value)
                        }
                      >
                        {[
                          "All",
                          "System Admin",
                          "Director",
                          "Deputy Director",
                          "Assistant Director",
                          "Researcher",
                          "Reviewer",
                        ].map((value) => (
                          <option key={value} value={value}>
                            {value === "All" ? "All roles" : value}
                          </option>
                        ))}
                      </select>
                      <span>{filteredUsers.length} people</span>
                    </div>
                  )}
                  {userWorkspaceTab === "Users" && (() => {
                    const totalUsers = userRows.length;
                    const activeUsers = userRows.filter((member) => member.active).length;
                    const onLeaveUsers = userRows.filter((member) => member.active && member.availability_status === "On Leave").length;
                    const inactiveUsers = userRows.filter((member) => !member.active).length;
                    const divisions = [...new Set(userRows.map((member) => member.division || "Unassigned"))].sort();
                    return (
                      <section className="user-directory-overview" aria-label="User directory overview">
                        <header className="user-directory-heading">
                          <div>
                            <p>USER DIRECTORY</p>
                            <h3>Accounts and access</h3>
                            <span>Find people, review account state and reporting lines, and use only the account actions permitted by your role.</span>
                          </div>
                          {(userSearch || userRoleFilter !== "All" || userStatusFilter !== "All" || userDivisionFilter !== "All") && (
                            <button type="button" onClick={() => { setUserSearch(""); setUserRoleFilter("All"); setUserStatusFilter("All"); setUserDivisionFilter("All"); }}>Clear filters</button>
                          )}
                        </header>
                        <div className="user-directory-summary">
                          <button type="button" className={userStatusFilter === "All" ? "selected" : ""} onClick={() => setUserStatusFilter("All")}><span>Total users</span><strong>{totalUsers}</strong><small>accounts in authorised scope</small></button>
                          <button type="button" className={userStatusFilter === "Active" ? "selected" : ""} onClick={() => setUserStatusFilter(userStatusFilter === "Active" ? "All" : "Active")}><span>Active</span><strong>{activeUsers}</strong><small>enabled accounts</small></button>
                          <button type="button" className={userStatusFilter === "On Leave" ? "selected" : ""} onClick={() => setUserStatusFilter(userStatusFilter === "On Leave" ? "All" : "On Leave")}><span>On leave</span><strong>{onLeaveUsers}</strong><small>approved current leave</small></button>
                          <button type="button" className={userStatusFilter === "Inactive" ? "selected" : ""} onClick={() => setUserStatusFilter(userStatusFilter === "Inactive" ? "All" : "Inactive")}><span>Inactive</span><strong>{inactiveUsers}</strong><small>disabled accounts</small></button>
                        </div>
                        <div className="user-directory-filters">
                          <label><span>Status</span><select value={userStatusFilter} onChange={(event) => setUserStatusFilter(event.target.value)}><option value="All">All statuses</option><option value="Active">Active</option><option value="On Leave">On leave</option><option value="Inactive">Inactive</option></select></label>
                          <label><span>Division</span><select value={userDivisionFilter} onChange={(event) => setUserDivisionFilter(event.target.value)}><option value="All">All divisions</option>{divisions.map((division) => <option key={division} value={division}>{division}</option>)}</select></label>
                          <div><span>Directory result</span><strong>{filteredUsers.length} user{filteredUsers.length === 1 ? "" : "s"}</strong></div>
                        </div>
                      </section>
                    );
                  })()}
                  {isManager && !canAdministerUsers && (userWorkspaceTab === "Users" || userWorkspaceTab === "Teams") && (
                    <div className="session-message">
                      <strong>Team management enabled.</strong>{" "}
                      You may edit operational details and reset passwords inside your authorised reporting scope. Role, reporting-line and account activation changes remain System Admin protected.
                    </div>
                  )}
                  {userNotice && (
                    <div className="session-message">{userNotice}</div>
                  )}
                  {userWorkspaceTab === "Teams" && (() => {
                    const activeTeam = userRows.filter((member) => member.active);
                    const onLeave = activeTeam.filter((member) => member.availability_status === "On Leave");
                    const availableNow = activeTeam.filter((member) => member.availability_status !== "On Leave" && member.availability_status !== "Away");
                    const activeWork = activeTeam.reduce((total, member) => total + Number(member.active_assignments || 0), 0);
                    const divisions = [...new Set(activeTeam.map((member) => member.division || "Unassigned").filter(Boolean))].sort();
                    return (
                      <section className="team-workspace-overview" aria-label="Team operational overview">
                        <header className="team-workspace-heading">
                          <div>
                            <p>TEAM OVERVIEW</p>
                            <h3>People, availability and workload</h3>
                            <span>Operational view of staff inside your authorised reporting scope. Select a division card to narrow the roster below.</span>
                          </div>
                        </header>
                        <div className="team-summary-cards">
                          <article><span>Active team</span><strong>{activeTeam.length}</strong><small>active staff in scope</small></article>
                          <article><span>Available now</span><strong>{availableNow.length}</strong><small>not currently away or on leave</small></article>
                          <article><span>On leave</span><strong>{onLeave.length}</strong><small>approved current absences</small></article>
                          <article><span>Active workload</span><strong>{activeWork}</strong><small>active assignments across the team</small></article>
                        </div>
                        <div className="team-division-grid" aria-label="Team divisions">
                          {divisions.map((division) => {
                            const members = activeTeam.filter((member) => (member.division || "Unassigned") === division);
                            const divisionOnLeave = members.filter((member) => member.availability_status === "On Leave").length;
                            const divisionWork = members.reduce((total, member) => total + Number(member.active_assignments || 0), 0);
                            return (
                              <button key={division} type="button" onClick={() => setUserSearch(userSearch === division ? "" : division)} className={userSearch === division ? "selected" : ""}>
                                <span>{division}</span>
                                <strong>{members.length} member{members.length === 1 ? "" : "s"}</strong>
                                <small>{divisionWork} active assignment{divisionWork === 1 ? "" : "s"} · {divisionOnLeave} on leave</small>
                              </button>
                            );
                          })}
                        </div>
                        <div className="team-roster-heading">
                          <div><p>TEAM ROSTER</p><h3>Authorised staff</h3></div>
                          <span>{filteredUsers.length} shown</span>
                        </div>
                      </section>
                    );
                  })()}
                  <section className="user-role-overview" aria-label="Account hierarchy summary">
                    {["System Admin", "Director", "Deputy Director", "Assistant Director", "Researcher"].map((role) => {
                      const count = userRows.filter((member) => member.active && member.role === role).length;
                      return <button key={role} type="button" className={userRoleFilter === role ? "selected" : ""} onClick={() => setUserRoleFilter(userRoleFilter === role ? "All" : role)}><span>{role}</span><strong>{count}</strong><small>active account{count === 1 ? "" : "s"}</small></button>;
                    })}
                  </section>
                  
                  <div className="user-table">
                    <div className="user-table-head">
                      <span>Member</span>
                      <span>Role & division</span>
                      <span>{userWorkspaceTab === "Users" ? "Reporting line" : "Workload"}</span>
                      <span>Availability</span>
                      <span>Account</span>
                      <span>Actions</span>
                    </div>
                    {filteredUsers.map((member) => (
                      <article key={member.id}>
                        <div className="managed-user">
                          <b>{initialsFor(member.name)}</b>
                          <span>
                            <strong>{member.name}</strong>
                            <small>{member.email}</small>
                            {member.email
                              .toLowerCase()
                              .endsWith("@publicservic.go.ke") && (
                              <small className="user-email-warning">
                                Check email: did you mean @publicservice.go.ke?
                              </small>
                            )}
                          </span>
                        </div>
                        <div>
                          <strong>{member.role}</strong>
                          <small>{member.division}</small>
                          {member.supervisor_name && <small className="user-reporting-line">Reports to {member.supervisor_name} · {member.supervisor_role}</small>}
                        </div>
                        {userWorkspaceTab === "Users" ? (
                          <div>
                            <strong>{member.supervisor_name || "Top-level / unassigned"}</strong>
                            <small>{member.supervisor_role || "No reporting manager recorded"}</small>
                          </div>
                        ) : (
                          <div>
                            <strong>{member.active_assignments || 0} active</strong>
                            <small>{member.completed_assignments || 0} completed</small>
                          </div>
                        )}
                        <span>{member.availability_status || member.status}{member.leave_end_date ? <small className="user-leave-inline"> until {member.leave_end_date}</small> : null}</span>
                        <b
                          className={
                            member.active
                              ? "account-active"
                              : "account-disabled"
                          }
                        >
                          {member.active ? "Active" : "Disabled"}
                        </b>
                        <div className="user-actions">
                          {canManageTeamUsers ? (
                            <>
                              <button data-tooltip="Edit this member's permitted profile details." onClick={() => openUserEditor(member)}>Edit member</button>
                              <button className="user-reset-password-action" data-tooltip="Create a temporary password, end existing sessions and force change at next sign-in." onClick={() => resetMemberPassword(member)}>Reset password</button>
                            </>
                          ) : <span className="user-view-only">View only</span>}
                        </div>
                      </article>
                    ))}
                  </div>
                  {canAdministerUsers && userWorkspaceTab === "Administration" && (() => {
                    const parentRoleByRole: Record<string,string> = {
                      "Deputy Director": "Director",
                      "Assistant Director": "Deputy Director",
                      "Researcher": "Assistant Director",
                    };
                    const activeAccounts = userRows.filter((member) => member.active).length;
                    const inactiveAccounts = userRows.filter((member) => !member.active).length;
                    const systemAdmins = userRows.filter((member) => member.role === "System Admin" && member.active).length;
                    const reportingGaps = userRows.filter((member) => {
                      if (!member.active) return false;
                      const expectedParent = parentRoleByRole[member.role];
                      if (!expectedParent) return false;
                      return !member.supervisor_id || member.supervisor_role !== expectedParent;
                    });
                    const roleCounts = ["System Admin","Director","Deputy Director","Assistant Director","Researcher"].map((role) => ({
                      role,
                      count: userRows.filter((member) => member.role === role).length,
                    }));
                    return (
                      <section className="user-administration-workspace" aria-label="System administration governance">
                        <header className="user-administration-heading">
                          <div>
                            <p>SYSTEM ADMINISTRATION</p>
                            <h3>Account governance and reporting integrity</h3>
                            <span>Review account health, role distribution and reporting lines. Protected account changes continue through the existing audited account editor.</span>
                          </div>
                          <div className="user-administration-heading-actions">
                            <button type="button" onClick={() => openUserEditor()}>+ Create account</button>
                            <button type="button" className="secondary" onClick={() => setActive("Audit Logs")}>Open audit logs</button>
                          </div>
                        </header>

                        <div className="user-administration-summary">
                          <article><span>Active accounts</span><strong>{activeAccounts}</strong><small>enabled for sign-in</small></article>
                          <article><span>Disabled accounts</span><strong>{inactiveAccounts}</strong><small>retained but inactive</small></article>
                          <article className={reportingGaps.length ? "attention" : ""}><span>Reporting gaps</span><strong>{reportingGaps.length}</strong><small>{reportingGaps.length ? "require administrator review" : "hierarchy is complete"}</small></article>
                          <article><span>System admins</span><strong>{systemAdmins}</strong><small>active privileged accounts</small></article>
                        </div>

                        <div className="user-administration-grid">
                          <section className="user-governance-card">
                            <header><div><p>REPORTING LINES</p><h4>Hierarchy integrity</h4></div><b>{reportingGaps.length ? `${reportingGaps.length} to review` : "Healthy"}</b></header>
                            {reportingGaps.length ? (
                              <div className="user-reporting-gap-list">
                                {reportingGaps.slice(0,6).map((member) => (
                                  <article key={member.id}>
                                    <div><strong>{member.name}</strong><span>{member.role} · {member.division || "Unassigned"}</span><small>Expected reporting manager: {parentRoleByRole[member.role]}</small></div>
                                    <button type="button" onClick={() => openUserEditor(member)}>Review account</button>
                                  </article>
                                ))}
                                {reportingGaps.length > 6 && <small className="user-governance-more">+ {reportingGaps.length - 6} additional reporting gap{reportingGaps.length - 6 === 1 ? "" : "s"}</small>}
                              </div>
                            ) : (
                              <div className="user-governance-empty"><strong>Reporting hierarchy is complete</strong><span>All active scoped roles that require a manager have the expected reporting relationship.</span></div>
                            )}
                          </section>

                          <section className="user-governance-card">
                            <header><div><p>ROLE GOVERNANCE</p><h4>Account distribution</h4></div><button type="button" onClick={() => setUserWorkspaceTab("Users")}>Open directory</button></header>
                            <div className="user-role-distribution">
                              {roleCounts.map((item) => <div key={item.role}><span>{item.role}</span><strong>{item.count}</strong></div>)}
                            </div>
                            <div className="user-governance-note-compact">Role changes, reporting-line changes and account activation remain System Admin protected and are audited through the existing account editor.</div>
                          </section>

                          <section className="user-governance-card user-security-governance">
                            <header><div><p>SECURITY CONTROLS</p><h4>Controlled account actions</h4></div></header>
                            <div className="user-security-control-list">
                              <article><strong>Password reset</strong><span>Creates a temporary password, ends existing sessions and forces a password change at next sign-in.</span></article>
                              <article><strong>Activation state</strong><span>Only System Admin can enable or disable an account.</span></article>
                              <article><strong>Role and reporting line</strong><span>Protected changes remain subject to backend authorization and audit logging.</span></article>
                            </div>
                            <div className="user-security-actions">
                              <button type="button" onClick={() => setUserWorkspaceTab("Users")}>Manage accounts</button>
                              <button type="button" className="secondary" onClick={() => setActive("Audit Logs")}>Review security audit</button>
                            </div>
                          </section>
                        </div>
                      </section>
                    );
                  })()}
                  {userWorkspaceTab === "Calendar" && (
                    <section className="user-calendar-panel">
                      <div>
                        <p>TEAM AVAILABILITY CALENDAR</p>
                        <h3>Leave dates and staff availability</h3>
                        <span>Approved leave is already synchronized with REDESY Calendar. Open the full calendar for deadlines, meetings and leave events in one schedule.</span>
                      </div>
                      <div className="user-calendar-absence-list">
                        {userRows.filter((member) => member.availability_status === "On Leave").length ? userRows.filter((member) => member.availability_status === "On Leave").map((member) => (
                          <article key={member.id}>
                            <strong>{member.name}</strong>
                            <span>{member.role} · {member.division}</span>
                            <small>{member.leave_end_date ? `Returns after ${member.leave_end_date}` : "Currently on approved leave"}</small>
                          </article>
                        )) : <div className="user-calendar-empty"><strong>No current absences</strong><span>No staff in your authorised scope are on approved leave today.</span></div>}
                      </div>
                      <button type="button" className="user-open-calendar" onClick={() => setActive("Calendar")}>Open full Calendar</button>
                    </section>
                  )}
                  {canAdministerUsers && userWorkspaceTab === "Administration" && (
                  <section className="permission-matrix">
                    <header>
                      <div>
                        <p>ROLE PERMISSIONS</p>
                        <h3>System access matrix</h3>
                      </div>
                      <span data-tooltip="Permissions are enforced by the backend API. This table is a readable summary for administrators.">
                        How access is enforced
                      </span>
                    </header>
                    <div className="role-governance-note">
                      <strong>Recommended PSC operating model</strong>
                      <span>System Admins protect platform configuration; Directors provide institutional oversight; Deputies coordinate their reporting scope; Assistants supervise their reporting scope; Researchers produce assigned work and may receive contextual review assignments.</span>
                    </div>
                    <div className="matrix-table">
                      <div>
                        <b>Capability</b>
                        <b>System Admin</b>
                        <b>Director</b>
                        <b>Deputy Director</b>
                        <b>Assistant Director</b>
                        <b>Researcher</b>
                      </div>
                      {[
                        ["Account administration", "Full", "Directory", "Team directory", "Team directory", "No"],
                        ["Create assignments", "Full", "Organisation", "Team", "Team", "No"],
                        ["Manage research", "Full", "Organisation", "Team", "Team", "Assigned work"],
                        ["Review work", "Full", "Organisation", "Team", "Team", "Only when assigned"],
                        ["Reports and analytics", "Full", "Organisation", "Team", "Team", "Own/authorised"],
                        ["Audit logs and platform controls", "Full", "No", "No", "No", "No"],
                      ].map((row) => (
                        <div key={row[0]}>
                          {row.map((cell, index) => (
                            <span key={`${row[0]}-${index}`} className={index ? `permission-${String(cell).toLowerCase().replace(/\s+/g,"-")}` : ""}>{cell}</span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </section>
                  )}
                  {(userWorkspaceTab === "Leave" || userWorkspaceTab === "Approvals") && (
                    <Suspense fallback={<div className="report-loading">Loading leave and availability...</div>}>
                      {user.id ? <UserLeaveManagement mode={userWorkspaceTab === "Approvals" ? "approvals" : "leave"} token={token} currentUser={{id:user.id}} users={userRows} isManager={isManager} onUsersRefresh={async()=>setUserRows(await api.users(token))} onOpenApprovalCentre={() => setActive("Reviews & Approvals")}/> : <div className="report-loading">Authenticated user identity is unavailable.</div>}
                    </Suspense>
                  )}
                </>
              )}
            </section>
            )}
            {active === "Leave" && (
              <section className="user-management-view leave-self-service-view">
              <Suspense fallback={<div className="report-loading">Loading your leave workspace...</div>}>
                {user.id ? (
                  <UserLeaveManagement
                    mode="leave"
                    token={token}
                    currentUser={{ id: user.id }}
                    users={userRows.filter((member) => member.id === user.id)}
                    isManager={false}
                    onUsersRefresh={async () => setUserRows(await api.users(token))}
                  />
                ) : (
                  <div className="report-loading">Authenticated user identity is unavailable.</div>
                )}
              </Suspense>
              </section>
            )}
            {active === "Reports & Analytics" && (
              <>
                {dashboardReportContext && (
                  <div className="dashboard-report-context">
                    <span>
                      <strong>Opened from manager dashboard</strong>
                      <small>
                        {dashboardReportContext.subject} · {dashboardReportContext.scope}
                      </small>
                    </span>
                    <button
                      type="button"
                      onClick={() => setDashboardReportContext(null)}
                    >
                      Clear context
                    </button>
                  </div>
                )}
                <Suspense
                  fallback={<div className="report-loading">Loading reports…</div>}
                >
              <ReportsModule
                token={token}
                active={active === "Reports & Analytics"}
                isManager={isManager}
                directorates={[
                  ...new Set([
                    ...assignmentRows.map((item) => item.division),
                    ...userRows.map((item) => item.division),
                  ]),
                ].sort()}
                onOpenAssignment={(id) => {
                  const item = assignmentRows.find((row) => row.id === id);
                  if (item) openAssignmentDetails(item);
                }}
              />
                </Suspense>
              </>
            )}
            <section className="notice-board-view">
              <div className="assignment-page-head">
                <div>
                  <p>NOTICE BOARD</p>
                  <h2>Approved public information</h2>
                  <span>
                    Every member may submit information. Administrators and
                    Research Managers review it before publication.
                  </span>
                </div>
              </div>
              {active === "Notice Board" && <Suspense fallback={<div className="report-loading">Loading notice board...</div>}><NoticeBoardWorkspace
                rows={noticeRows}
                form={noticeForm}
                setForm={setNoticeForm}
                notice={noticeNotice}
                isManager={isManager}
                token={token}
                onRowsChange={setNoticeRows}
                onRead={markNoticeNotificationsRead}
                users={userRows}
                canTargetSpecificRecipients={Boolean(user && ["System Admin", "Director"].includes(user.role))}
                onSubmit={submitNotice}
                onReview={(item) => {
                  setReviewingNotice(item);
                  setNoticeReason("");
                }}
                onDelete={deleteNotice}
              /></Suspense>}
              {noticeNotice && (
                <div className="session-message">{noticeNotice}</div>
              )}
            </section>
            <section className="calendar-management-view">
              <div className="assignment-page-head">
                <div>
                  <p>CALENDAR</p>
                  <h2>Deadlines and approved events</h2>
                  <span>
                    Live assignment due dates and dated Notice Board posts
                    visible to your role.
                  </span>
                </div>
              </div>
                {active === "Calendar" && <Suspense fallback={<div className="report-loading">Loading calendar...</div>}><CalendarView
                  items={[
                    ...calendarRows,
                    ...noticeRows
                      .filter((item) => item.status === "Published" && item.expires_at)
                      .map((item) => ({
                        id: `expiry-${item.id}`,
                        title: `${item.title} expires`,
                        start_at: String(item.expires_at),
                        type: "notice_expiry" as const,
                        status: "Expiry",
                        entity_id: item.id,
                        description: "This notice will be removed from published views at this time.",
                      })),
                  ]}
                  token={token}
                  onChange={setCalendarRows}
                  onOpen={openPulseCalendar}
                /></Suspense>}
            </section>
            <section className="meetings-management-view">
              {active === "Meetings" && (
                user.id ? (
                  <Suspense fallback={<div className="report-loading">Loading meetings...</div>}>
                    <MeetingsWorkspace
                      token={token}
                      currentUser={{ id: user.id, name: user.name, role: user.role }}
                      onBack={() => navigateTo("Dashboard")}
                      onDashboard={() => navigateTo("Dashboard")}
                      onClose={() => navigateTo("Dashboard")}
                    
                      initialTarget={meetingNotificationTarget}
                onTargetHandled={() => setMeetingNotificationTarget(null)}
                onNotifications={() => navigateTo("Notifications")}
                      onApprovals={() => navigateTo("Reviews & Approvals")}
                    />
                  </Suspense>
                ) : (
                  <div className="report-loading" role="status">Signed-in account ID is unavailable. Meetings cannot be opened safely.</div>
                )
              )}
            </section>
            <section className="notification-management-view">
              <div className="assignment-page-head">
                <div>
                  <p>NOTIFICATIONS</p>
                  <h2>My activity inbox</h2>
                  <span>
                    Review assignments, approval decisions and required
                    corrections appear here.
                  </span>
                </div>
                <b>
                  {myActivityNotifications.filter((item) => !item.read_at).length} unread
                </b>
              </div>
              {active === "Notifications" && <Suspense fallback={<div className="report-loading">Loading notifications...</div>}><NotificationCenter
                token={token}
                items={myActivityNotifications}
                loading={notificationsLoading}
                onOpen={openNotification}
                onNavigate={navigateNotification}
                onMarkAll={markAllNotificationsRead}
                onRefresh={refreshNotifications}
                onStateChange={updateNotificationState}
                onArchiveRead={archiveReadNotifications}
              /></Suspense>}
            </section>
            {active === "Messages" && (
              <Suspense fallback={<div className="report-loading">Loading messages...</div>}>
                <MessagesWorkspace
                  token={token}
                  currentUserId={user?.id}
                  onUnreadCountChange={setMessageUnreadCount}
                  onBack={() => navigateTo("Dashboard")}
                  onDashboard={() => navigateTo("Dashboard")}
                  onClose={() => navigateTo("Dashboard")}
                />
              </Suspense>
            )}
            {active === "Document Repository" && (
              <section className="document-management-view">
              <RepositoryHeaderPanel
                documentStatus={documentStatus}
                documentSearch={documentSearch}
                allCount={documentRows.length}
                publishedCount={documentRows.filter((item) => item.status === "Published").length}
                reviewCount={documentRows.filter((item) => item.status === "Pending Approval").length}
                draftChangesCount={documentRows.filter((item) => ["Draft", "Rejected"].includes(item.status)).length}
                archivedCount={documentRows.filter((item) => item.status === "Archived").length}
                shownCount={filteredDocuments.length}
                searchIcon={<Icon name="search" />}
                onAddDocument={openKnowledgeUpload}
                onSummaryStatusChange={applyRepositorySummaryStatus}
                onStatusChange={setDocumentStatus}
                onSearchChange={setDocumentSearch}
              />

              <details className="repository-administration-hub">
                <summary>
                  <span>
                    <small>REPOSITORY ADMINISTRATION</small>
                    <b>Management, assurance and governance tools</b>
                    <em>Open only when you need operational controls, assurance evidence or governance repair.</em>
                  </span>
                  <span className="repository-administration-hub-actions">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setRepositoryBulkIntakeOpen(true);
                      }}
                    >
                      Bulk intake
                    </button>
                    <strong>{deletionRequests.length + reviewRows.length} queue item{deletionRequests.length + reviewRows.length === 1 ? "" : "s"}</strong>
                  </span>
                </summary>
                <div className="repository-administration-hub-body">
              <details className="repository-progressive-panel repository-administration-subpanel">
                <summary><span><b>Lifecycle & attention</b><small>Open only when you need lifecycle or improvement controls</small></span></summary>
                <div className="repository-progressive-panel-body">
                  <RepositoryRecordsCommandCentre
                    documents={documentRows}
                    improvements={documentImprovementAssignments}
                    isManager={isManager}
                    currentUserId={user?.id || ""}
                    onViewAll={() => {
                      setDocumentStatus("All");
                      setRecordsLifecycleFilter("All");
                      setDocumentSearch("");
                    }}
                    onViewLifecycle={(value) => {
                      setDocumentStatus("All");
                      setRecordsLifecycleFilter(value);
                      setDocumentSearch("");
                    }}
                    onOpenImprovement={openDocumentImprovement}
                    onUpdateImprovementStatus={(assignment, status) => {
                      void updateImprovementStatus(assignment, status);
                    }}
                  />
                </div>
              </details>

              {user?.id && (
                <details className="repository-progressive-panel repository-administration-subpanel">
                  <summary><span><b>Operational records control</b><small>Queues and operational exceptions</small></span></summary>
                  <div className="repository-progressive-panel-body">
                    <RepositoryOperationalQueues
                      documents={documentRows}
                      improvements={documentImprovementAssignments}
                      currentUserId={user.id}
                      isManager={isManager}
                      selected={repositoryOperationalQueue}
                      onSelect={(queue) => {
                        setRepositoryOperationalQueue(queue);
                        setRepositoryAssuranceFilter("ALL");
                        setRepositoryAssuranceIds([]);
                        setRepositoryLibraryTab("All Records");
                        setRepositoryListPage(1);
                        setDocumentSearch("");
                        setDocumentStatus("All");
                        setDocumentSource("All");
                        setDocumentMine(false);
                        setRecordsLifecycleFilter("All");
                        setDocumentDraftView("All");
                        setDocumentDraftType("All");
                        setDocumentDraftOwner("All");
                        setDocumentDraftLifecycle("All");
                        setRepositoryAdvancedFilters(emptyRepositoryAdvancedFilters);
                      }}
                    />
                  </div>
                </details>
              )}

              {user?.id && (
                <details className="repository-progressive-panel repository-administration-subpanel">
                  <summary><span><b>Assurance</b><small>Quality, control and assurance evidence</small></span></summary>
                  <div className="repository-progressive-panel-body">
                    <RepositoryAssuranceOverview
                      token={token}
                      selected={repositoryAssuranceFilter}
                      onSelect={(filter, ids) => {
                        setRepositoryAssuranceFilter(filter);
                        setRepositoryAssuranceIds(ids);
                        setRepositoryOperationalQueue("All");
                        setRepositoryLibraryTab("All Records");
                        setRepositoryListPage(1);
                        setDocumentSearch("");
                        setDocumentStatus("All");
                        setDocumentSource("All");
                        setDocumentMine(false);
                        setRecordsLifecycleFilter("All");
                        setDocumentDraftView("All");
                        setDocumentDraftType("All");
                        setDocumentDraftOwner("All");
                        setDocumentDraftLifecycle("All");
                        setRepositoryAdvancedFilters(emptyRepositoryAdvancedFilters);
                      }}
                    />
                  </div>
                </details>
              )}

              {user?.id && (
                <details className="repository-progressive-panel repository-administration-subpanel">
                  <summary><span><b>Governance reconciliation</b><small>Open governance repair and reconciliation tools</small></span></summary>
                  <div className="repository-progressive-panel-body">
                    <RepositoryGovernanceReconciliation
                      token={token}
                      isManager={isManager}
                      onChanged={refreshDocuments}
                    />
                  </div>
                </details>
              )}

                </div>
              </details>

              <section className="repository-library-tabs" aria-label="Repository library views">
                <div className="repository-library-tabs-heading">
                  <div>
                    <small>RECORD LIBRARY</small>
                    <strong>Browse by record family</strong>
                    <span>Select a tab, then search only within that collection.</span>
                  </div>
                  <div className="repository-library-tabs-heading-actions">
                    <span>{filteredDocuments.length} matching record{filteredDocuments.length === 1 ? "" : "s"}</span>
                  </div>
                </div>
                <div className="repository-library-tab-list repository-primary-library-tabs" role="tablist" aria-label="Primary document collections">
                  {repositoryPrimaryTabs.map((tab) => (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={repositoryLibraryTab === tab}
                      className={repositoryLibraryTab === tab ? "active" : ""}
                      key={tab}
                      onClick={() => {
                        setRepositoryLibraryTab(tab);
                        setRepositoryListPage(1);
                        setDocumentSearch("");
                        setDocumentStatus("All");
                        setDocumentSource("All");
                        setDocumentMine(false);
                        setRecordsLifecycleFilter("All");
                        setRepositoryOperationalQueue("All");
                        setRepositoryAssuranceFilter("ALL");
                        setRepositoryAssuranceIds([]);
                        setDocumentDraftView("All");
                        setDocumentDraftType("All");
                        setDocumentDraftOwner("All");
                        setDocumentDraftLifecycle("All");
                      }}
                    >
                      <span>{tab === "Published" ? "Published / Final" : tab}</span>
                      <b>{repositoryLibraryCounts[tab]}</b>
                    </button>
                  ))}
                </div>
                <div className="repository-secondary-library-tabs" aria-label="Additional record collections">
                  <span>More records</span>
                  {repositorySecondaryTabs.map((tab) => (
                    <button
                      type="button"
                      className={repositoryLibraryTab === tab ? "active" : ""}
                      key={tab}
                      onClick={() => {
                        setRepositoryLibraryTab(tab);
                        setRepositoryListPage(1);
                        setDocumentSearch("");
                        setDocumentStatus("All");
                        setDocumentSource("All");
                        setDocumentMine(false);
                        setRecordsLifecycleFilter("All");
                        setRepositoryOperationalQueue("All");
                        setRepositoryAssuranceFilter("ALL");
                        setRepositoryAssuranceIds([]);
                        if (tab !== "Drafts") {
                          setDocumentDraftView("All");
                          setDocumentDraftType("All");
                          setDocumentDraftOwner("All");
                          setDocumentDraftLifecycle("All");
                        }
                      }}
                    >
                      {tab} <b>{repositoryLibraryCounts[tab]}</b>
                    </button>
                  ))}
                  {repositoryReviewerRequiredCount > 0 && (
                    <span className="repository-reviewer-gap-summary">
                      {repositoryReviewerRequiredCount} record{repositoryReviewerRequiredCount === 1 ? "" : "s"} need reviewer assignment
                    </span>
                  )}
                </div>
              </section>

              {repositoryLibraryTab === "Drafts" && (
              <section
                className="repository-private-draft-summary repository-draft-primary-nav"
                aria-label="Repository draft workspace"
              >
                <div>
                  <small>DRAFT WORKSPACE</small>
                  <strong>Choose the draft set you need</strong>
                  <span>
                    My Drafts, Supervised Drafts and Archived Drafts are the primary
                    working views. Detailed governance remains available inside each
                    record.
                  </span>
                </div>
                <div className="repository-private-draft-counts">
                  <button
                    type="button"
                    className={documentDraftView === "My Drafts" ? "active" : ""}
                    onClick={() =>
                      setDocumentDraftView((current) =>
                        current === "My Drafts" ? "All" : "My Drafts",
                      )
                    }
                  >
                    <b>{myPrivateRepositoryDrafts.length}</b>
                    <span>My Drafts</span>
                  </button>
                  <button
                    type="button"
                    className={
                      documentDraftView === "Supervised Drafts" ? "active" : ""
                    }
                    onClick={() =>
                      setDocumentDraftView((current) =>
                        current === "Supervised Drafts"
                          ? "All"
                          : "Supervised Drafts",
                      )
                    }
                  >
                    <b>{supervisedPrivateRepositoryDrafts.length}</b>
                    <span>Supervised Drafts</span>
                  </button>
                  <button
                    type="button"
                    className={
                      documentDraftView === "Archived Drafts" ? "active" : ""
                    }
                    onClick={() =>
                      setDocumentDraftView((current) =>
                        current === "Archived Drafts" ? "All" : "Archived Drafts",
                      )
                    }
                  >
                    <b>{archivedOperationalDrafts.length}</b>
                    <span>Archived Drafts</span>
                  </button>
                </div>
              </section>
              )}

              {repositoryLibraryTab === "Drafts" && (
              <section
                className="repository-draft-manager-summary repository-draft-manager-summary-compact"
                aria-label="Repository draft management summary"
              >
                <button
                  type="button"
                  onClick={() => setDocumentDraftLifecycle("Active")}
                  title="Show active drafts"
                >
                  <small>Active</small>
                  <strong>{activeRepositoryDrafts.length}</strong>
                </button>
                <button
                  type="button"
                  onClick={() => setDocumentDraftView("Supervised Drafts")}
                  title="Show supervised drafts"
                >
                  <small>Supervised</small>
                  <strong>{supervisedPrivateRepositoryDrafts.length}</strong>
                </button>
                <button
                  type="button"
                  onClick={() => setDocumentDraftView("Archived Drafts")}
                  title="Show archived working drafts"
                >
                  <small>Archived</small>
                  <strong>{archivedOperationalDrafts.length}</strong>
                </button>
                <button
                  type="button"
                  onClick={() => setDocumentSort("LastSavedNewest")}
                  title="Sort by most recently updated"
                >
                  <small>Recent</small>
                  <strong>{recentlyUpdatedDrafts.length}</strong>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDocumentDraftLifecycle("Active");
                    setDocumentSort("LastSavedOldest");
                  }}
                  title="Show active drafts with the oldest saves first"
                >
                  <small>Stale 7+ days</small>
                  <strong>{staleRepositoryDrafts.length}</strong>
                </button>
                <button
                  type="button"
                  onClick={() => setDocumentSort("VersionHigh")}
                  title="Sort drafts by highest version"
                >
                  <small>Top version</small>
                  <strong>v{highestDraftVersion}</strong>
                </button>
              </section>
              )}

              {repositoryLibraryTab === "Drafts" && documentDraftView !== "All" && (
                <div className="repository-draft-view-hint" role="status">
                  {documentDraftView === "My Drafts"
                    ? "Showing your active working drafts."
                    : documentDraftView === "Supervised Drafts"
                      ? "Showing active drafts inside your authorised supervisory scope."
                      : "Showing historical working drafts retained after final publication."}
                </div>
              )}

              {repositoryLibraryTab === "Drafts" &&
                documentDraftView === "Supervised Drafts" &&
                supervisedPrivateRepositoryDrafts.length > 0 && (
                  <section
                    className="repository-supervised-draft-oversight"
                    aria-label="Supervised draft oversight"
                  >
                    <strong>SUPERVISORY OVERSIGHT</strong>
                    <span>
                      These drafts belong to staff inside your authorised management
                      scope. Repository visibility does not widen ASSIGNMENT or TASK
                      authority beyond existing backend RBAC. Use the visual signals
                      to identify stale drafts and heavily revised work; they do not
                      create a new workflow status.
                    </span>
                  </section>
                )}

              {repositoryLibraryTab === "Drafts" && documentDraftView === "Archived Drafts" && (
                <section
                  className="repository-archived-draft-oversight"
                  aria-label="Archived working draft history"
                >
                  <strong>ARCHIVED WORKING DRAFT HISTORY</strong>
                  <span>
                    These working drafts were retired after a governed final report
                    was published. Nothing was deleted: their draft versions remain
                    available for institutional provenance and audit.
                  </span>
                </section>
              )}

              {repositoryLibraryTab === "Drafts" && (documentDraftView !== "All" ||
                documentDraftType !== "All" ||
                documentDraftOwner !== "All" ||
                documentDraftLifecycle !== "All") && (
                <section
                  className="repository-draft-refinement"
                  aria-label="Refine repository drafts"
                >
                  <div className="repository-draft-refinement-heading">
                    <strong>REFINE DRAFTS</strong>
                    <span>
                      Filter only when needed.
                    </span>
                  </div>

                  <label>
                    <span>Draft type</span>
                    <select
                      value={documentDraftType}
                      onChange={(event) =>
                        setDocumentDraftType(event.target.value)
                      }
                    >
                      <option value="All">All draft types</option>
                      {repositoryDraftTypes.map((type) => (
                        <option key={type} value={type}>
                          {type.replace(" Draft", "")}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Owner</span>
                    <select
                      value={documentDraftOwner}
                      onChange={(event) =>
                        setDocumentDraftOwner(event.target.value)
                      }
                    >
                      <option value="All">All owners</option>
                      {repositoryDraftOwners.map(([id, name]) => (
                        <option key={id} value={String(id)}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Lifecycle</span>
                    <select
                      value={documentDraftLifecycle}
                      onChange={(event) =>
                        setDocumentDraftLifecycle(event.target.value)
                      }
                    >
                      <option value="All">Active + archived</option>
                      <option value="Active">Active only</option>
                      <option value="Archived">Archived only</option>
                    </select>
                  </label>
                </section>
              )}

              <div className="repository-smart-filters">
                <select
                  value={documentSource}
                  aria-label="Filter repository by source"
                  onChange={(event) => setDocumentSource(event.target.value)}
                >
                  <option value="All">All sources</option>
                  {[...new Set(documentRows.map((item) => item.source_type).filter(Boolean))]
                    .sort()
                    .map((source) => (
                      <option key={source} value={source}>
                        {source}
                      </option>
                    ))}
                </select>

                <button
                  type="button"
                  className={documentMine ? "active" : ""}
                  onClick={() => setDocumentMine((current) => !current)}
                >
                  My documents
                </button>

                <select
                  value={documentSort}
                  aria-label="Sort repository documents"
                  onChange={(event) => setDocumentSort(event.target.value)}
                >
                  <option value="Newest">Created: newest first</option>
                  <option value="Oldest">Created: oldest first</option>
                  <option value="LastSavedNewest">Last saved: newest first</option>
                  <option value="LastSavedOldest">Last saved: oldest first</option>
                  <option value="VersionHigh">Version: highest first</option>
                  <option value="VersionLow">Version: lowest first</option>
                  <option value="OwnerAZ">Owner A-Z</option>
                  <option value="TitleAZ">Title A-Z</option>
                  <option value="TitleZA">Title Z-A</option>
                  <option value="Reviewed">Recently reviewed</option>
                </select>

                <span className="repository-result-count">
                  <strong>{filteredDocuments.length}</strong> in {repositoryLibraryTab}
                  {repositoryActiveFilterCount > 0 && (
                    <small>{repositoryActiveFilterCount} active filter{repositoryActiveFilterCount === 1 ? "" : "s"}</small>
                  )}
                </span>

                {(documentDraftType !== "All" ||
                  documentDraftOwner !== "All" ||
                  documentDraftLifecycle !== "All") && (
                  <span className="repository-draft-filter-summary">
                    Draft filters active
                  </span>
                )}

                {multiRevisionDrafts.length > 0 && (
                  <span className="repository-draft-revision-summary">
                    {multiRevisionDrafts.length} multi-revision draft
                    {multiRevisionDrafts.length === 1 ? "" : "s"}
                  </span>
                )}

                {(repositoryActiveFilterCount > 0 || documentSort !== "Newest" || repositoryLibraryTab !== "All Records") && (
                  <button
                    type="button"
                    className="repository-clear-filter"
                    onClick={resetRepositoryRetrievalView}
                  >
                    Reset all
                  </button>
                )}
              </div>
              {documentNotice && (
                <div className="session-message">{documentNotice}</div>
              )}
              {repositoryActiveFilterCount > 0 && (
                <div className="repository-retrieval-summary" role="status" aria-live="polite">
                  <span>
                    <b>Filtered view</b>
                    <small>{filteredDocuments.length} matching record{filteredDocuments.length === 1 ? "" : "s"} across the authorised Repository scope.</small>
                  </span>
                  <button type="button" onClick={resetRepositoryRetrievalView}>Clear all filters</button>
                </div>
              )}
              <RepositoryAdvancedSearch
                token={token}
                filters={repositoryAdvancedFilters}
                onChange={setRepositoryAdvancedFilters}
                onClear={() => setRepositoryAdvancedFilters(emptyRepositoryAdvancedFilters)}
              />

              <details className="repository-governance-drawer">
                <summary>
                  <span>
                    <b>Governance queues</b>
                    <small>Deletion approvals and document reviews</small>
                  </span>
                  <strong>{deletionRequests.length + reviewRows.length}</strong>
                </summary>
                <div className="repository-governance-drawer-body">
                  <RepositoryDeletionApprovalQueue
                    isManager={isManager}
                    deletionRequests={deletionRequests}
                    onReviewRequest={(item) => {
                      setDeletionDecision(item);
                      setDeletionDecisionComments("");
                    }}
                  />
                  <RepositoryReviewQueue
                    canReview={canReview}
                    isManager={isManager}
                    reviewRows={reviewRows}
                    reviewers={reviewers}
                    assignReviewer={assignReviewer}
                    openDocumentVersions={openDocumentVersions}
                    openRepositoryReview={openRepositoryReview}
                  />
                </div>
              </details>
              {filteredDocuments.length > 0 && (
                <nav className="repository-pagination repository-pagination-top" aria-label="Repository page navigation">
                  <div>
                    <strong>{repositoryLibraryTab}</strong>
                    <span>
                      {Math.min(
                        filteredDocuments.length,
                        (repositorySafePage - 1) * repositoryPageSize + 1,
                      )}
                      {"–"}
                      {Math.min(
                        filteredDocuments.length,
                        repositorySafePage * repositoryPageSize,
                      )}
                      {" of "}
                      {filteredDocuments.length}
                    </span>
                  </div>
                  <div className="repository-pagination-controls">
                    <button
                      type="button"
                      disabled={repositorySafePage <= 1}
                      onClick={() =>
                        setRepositoryListPage((page) => Math.max(1, page - 1))
                      }
                    >
                      ← Previous
                    </button>
                    <b>Page {repositorySafePage} / {repositoryTotalPages}</b>
                    <button
                      type="button"
                      disabled={repositorySafePage >= repositoryTotalPages}
                      onClick={() =>
                        setRepositoryListPage((page) =>
                          Math.min(repositoryTotalPages, page + 1),
                        )
                      }
                    >
                      Next →
                    </button>
                  </div>
                </nav>
              )}

              <div className="document-table repository-table">
                <div className="document-table-head">
                  <span>Record</span>
                  <span>Context</span>
                  <span>Status</span>
                  <span>Governance</span>
                  <span>Actions</span>
                </div>
                {visibleRepositoryDocuments.map((item) => (
                  <article key={item.id}>
                    <div className="document-name">
                      <span>
                        <button type="button" className="repository-record-title-button" onClick={() => void openRepositoryWorkspace(item)}>
                          <strong>{item.title}</strong>
                        </button>
                        {isPrivateRepositoryDraft(item) && (
                          <>
                            <span className="repository-private-draft-badge">
                              PRIVATE DRAFT
                            </span>
                            {draftSignalLabels(item).length > 0 && (
                              <div className="repository-draft-signals repository-draft-signals-compact">
                                <span>{draftSignalLabels(item)[0]}</span>
                              </div>
                            )}
                          </>
                        )}
                        {isArchivedOperationalDraft(item) && (
                          <>
                            <span className="repository-archived-draft-badge">
                              ARCHIVED WORKING DRAFT
                            </span>
                            {draftSignalLabels(item).length > 0 && (
                              <div className="repository-draft-signals repository-draft-signals-compact">
                                <span>{draftSignalLabels(item)[0]}</span>
                              </div>
                            )}
                          </>
                        )}
                        <small>
                          {isPrivateRepositoryDraft(item)
                            ? `${item.document_type} · owned by ${item.created_by_name}`
                            : `${item.category} · uploaded by ${item.created_by_name}`}
                        </small>
                        {!isPrivateRepositoryDraft(item) && (
                          <small className="repository-record-identity">
                            {item.record_number || "Record no. pending"} · {item.record_class || item.document_type || "General Record"}
                          </small>
                        )}
                        <div className="repository-row-meta">
                          <span>v{Math.max(1, Number(item.current_version || 1))}</span>
                          <span>Updated {new Date(item.updated_at || item.created_at).toLocaleDateString("en-KE")}</span>
                          <span>{item.records_lifecycle_state || (item.status === "Published" ? "Active Record" : "Working Document")}</span>
                          {item.protection_scope && item.protection_scope !== "INHERITED" && <b className="repository-protection-chip">{item.protection_scope.replaceAll("_"," ")}</b>}
                          {item.legal_hold && <b>LEGAL HOLD</b>}
                        </div>
                      </span>
                    </div>
                    <div className="repository-source">
                      <b>Source: {item.source_type || "App2 Upload"}</b>
                      {repositoryOriginDisplay(item) && (
                        <small className="repository-origin-compact">
                          <b>{repositoryOriginDisplay(item)!.typeLabel}:</b> {repositoryOriginDisplay(item)!.titleLabel}
                        </small>
                      )}
                      {(item.origin_links?.length || 0) > 1 && (
                        <small className="repository-linked-count">
                          +{(item.origin_links?.length || 0) - 1} additional linked record
                          {(item.origin_links?.length || 0) - 1 === 1 ? "" : "s"}
                        </small>
                      )}
                      {isArchivedOperationalDraft(item) && (
                        <small className="repository-final-record-indicator">
                          {findArchivedDraftFinalRecord(item)
                            ? "Final record available"
                            : "Final record not linked"}
                        </small>
                      )}
                      {item.source_url && (
                        <a
                          href={item.source_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open original source
                        </a>
                      )}
                    </div>
                    <div className="repository-state-stack">
                      <b
                        className={`doc-state ${item.status.toLowerCase().replace(" ", "-")}`}
                      >
                        {item.status}
                      </b>
                      {!isPrivateRepositoryDraft(item) && (
                        <span
                          className={`repository-lock-pill ${item.locked_by_name ? (item.locked_by_name === user?.name ? "mine" : "other") : "ready"}`}
                        >
                          {item.locked_by_name
                            ? item.locked_by_name === user?.name
                              ? "You are editing"
                              : `Locked by ${item.locked_by_name}`
                            : "Available for work"}
                        </span>
                      )}
                    </div>
                    <div className="repository-accountability repository-accountability-compact">
                      <strong>{item.created_by_name}</strong>
                      <small>
                        {item.status === "Published"
                          ? `Approved: ${item.approved_by_name || item.reviewed_by_name || "recorded"}`
                          : `Reviewer: ${item.reviewer_name || "not assigned"}`}
                      </small>
                      {item.status !== "Published" &&
                        !isPrivateRepositoryDraft(item) &&
                        !isArchivedOperationalDraft(item) &&
                        !item.reviewer_id && (
                          <span className="repository-reviewer-required">Reviewer required</span>
                        )}
                      <details aria-label={`Traceability for ${item.title}`}>
                        <summary>Info</summary>
                        <div>
                          <small><b>Owner:</b> {item.created_by_name}</small>
                          <small><b>Worked by:</b> {item.worked_by?.length ? item.worked_by.join(", ") : item.created_by_name}</small>
                          <small><b>Reviewer:</b> {item.reviewer_name || item.reviewed_by_name || "Not assigned"}</small>
                          <small><b>Approver:</b> {item.approved_by_name || "Not approved"}</small>
                          <small><b>Source:</b> {item.source_type || "App2 Upload"}</small>
                          {repositoryOriginDisplay(item) && <small><b>Origin:</b> {repositoryOriginDisplay(item)!.typeLabel}: {repositoryOriginDisplay(item)!.titleLabel}</small>}
                          {repositoryOriginDisplay(item) && <small><b>Trace:</b> {repositoryTraceLabel(item)}</small>}
                          <small><b>Current version:</b> v{Math.max(1, Number(item.current_version || 1))}</small>
                          {!isPrivateRepositoryDraft(item) && <small><b>Protection:</b> {(item.protection_scope || "INHERITED").replaceAll("_"," ")}</small>}
                          {isPrivateRepositoryDraft(item) && <small><b>Visibility:</b> {privateDraftVisibilityText(item)}</small>}
                        </div>
                      </details>
                    </div>
                    <div className="document-actions canonical-document-actions">
                      <button
                        className="approve repository-read-primary"
                        onClick={() => void openRepositoryDocumentReader(item)}
                      >
                        Read
                      </button>
                      {item.reviewer_id === user?.id && item.status === "Pending Approval" && (
                        <button
                          className="approve repository-review-primary"
                          onClick={() => {
                            openRepositoryReview(item);
                          }}
                        >
                          Review
                        </button>
                      )}
                      <button
                        className="repository-action-secondary repository-workspace-action"
                        disabled={!!item.locked_by_name && item.locked_by_name !== user?.name}
                        title={item.locked_by_name && item.locked_by_name !== user?.name ? `Locked by ${item.locked_by_name}` : "Open record workspace"}
                        onClick={() => void openRepositoryWorkspace(item)}
                      >
                        Record workspace
                      </button>
                      <button
                        className="repository-action-secondary"
                        title="Draft version history"
                        onClick={() => void openDocumentVersions(item)}
                      >
                        Versions
                      </button>
                      <button className="repository-action-secondary repository-audit-action" onClick={() => void openRepositoryDocumentActivity(item)}>
                        Audit trail
                      </button>
                      <details className="repository-more-actions">
                        <summary aria-label={`More actions for ${item.title}`}>More</summary>
                        <div>
                          <span className="repository-lock-status">
                            {item.locked_by_name
                              ? item.locked_by_name === user?.name
                                ? "You are editing this record"
                                : `Locked by ${item.locked_by_name}`
                              : "Locks automatically when Workspace opens"}
                          </span>
                          {isPrivateRepositoryDraft(item) && (
                            <button onClick={() => void openPrivateDraftSource(item)}>
                              {privateDraftSourceLabel(item)}
                            </button>
                          )}
                          {isArchivedOperationalDraft(item) && findArchivedDraftFinalRecord(item) && (
                            <button onClick={() => void openRepositoryDocumentReader(findArchivedDraftFinalRecord(item)!)}>
                              Open final record
                            </button>
                          )}
                          {!isPrivateRepositoryDraft(item) && repositoryPrimaryOrigin(item) && (
                            <button onClick={() => void openRepositoryOrigin(item)}>
                              Open source workspace
                            </button>
                          )}
                          {!isPrivateRepositoryDraft(item) && (
                            <button onClick={() => void openDocumentRelationships(item)}>
                              Relationships / evidence
                            </button>
                          )}
                          {!isPrivateRepositoryDraft(item) && (
                            <button
                              disabled={item.felix_index_status !== "Completed"}
                              onClick={() => openFelixDocumentReview(item)}
                            >
                              {item.felix_index_status === "Completed" ? "Ask Felix" : "Felix not ready"}
                            </button>
                          )}
                          {isManager && (
                            <details className="repository-governance-actions">
                              <summary>Governance</summary>
                              <div>
                                {!isPrivateRepositoryDraft(item) && (
                                  <button onClick={() => void openDocumentProtection(item)}>
                                    Protection & access
                                  </button>
                                )}
                                {!isPrivateRepositoryDraft(item) && !isArchivedOperationalDraft(item) && (
                                  <button onClick={() => openDocumentImprovement(item)}>
                                    Improve / update
                                  </button>
                                )}
                                {item.status === "Published" && item.felix_enabled && (
                                  <button onClick={async () => {
                                    try {
                                      await api.reindexFelixDocument(token, item.id);
                                      setDocumentNotice(`Felix re-index queued for “${item.title}”.`);
                                      await refreshDocuments();
                                    } catch (error) {
                                      setDocumentNotice(error instanceof Error ? error.message : "Felix re-index could not be queued.");
                                    }
                                  }}>
                                    Re-index Felix
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setRetentionDocument(item);
                                    setRetentionDate(item.retention_until || "");
                                  }}
                                >
                                  Retention
                                </button>
                              </div>
                            </details>
                          )}
                        </div>
                      </details>
                    </div>
                  </article>
                ))}
              </div>

              {filteredDocuments.length === 0 && (
                <div className="repository-library-empty">
                  <strong>No records found in {repositoryLibraryTab}</strong>
                  <span>Change the tab, search term or filters to broaden the result.</span>
                </div>
              )}

              {filteredDocuments.length > repositoryPageSize && (
                <nav className="repository-pagination" aria-label="Repository bottom page navigation">
                  <button
                    type="button"
                    disabled={repositorySafePage <= 1}
                    onClick={() =>
                      setRepositoryListPage((page) => Math.max(1, page - 1))
                    }
                  >
                    ← Previous
                  </button>
                  <span>
                    Page {repositorySafePage} of {repositoryTotalPages} ·{" "}
                    {filteredDocuments.length} records
                  </span>
                  <button
                    type="button"
                    disabled={repositorySafePage >= repositoryTotalPages}
                    onClick={() =>
                      setRepositoryListPage((page) =>
                        Math.min(repositoryTotalPages, page + 1),
                      )
                    }
                  >
                    Next →
                  </button>
                </nav>
              )}

              {!!filteredDocuments.length && (
                <details className="repository-deletion-controls">
                  <summary>Document archive and deletion</summary>
                  <p>
                    Archive a document from its card when it should remain in
                    the institutional record. Permanent deletion requires a
                    reason and approval by a Research Manager or Administrator.
                  </p>
                  <div>
                    {visibleRepositoryDocuments.map((item) => (
                      <article key={item.id}>
                        <span>
                          <strong>{item.title}</strong>
                          <small>
                            {item.status} · {item.source_type || "App2 Upload"}
                          </small>
                        </span>
                        <button
                          disabled={deletionRequests.some(
                            (request) =>
                              request.knowledge_id === item.id &&
                              request.status === "Pending",
                          )}
                          onClick={() => {
                            setDeletionRequestDocument(item);
                            setDeletionRequestReason("");
                          }}
                        >
                          {deletionRequests.some(
                            (request) =>
                              request.knowledge_id === item.id &&
                              request.status === "Pending",
                          )
                            ? "Deletion pending"
                            : "Request deletion"}
                        </button>
                      </article>
                    ))}
                  </div>
                </details>
              )}
              {!filteredDocuments.length && (
                <div className="assignment-empty">
                  <Icon name="documents" />
                  <h3>
                    {documentDraftView === "My Drafts"
                      ? "No private drafts saved yet"
                      : documentDraftView === "Supervised Drafts"
                        ? "No supervised drafts in your scope"
                        : documentDraftView === "Archived Drafts"
                          ? "No archived working drafts"
                          : "No documents found"}
                  </h3>
                  <p>
                    {documentDraftView === "My Drafts"
                      ? "Save an Assignment, Task or Report draft and it will appear here automatically."
                      : documentDraftView === "Supervised Drafts"
                        ? "Drafts created by staff in your authorised supervisory scope will appear here."
                        : documentDraftView === "Archived Drafts"
                          ? "Completed working drafts will appear here after the governed final report is published."
                          : "Upload a document or adjust the filters."}
                  </p>
                </div>
              )}
            </section>
            )}
            <Suspense fallback={<div className="report-loading">Loading Research Workspace…</div>}>
              <ResearchWorkspaceEntry
                token={token}
                active={
                  active === "Research Repository" &&
                  !selectedResearch &&
                  !selectedExternalResearch
                }
                researchRows={researchRows}
                externalResearchRows={externalResearchRows}
                userRole={user?.role || ""}
                isManager={Boolean(isManager)}
                requestedMode={researchEntryModeRequest}
                modeRequestKey={researchEntryModeRequestKey}
                onCreateResearch={() => setResearchSourceChoiceOpen(true)}
                onImportExternal={() => {
                  requestResearchEntryMode("Imported");
                  setExternalResearchOpen(true);
                }}
                onOpenWorkspace={(project) => void openResearchWorkspace(project)}
                onOpenExternal={(item) => setSelectedExternalResearch(item)}
              />
            </Suspense>
            <section className="ai-research-management-view">
              <div className="assignment-page-head">
                <div>
                  <p>AI RESEARCHER</p>
                  <h2>Evidence-led research workspace</h2>
                  <span>
                    Research approved REDESY documents and live local records while
                    keeping every result offline and under human review.
                  </span>
                </div>
                <button onClick={() => setAiResearchOpen(true)}>
                  + Plan research
                </button>
              </div>
              {active === "AI Researcher" && <Suspense fallback={<div className="report-loading">Loading Felix research...</div>}><AIResearchChat
                engine={aiResearchEngine}
                jobs={aiResearchJobs}
                userRole={user.role}
                reviewRequest={felixReviewRequest}
                onAsk={askAiResearch}
                onAction={runFelixAction}
                onListProposals={listChangeProposals}
                onCreateProposal={createChangeProposal}
                onDecideProposal={decideChangeProposal}
              /></Suspense>}
              <div className="ai-engine-card">
                <div>
                  <strong>Offline REDESY mode</strong>
                  <span>No internet or paid provider. Felix uses local REDESY evidence only.</span>
                </div>
                <b
                  className={
                    aiResearchEngine?.ollamaConnected ? "connected" : "offline"
                  }
                >
                  {aiResearchEngine?.ollamaConnected
                    ? "Ollama connected"
                    : "Local engine offline"}
                </b>
                <div className="engine-parts">
                  <span
                    className={
                      aiResearchEngine?.gptResearcherConnected ? "ready" : ""
                    }
                  >
                    GPT Researcher adapter
                  </span>
                  <span
                    className={
                      aiResearchEngine?.researchMateConnected ? "ready" : ""
                    }
                  >
                    ResearchMate adapter
                  </span>
                  <span className="ready">PostgreSQL job store</span>
                </div>
              </div>
              {aiResearchNotice && (
                <div className="session-message">{aiResearchNotice}</div>
              )}
              <div className="ai-research-grid">
                {aiResearchJobs.map((job) => (
                  <article key={job.id}>
                    <header>
                      <span>{job.status}</span>
                      <b>{job.depth}</b>
                    </header>
                    <h3>{job.title}</h3>
                    <p>{job.question}</p>
                    <dl>
                      <div>
                        <dt>Sources</dt>
                        <dd>{job.source_mode}</dd>
                      </div>
                      <div>
                        <dt>Created by</dt>
                        <dd>{job.created_by_name}</dd>
                      </div>
                      <div>
                        <dt>Provider</dt>
                        <dd>{job.provider}</dd>
                      </div>
                      <div>
                        <dt>Cost policy</dt>
                        <dd>Zero API cost</dd>
                      </div>
                    </dl>
                    <div className="ai-plan">
                      {job.plan.map((item) => (
                        <div key={item.step}>
                          <b>{item.step}</b>
                          <span>
                            <strong>{item.title}</strong>
                            <small>{item.description}</small>
                          </span>
                        </div>
                      ))}
                    </div>
                    <footer>
                      <button onClick={() => startAiResearch(job)}>
                        Run locally
                      </button>
                      <span>{job.progress}% complete</span>
                    </footer>
                  </article>
                ))}
                {!aiResearchJobs.length && (
                  <div className="assignment-empty">
                    <Icon name="research" />
                    <h3>No AI research plans yet</h3>
                    <p>
                      Create a question and Felix will research approved REDESY
                      documents using the local AI engine.
                    </p>
                  </div>
                )}
              </div>
            </section>
            {user?.role === "System Admin" && (
              <section className="felix-admin-management-view">
                {active === "Felix Administration" && <Suspense fallback={<div className="report-loading">Loading Felix administration...</div>}><FelixAdmin token={token} /></Suspense>}
              </section>
            )}
            <Suspense fallback={<div className="report-loading">Loading Assignments Control Centre...</div>}>
              <AssignmentsControlCentreEntry
                active={active === "Assignments" && !selectedAssignment}
                canCreate={Boolean(isManager)}
                currentUserName={user?.name || ""}
                rows={assignmentRows}
                notice={assignmentNotice}
                onCreate={() => startAssignment()}
                onOpen={openAssignmentDetails}
                onEdit={(assignment) => startAssignment(assignment)}
                onDelete={removeAssignment}
                onUpdateStatus={async (assignment, status) => {
                  try {
                    await api.updateStatus(token, assignment.id, status);
                    await refreshAssignments();
                  } catch (error) {
                    const message =
                      error instanceof Error
                        ? error.message
                        : "Status could not be updated.";
                    setAssignmentNotice(message);
                    throw error;
                  }
                }}
              />
            </Suspense>
            {/* TASKS V1.11.1: repository content is rendered only in its own active workspace. */}
            <Suspense fallback={<div className="report-loading">Loading Tasks...</div>}>
              <TasksWorkspaceEntry
                token={token}
                active={active === "Tasks" && !selectedAssignmentTask}
                requestedTaskRequestView={taskRequestWorkspaceView}
                onRequestedTaskRequestViewConsumed={() => setTaskRequestWorkspaceView(null)}
                requestedTaskRequestTarget={dashboardTaskRequestTarget}
                onRequestedTaskRequestTargetConsumed={() => setDashboardTaskRequestTarget(null)}
                requestedDashboardTaskShortcut={dashboardTaskShortcut}
                onRequestedDashboardTaskShortcutConsumed={() => setDashboardTaskShortcut(null)}
                currentUserId={user?.id || ""}
                currentUserName={user?.name || ""}
                currentUserRole={user?.role || ""}
                isManager={Boolean(isManager)}
                onOpenTask={openStandaloneTask}
                prefillRequestAssignmentId={taskRequestAssignmentId}
                onPrefillRequestConsumed={() => setTaskRequestAssignmentId(null)}
              />
            </Suspense>
            <div hidden={active !== "Dashboard"}>
              {active === "Dashboard" && !dashboardModule && (
                <section className="dashboard-task-requests" aria-label="Task Requests dashboard panel">
                  <div className="dashboard-task-requests-copy">
                    <span>TASK WORKFLOW</span>
                    <h2>Task Requests</h2>
                    <p>Track requests you submitted and requests awaiting a supervisor decision.</p>
                  </div>
                  <div className="dashboard-task-requests-actions">
                    <button type="button" className="dashboard-task-request-action approval" onClick={() => setDashboardRequestPicker("approvals")}>
                      <span>Awaiting your approval</span>
                      <strong>{dashboardTaskRequests.filter((item) => item.can_decide && item.status === "Pending").length}</strong>
                      <small>Choose a request to review →</small>
                    </button>
                    <button type="button" className="dashboard-task-request-action mine" onClick={() => setDashboardRequestPicker("mine")}>
                      <span>My pending requests</span>
                      <strong>{dashboardTaskRequests.filter((item) => item.is_mine && item.status === "Pending").length}</strong>
                      <small>Choose a request →</small>
                    </button>
                  </div>
                </section>
              )}
              <ProgressiveDashboard
                initialModule={dashboardModule}
                onModuleChange={setDashboardModule}
                data={pulse.data}
                error={pulse.error}
                onRefresh={pulse.refresh}
                onOpen={openPulseWork}
                onCalendar={openPulseCalendar}
                onNavigate={navigateTo}
                canSee={canSeeNavigationItem}
                showTaskRequestApprovalCard={isManager}
                taskRequestApprovalCount={dashboardTaskRequests.filter((item) => item.can_decide && item.status === "Pending").length}
                taskRequestApprovalItems={dashboardTaskRequests.filter((item) => item.can_decide && item.status === "Pending")}
                onOpenTaskRequestApprovals={(requestId) => {
                  const selectedRequest = dashboardTaskRequests.find((item) => item.id === requestId && item.can_decide && item.status === "Pending");
                  if (!selectedRequest) return;
                  setTaskRequestWorkspaceView("Requests for Approval");
                  setDashboardTaskRequestTarget({ requestId: selectedRequest.id, intent: "approval" });
                  navigateTo("Tasks");
                }}
                onOpenTaskDashboardShortcut={(label, taskIds) => { setDashboardTaskShortcut({ label, taskIds }); setTaskRequestWorkspaceView(null); navigateTo("Tasks"); }}
              />
              <DashboardRecordPickerModal
                open={dashboardRequestPicker === "approvals"}
                title="Task Requests Awaiting Approval"
                description="Choose a pending request to open its supervisor decision form."
                items={dashboardTaskRequests.filter((item) => item.can_decide && item.status === "Pending").map((item) => ({
                  key: item.id,
                  title: item.title,
                  kind: "Task Request",
                  detail: [item.assignment_title, `Requested by ${item.requested_by_name}`, item.priority ? `Priority ${item.priority}` : ""].filter(Boolean).join(" · "),
                  status: item.status,
                  date: item.due_date || undefined,
                  onSelect: () => {
                    const selectedRequest = dashboardTaskRequests.find((candidate) => candidate.id === item.id && candidate.can_decide && candidate.status === "Pending");
                    if (!selectedRequest) return;
                    setTaskRequestWorkspaceView("Requests for Approval");
                    setDashboardTaskRequestTarget({ requestId: selectedRequest.id, intent: "approval" });
                    navigateTo("Tasks");
                  },
                }))}
                emptyMessage="No pending Task Requests are awaiting your decision."
                onClose={() => setDashboardRequestPicker(null)}
              />
              <DashboardRecordPickerModal
                open={dashboardRequestPicker === "mine"}
                title="My Pending Task Requests"
                description="Choose one of your requests to open it in the Task Requests workspace."
                items={dashboardTaskRequests.filter((item) => item.is_mine && item.status === "Pending").map((item) => ({
                  key: item.id,
                  title: item.title,
                  kind: "Task Request",
                  detail: [item.assignment_title, item.suggested_owner_name ? `Suggested owner ${item.suggested_owner_name}` : "", item.priority ? `Priority ${item.priority}` : ""].filter(Boolean).join(" · "),
                  status: item.status,
                  date: item.due_date || undefined,
                  onSelect: () => {
                    const selectedRequest = dashboardTaskRequests.find((candidate) => candidate.id === item.id && candidate.is_mine && candidate.status === "Pending");
                    if (!selectedRequest) return;
                    setTaskRequestWorkspaceView("Task Requests");
                    setDashboardTaskRequestTarget({ requestId: selectedRequest.id, intent: "focus" });
                    navigateTo("Tasks");
                  },
                }))}
                emptyMessage="You have no pending Task Requests."
                onClose={() => setDashboardRequestPicker(null)}
              />
            </div>
            
            
            
            
            

          </div>
        </main>
        {roleNavigation[user.role].includes("AI Researcher") && (<>
          <div
            className={
              active === "Document Repository" || active === "Documents"
                ? "felix-launcher-zone repository-felix-clearance"
                : "felix-launcher-zone"
            }
           data-felix-closeable-wrapper="true" data-felix-dismissed={felixLauncherDismissed ? "true" : "false"}>
            <button
              type="button"
              className="felix-launcher-close"
              aria-label="Close Felix assistant"
              title="Hide Felix assistant"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setFelixLauncherDismissed(true);
              }}
            >
              ×
            </button>            <FelixAssistant
              online={Boolean(aiResearchEngine?.ollamaConnected)}
              onOpen={() => {
                setActive("AI Researcher");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </div>
          {felixLauncherDismissed && (
            <button
              type="button"
              className="felix-launcher-reopen"
              aria-label="Reopen Felix assistant"
              title="Reopen Felix assistant"
              onClick={() => setFelixLauncherDismissed(false)}
            >
              Felix <span aria-hidden="true">+</span>
            </button>
          )}
          </>
        )}
        {profileMenuOpen && (
          <div
            className="account-menu-layer"
            onClick={() => setProfileMenuOpen(false)}
          >
            <section
              className="account-menu"
              onClick={(e) => e.stopPropagation()}
            >
              <button className="close" onClick={() => setProfileMenuOpen(false)}>
                ×
              </button>
              <header>
                <span className="user-icon">{user.initials}</span>
                <div><strong>{user.name}</strong><small>{user.email}</small><em>{user.role}</em></div>
              </header>
              <button
                onClick={() => {
                  setProfileMenuOpen(false);
                  setPasswordMode("change");
                  setPasswordMessage("");
                }}
              >
                Change password
              </button>
              <button className="account-sign-out" onClick={() => { setProfileMenuOpen(false); setShowLogout(true); }}>
                Sign out everywhere
              </button>
            </section>
          </div>
        )}
        {passwordMode === "change" && (
          <div className="modal-backdrop">
            <section
              className="profile-modal password-modal"
              onClick={(event) => event.stopPropagation()}
            >
              {!user?.mustChangePassword && (
                <button className="close" onClick={() => setPasswordMode(null)}>
                  ×
                </button>
              )}
              <h2>Change password</h2>
              <p>Your old sessions will be revoked immediately.</p>
              <form onSubmit={changePassword}>
                <label>
                  Current password
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    required
                  />
                </label>
                <label>
                  New password
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    minLength={10}
                    required
                  />
                </label>
                <label>
                  Confirm new password
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    minLength={10}
                    required
                  />
                </label>
                {passwordMessage && (
                  <div className="session-message" role="status">
                    {passwordMessage}
                  </div>
                )}
                <button
                  className="sign-in"
                  type="submit"
                  disabled={savingPassword}
                >
                  {savingPassword ? "Updating..." : "Change password"}
                </button>
              </form>
              {user?.mustChangePassword && (
                <button className="sign-in" type="button" onClick={signOut}>
                  Sign out
                </button>
              )}
            </section>
          </div>
        )}
        <AssignmentSourceChoiceModal
          open={assignmentSourceChoiceOpen}
          onClose={() => setAssignmentSourceChoiceOpen(false)}
          onChoose={(mode) => void beginAssignmentCreation(mode)}
        />
        <AssignmentEditorModal
          editor={assignmentEditor}
          creationMode={assignmentCreationMode}
          notice={assignmentNotice}
          assignmentForm={assignmentForm}
          onAssignmentFormChange={setAssignmentForm}
          onClose={() => setAssignmentEditor(null)}
          onSubmit={saveAssignment}
          externalFile={externalAssignmentFile}
          onExternalFileChange={setExternalAssignmentFile}
          externalReviewerId={externalAssignmentReviewerId}
          onExternalReviewerIdChange={setExternalAssignmentReviewerId}
          externalReviewNote={externalAssignmentReviewNote}
          onExternalReviewNoteChange={setExternalAssignmentReviewNote}
          externalActionStatus={externalAssignmentActionStatus}
          saving={savingAssignment}
          users={userRows}
          currentUserId={user?.id}
          team={team}
        />
        {selectedAudit && (
          <div
            className="modal-backdrop"
          >
            <section
              className="assignment-editor audit-detail"
              onClick={(event) => event.stopPropagation()}
            >
              <button className="close" onClick={() => setSelectedAudit(null)}>
                ×
              </button>
              <p>AUDIT EVENT #{selectedAudit.id}</p>
              <h2>{auditLabel(selectedAudit.action)}</h2>
              <div className="audit-detail-grid">
                <div>
                  <small>Performed by</small>
                  <strong>{selectedAudit.user_name}</strong>
                  <span>{selectedAudit.user_email || "System event"}</span>
                </div>
                <div>
                  <small>Date and time</small>
                  <strong>
                    {new Date(selectedAudit.created_at).toLocaleString("en-KE")}
                  </strong>
                </div>
                <div>
                  <small>Module</small>
                  <strong>{selectedAudit.entity_type}</strong>
                </div>
                <div>
                  <small>Record ID</small>
                  <strong>{selectedAudit.entity_id || "Not applicable"}</strong>
                </div>
              </div>
              <h3>Event description</h3>
              <p className="audit-description">
                {auditDescription(selectedAudit)}
              </p>
              <h3>Recorded details</h3>
              <pre>{JSON.stringify(selectedAudit.details, null, 2)}</pre>
              <small className="read-only-note">
                Audit records are read-only and cannot be changed from this
                system.
              </small>
            </section>
          </div>
        )}
        {createdAccount && (
          <div className="modal-backdrop">
            <section
              className="assignment-editor account-success"
              role="dialog"
              aria-modal="true"
              aria-labelledby="account-success-title"
            >
              <div className="success-mark">✓</div>
              <p>{createdAccount.setupEmailSent ? "SETUP LINK SENT" : "ACCOUNT CREATED"}</p>
              <h2 id="account-success-title">User account created successfully</h2>
              <span>
                {createdAccount.name} has been registered with the official email{" "}
                <strong>{createdAccount.email}</strong>.
              </span>
              <div className="session-message" role="status">
                {accountSetupMessage || (createdAccount.setupEmailSent
                  ? "A secure account setup link was accepted by the email server. Inbox delivery is not confirmed."
                  : "The account exists, but the setup email is not yet confirmed. Resend the link after checking email settings.")}
              </div>
              <div className="success-actions">
                <button className="add-another" onClick={resendCreatedAccountSetup} disabled={savingSetupLink}>
                  {savingSetupLink ? "Sending link..." : "Send / resend setup link"}
                </button>
                <button onClick={() => {
                  setCreatedAccount(null);
                  setAccountSetupMessage("");
                  openUserEditor();
                }}>
                  + Add another user
                </button>
                <button onClick={() => {
                  setCreatedAccount(null);
                  setAccountSetupMessage("");
                }}>
                  Close
                </button>
              </div>
            </section>
          </div>
        )}
        {userEditor && (
          <div
            className="modal-backdrop"
          >
            <section
              className="assignment-editor user-editor"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="close"
                type="button"
                aria-label="Close staff account editor"
                disabled={savingUser}
                onClick={() => setUserEditor(null)}
              >
                ×
              </button>
              <h2>
                {userEditor === "new"
                  ? "Create staff account"
                  : "Edit staff account"}
              </h2>
              <form onSubmit={saveUser}>
                <label>
                  Full name
                  <input
                    value={userForm.name}
                    onChange={(event) =>
                      setUserForm({ ...userForm, name: event.target.value })
                    }
                    required
                    minLength={3}
                    disabled={savingUser}
                  />
                  <small>Enter at least 3 characters.</small>
                </label>
                <label>
                  Official email
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(event) =>
                      setUserForm({ ...userForm, email: event.target.value })
                    }
                    required
                    disabled={savingUser}
                  />
                  <small>
                    Use a complete email address, for example
                    name@publicservice.go.ke.
                  </small>
                </label>
                <div className="form-pair">
                  <label>
                    Role
                    <select
                      value={userForm.role}
                      onChange={(event) =>
                        setUserForm({ ...userForm, role: event.target.value, supervisorId: "" })
                      }
                      disabled={savingUser || (userEditor !== "new" && !canAdministerUsers)}
                    >
                      {[
                        ...(user?.role === "System Admin" ? ["System Admin"] : []),
                        "Director",
                        "Deputy Director",
                        "Assistant Director",
                        "Researcher",
                      ].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                    <small>
                      Leadership roles receive scoped management access. System Admin access remains protected.
                    </small>
                  </label>
                  <label>
                    Division
                    <input
                      value={userForm.division}
                      onChange={(event) =>
                        setUserForm({
                          ...userForm,
                          division: event.target.value,
                        })
                      }
                      required
                      minLength={2}
                      disabled={savingUser}
                    />
                    <small>Enter at least 2 characters.</small>
                  </label>
                </div>
                {(() => {
                  const parentRole = ({"Deputy Director":"Director","Assistant Director":"Deputy Director","Researcher":"Assistant Director"} as Record<string,string>)[userForm.role];
                  if (!parentRole) return null;
                  const candidates = userRows.filter((member) => member.active && member.role === parentRole && member.id !== (userEditor === "new" ? "" : userEditor.id));
                  return <label className="user-supervisor-field">Reports to <select value={userForm.supervisorId} onChange={(event) => setUserForm({...userForm,supervisorId:event.target.value})} required disabled={savingUser || (userEditor !== "new" && !canAdministerUsers)}><option value="">Choose {parentRole}</option>{candidates.map((member) => <option key={member.id} value={member.id}>{member.name} — {member.division}</option>)}</select><small>{userForm.role} accounts must be assigned to one active {parentRole}. One {parentRole} may supervise several {userForm.role}s.</small>{!candidates.length && <b>Create an active {parentRole} account before saving this role.</b>}</label>;
                })()}
                {userEditor === "new" ? (
                  <div className="session-message">
                    A secure setup link will be sent to the official email address after the account is created.
                  </div>
                ) : (
                  <>
                    <label>
                      Availability
                      <select
                        value={userForm.status}
                        onChange={(event) =>
                          setUserForm({
                            ...userForm,
                            status: event.target.value,
                          })
                        }
                        disabled={savingUser}
                      >
                        {["Available", "Busy", "Away"].map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                    <label className="account-switch">
                      <input
                        type="checkbox"
                        checked={userForm.active}
                        onChange={(event) =>
                          setUserForm({
                            ...userForm,
                            active: event.target.checked,
                          })
                        }
                        disabled={savingUser || !canAdministerUsers}
                      />
                      <span>Account active</span>
                    </label>
                  </>
                )}
                {userFormError && (
                  <div className="user-form-error" role="alert">
                    {userFormError}
                  </div>
                )}
                <button className="sign-in" disabled={savingUser}>
                  {savingUser
                    ? userEditor === "new"
                      ? "Creating account..."
                      : "Saving changes..."
                    : userEditor === "new"
                      ? "Create account"
                      : "Save changes"}
                </button>
              </form>
            </section>
          </div>
        )}
        {knowledgeUploadOpen && (
          <div className="modal-backdrop repository-add-record-backdrop">
            <section
              className="assignment-editor repository-upload repository-add-record-wizard"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="repository-add-record-heading">
                <div>
                  <p>RECORDS & DOCUMENT MANAGEMENT</p>
                  <h2>Add record / document</h2>
                  <span>
                    Add an institutional record, reference, evidence or source without forcing it into Research.
                  </span>
                </div>
                <div className="repository-add-record-heading-actions">
                  <b>Step {knowledgeUploadStep} of 4</b>
                  <button
                    type="button"
                    className="repository-add-record-close"
                    disabled={knowledgeUploading}
                    onClick={() => setKnowledgeUploadOpen(false)}
                    aria-label="Close add record window"
                    title="Close"
                  >
                    <span aria-hidden="true">×</span>
                    Close
                  </button>
                </div>
              </div>

              <div className="repository-add-record-steps" aria-label="Add record progress">
                {[
                  [1, "Purpose & file"],
                  [2, "Classification"],
                  [3, "Relationship"],
                  [4, "Governance"],
                ].map(([step, label]) => (
                  <button
                    type="button"
                    key={String(step)}
                    disabled={knowledgeUploading}
                    className={knowledgeUploadStep === step ? "active" : knowledgeUploadStep > Number(step) ? "done" : ""}
                    onClick={() => setKnowledgeUploadStep(step as 1 | 2 | 3 | 4)}
                  >
                    <i>{Number(step)}</i>
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <form onSubmit={uploadKnowledge}>
                {knowledgeUploadStep === 1 && (
                  <section className="repository-add-record-step">
                    <header>
                      <small>STEP 1</small>
                      <h3>What are you adding?</h3>
                      <p>The purpose describes how REDESY should treat the item. It is separate from the records class and any business link.</p>
                    </header>

                    <div className="repository-purpose-grid">
                      {[
                        ["Official Record", "An authoritative institutional record"],
                        ["Reference", "Material kept for consultation or guidance"],
                        ["Evidence", "Evidence supporting a decision, task or finding"],
                        ["Source Material", "A source used for analysis or research"],
                        ["Supporting Document", "Supporting material for institutional work"],
                        ["Policy / Guideline", "Policy, manual, procedure or guidance"],
                        ["Minutes", "Meeting minutes or formal proceedings"],
                        ["Correspondence", "Letter, memo, email export or communication"],
                        ["Report", "Institutional, external or analytical report"],
                        ["Dataset", "Structured data or register used as evidence"],
                        ["Other", "Another governed document type"],
                      ].map(([value, hint]) => (
                        <button
                          type="button"
                          key={value}
                          className={knowledgeForm.documentType === value ? "active" : ""}
                          onClick={() => setKnowledgeForm({...knowledgeForm, documentType: value})}
                        >
                          <strong>{value}</strong>
                          <small>{hint}</small>
                        </button>
                      ))}
                    </div>

                    <label>
                      File
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                        disabled={knowledgeUploading}
                        onChange={(event) => setKnowledgeFile(event.target.files?.[0] || null)}
                        required
                      />
                      <small>{knowledgeFile ? `Selected: ${knowledgeFile.name}` : "PDF, DOCX, TXT or MD"}</small>
                    </label>

                    <label>
                      Record title
                      <input
                        value={knowledgeForm.title}
                        disabled={knowledgeUploading}
                        placeholder="Use the official or commonly recognised title"
                        onChange={(event) => setKnowledgeForm({...knowledgeForm, title: event.target.value})}
                        required
                      />
                    </label>

                    <label>
                      Short description
                      <textarea
                        value={knowledgeForm.description}
                        disabled={knowledgeUploading}
                        placeholder="What is this record and why is it being kept?"
                        onChange={(event) => setKnowledgeForm({...knowledgeForm, description: event.target.value})}
                      />
                    </label>
                  </section>
                )}

                {knowledgeUploadStep === 2 && (
                  <section className="repository-add-record-step">
                    <header>
                      <small>STEP 2</small>
                      <h3>Classify the record</h3>
                      <p>Classification describes what institutional records family the item belongs to.</p>
                    </header>

                    <div className="form-pair">
                      <label>
                        Records class
                        <select
                          value={knowledgeForm.category}
                          disabled={knowledgeUploading}
                          onChange={(event) => setKnowledgeForm({...knowledgeForm, category: event.target.value})}
                        >
                          {[
                            "Administrative Records",
                            "Policies & Guidelines",
                            "Reports & Publications",
                            "Meeting Records",
                            "Correspondence",
                            "Evidence & Supporting Records",
                            "Data & Registers",
                            "Legal & Compliance",
                            "HR Records",
                            "Finance & Procurement",
                            "ICT & Digital Records",
                            "Research & Knowledge",
                            "Other",
                          ].map((value) => <option key={value}>{value}</option>)}
                        </select>
                      </label>

                      <label>
                        Security classification
                        <select
                          value={knowledgeForm.classification}
                          disabled={knowledgeUploading}
                          onChange={(event) => setKnowledgeForm({...knowledgeForm, classification: event.target.value})}
                        >
                          {["PUBLIC","INTERNAL","CONFIDENTIAL","RESTRICTED"].map((value) => <option key={value}>{value}</option>)}
                        </select>
                      </label>
                    </div>

                    <div className="form-pair">
                      <label>
                        Originating office / directorate
                        <input
                          value={knowledgeForm.directorate}
                          disabled={knowledgeUploading}
                          placeholder="e.g. ICT Directorate"
                          onChange={(event) => setKnowledgeForm({...knowledgeForm, directorate: event.target.value})}
                        />
                      </label>
                      <label>
                        Author / issuing body
                        <input
                          value={knowledgeForm.author}
                          disabled={knowledgeUploading}
                          placeholder="Person, institution or office"
                          onChange={(event) => setKnowledgeForm({...knowledgeForm, author: event.target.value})}
                        />
                      </label>
                    </div>

                    <div className="form-pair">
                      <label>
                        Document date
                        <input
                          type="date"
                          value={knowledgeForm.documentDate}
                          disabled={knowledgeUploading}
                          onChange={(event) => setKnowledgeForm({...knowledgeForm, documentDate: event.target.value})}
                        />
                      </label>
                      <label>
                        Subject
                        <input
                          value={knowledgeForm.subject}
                          disabled={knowledgeUploading}
                          placeholder="Short subject or topic"
                          onChange={(event) => setKnowledgeForm({...knowledgeForm, subject: event.target.value})}
                        />
                      </label>
                    </div>

                    <label>
                      Tags
                      <input
                        value={knowledgeForm.tags}
                        disabled={knowledgeUploading}
                        onChange={(event) => setKnowledgeForm({...knowledgeForm, tags: event.target.value})}
                        placeholder="governance, HR, digital, policy"
                      />
                    </label>
                  </section>
                )}

                {knowledgeUploadStep === 3 && (
                  <section className="repository-add-record-step">
                    <header>
                      <small>STEP 3</small>
                      <h3>Where did it come from?</h3>
                      <p>A record may stand alone or be linked to Assignment, Task, Research or a REDESY Report. The original record remains in one governed Repository.</p>
                    </header>

                    <div className="repository-source-choice-grid">
                      {[
                        ["App2 Upload", "Standalone institutional record", "Not tied to another REDESY workspace"],
                        ["External Upload", "External / received document", "Received from an external person or institution"],
                        ["Internet", "Internet source", "Keep the original URL with the record"],
                        ["Assignment", "Assignment", "Produced by or supports an Assignment"],
                        ["Task", "Task", "Produced by or supports a Task"],
                        ["Research", "Research", "Used by or produced by Research"],
                        ["App2 Report", "App2 Report", "Generated from a REDESY report workflow"],
                      ].map(([value, label, hint]) => (
                        <button
                          type="button"
                          key={value}
                          className={knowledgeForm.sourceType === value ? "active" : ""}
                          onClick={() => setKnowledgeForm({
                            ...knowledgeForm,
                            sourceType: value,
                            sourceUrl: "",
                            originEntityId: "",
                          })}
                        >
                          <strong>{label}</strong>
                          <small>{hint}</small>
                        </button>
                      ))}
                    </div>

                    {knowledgeForm.sourceType === "Internet" && (
                      <label>
                        Original source URL
                        <input
                          type="url"
                          required
                          value={knowledgeForm.sourceUrl}
                          disabled={knowledgeUploading}
                          onChange={(event) => setKnowledgeForm({...knowledgeForm, sourceUrl: event.target.value})}
                          placeholder="https://..."
                        />
                      </label>
                    )}

                    {["Research","Assignment","Task","App2 Report"].includes(knowledgeForm.sourceType) && (
                      <label>
                        Linked REDESY record
                        <select
                          required
                          value={knowledgeForm.originEntityId}
                          disabled={knowledgeUploading}
                          onChange={(event) => setKnowledgeForm({...knowledgeForm, originEntityId: event.target.value})}
                        >
                          <option value="">Choose {knowledgeForm.sourceType.toLowerCase()}</option>
                          {repositoryOrigins
                            .filter((item) => item.type === knowledgeForm.sourceType)
                            .map((item) => (
                              <option value={item.id} key={item.id}>{item.title}</option>
                            ))}
                        </select>
                        <small>The Repository keeps one governed copy; other modules reference this record instead of duplicating it.</small>
                      </label>
                    )}

                    <div className="repository-relationship-principle">
                      <strong>One record, many relationships</strong>
                      <span>
                        A record can later be cited as evidence, reference or source by multiple Assignments, Tasks or Research projects without creating duplicate files.
                      </span>
                    </div>
                  </section>
                )}

                {knowledgeUploadStep === 4 && (
                  <section className="repository-add-record-step">
                    <header>
                      <small>STEP 4</small>
                      <h3>Governance and review</h3>
                      <p>Every new Repository item has accountable provenance and an independent reviewer before approval.</p>
                    </header>

                    <label className="repository-reviewer-field">
                      Assigned reviewer <span aria-hidden="true">*</span>
                      <select
                        required
                        value={knowledgeForm.reviewerId}
                        disabled={knowledgeUploading}
                        onChange={(event) => setKnowledgeForm({...knowledgeForm, reviewerId: event.target.value})}
                      >
                        <option value="">Select reviewer</option>
                        {documentReviewerOptions
                          .filter((member) => member.id !== user?.id)
                          .map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.name} · {member.role}{member.division ? ` · ${member.division}` : ""}
                            </option>
                          ))}
                      </select>
                      <small>Self-review is blocked. The reviewer validates the uploaded record before publication.</small>
                    </label>

                    <label className="setting-toggle repository-felix-toggle">
                      <input
                        type="checkbox"
                        checked={knowledgeForm.felixEnabled}
                        disabled={knowledgeUploading}
                        onChange={(event) => setKnowledgeForm({...knowledgeForm, felixEnabled: event.target.checked})}
                      />
                      <span>
                        <strong>Make available to Felix after approval</strong>
                        <small>Draft or rejected records remain unavailable to Felix.</small>
                      </span>
                    </label>

                    <div className="repository-add-record-summary">
                      <div><small>Purpose</small><strong>{knowledgeForm.documentType}</strong></div>
                      <div><small>Class</small><strong>{knowledgeForm.category}</strong></div>
                      <div><small>Source</small><strong>{knowledgeForm.sourceType === "App2 Upload" ? "Standalone record" : knowledgeForm.sourceType}</strong></div>
                      <div><small>Classification</small><strong>{knowledgeForm.classification}</strong></div>
                    </div>

                    <div className="provenance-note">
                      <strong>Accountability recorded automatically</strong>
                      <span>REDESY records the uploader, reviewer, file hash, version, review actions and final approver.</span>
                    </div>
                  </section>
                )}

                {knowledgeUploadProgress.progress > 0 && (
                  <div className={`upload-link-progress ${knowledgeUploadProgress.state}`} role="status" aria-live="polite">
                    <div><i style={{width: `${knowledgeUploadProgress.progress}%`}} /></div>
                    <span>{knowledgeUploadProgress.label}</span>
                  </div>
                )}

                {knowledgeUploadProgress.state === "failed" && knowledgeNotice && (
                  <div className="user-form-error" role="alert">{knowledgeNotice}</div>
                )}

                <footer className="repository-add-record-actions">
                  <button
                    type="button"
                    disabled={knowledgeUploading || knowledgeUploadStep === 1}
                    onClick={() => setKnowledgeUploadStep((Math.max(1, knowledgeUploadStep - 1)) as 1 | 2 | 3 | 4)}
                  >
                    ← Back
                  </button>
                  <span>Step {knowledgeUploadStep} of 4</span>
                  {knowledgeUploadStep < 4 ? (
                    <button
                      type="button"
                      className="primary"
                      disabled={
                        knowledgeUploading ||
                        (knowledgeUploadStep === 1 && (!knowledgeFile || !knowledgeForm.title.trim() || !knowledgeForm.documentType)) ||
                        (knowledgeUploadStep === 2 && !knowledgeForm.category) ||
                        (knowledgeUploadStep === 3 &&
                          ((knowledgeForm.sourceType === "Internet" && !knowledgeForm.sourceUrl) ||
                           (["Research","Assignment","Task","App2 Report"].includes(knowledgeForm.sourceType) && !knowledgeForm.originEntityId)))
                      }
                      onClick={() => setKnowledgeUploadStep((Math.min(4, knowledgeUploadStep + 1)) as 1 | 2 | 3 | 4)}
                    >
                      Continue →
                    </button>
                  ) : (
                    <button
                      className="sign-in"
                      disabled={knowledgeUploading || !knowledgeForm.reviewerId}
                    >
                      {knowledgeUploading ? "Adding record..." : "Add record and submit for review"}
                    </button>
                  )}
                </footer>
              </form>
            </section>
          </div>
        )}

        {repositoryBulkIntakeOpen && (
          <RepositoryBulkIntake token={token} reviewers={documentReviewerOptions}
            onClose={() => setRepositoryBulkIntakeOpen(false)} onComplete={refreshDocuments} />
        )}
        {repositoryWorkspaceDocument && (
          <RepositoryRecordWorkspace token={token} document={repositoryWorkspaceDocument}
            isManager={isManager} documents={documentRows}
            onClose={() => void closeRepositoryWorkspace()} onChanged={refreshDocuments} />
        )}

        {protectionDocument && (
          <div className="modal-backdrop repository-protection-backdrop">
            <section className="assignment-editor repository-protection-dialog">
              <button className="close" onClick={() => setProtectionDocument(null)}>×</button>
              <p>DOCUMENT PROTECTION & ACCESS</p>
              <h2>{protectionDocument.title}</h2>
              <span>
                Control who may read this record and whether authorised readers may download, copy,
                print or reuse it as evidence/reference. Restrictions are enforced by the backend.
              </span>

              <div className="repository-protection-levels">
                {[
                  ["INHERITED","Normal REDESY scope","Use existing REDESY RBAC and Repository permissions."],
                  ["TEAM","Team only","Owner, reviewer and authorised management team."],
                  ["NAMED_USERS","Named readers","Only explicitly selected readers plus authorised custodians."],
                  ["REVIEWER_ONLY","Reviewer only","Owner, reviewer/approver and authorised management."],
                  ["MANAGEMENT_ONLY","Management only","Restrict ordinary staff from opening the record."],
                ].map(([value,label,hint]) => (
                  <button type="button" key={value}
                    className={protectionForm.readerScope===value?"active":""}
                    onClick={() => setProtectionForm({...protectionForm,readerScope:value as DocumentProtectionPolicy["reader_scope"]})}>
                    <strong>{label}</strong><small>{hint}</small>
                  </button>
                ))}
              </div>

              {protectionForm.readerScope === "NAMED_USERS" && (
                <label className="repository-protection-readers">
                  Named readers
                  <select multiple value={protectionForm.userIds}
                    onChange={(event) => setProtectionForm({
                      ...protectionForm,
                      userIds:Array.from(event.currentTarget.selectedOptions).map((option)=>option.value),
                    })}>
                    {documentReviewerOptions.filter((member)=>member.id!==user?.id).map((member)=>(
                      <option key={member.id} value={member.id}>{member.name} · {member.role}</option>
                    ))}
                  </select>
                  <small>Use Ctrl/Cmd to select more than one reader.</small>
                </label>
              )}

              <div className="repository-protection-capabilities">
                {[
                  ["allowDownload","Download","Allow the original file to leave REDESY."],
                  ["allowCopy","Copy","Allow normal text/content copying."],
                  ["allowPrint","Print","Allow printing from supported REDESY viewers."],
                  ["allowLink","Link","Allow this record to be reused as evidence/reference."],
                  ["watermark","Watermark","Show identity/time watermark in protected previews."],
                ].map(([field,label,hint]) => (
                  <label key={field}>
                    <input type="checkbox"
                      checked={Boolean(protectionForm[field as keyof typeof protectionForm])}
                      onChange={(event)=>setProtectionForm({...protectionForm,[field]:event.target.checked})}/>
                    <span><strong>{label}</strong><small>{hint}</small></span>
                  </label>
                ))}
              </div>

              <div className="form-pair">
                <label>
                  Restriction expires
                  <input type="datetime-local" value={protectionForm.expiresAt}
                    onChange={(event)=>setProtectionForm({...protectionForm,expiresAt:event.target.value})}/>
                  <small>Optional. After expiry, protected access is denied until a manager reviews the policy.</small>
                </label>
                <label>
                  Reason for restriction
                  <textarea value={protectionForm.restrictionReason}
                    placeholder="Why is this record restricted?"
                    onChange={(event)=>setProtectionForm({...protectionForm,restrictionReason:event.target.value})}/>
                </label>
              </div>

              <div className="repository-protection-warning">
                <strong>Screen capture limitation</strong>
                <span>No application can prevent someone photographing a visible screen. REDESY can restrict view,
                download, copy, print and linking, add watermarks, and audit protected access.</span>
              </div>

              <div className="review-actions">
                <button type="button" onClick={()=>setProtectionDocument(null)}>Cancel</button>
                <button type="button" className="approve"
                  disabled={protectionSaving || (protectionForm.readerScope==="NAMED_USERS" && protectionForm.userIds.length===0)}
                  onClick={()=>void saveDocumentProtection()}>
                  {protectionSaving?"Saving...":"Save protection"}
                </button>
              </div>
            </section>
          </div>
        )}

        {relationshipDocument && (
          <div className="modal-backdrop repository-relationship-backdrop">
            <section className="assignment-editor repository-relationship-dialog">
              <button className="close" onClick={() => setRelationshipDocument(null)}>×</button>
              <p>RECORD RELATIONSHIPS & EVIDENCE</p>
              <h2>{relationshipDocument.title}</h2>
              <span>
                Link this governed Repository record to institutional work without duplicating the file.
                Evidence can be pinned to the exact version used.
              </span>

              <div className="repository-relationship-form">
                <label>
                  Relationship
                  <select value={relationshipForm.relationshipType}
                    onChange={(event) => setRelationshipForm({...relationshipForm, relationshipType: event.target.value as RepositoryRelationship["relationship_type"]})}>
                    {["Evidence for","Reference for","Source for","Supports","Produced by","Supersedes","Related to","Annex to"].map((value) => <option key={value}>{value}</option>)}
                  </select>
                </label>
                <label>
                  Link to
                  <select value={relationshipForm.entityType}
                    onChange={(event) => setRelationshipForm({...relationshipForm, entityType: event.target.value as RepositoryRelationship["entity_type"], entityId: ""})}>
                    <option value="assignment">Assignment</option>
                    <option value="task">Task</option>
                    <option value="research">Research</option>
                    <option value="report">REDESY Report</option>
                  </select>
                </label>
                <label className="repository-relationship-target">
                  Target record
                  <select value={relationshipForm.entityId}
                    onChange={(event) => setRelationshipForm({...relationshipForm, entityId: event.target.value})}>
                    <option value="">Choose target</option>
                    {repositoryOrigins
                      .filter((origin) => origin.type.toLowerCase().replace("app2 ","") === relationshipForm.entityType)
                      .map((origin) => <option key={origin.id} value={origin.id}>{origin.title}</option>)}
                  </select>
                </label>
                <label className="repository-pin-version">
                  <input type="checkbox" checked={relationshipForm.pinCurrentVersion}
                    onChange={(event) => setRelationshipForm({...relationshipForm, pinCurrentVersion: event.target.checked})} />
                  <span>
                    <strong>Pin current version v{Math.max(1, Number(relationshipDocument.current_version || 1))}</strong>
                    <small>Recommended for evidence and formal references so later updates do not change the historical basis.</small>
                  </span>
                </label>
                <label className="repository-relationship-notes">
                  Relationship note
                  <textarea value={relationshipForm.notes}
                    placeholder="Why is this record relevant to the selected work?"
                    onChange={(event) => setRelationshipForm({...relationshipForm, notes: event.target.value})} />
                </label>
                <button type="button" className="approve" disabled={!relationshipForm.entityId || relationshipSaving}
                  onClick={() => void saveDocumentRelationship()}>
                  {relationshipSaving ? "Linking..." : "Add relationship"}
                </button>
              </div>

              <div className="repository-relationship-list">
                <header>
                  <strong>Current relationships</strong>
                  <span>{documentRelationships.length}</span>
                </header>
                {documentRelationships.length === 0 ? (
                  <p>No relationships have been recorded yet.</p>
                ) : documentRelationships.map((relationship) => (
                  <article key={relationship.id}>
                    <div>
                      <b>{relationship.relationship_type}</b>
                      <strong>{relationship.entity_title || relationship.entity_id}</strong>
                      <small>
                        {relationship.entity_type}
                        {relationship.pinned_version_number ? ` · pinned to v${relationship.pinned_version_number}` : " · follows current version"}
                      </small>
                      {relationship.notes && <span>{relationship.notes}</span>}
                    </div>
                    <button type="button" onClick={() => void removeDocumentRelationship(relationship.id)}>Remove</button>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {improvementDocument && (
          <div className="modal-backdrop repository-improvement-backdrop">
            <section className="assignment-editor repository-improvement-dialog">
              <button className="close" onClick={() => setImprovementDocument(null)}>×</button>
              <p>CONTROLLED DOCUMENT IMPROVEMENT</p>
              <h2>{improvementDocument.title}</h2>
              <span>
                Assign an officer to prepare a new version. The current approved version remains the official record
                until the new version is submitted and reviewed.
              </span>

              <div className="repository-improvement-current">
                <div><small>Current version</small><strong>v{Math.max(1, Number(improvementDocument.current_version || 1))}</strong></div>
                <div><small>Lifecycle</small><strong>{improvementDocument.records_lifecycle_state || improvementDocument.status}</strong></div>
                <div><small>Reviewer</small><strong>{improvementDocument.reviewer_name || "Not assigned"}</strong></div>
              </div>

              <label>
                Improvement type
                <select value={improvementForm.improvementType}
                  onChange={(event) => setImprovementForm({...improvementForm, improvementType: event.target.value as DocumentImprovementAssignment["improvement_type"]})}>
                  {["Content Update","Policy Review","Legal Review","Metadata Improvement","Formatting","Annual Review","Other"].map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
              <label>
                Assign to
                <select required value={improvementForm.assigneeId}
                  onChange={(event) => setImprovementForm({...improvementForm, assigneeId: event.target.value})}>
                  <option value="">Choose officer</option>
                  {documentReviewerOptions.map((member) => (
                    <option key={member.id} value={member.id}>{member.name} · {member.role}</option>
                  ))}
                </select>
              </label>
              <label>
                Reviewer
                <select required value={improvementForm.reviewerId}
                  onChange={(event) => setImprovementForm({...improvementForm, reviewerId: event.target.value})}>
                  <option value="">Choose reviewer</option>
                  {documentReviewerOptions.filter((member) => member.id !== improvementForm.assigneeId).map((member) => (
                    <option key={member.id} value={member.id}>{member.name} · {member.role}</option>
                  ))}
                </select>
              </label>
              <label>
                Due date
                <input type="date" value={improvementForm.dueDate}
                  onChange={(event) => setImprovementForm({...improvementForm, dueDate: event.target.value})} />
              </label>
              <label>
                What must be improved?
                <textarea value={improvementForm.reason} minLength={5}
                  placeholder="Describe the content, policy, legal, metadata or formatting changes required."
                  onChange={(event) => setImprovementForm({...improvementForm, reason: event.target.value})} />
              </label>
              <div className="review-actions">
                <button type="button" onClick={() => setImprovementDocument(null)}>Cancel</button>
                <button type="button" className="approve" disabled={improvementSaving || !improvementForm.assigneeId || !improvementForm.reviewerId || improvementForm.reason.trim().length < 5}
                  onClick={() => void saveDocumentImprovement()}>
                  {improvementSaving ? "Assigning..." : "Assign improvement"}
                </button>
              </div>
            </section>
          </div>
        )}

        {selectedKnowledge && (
          <div
            className="modal-backdrop"
          >
            <section
              className="assignment-editor"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="close"
                onClick={() => setSelectedKnowledge(null)}
              >
                ×
              </button>
              <p className="repository-version-eyebrow">VERSION & IMPROVEMENT WORKSPACE</p>
              <h2>{selectedKnowledge.title}</h2>
              <p>{selectedKnowledge.description}</p>
              <div className="repository-version-governance-note">
                The current approved record is never overwritten. Uploading a new file creates a traceable version;
                assigned improvements must be reviewed before they replace the approved record.
              </div>
              <div className="version-list">
                {knowledgeVersions.map((version, index) => (
                  <div
                    key={version.id}
                    className={`repository-version-row ${index === 0 ? "current" : "historical"}`}
                  >
                    <span className="repository-version-main">
                      <span className="repository-version-title">
                        <strong>Version {version.version_number}</strong>
                        {index === 0 && <b>Current</b>}
                      </span>

                      <small>{version.original_name}</small>

                      <small className="repository-version-meta">
                        Uploaded by {version.created_by_name || "Unknown user"}
                        {version.created_at
                          ? ` · ${new Date(version.created_at).toLocaleString()}`
                          : ""}
                      </small>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setReaderVersionId(version.id);
                        setReaderDocument(selectedKnowledge as DocumentItem);
                        setSelectedKnowledge(null);
                      }}
                    >
                      Read
                    </button>
                    <button
                      type="button"
                      disabled={knowledgeVersionDownloadId === version.id}
                      onClick={() => {
                        setKnowledgeVersionDownloadId(version.id);
                        setKnowledgeVersionDownloadMessage(`Preparing PDF for version ${version.version_number}…`);
                        void api.downloadKnowledgeVersion(token, version.id, version.original_name)
                          .then(() => setKnowledgeVersionDownloadMessage("PDF downloaded."))
                          .catch((error) => setKnowledgeVersionDownloadMessage(
                            error instanceof Error ? error.message : "PDF could not be downloaded.",
                          ))
                          .finally(() => setKnowledgeVersionDownloadId(""));
                      }}
                    >
                      {knowledgeVersionDownloadId === version.id ? "Preparing PDF…" : "Download PDF"}
                    </button>
                  </div>
                ))}
              </div>
              {knowledgeVersionDownloadMessage && (
                <p className="repository-version-download-status" role="status">
                  {knowledgeVersionDownloadMessage}
                </p>
              )}
              <label className="version-upload">
                Upload improved / new version
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      try {
                        await api.uploadKnowledgeVersion(
                          token,
                          selectedKnowledge.id,
                          file,
                        );
                        setKnowledgeVersions(
                          await api.knowledgeVersions(
                            token,
                            selectedKnowledge.id,
                          ),
                        );
                      } catch (error) {
                        setKnowledgeNotice(
                          error instanceof Error
                            ? error.message
                            : "Version could not be uploaded.",
                        );
                        setSelectedKnowledge(null);
                      }
                    }
                  }}
                />
              </label>
              {isManager && (
                <div className="review-actions">
                  <button
                    className="reject"
                    onClick={() => removeKnowledge(selectedKnowledge)}
                  >
                    Delete document and all versions
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
        {documentActivityTarget && (
          <div
            className="modal-backdrop repository-activity-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setDocumentActivityTarget(null);
                setDocumentActivityRows([]);
                setDocumentActivityError("");
              }
            }}
          >
            <section
              className="repository-activity-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="repository-activity-title"
            >
              <header>
                <div>
                  <p>INSTITUTIONAL AUDIT TRAIL</p>
                  <h2 id="repository-activity-title">{documentActivityTarget.title}</h2>
                  <span aria-label="Read-only institutional activity and audit history for this repository document. Downloads, protected access, copy controls, reviewer changes and governance actions are recorded when emitted by their governed endpoints.">Read-only chronology of access, review, publication, governance and security events. Technical evidence remains available when required.</span>
                </div>
                <button
                  type="button"
                  className="close"
                  aria-label="Close document activity"
                  onClick={() => {
                    setDocumentActivityTarget(null);
                    setDocumentActivityRows([]);
                    setDocumentActivityError("");
                  }}
                >
                  ×
                </button>
              </header>
              <div className="repository-activity-summary">
                <span><b>{documentActivityRows.length}</b> recorded</span>
                <span title="access events"><b>{documentActivityRows.filter(row => repositoryActivityCategory(row.action) === "Access").length}</b> access</span>
                <span title="governance events"><b>{documentActivityRows.filter(row => ["Review","Approval","Publication","Governance","Security"].includes(repositoryActivityCategory(row.action))).length}</b> governed</span>
                <span>Read only · auditable</span>
              </div>
              <div className="repository-activity-list institutional-audit-timeline">
                {documentActivityLoading && <p className="repository-activity-empty">Loading document activity…</p>}
                {!documentActivityLoading && documentActivityError && (
                  <p className="repository-activity-error">{documentActivityError}</p>
                )}
                {!documentActivityLoading && !documentActivityError && groupedRepositoryActivityRows(documentActivityRows).map((row, index, groupedRows) => {
                  const category = repositoryActivityCategory(row.action);
                  const eventType = category.toLowerCase();
                  const dayLabel = repositoryActivityDayLabel(row.created_at);
                  const previousDay = index > 0 ? repositoryActivityDayLabel(groupedRows[index - 1].created_at) : "";
                  return (
                    <div key={row.id} className="repository-activity-entry">
                      {dayLabel !== previousDay && <div className="repository-activity-day">{dayLabel}</div>}
                      <article className={`repository-activity-event ${eventType}`}>
                        <i aria-hidden="true" />
                        <div>
                          <div className="repository-activity-event-head">
                            <strong>
                              {repositoryActivityLabel(row.action)}
                              {row.repeat_count > 1 ? ` · ${row.repeat_count} times` : ""}
                            </strong>
                            <span>{category}</span>
                          </div>

                          <p className="repository-activity-human-summary">
                            {repositoryActivitySummary(row.action, row.details)}
                          </p>

                          <small className="repository-activity-actor">
                            {row.user_name || "System"} ·{" "}
                            {new Date(row.created_at).toLocaleString("en-KE")}
                          </small>

                          <details className="repository-activity-technical-details">
                            <summary>Technical details</summary>
                            <p>{formatRepositoryActivityDetails(row.details)}</p>
                            <small>Event: {formatRepositoryActivityAction(row.action)} · Audit ID: {row.id}</small>
                          </details>
                        </div>
                      </article>
                    </div>
                  );
                })}
                {!documentActivityLoading && !documentActivityError && !documentActivityRows.length && (
                  <p className="repository-activity-empty">No document activity has been recorded yet.</p>
                )}
              </div>
            </section>
          </div>
        )}

        {researchSourceChoiceOpen && (
          <ResearchSourceChoiceModal
            onClose={() => setResearchSourceChoiceOpen(false)}
            onInternal={() => {
              setResearchSourceChoiceOpen(false);
              setResearchFormStep(1);
              setResearchOpen(true);
            }}
            onExternal={() => {
              setResearchSourceChoiceOpen(false);
              setSelectedResearch(null);
              requestResearchEntryMode("Imported");
              setExternalResearchOpen(true);
            }}
          />
        )}
        {researchOpen && (
          <ResearchCreationWizard
            researchForm={researchForm}
            setResearchForm={setResearchForm}
            researchFormStep={researchFormStep}
            setResearchFormStep={setResearchFormStep}
            researchBriefComplete={researchBriefComplete}
            researchBriefMissing={researchBriefMissing}
            researchTimelineComplete={researchTimelineComplete}
            researchCreateNotice={researchCreateNotice}
            researchCreating={researchCreating}
            team={team}
            saveResearch={saveResearch}
            setResearchOpen={setResearchOpen}
            setResearchCreateNotice={setResearchCreateNotice}
          />
        )}
        {aiResearchOpen && (
          <div
            className="modal-backdrop"
          >
            <section
              className="assignment-editor ai-research-editor"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="close"
                onClick={() => setAiResearchOpen(false)}
              >
                x
              </button>
              <p>FREE LOCAL MODE</p>
              <h2>Plan AI-assisted research</h2>
              <form onSubmit={saveAiResearch}>
                <label>
                  Research title
                  <input
                    value={aiResearchForm.title}
                    onChange={(event) =>
                      setAiResearchForm({
                        ...aiResearchForm,
                        title: event.target.value,
                      })
                    }
                    minLength={4}
                    required
                  />
                </label>
                <label>
                  Primary research question
                  <textarea
                    value={aiResearchForm.question}
                    onChange={(event) =>
                      setAiResearchForm({
                        ...aiResearchForm,
                        question: event.target.value,
                      })
                    }
                    minLength={10}
                    required
                    placeholder="What decision should this research help the Commission make?"
                  />
                </label>
                <label>
                  Scope and boundaries
                  <textarea
                    value={aiResearchForm.scope}
                    onChange={(event) =>
                      setAiResearchForm({
                        ...aiResearchForm,
                        scope: event.target.value,
                      })
                    }
                    placeholder="Countries, period, population, exclusions or required policy context"
                  />
                </label>
                <div className="form-pair">
                  <label>
                    Evidence sources
                    <select
                      value={aiResearchForm.sourceMode}
                      onChange={(event) =>
                        setAiResearchForm({
                          ...aiResearchForm,
                          sourceMode: event.target.value,
                        })
                      }
                    >
                      <option value="App2 Documents">REDESY Documents</option>
                    </select>
                  </label>
                  <label>
                    Research depth
                    <select
                      value={aiResearchForm.depth}
                      onChange={(event) =>
                        setAiResearchForm({
                          ...aiResearchForm,
                          depth: event.target.value,
                        })
                      }
                    >
                      <option>Quick</option>
                      <option>Standard</option>
                      <option>Deep</option>
                    </select>
                  </label>
                </div>
                <div className="zero-cost-note">
                  <strong>Cost safeguard</strong>
                  <span>
                    This plan uses Local Ollama only. It will stop instead of
                    calling a paid provider.
                  </span>
                </div>
                <button className="sign-in">Create research plan</button>
              </form>
            </section>
          </div>
        )}
        {deletionRequestDocument && (
          <div
            className="modal-backdrop"
          >
            <section
              className="assignment-editor deletion-request-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="close"
                onClick={() => setDeletionRequestDocument(null)}
              >
                ×
              </button>
              <p>CONTROLLED DELETION</p>
              <h2>Request document deletion</h2>
              <strong>{deletionRequestDocument.title}</strong>
              <span>
                The document and its versions remain available until a manager
                approves this request.
              </span>
              <label>
                Reason for deletion
                <textarea
                  autoFocus
                  minLength={5}
                  maxLength={2000}
                  value={deletionRequestReason}
                  onChange={(event) =>
                    setDeletionRequestReason(event.target.value)
                  }
                  placeholder="Explain why this record should be permanently removed."
                />
              </label>
              <button
                className="danger"
                disabled={deletionRequestReason.trim().length < 5}
                onClick={submitDeletionRequest}
              >
                Send for manager approval
              </button>
            </section>
          </div>
        )}
        {deletionDecision && (
          <div
            className="modal-backdrop"
          >
            <section
              className="assignment-editor deletion-request-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="close"
                onClick={() => setDeletionDecision(null)}
              >
                ×
              </button>
              <p>MANAGER DECISION</p>
              <h2>Review deletion request</h2>
              <strong>{deletionDecision.knowledge_title}</strong>
              <small>Requested by {deletionDecision.requested_by_name}</small>
              <blockquote>{deletionDecision.reason}</blockquote>
              <label>
                Decision comments
                <textarea
                  value={deletionDecisionComments}
                  onChange={(event) =>
                    setDeletionDecisionComments(event.target.value)
                  }
                  placeholder="Record the reason for approving or rejecting this request."
                />
              </label>
              <div className="review-actions">
                <button
                  className="reject"
                  onClick={() => decideDeletionRequest(false)}
                >
                  Reject request
                </button>
                <button
                  className="danger"
                  onClick={() => decideDeletionRequest(true)}
                >
                  Approve permanent deletion
                </button>
              </div>
            </section>
          </div>
        )}
        {retentionDocument && (
          <div
            className="modal-backdrop"
          >
            <section
              className="assignment-editor retention-editor"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="close"
                onClick={() => setRetentionDocument(null)}
              >
                x
              </button>
              <h2>Retention & archival</h2>
              <p>{retentionDocument.title}</p>
              <label>
                Retain until
                <input
                  type="date"
                  value={retentionDate}
                  onChange={(event) => setRetentionDate(event.target.value)}
                />
              </label>
              <div className="retention-actions">
                <button
                  onClick={async () => {
                    await api.retainDocument(
                      token,
                      retentionDocument.id,
                      retentionDate || null,
                      false,
                    );
                    await refreshDocuments();
                    setRetentionDocument(null);
                    setDocumentNotice("Retention date updated.");
                  }}
                >
                  Save retention
                </button>
                <button
                  className="danger"
                  onClick={async () => {
                    if (window.confirm("Archive this document?")) {
                      await api.retainDocument(
                        token,
                        retentionDocument.id,
                        retentionDate || null,
                        true,
                      );
                      await refreshDocuments();
                      setRetentionDocument(null);
                      setDocumentNotice("Document archived.");
                    }
                  }}
                >
                  Archive document
                </button>
              </div>
            </section>
          </div>
        )}
        {reviewDocument && (
          <div
            className="modal-backdrop"
          >
            <section
              className="assignment-editor review-editor"
              onClick={(event) => event.stopPropagation()}
            >
              <button className="close" onClick={() => { setReviewDocument(null); setReviewDocumentReadId(null); }}>
                x
              </button>
              <h2>Review document</h2>
              <p>
                <strong>{reviewDocument.title}</strong>
              </p>
              <div className={`repository-review-read-gate ${reviewDocumentReadId === reviewDocument.id ? "complete" : "required"}`}>
                <div>
                  <b>{reviewDocumentReadId === reviewDocument.id ? "Current document opened" : "Read before decision"}</b>
                  <span>{reviewDocumentReadId === reviewDocument.id ? "The current version has been opened in the secure reader. REDESY also verifies the audited reader event on the server before accepting a decision." : "Open the current stored version in the secure reader before Approve or Reject becomes available."}</span>
                </div>
                <button type="button" className="approve" onClick={() => void openRepositoryDocumentReader(reviewDocument, true)}>
                  {reviewDocumentReadId === reviewDocument.id ? "Read again" : "Open current document"}
                </button>
              </div>
              <ol>
                <li>
                  <b>Inspect versions</b>
                  <span>
                    Confirm the latest file is complete, readable and correctly
                    classified.
                  </span>
                </li>
                <li>
                  <b>Verify content</b>
                  <span>
                    Check accuracy, policy compliance, ownership and linked
                    assignment context.
                  </span>
                </li>
                <li>
                  <b>Record a decision</b>
                  <span>
                    Approve to publish, or explain the correction required when
                    rejecting.
                  </span>
                </li>
              </ol>
              <label>
                Reviewer comments / rejection reason
                <textarea
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  placeholder="Add review notes. A reason is required when rejecting."
                />
              </label>
              <button type="button" className="app2-paste-button" onClick={() => {
                const copied = sessionStorage.getItem("app2-internal-clipboard") || "";
                if (copied) setRejectionReason((current) => current ? `${current}\n\n${copied}` : copied);
                else setDocumentNotice("There is no text in the REDESY internal clipboard.");
              }}>Paste REDESY copy into review notes</button>
              <div className="review-actions">
                <button
                  className="approve"
                  data-tooltip="Publish the approved document and record you as its reviewer."
                  disabled={reviewDocumentReadId !== reviewDocument.id}
                  onClick={() => reviewDocumentAction(true)}
                >
                  Approve & publish
                </button>
                <button
                  className="reject"
                  data-tooltip="Return the document to its owner with your correction instructions."
                  disabled={reviewDocumentReadId !== reviewDocument.id || !rejectionReason.trim()}
                  onClick={() => reviewDocumentAction(false)}
                >
                  Reject with reason
                </button>
              </div>
            </section>
          </div>
        )}
        {reviewingNotice && (
          <div
            className="modal-backdrop"
          >
            <section
              className="assignment-editor review-editor"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="close"
                onClick={() => setReviewingNotice(null)}
              >
                x
              </button>
              <p>NOTICE APPROVAL</p>
              <h2>{reviewingNotice.title}</h2>
              <p>{reviewingNotice.body}</p>
              <small>
                Submitted by {reviewingNotice.created_by_name} |{" "}
                {reviewingNotice.severity}
              </small>
              {reviewingNotice.event_start && (
                <div className="notice-event-summary">
                  Calendar event:{" "}
                  {new Date(reviewingNotice.event_start).toLocaleString(
                    "en-KE",
                  )}
                </div>
              )}
              <label>
                Reviewer comments / rejection reason
                <textarea
                  value={noticeReason}
                  onChange={(event) => setNoticeReason(event.target.value)}
                  placeholder="A reason is required when rejecting."
                />
              </label>
              <div className="review-actions">
                <button className="approve" onClick={() => reviewNotice(true)}>
                  Approve & publish
                </button>
                <button
                  className="reject"
                  disabled={!noticeReason.trim()}
                  onClick={() => reviewNotice(false)}
                >
                  Reject with reason
                </button>
              </div>
            </section>
          </div>
        )}
        {selectedResearch && !builderDocument && (
          <ResearchProjectWorkspaceEntry
            project={selectedResearch}
            isManager={isManager}
            researchTab={researchTab}
            readOnly={researchReportIsLocked}
            readOnlyMessage={
              researchReportIsLocked
                ? `Submitted report version ${latestResearchReportVersion?.version_number || ""} is locked${researchReportLockReviewerName ? ` and under review by ${researchReportLockReviewerName}` : " for review"}. All Research workspace content is read-only until the reviewer returns it for changes.`
                : ""
            }
            onNavigate={async (tab) => {
              setResearchTab(tab);
              window.history.replaceState(
                {},
                "",
                `/research/${selectedResearch.id}/${tab.toLowerCase()}`,
              );
              if (tab !== "Report" || researchReportIsLocked) return;

              const section = selectedReportSection || researchReport[0] || null;
              if (!section) return;

              setSelectedReportSection(section);
              setReportContent(section.content || "");
              await loadResearchSectionAccess(selectedResearch.id, section.id);
              setResearchSectionWorkspaceMode(
                section.status === "Approved" ? "review" : "edit",
              );
            }}
            nextAction={researchTab === "Overview" ? null : researchNextAction}
            notice={researchWorkspaceNotice}
            onBack={() => {
              setSelectedResearch(null);
              setResearchComments([]);
              setResearchComment("");
              setResearchReport([]);
              setSelectedReportSection(null);
              setReportContent("");
              setActive("Research Repository");
              window.history.replaceState({}, "", "/research");
            }}
            onClose={() => {
              setSelectedResearch(null);
              setResearchComments([]);
              setResearchComment("");
              setResearchReport([]);
              setSelectedReportSection(null);
              setReportContent("");
              window.history.replaceState({}, "", "/research");
            }}
            onArchive={archiveSelectedResearch}
            onDelete={deleteSelectedResearch}
            onPreviewBrief={() => {
              setResearchBriefOpen(true);
              setResearchBriefEditing(false);
              setResearchBriefRequestOpen(false);
            }}
            onOpenReportBuilder={async () => {
              setResearchTab("Report");
              window.history.replaceState(
                {},
                "",
                `/research/${selectedResearch.id}/report`,
              );
              const section = selectedReportSection || researchReport[0] || null;
              if (section) {
                setSelectedReportSection(section);
                setReportContent(section.content || "");
                await loadResearchSectionAccess(selectedResearch.id, section.id);
                setResearchSectionWorkspaceMode(
                  section.status === "Approved" ? "review" : "edit",
                );
              }
              window.setTimeout(() => {
                const builder = document.querySelector<HTMLElement>(
                  ".research-report-workspace",
                );
                builder?.scrollIntoView({ behavior: "smooth", block: "start" });
                builder?.querySelector<HTMLElement>("select, textarea, button")?.focus({
                  preventScroll: true,
                });
              }, 80);
            }}
            overview={
              <ResearchOverviewHome
                token={token}
                project={selectedResearch}
                researchSources={researchSources}
                active={researchTab === "Overview"}
                onPrimaryAction={() => {
                  if (selectedResearch.status === "Planning") {
                    setResearchBriefOpen(true);
                    setResearchBriefEditing(false);
                    setResearchBriefRequestOpen(false);
                  } else {
                    setResearchTab("Work");
                  }
                }}
                primaryActionLabel={
                  selectedResearch.status === "Planning"
                    ? "Preview Research Brief"
                    : "Continue to Work"
                }
                teamPanel={
            <ResearchTeamPanel
              token={token}
              selectedResearch={selectedResearch}
              isManager={isManager}
              canManageResearchTeam={canManageResearchTeam}
              team={team}
              setTeam={setTeam}
              mapTeamMember={mapTeamMember}
              researchTeamEditing={researchTeamEditing}
              setResearchTeamEditing={setResearchTeamEditing}
              researchTeamDraft={researchTeamDraft}
              setResearchTeamDraft={setResearchTeamDraft}
              researchTeamSaving={researchTeamSaving}
              setResearchTeamSaving={setResearchTeamSaving}
              setResearchRows={setResearchRows}
              setSelectedResearch={setSelectedResearch}
              setResearchActivity={setResearchActivity}
              setResearchWorkspaceNotice={setResearchWorkspaceNotice}
              initialsFor={initialsFor}
            />
                }
                briefPanel={
            <ResearchBriefPanel
              token={token}
              userId={user?.id}
              selectedResearch={selectedResearch}
              isManager={isManager}
              researchPlanDraft={researchPlanDraft}
              setResearchPlanDraft={setResearchPlanDraft}
              researchPlanSaving={researchPlanSaving}
              setResearchPlanSaving={setResearchPlanSaving}
              researchBriefOpen={researchBriefOpen}
              setResearchBriefOpen={setResearchBriefOpen}
              researchBriefEditing={researchBriefEditing}
              setResearchBriefEditing={setResearchBriefEditing}
              researchBriefRequestOpen={researchBriefRequestOpen}
              setResearchBriefRequestOpen={setResearchBriefRequestOpen}
              researchBriefChangeReason={researchBriefChangeReason}
              setResearchBriefChangeReason={setResearchBriefChangeReason}
              researchBriefRequesting={researchBriefRequesting}
              setResearchBriefRequesting={setResearchBriefRequesting}
              setResearchRows={setResearchRows}
              setSelectedResearch={setSelectedResearch}
              setResearchActivity={setResearchActivity}
              setResearchWorkspaceNotice={setResearchWorkspaceNotice}
            />
                }
              />
            }
          >

            <ResearchReferencePanel project={selectedResearch} stage="Work" />

            <div className="research-work-primary-grid">
            <ResearchWorkPlanPanel
              project={selectedResearch}
              form={researchMilestoneForm}
              setForm={setResearchMilestoneForm}
              onImportExternal={() => {
                setSelectedResearch(null);
                setResearchComments([]);
                setResearchComment("");
                setResearchReport([]);
                setSelectedReportSection(null);
                setReportContent("");
                requestResearchEntryMode("Imported");
                setExternalResearchOpen(true);
              }}
              onUpdateMilestone={async (milestoneId, status) => {
                try {
                  await api.updateResearchMilestone(token, selectedResearch.id, milestoneId, status);
                  const projects = await api.research(token);
                  setResearchRows(projects);
                  setSelectedResearch(projects.find((item) => item.id === selectedResearch.id) || selectedResearch);
                  setResearchActivity(await api.researchActivity(token, selectedResearch.id));
                  setResearchWorkspaceNotice("Milestone status updated.");
                } catch (error) {
                  setResearchWorkspaceNotice(error instanceof Error ? error.message : "Milestone could not be updated.");
                }
              }}
              onAddMilestone={async () => {
                try {
                  await api.addResearchMilestone(token, selectedResearch.id, {
                    ...researchMilestoneForm,
                    title: researchMilestoneForm.title.trim(),
                  });
                  const projects = await api.research(token);
                  setResearchRows(projects);
                  setSelectedResearch(projects.find((item) => item.id === selectedResearch.id) || selectedResearch);
                  setResearchActivity(await api.researchActivity(token, selectedResearch.id));
                  setResearchMilestoneForm({ title: "", description: "", ownerId: "", dueDate: "", priority: "Normal" });
                  setResearchWorkspaceNotice("Milestone created with an accountable owner and deadline.");
                } catch (error) {
                  setResearchWorkspaceNotice(error instanceof Error ? error.message : "Milestone could not be created.");
                }
              }}
            />

            <ResearchRelatedAssignmentsPanel
              token={token}
              project={selectedResearch}
              assignmentRows={assignmentRows}
              isManager={isManager}
              currentUserId={user?.id}
              linkId={researchAssignmentLinkId}
              draft={researchAssignmentDraft}
              creating={researchAssignmentCreating}
              onImportExternal={() => {
                setSelectedResearch(null);
                setResearchComments([]);
                setResearchComment("");
                setResearchReport([]);
                setSelectedReportSection(null);
                setReportContent("");
                requestResearchEntryMode("Imported");
                setExternalResearchOpen(true);
              }}
              onLinkIdChange={setResearchAssignmentLinkId}
              onLinkExisting={async () => {
                try {
                  await api.linkResearchAssignment(token, selectedResearch.id, researchAssignmentLinkId);
                  const projects = await api.research(token);
                  setResearchRows(projects);
                  setSelectedResearch(projects.find((item) => item.id === selectedResearch.id) || selectedResearch);
                  setResearchAssignmentLinkId("");
                  setResearchActivity(await api.researchActivity(token, selectedResearch.id));
                  setResearchWorkspaceNotice("Assignment linked to this research project.");
                } catch (error) {
                  setResearchWorkspaceNotice(error instanceof Error ? error.message : "Assignment could not be linked.");
                }
              }}
              onDraftChange={setResearchAssignmentDraft}
              onCreate={async () => {
                try {
                  setResearchAssignmentCreating(true);
                  await api.createResearchAssignment(token, selectedResearch.id, researchAssignmentDraft);
                  const [projects, assignments] = await Promise.all([api.research(token), api.assignments(token)]);
                  setResearchRows(projects);
                  setAssignmentRows(assignments);
                  setSelectedResearch(projects.find((item) => item.id === selectedResearch.id) || selectedResearch);
                  setResearchAssignmentDraft({
                    title: "",
                    description: "",
                    objective: "",
                    scope: "",
                    instructions: "",
                    expectedOutput: "Final Assignment Report",
                    division: researchAssignmentDraft.division,
                    startDate: null,
                    dueDate: null,
                    priority: "Normal",
                    memberIds: [selectedResearch.lead_id],
                    leadId: selectedResearch.lead_id,
                  });
                  setResearchActivity(await api.researchActivity(token, selectedResearch.id));
                  setResearchWorkspaceNotice(
                    isManager
                      ? "Related assignment created and linked to this research project."
                      : "Assignment proposal sent to Research Managers for final approval.",
                  );
                } catch (error) {
                  setResearchWorkspaceNotice(error instanceof Error ? error.message : "Related assignment could not be created.");
                } finally {
                  setResearchAssignmentCreating(false);
                }
              }}
              onApproveRequest={async (request) => {
                try {
                  await api.decideResearchAssignmentRequest(token, selectedResearch.id, request.id, "Approved");
                  const [projects, assignments] = await Promise.all([api.research(token), api.assignments(token)]);
                  setResearchRows(projects);
                  setAssignmentRows(assignments);
                  setSelectedResearch(projects.find((item) => item.id === selectedResearch.id) || selectedResearch);
                  setResearchWorkspaceNotice(`“${request.title}” approved and activated.`);
                } catch (error) {
                  setResearchWorkspaceNotice(error instanceof Error ? error.message : "Proposal could not be approved.");
                }
              }}
              onRejectRequest={async (request) => {
                const comment = window.prompt("Reason for rejecting this assignment proposal:")?.trim();
                if (!comment) return;
                try {
                  await api.decideResearchAssignmentRequest(token, selectedResearch.id, request.id, "Rejected", comment);
                  const projects = await api.research(token);
                  setResearchRows(projects);
                  setSelectedResearch(projects.find((item) => item.id === selectedResearch.id) || selectedResearch);
                  setResearchWorkspaceNotice(`“${request.title}” rejected with feedback.`);
                } catch (error) {
                  setResearchWorkspaceNotice(error instanceof Error ? error.message : "Proposal could not be rejected.");
                }
              }}
              onOpenAssignment={async (assignment) => {
                const assignments = await api.assignments(token);
                setAssignmentRows(assignments);
                const full = assignments.find((item) => item.id === assignment.id);
                if (!full) {
                  setResearchWorkspaceNotice("The linked assignment could not be opened.");
                  return;
                }
                setSelectedResearch(null);
                setActive("Assignments");
                await openAssignmentDetails(full);
              }}
              onUnlinkAssignment={async (assignment) => {
                if (!window.confirm(`Remove the link to “${assignment.title}”? The assignment itself will not be deleted.`)) return;
                try {
                  await api.unlinkResearchAssignment(token, selectedResearch.id, assignment.id);
                  const projects = await api.research(token);
                  setResearchRows(projects);
                  setSelectedResearch(projects.find((item) => item.id === selectedResearch.id) || selectedResearch);
                  setResearchActivity(await api.researchActivity(token, selectedResearch.id));
                  setResearchWorkspaceNotice("Assignment link removed. The assignment remains in REDESY.");
                } catch (error) {
                  setResearchWorkspaceNotice(error instanceof Error ? error.message : "Assignment link could not be removed.");
                }
              }}
            />

            </div>

            <section className="research-documents-placeholder">
              <h3>Evidence</h3>
              <p>Use the Evidence tab to link Repository documents and record other research sources.</p>
            </section>

            <ResearchDiscussionPanel
              comments={researchComments}
              filter={researchDiscussionFilter}
              comment={researchComment}
              category={researchCommentCategory}
              onFilterChange={setResearchDiscussionFilter}
              onCommentChange={setResearchComment}
              onCategoryChange={setResearchCommentCategory}
              onResolve={async (item) => {
                try {
                  await api.resolveResearchComment(
                    token,
                    selectedResearch.id,
                    item.id,
                    !item.resolved,
                  );
                  setResearchComments(await api.researchComments(token, selectedResearch.id));
                  setResearchActivity(await api.researchActivity(token, selectedResearch.id));
                  setResearchWorkspaceNotice(
                    item.resolved ? "Discussion item reopened." : "Discussion item resolved.",
                  );
                } catch (error) {
                  setResearchWorkspaceNotice(
                    error instanceof Error ? error.message : "Discussion item could not be updated.",
                  );
                }
              }}
              onPost={async () => {
                if (!selectedResearch || !researchComment.trim()) return;
                try {
                  await api.addResearchComment(
                    token,
                    selectedResearch.id,
                    researchComment.trim(),
                    researchCommentCategory,
                  );
                  setResearchComment("");
                  setResearchCommentCategory("Update");
                  setResearchComments(await api.researchComments(token, selectedResearch.id));
                } catch (error) {
                  alert(error instanceof Error ? error.message : "Research comment could not be saved.");
                }
              }}
              onNext={() => setResearchTab("Resources")}
            />

            <ResearchReviewHandoffPanel
              reportVersions={researchReportVersions}
              latestApprovedVersion={latestApprovedResearchVersion}
              currentUserId={user?.id}
              researchTab={researchTab}
              hasDraftContent={researchReport.some((section) => section.content.trim())}
              hasControlledEvidence={Boolean(researchSources.length || researchRepositoryDocuments.length)}
              canSubmitForReview={isManager || selectedResearch.lead_id === user?.id || isResearchReportBuilder}
              assignedReviewers={selectedResearch.reviewers || []}
              eligibleReviewers={eligibleResearchReviewers}
              assignedReviewerIds={assignedResearchReviewerIds}
              canChooseReviewer={canChooseResearchReviewer}
              eligibleReviewersLoading={eligibleResearchReviewersLoading}
              draftReviewerId={researchDraftReviewerId}
              submitting={researchReportSubmitting}
              decisionSubmitting={researchReviewDecisionSubmitting}
              reviewComments={researchReportReviewComments}
              reviewerCanDecide={Boolean(
                researchReportVersions[0]?.status === "Submitted" &&
                researchReportVersions[0].submitted_by !== user?.id &&
                researchReportVersions[0].reviewer_id === user?.id
              )}
              onReturnToReport={() => setResearchTab("Report")}
              onPreviewReport={() => setResearchReportPreviewOpen(true)}
              onReviewerChange={setResearchDraftReviewerId}
              onSubmitForReview={submitCompleteResearchReport}
              onOpenResources={() => setResearchTab("Resources")}
              onReviewCommentsChange={setResearchReportReviewComments}
              onDecision={decideCompleteResearchReport}
            />

            <ResearchReportPreviewModal
              open={researchReportPreviewOpen}
              title={
                latestResearchReportVersion?.title ||
                `${selectedResearch.title} — Research Report`
              }
              previewWarning={researchReportPreviewWarning}
              eyebrow={
                researchReportPreviewWarning
                  ? "UNSAVED LOCAL PREVIEW"
                  : researchPreviewUsesVersionSnapshot
                    ? "LOCKED REPORT PREVIEW"
                    : "DRAFT REPORT PREVIEW"
              }
              subtitle={
                researchReportPreviewWarning
                  ? "Read-only preview of current editor content — not yet saved"
                  : researchPreviewUsesVersionSnapshot
                    ? `Version v${latestResearchReportVersion?.version_number || ""} · ${latestResearchReportVersion?.status || "Submitted"} · exact governed snapshot`
                    : "Current saved Research report draft"
              }
              sections={researchPreviewSections}
              team={researchPreviewTeam}
              documentControl={[
                {
                  label: "Report reference",
                  value: `RES-${String(selectedResearch.id).replace(/[^a-f0-9]/gi, "").slice(0, 8).toUpperCase()}`,
                },
                { label: "Research project", value: selectedResearch.title },
                {
                  label: "Prepared by",
                  value: researchPreviewUsesVersionSnapshot
                    ? latestResearchReportVersion?.submitted_by_name || selectedResearch.lead_name || "Not recorded"
                    : selectedResearch.lead_name || "Not recorded",
                },
                {
                  label: "Reviewer",
                  value: researchPreviewUsesVersionSnapshot
                    ? latestResearchReportVersion?.reviewer_name || "Not assigned"
                    : "Not assigned",
                },
                {
                  label: "Version",
                  value: researchPreviewUsesVersionSnapshot
                    ? `v${latestResearchReportVersion?.version_number || 1}`
                    : latestResearchReportVersion
                      ? `Draft for v${latestResearchReportVersion.version_number + 1}`
                      : "Draft 1",
                },
                {
                  label: "Status",
                  value: researchPreviewUsesVersionSnapshot
                    ? latestResearchReportVersion?.status || "Submitted"
                    : "Draft",
                },
                { label: "Classification", value: "Official" },
                { label: "Last updated", value: researchReportDate },
              ]}
              downloadingPdf={researchReportPdfDownloading}
              downloadMessage={researchReportPdfMessage}
              onDownloadPdf={async () => {
                if (!selectedResearch || researchReportPdfDownloading) return;
                setResearchReportPdfDownloading(true);
                setResearchReportPdfMessage("Preparing the PSC formatted PDF…");
                try {
                  await api.downloadResearchReportPdf(
                    token,
                    selectedResearch.id,
                    `${selectedResearch.title}-${researchPreviewUsesVersionSnapshot ? `v${latestResearchReportVersion?.version_number || 1}` : "draft"}`,
                    researchPreviewUsesVersionSnapshot ? latestResearchReportVersion?.id : null,
                  );
                  setResearchReportPdfMessage("PDF downloaded.");
                } catch (error) {
                  setResearchReportPdfMessage(
                    error instanceof Error ? error.message : "The Research report PDF could not be downloaded.",
                  );
                } finally {
                  setResearchReportPdfDownloading(false);
                }
              }}
              onClose={() => setResearchReportPreviewOpen(false)}
            />

            <ResearchFinalisationPanel
              authoredApprovedCount={researchReport.filter((section) => section.content.trim() && section.status === "Approved").length}
              authoredSectionCount={researchReport.filter((section) => section.content.trim()).length}
              latestApprovedVersion={latestApprovedResearchVersion}
              currentUserId={user?.id}
              generating={researchReportGenerating}
              generationNotice={researchFinalGenerationNotice}
              hasReportSections={Boolean(researchReport.length)}
              canGenerateApprovedFinal={canGenerateApprovedResearchFinal}
              allAuthoredSectionsApproved={!researchReport.some((section) => section.content.trim() && section.status !== "Approved")}
              hasControlledEvidence={Boolean(researchSources.length || researchRepositoryDocuments.length)}
              researchStatus={selectedResearch.status}
              onOpenResources={() => setResearchTab("Resources")}
              onGenerate={generateApprovedResearchFinalReport}
            />

            {researchTab === "Report" && researchReportIsLocked && (
              <ResearchReportLockedPanel
                status={
                  latestResearchReportVersion?.status === "Approved"
                    ? "Approved — locked"
                    : latestResearchReportVersion?.status === "Rejected"
                      ? "Review completed — locked"
                      : "Under Review"
                }
                reviewerName={researchReportLockReviewerName}
                versionNumber={latestResearchReportVersion?.version_number || null}
                submittedAt={latestResearchReportVersion?.submitted_at || null}
                message={
                  latestResearchReportVersion?.status === "Approved"
                    ? "This approved report is locked. The governed version can now proceed to finalisation."
                    : latestResearchReportVersion?.status === "Rejected"
                      ? "This reviewed version remains locked. Editing can resume only through a governed returned revision."
                      : `Version ${latestResearchReportVersion?.version_number || ""} is being reviewed by ${researchReportLockReviewerName}. Editing will reopen only if the reviewer returns it for changes.`
                }
                onPreview={() => setResearchReportPreviewOpen(true)}
                onOpenReview={() => {
                  setResearchTab("Review");
                  window.history.replaceState(
                    {},
                    "",
                    `/research/${selectedResearch.id}/review`,
                  );
                }}
              />
            )}

            {researchTab === "Report" && !researchReportIsLocked && !researchSectionWorkspaceMode && (
              <ResearchReportBuilderPanel
              token={token}
              selectedResearch={selectedResearch}
              researchReport={researchReport}
              setResearchReport={setResearchReport}
              researchReportVersions={researchReportVersions}
              researchTab={researchTab}
              selectedReportSection={selectedReportSection}
              setSelectedReportSection={setSelectedReportSection}
              reportContent={reportContent}
              setReportContent={setReportContent}
              reportSaving={reportSaving}
              canReview={canReview}
              team={team}
              reviewerOptions={eligibleResearchReviewers}
              researchSources={researchSources}
              researchRepositoryDocuments={researchRepositoryDocuments}
              knowledgeRows={knowledgeRows}
              researchSupportingDocumentIds={researchSupportingDocumentIds}
              setResearchSupportingDocumentIds={setResearchSupportingDocumentIds}
              researchTemplateLibrary={researchTemplateLibrary}
              researchTemplateDownloadId={researchTemplateDownloadId}
              setResearchTemplateDownloadId={setResearchTemplateDownloadId}
              researchTemplateApplying={researchTemplateApplying}
              setResearchTemplateApplying={setResearchTemplateApplying}
              researchReportPreviewOpen={researchReportPreviewOpen}
              setResearchReportPreviewOpen={setResearchReportPreviewOpen}
              setResearchWorkspaceNotice={setResearchWorkspaceNotice}
              saveResearchSectionDraft={saveResearchSectionDraft}
              saveResearchSectionStatus={saveResearchSectionStatus}
              renderSectionHtml={safeReportSectionHtml}
              onOpenRepository={() => {
                setSelectedResearch(null);
                setActive("Document Repository");
                setKnowledgeNotice(`Repository opened for evidence linked to ${selectedResearch.title}.`);
              }}
              onOpenSectionEditor={async (section) => {
                const target = section || selectedReportSection;
                if (!selectedResearch || !target) return;
                setSelectedReportSection(target);
                setReportContent(target.content || "");
                await loadResearchSectionAccess(selectedResearch.id, target.id);
                setResearchSectionWorkspaceMode(
                  target.status === "Approved" ? "review" : "edit",
                );
              }}
              onOpenSectionReview={() => setResearchSectionWorkspaceMode("review")}
              onGoToReview={() => {
                setResearchTab("Review");
                setTimeout(() => {
                  document
                    .querySelector(".research-submit-review-section")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 80);
              }}
              onProceedToReview={() => {
                setResearchSectionWorkspaceMode(null);
                setResearchTab("Review");
                setTimeout(() => {
                  document
                    .querySelector(".research-submit-review-section")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 80);
              }}
            />
            )}

            {!researchReportIsLocked && researchSectionWorkspaceMode && selectedReportSection && (
              <ResearchReportWorkspace
                key={selectedReportSection.id}
                title={selectedReportSection.title}
                reportTitle={`${selectedResearch.title} — Research Report`}
                mode={researchSectionWorkspaceMode}
                workspaceVariant="research-report"
                status={
                  selectedReportSection.status === "Approved"
                    ? "Final"
                    : selectedReportSection.status === "Ready for Review"
                      ? "In Review"
                      : "Draft"
                }
                value={reportContent}
                busy={reportSaving}
                canEditSection={canEditSelectedResearchSection}
                sectionOwnerName={selectedResearchSectionAccess?.owner_name ?? selectedReportSection.owner_name}
                readOnlyReason={selectedResearchSectionAccess?.reason}
                contextTitle={`${selectedResearch.title} — Research Report`}
                linkedWorkLabel="Attach assignment"
                linkedWorkPlaceholder="Choose assignment"
                linkedWorkActionLabel="Attach to"
                linkedWorkItems={(selectedResearch.assignments || []).map((assignment) => ({
                  id: assignment.id,
                  title: assignment.title,
                  status: assignment.status,
                }))}
                onInsertLinkedWorkItem={async (assignmentId) => {
                  if (researchReportIsLocked) {
                    throw new Error(`This submitted report is locked while ${researchReportLockReviewerName} reviews it.`);
                  }
                  const documents = await api.generatedDocuments(
                    token,
                    "Assignment",
                    assignmentId,
                  );
                  const source =
                    documents.find((item) => item.status === "Final") ||
                    documents.find((item) => item.status === "Approved");
                  if (!source) {
                    setResearchWorkspaceNotice(
                      "That assignment has no approved or final report to attach.",
                    );
                    throw new Error(
                      "That assignment has no approved or final report to attach.",
                    );
                  }
                  if (reportContent.includes(`data-assignment-report-id="${source.id}"`)) {
                    throw new Error(
                      "This assignment report is already linked to the selected section.",
                    );
                  }
                  const full = await api.generatedDocument(token, source.id);
                  const assignment = (selectedResearch.assignments || []).find(
                    (item) => item.id === assignmentId,
                  );
                  const imported = full.sections
                    .filter((item) => item.content.trim())
                    .map(
                      (item) =>
                        `<h3>${item.title}</h3>${item.content}`,
                    )
                    .join("<hr>");
                  const updatedContent = `${reportContent}${reportContent ? "<hr>" : ""}<section data-assignment-report-id="${source.id}" data-assignment-id="${assignmentId}"><h2>Assignment contribution: ${assignment?.title || source.title}</h2><p><strong>Source report:</strong> ${source.reference} · ${source.status}</p>${imported}</section>`;
                  await api.updateResearchReportSection(token, selectedResearch.id, selectedReportSection.id, {
                    content: updatedContent,
                    status: "In Progress",
                    ownerId: selectedReportSection.owner_id,
                    reviewerId: selectedReportSection.reviewer_id,
                  });
                  const refreshed = await api.researchReport(token, selectedResearch.id);
                  setResearchReport(refreshed);
                  const current = refreshed.find((section) => section.id === selectedReportSection.id);
                  if (current) setSelectedReportSection(current);
                  setReportContent(current?.content || updatedContent);
                  setResearchWorkspaceNotice(
                    `${assignment?.title || "Assignment"} linked and saved in ${selectedReportSection.title}.`,
                  );
                }}
                reportTemplateOptions={researchTemplateLibrary.map((template) => ({
                  key: template.template_key,
                  name: template.name,
                  description: template.description,
                  sectionCount: template.section_count,
                }))}
                onApplyReportTemplate={async (templateKey) => {
                  if (researchReportIsLocked) {
                    throw new Error(`This submitted report is locked while ${researchReportLockReviewerName} reviews it.`);
                  }
                  const template = researchTemplateLibrary.find(
                    (item) => item.template_key === templateKey,
                  );
                  if (!template) {
                    throw new Error("The selected research template could not be found.");
                  }

                  const saved = await saveResearchSectionDraft(undefined, false);
                  if (!saved) {
                    throw new Error("Save the current section before changing the report template.");
                  }

                  const hasDraftContent = researchReport.some((section) =>
                    Boolean(section.content.trim()),
                  );
                  if (
                    hasDraftContent &&
                    !window.confirm(
                      `Applying "${template.name}" will change the Report Outline. Matching section content is preserved where possible, but sections not in the new template will be removed. Continue?`,
                    )
                  ) {
                    throw new Error("Template change cancelled.");
                  }

                  const result = await api.applyResearchReportTemplate(
                    token,
                    selectedResearch.id,
                    {
                      templateKey: template.template_key,
                      replaceExisting: hasDraftContent,
                    },
                  );
                  const refreshed = await api.researchReport(
                    token,
                    selectedResearch.id,
                  );
                  const nextSections = refreshed.length
                    ? refreshed
                    : result.sections;

                  setResearchReport(nextSections);
                  const nextSection = nextSections[0] || null;
                  setSelectedReportSection(nextSection);
                  setReportContent(nextSection?.content || "");
                  setResearchWorkspaceNotice(
                    `${result.template.name} applied. Report Outline updated to ${nextSections.length} section${nextSections.length === 1 ? "" : "s"}.`,
                  );
                }}
                templateOptions={researchDocumentTemplates
                  .filter(
                    (template) => template.governance_status === "Approved",
                  )
                  .map((template) => ({
                    id: template.id,
                    name: template.name,
                    description: template.description,
                    sections: template.sections,
                  }))}
                sectionNumber={
                  researchReport.findIndex(
                    (section) => section.id === selectedReportSection.id,
                  ) + 1
                }
                sectionCount={researchReport.length}
                currentSectionId={selectedReportSection.id}
                outlineSections={researchReport.map((section) => ({
                  id: section.id,
                  title: section.title,
                  status: section.status,
                }))}
                canGoPrevious={
                  researchReport.findIndex(
                    (section) => section.id === selectedReportSection.id,
                  ) > 0
                }
                canGoNext={
                  researchReport.findIndex(
                    (section) => section.id === selectedReportSection.id,
                  ) <
                  researchReport.length - 1
                }
                reviewerOptions={researchReportReviewerOptions}
                canSubmitForReview={!researchReportIsLocked && (isManager || selectedResearch.lead_id === user?.id || isResearchReportBuilder)}
                submissionReady={Boolean(researchReport.length) && researchReport.every((section) => Boolean(section.content.trim()))}
                readySectionCount={researchReport.filter((section) => Boolean(section.content.trim())).length}
                totalSectionCount={researchReport.length}
                onChange={setReportContent}
                closeLabel="Return to Research"
                saveLabel="Save Draft & Return to Research"
                onPreviewReport={async (latestValue) => {
                  const contentToPreview =
                    typeof latestValue === "string" ? latestValue : reportContent;
                  const localPreviewSection = { ...selectedReportSection, content: contentToPreview };
                  setReportContent(contentToPreview);
                  setSelectedReportSection(localPreviewSection);
                  setResearchReport((current) => current.map((section) =>
                    section.id === localPreviewSection.id ? { ...section, content: contentToPreview } : section));
                  setResearchReportPreviewWarning("");

                  // A preview must not be blocked by a save failure. Keep the current editor
                  // content visible, but explicitly label it as unsaved and do not export it.
                  const saved = await saveResearchSectionDraft(contentToPreview, false);
                  if (!saved) {
                    const reason = researchSectionSaveErrorRef.current || "The save request failed without a detailed error.";
                    const warning = `PREVIEW ONLY — this section was not saved to REDESY. The preview uses the current editor content. Save error: ${reason}`;
                    setResearchReportPreviewWarning(warning);
                    setResearchWorkspaceNotice(warning);
                    setResearchReportPreviewOpen(true);
                    return;
                  }

                  // saveResearchSectionDraft performs the read-back; retain the exact content
                  // just previewed in case that refresh was briefly stale.
                  setResearchReport((current) => current.map((section) =>
                    section.id === localPreviewSection.id ? { ...section, content: contentToPreview } : section));
                  setResearchReportPreviewWarning("");
                  setResearchReportPreviewOpen(true);
                }}
                onProceedForReview={async (latestValue) => {
                  const contentToSubmit =
                    typeof latestValue === "string" ? latestValue : reportContent;
                  setReportContent(contentToSubmit);
                  const saved = await saveResearchSectionDraft(contentToSubmit, false);
                  if (!saved) {
                    setResearchWorkspaceNotice(
                      "Save the current report section before proceeding to review.",
                    );
                    return;
                  }
                  setResearchSectionWorkspaceMode(null);
                  setResearchTab("Review");
                  window.history.replaceState({}, "", `/research/${selectedResearch.id}/review`);
                  setTimeout(() => {
                    document
                      .querySelector(".research-submit-review-section")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 80);
                }}
                onClose={() => {
                  setResearchSectionWorkspaceMode(null);
                  setResearchTab("Overview");
                  window.history.replaceState({}, "", `/research/${selectedResearch.id}/overview`);
                }}
                onSave={async (latestValue) => {
                  if (researchReportIsLocked) {
                    throw new Error(`This submitted report is locked while ${researchReportLockReviewerName} reviews it.`);
                  }
                  const contentToSave =
                    typeof latestValue === "string" ? latestValue : reportContent;
                  setReportContent(contentToSave);
                  if (!(await saveResearchSectionDraft(contentToSave, true))) {
                    const reason = researchSectionSaveErrorRef.current || "The save request failed without a detailed error.";
                    throw new Error(`The Research section could not be saved. ${reason} The Report Builder remains open.`);
                  }
                  const syncResult = researchRepositorySyncResultRef.current;
                  const pending = Boolean(syncResult?.status && syncResult.status !== "done");
                  return {
                    saved: true,
                    message: pending
                      ? (syncResult?.message || "Research section saved; Repository synchronization is queued for automatic retry.")
                      : `Draft saved to Document Repository${syncResult?.version ? ` (version ${syncResult.version})` : ""}.`,
                  };
                }}
                onPrevious={async (latestValue) => {
                  const index = researchReport.findIndex(
                    (section) => section.id === selectedReportSection.id,
                  );
                  const previous = researchReport[index - 1];
                  const contentToSave =
                    typeof latestValue === "string" ? latestValue : reportContent;
                  if (!previous) return;
                  if (
                    researchSectionWorkspaceMode === "edit" && !(await (async () => { const access = await loadResearchSectionAccess(selectedResearch.id, selectedReportSection.id); if (!access.can_edit) { if (contentToSave === selectedReportSection.content && !researchReportPreviewWarning) return true; researchSectionSaveErrorRef.current = access.reason || "Section access is denied or unverified."; setResearchWorkspaceNotice((access.reason || "Section access is denied or unverified.") + " Unsaved content has been kept open; navigation was cancelled."); return false; } return Boolean(await saveResearchSectionDraft(contentToSave, false)); })())
                  ) {
                    throw new Error("Save failed, so the previous section was not opened.");
                  }
                  await loadResearchSectionAccess(selectedResearch.id, previous.id);
                  setSelectedReportSection(previous);
                  setReportContent(previous.content || "");
                }}
                onNext={async (latestValue) => {
                  const index = researchReport.findIndex(
                    (section) => section.id === selectedReportSection.id,
                  );
                  const next = researchReport[index + 1];
                  const contentToSave =
                    typeof latestValue === "string" ? latestValue : reportContent;
                  if (!next) return;
                  if (
                    researchSectionWorkspaceMode === "edit" && !(await (async () => { const access = await loadResearchSectionAccess(selectedResearch.id, selectedReportSection.id); if (!access.can_edit) { if (contentToSave === selectedReportSection.content && !researchReportPreviewWarning) return true; researchSectionSaveErrorRef.current = access.reason || "Section access is denied or unverified."; setResearchWorkspaceNotice((access.reason || "Section access is denied or unverified.") + " Unsaved content has been kept open; navigation was cancelled."); return false; } return Boolean(await saveResearchSectionDraft(contentToSave, false)); })())
                  ) {
                    throw new Error("Save failed, so the next section was not opened.");
                  }
                  await loadResearchSectionAccess(selectedResearch.id, next.id);
                  setSelectedReportSection(next);
                  setReportContent(next.content || "");
                }}
                onSelectSection={async (sectionId, latestValue) => {
                  const next = researchReport.find(
                    (section) => section.id === sectionId,
                  );
                  if (!next || next.id === selectedReportSection.id) return;
                  const contentToSave =
                    typeof latestValue === "string" ? latestValue : reportContent;
                  if (
                    researchSectionWorkspaceMode === "edit" && !(await (async () => { const access = await loadResearchSectionAccess(selectedResearch.id, selectedReportSection.id); if (!access.can_edit) { if (contentToSave === selectedReportSection.content && !researchReportPreviewWarning) return true; researchSectionSaveErrorRef.current = access.reason || "Section access is denied or unverified."; setResearchWorkspaceNotice((access.reason || "Section access is denied or unverified.") + " Unsaved content has been kept open; navigation was cancelled."); return false; } return Boolean(await saveResearchSectionDraft(contentToSave, false)); })())
                  ) {
                    throw new Error("Save failed, so the selected section was not opened.");
                  }
                  await loadResearchSectionAccess(selectedResearch.id, next.id);
                  setSelectedReportSection(next);
                  setReportContent(next.content || "");
                }}
              />
            )}

            <ResearchEvidencePanel
              token={token}
              selectedResearch={selectedResearch}
              knowledgeRows={knowledgeRows}
              researchRepositoryDocuments={researchRepositoryDocuments}
              setResearchRepositoryDocuments={setResearchRepositoryDocuments}
              researchRepositoryLinkId={researchRepositoryLinkId}
              setResearchRepositoryLinkId={setResearchRepositoryLinkId}
              researchSources={researchSources}
              setResearchSources={setResearchSources}
              researchSourceForm={researchSourceForm}
              setResearchSourceForm={setResearchSourceForm}
              researchSourceSearch={researchSourceSearch}
              setResearchSourceSearch={setResearchSourceSearch}
              researchSourceQuality={researchSourceQuality}
              setResearchSourceQuality={setResearchSourceQuality}
              researchSourceRelevance={researchSourceRelevance}
              setResearchSourceRelevance={setResearchSourceRelevance}
              setResearchActivity={setResearchActivity}
              setResearchWorkspaceNotice={setResearchWorkspaceNotice}
              setResearchTab={setResearchTab}
              openRepositoryDocumentReader={openRepositoryDocumentReader}
            />

            <ResearchActivityPanel
              selectedResearch={selectedResearch}
              researchActivity={researchActivity}
              researchActivitySearch={researchActivitySearch}
              setResearchActivitySearch={setResearchActivitySearch}
              researchActivityFilter={researchActivityFilter}
              setResearchActivityFilter={setResearchActivityFilter}
              setResearchWorkspaceNotice={setResearchWorkspaceNotice}
            />
          </ResearchProjectWorkspaceEntry>
        )}
        {externalAssignmentReaderDocument && (
          <Suspense fallback={<div className="assignment-report-reader-loading">Opening review copy…</div>}>
            <AssignmentReportReader
              token={token}
              document={externalAssignmentReaderDocument}
              assignmentTitle={selectedAssignmentRecord?.title || selectedAssignment || undefined}
              onClose={() => setExternalAssignmentReaderDocument(null)}
              onReviewComplete={async () => {
                const [updated, documents, assignments] = await Promise.all([
                  api.generatedDocument(token, externalAssignmentReaderDocument.id),
                  selectedAssignmentId ? api.generatedDocuments(token, "Assignment", selectedAssignmentId) : Promise.resolve(null),
                  api.assignments(token),
                ]);
                setExternalAssignmentReaderDocument(updated);
                if (documents) setWorkspaceDocuments(documents);
                setAssignmentRows(assignments);
                await refreshNotifications();
              }}
            />
          </Suspense>
        )}        {builderDocument && builderDocument.context !== "Assignment" && (
          <div className="structured-document-builder">
            <header>
              <button onClick={() => setBuilderDocument(null)}>← Back</button>
              <div>
                <p>
                  {builderDocument.context} / {builderDocument.reference} /
                  Documents / {builderDocument.template_name}
                </p>
                <h1>{builderDocument.title}</h1>
                <span>
                  {builderDocument.classification} | Version{" "}
                  {builderDocument.version} | {builderDocument.status} |
                  Template v{builderDocument.template_version}
                </span>
              </div>
              <button onClick={() => setBuilderDocument(null)}>×</button>
            </header>
            <div className="builder-command-bar">
              <button
                onClick={() => saveBuilderSection(false)}
                disabled={!builderSection || builderSaving}
              >
                {builderSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => saveBuilderSection(true)}
                disabled={!builderSection || builderSaving}
              >
                Save & Continue
              </button>
              <span>
                {builderDirty
                  ? "Unsaved changes"
                  : builderSaving
                    ? "Saving automatically..."
                    : "All changes saved"}
              </span>
            </div>
            <div className="builder-layout">
              <aside>
                <h3>Document sections</h3>
                {builderDocument.sections.map((section) => (
                  <button
                    key={section.id}
                    className={
                      builderSection?.id === section.id ? "active" : ""
                    }
                    onClick={() => {
                      setBuilderSection(section);
                      setBuilderContent(section.content || "");
                      setBuilderDirty(false);
                    }}
                  >
                    <b>{String(section.section_order).padStart(2, "0")}</b>
                    <span>
                      <strong>{section.title}</strong>
                      <small>{section.completion}% complete</small>
                    </span>
                  </button>
                ))}
              </aside>
              <section>
                <header>
                  <div>
                    <small>
                      CONTROLLED SECTION {builderSection?.section_order}
                    </small>
                    <h2>{builderSection?.title || "Select a section"}</h2>
                  </div>
                  <b>{builderSection?.completion || 0}%</b>
                </header>
                {builderSection && (
                  <>
                    <div className="builder-format-note">
                      Structured text editor | use clear headings, paragraphs
                      and lists. Tables and media will be added through
                      controlled section blocks in a later increment.
                    </div>
                    <textarea
                      value={builderContent}
                      onChange={(event) => {
                        setBuilderContent(event.target.value);
                        setBuilderDirty(true);
                      }}
                      placeholder={`Write ${builderSection.title}...`}
                    />
                    <footer>
                      <button
                        disabled={builderSection.section_order === 1}
                        onClick={() => {
                          const item =
                            builderDocument.sections[
                              builderSection.section_order - 2
                            ];
                          setBuilderSection(item);
                          setBuilderContent(item.content || "");
                          setBuilderDirty(false);
                        }}
                      >
                        Previous section
                      </button>
                      <span>
                        Last updated{" "}
                        {new Date(builderSection.updated_at).toLocaleString(
                          "en-KE",
                        )}
                      </span>
                      <button onClick={() => saveBuilderSection(true)}>
                        Next section
                      </button>
                    </footer>
                  </>
                )}
              </section>
              <aside className="builder-metadata">
                <h3>Document control</h3>
                <dl>
                  <dt>Reference</dt>
                  <dd>{builderDocument.reference}</dd>
                  <dt>Template</dt>
                  <dd>{builderDocument.template_name}</dd>
                  <dt>Template governance</dt>
                  <dd>{builderDocument.template_status}</dd>
                  <dt>Classification</dt>
                  <dd>{builderDocument.classification}</dd>
                  <dt>Author</dt>
                  <dd>{builderDocument.created_by_name}</dd>
                  <dt>Created</dt>
                  <dd>
                    {new Date(builderDocument.created_at).toLocaleDateString(
                      "en-KE",
                    )}
                  </dd>
                </dl>
                <p>
                  Review, approval, controlled version creation and export are
                  introduced in Phase 9.
                </p>
              </aside>
            </div>
          </div>
        )}
        {externalAssignmentReaderDocument && (
          <Suspense fallback={<div className="assignment-report-reader-loading">Opening review copy…</div>}>
            <AssignmentReportReader
              token={token}
              document={externalAssignmentReaderDocument}
              assignmentTitle={selectedAssignmentRecord?.title || selectedAssignment || undefined}
              onClose={() => setExternalAssignmentReaderDocument(null)}
              onReviewComplete={async () => {
                const [updated, documents, assignments] = await Promise.all([
                  api.generatedDocument(token, externalAssignmentReaderDocument.id),
                  selectedAssignmentId ? api.generatedDocuments(token, "Assignment", selectedAssignmentId) : Promise.resolve(null),
                  api.assignments(token),
                ]);
                setExternalAssignmentReaderDocument(updated);
                if (documents) setWorkspaceDocuments(documents);
                setAssignmentRows(assignments);
                await refreshNotifications();
              }}
            />
          </Suspense>
        )}        {builderDocument && builderDocument.context !== "Assignment" && (
          <aside
            className="builder-control-overlay"
            aria-label="Document workflow controls"
          >
            <nav>
              {(
                [
                  "Control",
                  "Review",
                  "References",
                  "Comments",
                  "Felix",
                ] as const
              ).map((tab) => (
                <button
                  key={tab}
                  className={builderControlTab === tab ? "active" : ""}
                  onClick={() => setBuilderControlTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </nav>
            {builderControlTab === "Control" && (
              <div className="builder-control-pane">
                <h3>Controlled versions</h3>
                {builderControl?.versions.map((version) => (
                  <div className="builder-control-record" key={version.id}>
                    <strong>Version {version.version_number}</strong>
                    <small>
                      {version.status} | {version.created_by_name}
                    </small>
                  </div>
                ))}
                {["Approved", "Final", "Changes Requested"].includes(
                  builderDocument.status,
                ) && (
                  <button
                    onClick={async () => {
                      const note = window.prompt(
                        "Describe the reason for this controlled revision.",
                      );
                      if (note) {
                        await api.newGeneratedDocumentVersion(
                          token,
                          builderDocument.id,
                          note,
                        );
                        await openGeneratedDocument(builderDocument.id);
                      }
                    }}
                  >
                    Create new version
                  </button>
                )}
              </div>
            )}
            {builderControlTab === "Review" && (
              <div className="builder-control-pane">
                <h3>Review workflow</h3>
                <textarea
                  value={builderReviewNote}
                  onChange={(event) => setBuilderReviewNote(event.target.value)}
                  placeholder="Review or change note"
                />
                {!["Submitted", "Under Review", "Approved", "Final"].includes(
                  builderDocument.status,
                ) && (
                  <>
                    <select
                      aria-label="Assign reviewer"
                      value={builderReviewerId}
                      onChange={(event) =>
                        setBuilderReviewerId(event.target.value)
                      }
                    >
                      <option value="">Open review queue</option>
                      {reviewers.map((reviewer) => (
                        <option value={reviewer.id} key={reviewer.id}>
                          {reviewer.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      aria-label="Review due date"
                      value={builderReviewDue}
                      onChange={(event) =>
                        setBuilderReviewDue(event.target.value)
                      }
                    />
                    <button onClick={submitBuilderDocument}>
                      Submit for review
                    </button>
                  </>
                )}
                {canReview && (
                  <div className="builder-review-actions">
                    <button
                      onClick={() => reviewBuilderDocument("Under Review")}
                    >
                      Start review
                    </button>
                    <button
                      onClick={() => reviewBuilderDocument("Changes Requested")}
                    >
                      Request changes
                    </button>
                    <button onClick={() => reviewBuilderDocument("Approved")}>
                      Approve
                    </button>
                    <button
                      disabled={builderDocument.status !== "Approved"}
                      onClick={() => reviewBuilderDocument("Final")}
                    >
                      Mark final
                    </button>
                  </div>
                )}
                {builderControl?.reviews.map((review) => (
                  <div className="builder-control-record" key={review.id}>
                    <strong>
                      {review.decision} | v{review.version_number}
                    </strong>
                    <small>{review.reviewer_name}</small>
                    <p>{review.comments}</p>
                  </div>
                ))}
              </div>
            )}
            {builderControlTab === "References" && (
              <div className="builder-control-pane">
                <h3>Citations</h3>
                <select
                  aria-label="Citation style"
                  value={builderReference.citationStyle}
                  onChange={(event) =>
                    setBuilderReference({
                      ...builderReference,
                      citationStyle: event.target.value,
                    })
                  }
                >
                  <option>APA</option>
                  <option>Harvard</option>
                  <option>Chicago</option>
                </select>
                <input
                  aria-label="Source title"
                  value={builderReference.title}
                  onChange={(event) =>
                    setBuilderReference({
                      ...builderReference,
                      title: event.target.value,
                    })
                  }
                  placeholder="Source title"
                />
                <input
                  aria-label="Source author"
                  value={builderReference.author}
                  onChange={(event) =>
                    setBuilderReference({
                      ...builderReference,
                      author: event.target.value,
                    })
                  }
                  placeholder="Author"
                />
                <input
                  aria-label="Source identifier"
                  value={builderReference.identifier}
                  onChange={(event) =>
                    setBuilderReference({
                      ...builderReference,
                      identifier: event.target.value,
                    })
                  }
                  placeholder="DOI, ISBN or reference"
                />
                <button
                  disabled={!builderReference.title.trim()}
                  onClick={addBuilderReference}
                >
                  Add reference
                </button>
                {builderControl?.references.map((reference) => (
                  <div className="builder-control-record" key={reference.id}>
                    <strong>{reference.title}</strong>
                    <small>
                      {reference.author} | {reference.citation_style}
                    </small>
                  </div>
                ))}
              </div>
            )}
            {builderControlTab === "Comments" && (
              <div className="builder-control-pane">
                <h3>Comments</h3>
                <textarea
                  value={builderComment}
                  onChange={(event) => setBuilderComment(event.target.value)}
                  placeholder="Comment on the selected section"
                />
                <button
                  disabled={!builderComment.trim()}
                  onClick={async () => {
                    await api.addGeneratedDocumentComment(
                      token,
                      builderDocument.id,
                      builderSection?.id || null,
                      builderComment.trim(),
                    );
                    setBuilderComment("");
                    await refreshBuilderControl();
                  }}
                >
                  Add comment
                </button>
                {builderControl?.comments.map((comment) => (
                  <div className="builder-control-record" key={comment.id}>
                    <strong>{comment.author_name}</strong>
                    <small>{comment.section_title || "Document"}</small>
                    <p>{comment.body}</p>
                  </div>
                ))}
              </div>
            )}
            {builderControlTab === "Felix" && (
              <div className="builder-control-pane">
                <h3>Felix suggestions</h3>
                <p>
                  Suggestions never change the official record until accepted.
                </p>
                <select
                  aria-label="Felix action"
                  value={builderFelixAction}
                  onChange={(event) =>
                    setBuilderFelixAction(event.target.value)
                  }
                >
                  {[
                    "Improve clarity",
                    "Summarize section",
                    "Suggest missing content",
                    "Check consistency",
                    "Find supporting approved evidence",
                    "Identify evidence gaps",
                    "Check citations",
                  ].map((action) => (
                    <option key={action}>{action}</option>
                  ))}
                </select>
                <button
                  disabled={builderFelixLoading || !builderSection}
                  onClick={askBuilderFelix}
                >
                  {builderFelixLoading ? "Preparing..." : "Generate suggestion"}
                </button>
                {builderFelixSuggestion && (
                  <div className="felix-builder-suggestion">
                    <pre>{builderFelixSuggestion}</pre>
                    <button onClick={() => setBuilderFelixSuggestion("")}>
                      Reject
                    </button>
                    <button
                      onClick={() => {
                        setBuilderContent(
                          (value) =>
                            `${value}${value.trim() ? "\n\n" : ""}${builderFelixSuggestion}`,
                        );
                        setBuilderDirty(true);
                        setBuilderFelixSuggestion("");
                      }}
                    >
                      Accept
                    </button>
                  </div>
                )}
              </div>
            )}
          </aside>
        )}
        <AssignmentReportBuilderSurface
          visible={builderDocument?.context === "Assignment"}
          builderProps={builderDocument?.context === "Assignment" ? {
            token,
            document: builderDocument,
            templates: assignmentReportTemplates(builderTemplates),
            members: selectedAssignmentRecord?.members || [],
            currentUserName: user.name,
            currentUserId: user.id,
            assignmentTitle: selectedAssignmentRecord?.title || selectedAssignment || undefined,
            linkedTasks: assignmentTasks
              .filter(
                (task) =>
                  task.contribution_status === "Accepted" &&
                  Boolean(task.repository_document_id),
              )
              .map((task) => ({
                id: task.id,
                title: task.contribution_title || task.title,
                status: "Final approved source",
              })),
            taskCount: assignmentTasks.length,
            reviewers: assignmentReportReviewerCandidates,
            canReview,
            onSubmitForReview: submitAssignmentReportForReview,
            canEditAssignmentReport: Boolean(isManager || isAssignmentLead),
            canAdministerAssignment: Boolean(isManager || isAssignmentLead),
            canArchiveAssignment: Boolean(isManager),
            onArchiveAssignment: async () => {
              if (!selectedAssignmentId) return;
              await api.updateStatus(token, selectedAssignmentId, "Archived");
              setAssignmentNotice("Assignment archived. The institutional record and report provenance are preserved.");
              setBuilderDocument(null);
              setAssignmentReportPreviewMode(false);
              setSelectedAssignment(null);
              setSelectedAssignmentId(null);
              setAssignmentRows(await api.assignments(token));
            },
            initialPreview: assignmentReportPreviewMode,
            onClose: () => {
              const returnTab = "Reports";
              const assignmentId = selectedAssignmentId || builderDocument?.context_id;
              if (assignmentId)
                window.history.replaceState(
                  {},
                  "",
                  `/assignments/${assignmentId}/${returnTab.toLowerCase()}`,
                );
              setBuilderDocument(null);
              setAssignmentReportPreviewMode(false);
              setAssignmentWorkspaceTab(returnTab);
              if (selectedAssignmentId)
                void api
                  .generatedDocuments(token, "Assignment", selectedAssignmentId)
                  .then(setWorkspaceDocuments)
                  .catch(() => {});
            },
            onRefresh: openGeneratedDocument,
            onExternalImported: async () => {
              setBuilderDocument(null);
              setAssignmentReportPreviewMode(false);
              setAssignmentWorkspaceTab("Reports");
              if (selectedAssignmentId) {
                setWorkspaceDocuments(
                  await api.generatedDocuments(token, "Assignment", selectedAssignmentId),
                );
              }
              setAssignmentNotice(
                "Imported report ready. Select a reviewer to submit it, or discard the import.",
              );
            },
          } : null}
        />
        {selectedAssignment && (
          <Suspense fallback={<div className="report-loading">Loading Assignment Workspace...</div>}>
          <AssignmentWorkspaceEntry
            assignment={selectedAssignmentRecord}
            fallbackTitle={selectedAssignment}
            assignmentId={selectedAssignmentId}
            assignmentReference={selectedAssignmentId ? assignmentRef(selectedAssignmentId) : ""}
            daysRemaining={assignmentDays}
            activeTab={assignmentWorkspaceTab}
            reportCount={workspaceDocuments.length}
            quickAddOpen={assignmentAddOpen}
            displayLabel={navigationDisplayLabel}
            onBack={closeAssignmentToOrigin}
            onClose={closeAssignmentToOrigin}
            onOpenResearch={async () => {
              if (!selectedAssignmentRecord?.research_id) return;
              try {
                const projects = await api.research(token);
                const project = projects.find(
                  (item) => item.id === selectedAssignmentRecord.research_id,
                );
                if (!project) {
                  setAssignmentNotice(
                    "The related research project is not available to your account.",
                  );
                  return;
                }
                setSelectedAssignment(null);
                setSelectedAssignmentId(null);
                setActive("Research Repository");
                setSelectedResearch(project);
                setResearchTab("Overview");
                setSelectedReportSection(null);
                setReportContent("");
                const [comments, report, sources, activityRows, templates, documents] =
                  await Promise.all([
                    api.researchComments(token, project.id),
                    api.researchReport(token, project.id),
                    api.researchSources(token, project.id),
                    api.researchActivity(token, project.id),
                    api.documentTemplates(token, "Research"),
                    api.generatedDocuments(token, "Research", project.id),
                  ]);
                setResearchComments(comments);
                setResearchReport(report);
                setResearchSources(sources);
                setResearchActivity(activityRows);
                setBuilderTemplates(templates);
                setWorkspaceDocuments(documents);
                if (report.length) {
                  setSelectedReportSection(report[0]);
                  setReportContent(report[0].content || "");
                }
              } catch (error) {
                setAssignmentNotice(
                  error instanceof Error
                    ? error.message
                    : "Related research could not be opened.",
                );
              }
            }}
            onTabChange={(tab) => {
              setAssignmentWorkspaceTab(tab);
              setAssignmentNotice("");
              if (selectedAssignmentId) {
                window.history.replaceState(
                  {},
                  "",
                  `/assignments/${selectedAssignmentId}/${tab.toLowerCase()}`,
                );
              }
            }}
            onToggleQuickAdd={() => setAssignmentAddOpen((open) => !open)}
            onQuickAddReport={() => {
              setAssignmentAddOpen(false);
              setAssignmentWorkspaceTab("Reports");
            }}
            onQuickAddNote={() => {
              setAssignmentAddOpen(false);
              setAssignmentWorkspaceTab("Documents");
              setComment("Research note: ");
            }}
            onQuickAddDocument={async (file) => {
              setAssignmentAddOpen(false);
              setAssignmentWorkspaceTab("Documents");
              if (file) await uploadAssignmentFile(file);
            }}
            onQuickAddComment={() => {
              setAssignmentAddOpen(false);
              setAssignmentWorkspaceTab("Activity");
              window.setTimeout(
                () =>
                  document
                    .querySelector<HTMLTextAreaElement>(
                      ".assignment-activity-comment textarea",
                    )
                    ?.focus(),
                0,
              );
            }}
          >
              <AssignmentWorkspaceContext
                activeTab={assignmentWorkspaceTab}
                notice={assignmentNotice}
                felixOpen={assignmentFelixOpen}
                felixQuestion={assignmentFelixQuestion}
                felixBusy={assignmentFelixBusy}
                felixAnswer={assignmentFelixAnswer}
                onSelectTab={selectAssignmentWorkspaceTab}
                onDismissNotice={() => setAssignmentNotice("")}
                onToggleFelix={() => setAssignmentFelixOpen((open) => !open)}
                onHideFelix={() => setAssignmentFelixOpen(false)}
                onQuestionChange={setAssignmentFelixQuestion}
                onAskFelix={async () => {
                  if (!selectedAssignmentId) return;
                  setAssignmentFelixBusy(true);
                  setAssignmentFelixAnswer("");
                  try {
                    const response = await api.askFelix(
                      token,
                      `Assignment context: ID ${selectedAssignmentId}; title: ${selectedAssignmentRecord?.title || selectedAssignment || "Assignment"}. ${assignmentFelixQuestion}`,
                      [],
                      "Auto",
                    );
                    setAssignmentFelixAnswer(response.answer);
                  } catch (error) {
                    setAssignmentFelixAnswer(
                      error instanceof Error ? error.message : "Felix could not answer.",
                    );
                  } finally {
                    setAssignmentFelixBusy(false);
                  }
                }}
                onDismissAnswer={() => setAssignmentFelixAnswer("")}
              />

              {assignmentWorkspaceTab === "Overview" && (
                <AssignmentOverview
                  token={token}
                  selectedAssignmentRecord={selectedAssignmentRecord}
                  selectedAssignment={selectedAssignment}
                  assignmentLead={assignmentLead}
                  currentUserName={user?.name || "Current user"}
                  currentUserId={user?.id || ""}
                  currentUserRole={user?.role || "User"}
                  isAssignmentLead={isAssignmentLead}
                  isManager={isManager}
                  assignmentNextAction={assignmentNextAction}
                  assignmentOperationalStatus={assignmentOperationalStatus}
                  assignmentCompletion={assignmentCompletion}
                  assignmentReviews={assignmentReviews}
                  assignmentTasks={assignmentTasks}
                  completedTaskCount={completedTaskCount}
                  acceptedTaskReportCount={acceptedTaskReportCount}
                  latestFinalAssignmentReport={latestFinalAssignmentReport}
                  finalAssignmentReportIsFinal={finalAssignmentReportIsFinal}
                  allTaskReportsAccepted={allTaskReportsAccepted}
                  assignmentHistory={assignmentHistory}
                  assignmentMemberRequests={assignmentMemberRequests}
                  assignmentMemberRequestComments={assignmentMemberRequestComments}
                  assignmentMemberRequestSaving={assignmentMemberRequestSaving}
                  onSelectTab={selectAssignmentWorkspaceTab}
                  onOpenTasksModule={() => {
                    setTaskRequestAssignmentId(null);
                    setSelectedAssignment(null);
                    setSelectedAssignmentId(null);
                    setActive("Tasks");
                  }}
                  onCreateTaskRequest={() => {
                    if (!selectedAssignmentId) return;
                    setTaskRequestAssignmentId(selectedAssignmentId);
                    setSelectedAssignment(null);
                    setSelectedAssignmentId(null);
                    setActive("Tasks");
                  }}
                  onRequestMember={() => void openAssignmentMemberRequest()}
                  onMemberRequestComment={(requestId, value) =>
                    setAssignmentMemberRequestComments((current) => ({
                      ...current,
                      [requestId]: value,
                    }))
                  }
                  onDecideMemberRequest={(request, decision) =>
                    void decideAssignmentMemberRequest(request, decision)
                  }
                  onOpenTask={(task) => void openStandaloneTask(task.id)}
                  onOpenGeneratedDocument={(documentId, isFinal) =>
                    void openGeneratedDocument(documentId, isFinal)
                  }
                  assignmentReportStatusLabel={assignmentReportStatusLabel}
                  initialsFor={initialsFor}
                />
              )}

              {/* ASSIGNMENT V1.12: only ASSIGNMENT MEMBER REQUEST governance remains in this host. */}
              {assignmentMemberRequestOpen && (
                <section className="phase4-tasks task-workspace-polished">


                  {assignmentMemberRequestOpen && (
                    <div className="task-assignment-backdrop task-member-request-layer" role="presentation">
                      <form
                        className="task-assignment-modal task-member-request-modal"
                        aria-label="Request an additional assignment team member"
                        onSubmit={submitAssignmentMemberRequest}
                      >
                        <header>
                          <div className="task-modal-heading">
                            <span className="task-modal-eyebrow">Assignment team request</span>
                            <h3>Request an additional member</h3>
                            <p>
                              Sent to {assignmentLead?.supervisor_name || "the Assignment Lead's immediate supervisor"} for approval.
                            </p>
                          </div>
                          <button
                            type="button"
                            className="task-modal-close"
                            disabled={assignmentMemberRequestSaving}
                            onClick={() => setAssignmentMemberRequestOpen(false)}
                            aria-label="Close team-member request"
                          >
                            ×
                          </button>
                        </header>
                        <div className="task-member-request-body">
                          <div className="task-member-request-guidance">
                            <strong>Why approval is required</strong>
                            <span>The immediate supervisor confirms availability and accountability before the officer joins this assignment.</span>
                          </div>
                          <label className="task-field">
                            <span>Officer requested *</span>
                            <select
                              required
                              autoFocus
                              value={assignmentMemberRequestForm.userId}
                              onChange={(event) =>
                                setAssignmentMemberRequestForm({
                                  ...assignmentMemberRequestForm,
                                  userId: event.target.value,
                                })
                              }
                            >
                              <option value="">Select an active REDESY team member</option>
                              {userRows
                                .filter(
                                  (candidate) =>
                                    candidate.active &&
                                    candidate.role !== "System Admin" &&
                                    !(selectedAssignmentRecord?.members || []).some(
                                      (member) => member.id === candidate.id,
                                    ),
                                )
                                .sort((left, right) => left.name.localeCompare(right.name))
                                .map((candidate) => (
                                  <option key={candidate.id} value={candidate.id}>
                                    {candidate.name} — {candidate.role}
                                    {candidate.division ? ` · ${candidate.division}` : ""}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <label className="task-field">
                            <span>Reason for the request *</span>
                            <textarea
                              required
                              minLength={5}
                              rows={4}
                              value={assignmentMemberRequestForm.reason}
                              onChange={(event) =>
                                setAssignmentMemberRequestForm({
                                  ...assignmentMemberRequestForm,
                                  reason: event.target.value,
                                })
                              }
                              placeholder="Explain the skills, capacity, or workstream support needed."
                            />
                          </label>
                          {assignmentTaskDialogNotice && (
                            <p className="task-assignment-dialog-notice" role="alert">
                              {assignmentTaskDialogNotice}
                            </p>
                          )}
                        </div>
                        <footer>
                          <button
                            type="button"
                            className="task-modal-secondary"
                            disabled={assignmentMemberRequestSaving}
                            onClick={() => setAssignmentMemberRequestOpen(false)}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="task-modal-primary"
                            disabled={
                              !assignmentMemberRequestForm.userId ||
                              assignmentMemberRequestForm.reason.trim().length < 5 ||
                              assignmentMemberRequestSaving
                            }
                          >
                            {assignmentMemberRequestSaving ? "Sending..." : "Send request"}
                          </button>
                        </footer>
                      </form>
                    </div>
                  )}
                </section>
              )}

              {assignmentWorkspaceTab === "Documents" && (
                <AssignmentEvidencePanel
                  search={assignmentDocumentSearch}
                  onSearchChange={setAssignmentDocumentSearch}
                  filter={assignmentDocumentFilter}
                  onFilterChange={setAssignmentDocumentFilter}
                  repositoryLinkId={assignmentRepositoryLinkId}
                  onRepositoryLinkIdChange={setAssignmentRepositoryLinkId}
                  knowledgeRows={knowledgeRows}
                  assignmentFiles={assignmentFiles}
                  selectedAssignmentId={selectedAssignmentId}
                  comment={comment}
                  onCommentChange={setComment}
                  onAttachRepositoryDocument={async () => {
                    if (!selectedAssignmentId || !assignmentRepositoryLinkId) return;
                    await api.linkKnowledgeToAssignment(token, assignmentRepositoryLinkId, selectedAssignmentId);
                    setAssignmentRepositoryLinkId("");
                    setKnowledgeRows(await api.knowledge(token));
                    setAssignmentHistory(await api.history(token, selectedAssignmentId));
                    setAssignmentNotice("Repository document attached.");
                  }}
                  onDownloadAttachment={(file) => api.downloadAttachment(token, file.id, file.original_name)}
                  onPreviewRepository={(item) => void openRepositoryDocumentReader(item)}
                  onAddResearchNote={async () => {
                    if (!selectedAssignmentId || !comment.trim()) return;
                    const note = comment.trim().toLowerCase().startsWith("research note:")
                      ? comment.trim()
                      : `Research note: ${comment.trim()}`;
                    await api.addComment(token, selectedAssignmentId, note);
                    setComment("");
                    const [history, discussion] = await Promise.all([
                      api.history(token, selectedAssignmentId),
                      api.comments(token, selectedAssignmentId),
                    ]);
                    setAssignmentHistory(history);
                    setComments(discussion.map((item) => ({
                      id: item.id,
                      author: item.author_name,
                      text: item.body,
                      created_at: item.created_at,
                    })));
                  }}
                />
              )}

              <AssignmentReportsWorkspace
                visible={assignmentWorkspaceTab === "Reports"}
                panelProps={{
                  assignmentTitle: selectedAssignmentRecord?.title || selectedAssignment,
                  tasks: assignmentTasks,
                  documents: workspaceDocuments,
                  knowledge: knowledgeRows.filter((item) =>
                    item.assignments?.some((assignment) => assignment.id === selectedAssignmentId),
                  ),
                  reviewers: assignmentReportReviewerCandidates,
                  currentUserId: user?.id,
                  canManage: Boolean(isAssignmentLead || isManager),
                  isCurrentUserLead: isAssignmentLead,
                  canOverrideAsManager: isManager && !isAssignmentLead,
                  assignmentLeadName: assignmentLead?.name,
                  onCompile: compileAssignmentReport,
                  onOpen: (id) => openGeneratedDocument(id, false),
                  onPreview: (id) => void openGeneratedDocument(id, true),
                  onOpenTask: (task) => void openAssignmentTaskWorkspace(task),
                  onOpenRepository: (id) => {
                    void openRepositoryDocumentReader(id);
                  },
                  onSubmit: submitAssignmentReportForReview,
                  onReview: reviewAssignmentReportDecision,
                  onDiscardImport: async (id) => {
                    await api.discardImportedAssignmentReport(token, id);
                    if (selectedAssignmentId) {
                      setWorkspaceDocuments(
                        await api.generatedDocuments(token, "Assignment", selectedAssignmentId),
                      );
                    }
                    setAssignmentNotice(
                      "Imported report discarded. You can continue editing inside REDESY or import a replacement.",
                    );
                  },
                }}
              />

              {assignmentWorkspaceTab === "Activity" && (
                <AssignmentActivityPanel
                  history={assignmentHistory}
                  comments={comments}
                  comment={comment}
                  onCommentChange={setComment}
                  onAddComment={addComment}
                />
              )}

          </AssignmentWorkspaceEntry>
          </Suspense>
        )}

        {/* TASK V1.11: standalone TASK renderer lives outside the ASSIGNMENT Workspace shell. */}
        {selectedAssignmentTask && (
          <section
            className="phase4-tasks task-workspace-polished task-workspace-standalone-host"
            aria-label={`Standalone TASK: ${selectedAssignmentTask.title}`}
          >
                    <Suspense fallback={<div className="report-loading">Loading Task Workspace...</div>}>
                    <TaskWorkspaceEntry
                      task={selectedAssignmentTask}
                      header={
                        <AssignmentTaskWorkspaceHeader
                          task={selectedAssignmentTask}
                          responsibility={selectedTaskResponsibility}
                          isManager={isManager}
                          isSelectedTaskOwner={isSelectedTaskOwner}
                          workspaceSaving={assignmentTaskWorkspaceSaving}
                          managementBusy={assignmentTaskManagementBusy}
                          reportPreviewBusy={assignmentTaskReportPreviewBusy}
                          knowledgeUploading={knowledgeUploading}
                          workspaceStatus={assignmentTaskWorkspaceForm.status}
                          workspaceProgress={assignmentTaskWorkspaceForm.progress}
                          workspaceStartDate={assignmentTaskWorkspaceForm.startDate}
                          assignmentFiles={assignmentFiles}
                          workspaceDocuments={workspaceDocuments}
                          knowledgeRows={knowledgeRows}
                          selectedAssignmentId={selectedAssignmentId}
                          taskDateText={taskDateText}
                          reportActionLabel={taskReportOwnerActionLabel}
                          onClose={() => void closeAssignmentTaskWorkspaceSafely()}
                          onFocusReport={focusTaskReportEditor}
                          onOpenSavedReport={() => void openSavedAssignmentTaskContributionReport()}
                          onStatusChange={(status) =>
                            setAssignmentTaskWorkspaceForm({
                              ...assignmentTaskWorkspaceForm,
                              status,
                            })
                          }
                          onStartDateChange={(startDate) =>
                            setAssignmentTaskWorkspaceForm({
                              ...assignmentTaskWorkspaceForm,
                              startDate,
                            })
                          }
                          onProgressChange={(progress) =>
                            setAssignmentTaskWorkspaceForm({
                              ...assignmentTaskWorkspaceForm,
                              progress,
                            })
                          }
                          onOpenGeneratedDocument={(id) => void openGeneratedDocument(id)}
                          onDownloadAttachment={(file) =>
                            api.downloadAttachment(token, file.id, file.original_name)
                          }
                          onOpenRepositoryDocument={(item) =>
                            void openRepositoryDocumentReader(item)
                          }
                          onAttachReport={(file) =>
                            void attachWorkspaceReport(file, "Task", selectedAssignmentTask.id)
                          }
                          onArchive={() => void archiveSelectedAssignmentTask()}
                          onRequestDelete={() => {
                            setAssignmentTaskDeleteReason("");
                            setAssignmentTaskDeleteConfirmed(false);
                            setAssignmentTaskDeleteDialogOpen(true);
                          }}
                        />
                      }
                    >

                        {isManager || isSelectedTaskOwner || isSelectedTaskReviewer ? (
                          <div className="task-workspace-body task-screen-body">
                            <Suspense fallback={<div className="report-loading">Loading task status...</div>}>
                              <TaskWorkflowStatusPanel
                                taskStatus={selectedAssignmentTask.status}
                                contributionStatus={assignmentTaskWorkspaceForm.contributionStatus}
                                isOwner={isSelectedTaskOwner}
                                isReviewer={isSelectedTaskReviewer}
                                ownerName={selectedAssignmentTask.owner_name || "the task owner"}
                                reviewerName={
                                  selectedAssignmentTask.reviewer_name ||
                                  "the assigned reviewer"
                                }
                                latestReviewAction={latestSelectedTaskReview?.action || ""}
                                latestReviewComment={String(
                                  latestSelectedTaskReview?.details?.comments || "",
                                )}
                              />
                            </Suspense>

                            {canManageTaskOwner(selectedAssignmentTask) &&
                              selectedAssignmentTask.contribution_status === "Draft" && (
                                <Suspense fallback={<div className="report-loading">Loading task controls...</div>}>
                                  <TaskManagementPanel
                                    form={assignmentTaskWorkspaceForm}
                                    reviewerOptions={deriveTaskReviewerOptions(
                                      userRows,
                                      selectedAssignmentRecord?.members || [],
                                      assignmentTaskWorkspaceForm.ownerId,
                                    )}
                                    assigneeOptions={deriveTaskAssigneeOptions(
                                      selectedAssignmentRecord?.members || [],
                                    )}
                                    onChange={(field, value) =>
                                      setAssignmentTaskWorkspaceForm((current) => ({
                                        ...current,
                                        [field]: value,
                                      }))
                                    }
                                  />
                                </Suspense>
                              )}

                            {renderTaskReviewDecision()}
                            <Suspense fallback={<div className="report-loading">Loading report controls...</div>}>
                              <TaskReportAccessPanel
                                task={selectedAssignmentTask}
                                reportMode={taskReportDocumentMode}
                                isOwner={canEditSelectedTaskReport}
                                isReviewer={isSelectedTaskReviewer}
                                responsibilityStage={selectedTaskResponsibility?.stage || "Task work"}
                                responsibilityAction={
                                  selectedTaskResponsibility?.action ||
                                  "Continue the governed task workflow."
                                }
                                previewBusy={assignmentTaskReportPreviewBusy}
                                readySectionCount={
                                  taskReportRequiredSectionKeys.filter(
                                    (key) => taskReportSectionValue(key).trim().length > 0,
                                  ).length
                                }
                                totalSectionCount={taskReportRequiredSectionKeys.length}
                                submissionReady={taskReportMissingSectionKeys.length === 0}
                                outlineSections={taskReportRequiredSectionKeys.map((key) => ({
                                  id: key,
                                  title: taskReportSectionName(key),
                                  status:
                                    taskReportSectionValue(key).trim() &&
                                    String(
                                      selectedAssignmentTask.contribution_section_statuses?.[key] || "",
                                    ) === "Not Started"
                                      ? "Draft"
                                      : selectedAssignmentTask.contribution_section_statuses?.[key] ||
                                        (taskReportSectionValue(key).trim()
                                          ? "Draft"
                                          : "Not Started"),
                                }))}
                                onContinueReport={() =>
                                  void openAssignmentTaskReport(selectedAssignmentTask)
                                }
                                onPreviewLockedReport={openSavedAssignmentTaskContributionReport}
                              />
                            </Suspense>
                          </div>
                        ) : (
                          <Suspense fallback={<div className="report-loading">Loading task access...</div>}>
                            <TaskReadOnlyPanel
                              task={selectedAssignmentTask}
                              isReviewer={isSelectedTaskReviewer}
                              contributionStatus={assignmentTaskWorkspaceForm.contributionStatus}
                              previewBusy={assignmentTaskReportPreviewBusy}
                              reviewControls={renderTaskReviewDecision()}
                              onOpenSubmittedReport={openSavedAssignmentTaskContributionReport}
                            />
                          </Suspense>
                        )}

                        {taskReportSectionModal &&
                          canEditSelectedTaskReport &&
                          selectedAssignmentTask.contribution_status === "Draft" &&
                          selectedAssignmentTask.status !== "Blocked" && (
                            <Suspense fallback={<div className="report-loading">Loading report section...</div>}>
                              <TaskReportSectionPanel
                                previewOpen={assignmentTaskReportPreviewOpen}
                                key={`${selectedAssignmentTask.id}-${taskReportSectionModal.key}`}
                                sectionKey={taskReportSectionModal.key}
                                currentReviewerId={selectedAssignmentTask.reviewer_id}
                                sectionTitle={taskReportSectionName(taskReportSectionModal.key)}
                                reportTitle={taskReportSafeTitle(assignmentTaskWorkspaceForm.contributionTitle)}
                                
                                contextTitle={`${selectedAssignmentRecord?.title || selectedAssignment || "Assignment"} — ${selectedAssignmentTask.title}`}
                                reportDocumentMode={taskReportDocumentMode}
                                documentFrameMeta={{
                                  reference: selectedAssignmentTask.id,
                                  assignment: selectedAssignmentRecord?.title || selectedAssignment || "Not specified",
                                  preparedBy: selectedAssignmentTask.owner_name || user.name || "Not recorded",
                                  status: selectedAssignmentTask.contribution_status || "Draft",
                                  savedAt: selectedAssignmentTask.contribution_updated_at || "",
                                }}
                                value={taskReportSectionValue(taskReportSectionModal.key)}
                                busy={assignmentTaskContributionSaving}
                                statusMessage={assignmentNotice}
                                statusTone={assignmentTaskReviewResult?.tone || "info"}
                                reviewerOptions={taskReportReviewerCandidates}
                                reviewerOptionsError={taskReportReviewerAuthority.error}
                                reviewerOptionsLoading={taskReportReviewerAuthority.loading}
                                onRetryReviewerOptions={taskReportReviewerAuthority.retry}
                                readySectionCount={0}
                                totalSectionCount={0}
                                submissionReady={taskReportSubmissionReady}
                                sectionNumber={0}
                                outlineSections={taskReportRequiredSectionKeys.map((key) => ({
                                  id: key,
                                  title: taskReportSectionName(key),
                                  status:
                                    taskReportSectionValue(key).trim() &&
                                    String(
                                      selectedAssignmentTask.contribution_section_statuses?.[key] || "",
                                    ) === "Not Started"
                                      ? "Draft"
                                      : selectedAssignmentTask.contribution_section_statuses?.[key] ||
                                        (taskReportSectionValue(key).trim()
                                          ? "Draft"
                                          : "Not Started"),
                                }))}
                                templateOptions={taskReportTemplates(builderTemplates)
                                  .map((template) => ({
                                    id: template.id,
                                    name: template.name,
                                    description: template.description,
                                    sections: template.sections,
                                  }))}
                                canGoPrevious={
                                  taskReportPreviousSection(taskReportSectionModal.key) !== null
                                }
                                canGoNext={
                                  taskReportNextSection(taskReportSectionModal.key) !== null
                                }
                                onChange={(value) => {
                                  taskReportLatestEditorValueRef.current = {
                                    taskId: selectedAssignmentTask.id,
                                    sectionKey: taskReportSectionModal.key,
                                    value,
                                  };
                                  setTaskReportSectionValue(taskReportSectionModal.key, value);
                                }}
                                onImmediateChange={(value) => {
                                  taskReportLatestEditorValueRef.current = {
                                    taskId: selectedAssignmentTask.id,
                                    sectionKey: taskReportSectionModal.key,
                                    value,
                                  };
                                }}
                                onSave={async (latestValue, reviewerId?: string, saveOptions?: { autoSave?: boolean }) => {
                                  const value =
                                    latestValue ??
                                    taskReportSectionValue(taskReportSectionModal.key);
                                  if (
                                    reviewerId &&
                                    reviewerId !== selectedAssignmentTask.reviewer_id
                                  ) {
                                    const reviewerSaved =
                                      await selectAssignmentTaskReviewer(reviewerId);
                                    if (!reviewerSaved) return false;
                                  }
                                  setTaskReportSectionValue(
                                    taskReportSectionModal.key,
                                    value,
                                  );
                                  return saveAssignmentTaskContribution(
                                    "Draft",
                                    {
                                      key: taskReportSectionModal.key,
                                      value,
                                    },
                                    { throwOnError: true, autoSave: saveOptions?.autoSave },
                                  );
                                }}
                                onSelectSection={(key) =>
                                  setTaskReportSectionModal({ key, mode: "edit" })
                                }
                                onPrevious={() => {
                                  const previousSection = taskReportPreviousSection(
                                    taskReportSectionModal.key,
                                  );
                                  if (previousSection) {
                                    setTaskReportSectionModal({
                                      key: previousSection,
                                      mode: "edit",
                                    });
                                  }
                                }}
                                onNext={() => {
                                  const nextSection = taskReportNextSection(
                                    taskReportSectionModal.key,
                                  );
                                  if (nextSection) {
                                    setTaskReportSectionModal({
                                      key: nextSection,
                                      mode: "edit",
                                    });
                                  }
                                }}
                                onPreviewReport={async (latestValue) => {
                                  const value =
                                    latestValue ??
                                    taskReportSectionValue(taskReportSectionModal.key);

                                  // TaskSectionWorkspace saves the latest editor value first.
                                  // Preview therefore renders the exact saved value without a
                                  // second API save or a competing busy-state transition.
                                  taskReportPreviewReturnSectionRef.current =
                                    taskReportSectionModal.key;
                                  const opened = await openAssignmentTaskContributionPreview({
                                    key: taskReportSectionModal.key,
                                    value,
                                    throwOnError: true,
                                  });

                                  if (!opened) {
                                    throw new Error(
                                      "The Task Report preview could not be opened. Your saved draft remains in the editor.",
                                    );
                                  }
                                }}
                                onProceedForReview={async (latestValue) => {
                                  const value =
                                    latestValue ??
                                    taskReportSectionValue(taskReportSectionModal.key);
                                  const saved = await saveAssignmentTaskContribution(
                                    "Draft",
                                    {
                                      key: taskReportSectionModal.key,
                                      value,
                                    },
                                  );
                                  if (!saved) return;
                                  taskReportPreviewReturnSectionRef.current =
                                    taskReportSectionModal.key;
                                  const opened = await openSavedAssignmentTaskContributionReport();
                                  if (!opened) {
                                    throw new Error(
                                      "The Task Report preview could not be opened. Your saved draft remains in the editor.",
                                    );
                                  }
                                }}
                                onSubmitForReview={async (reviewerId, latestValue) => {
                                  const selectedReviewer = taskReportReviewerCandidates.find(
                                    (reviewer) => reviewer.id === reviewerId,
                                  );
                                  if (!selectedReviewer) {
                                    throw new Error(
                                      "Select an eligible reviewer before submitting this TASK Report.",
                                    );
                                  }
                                  const currentValue = latestValue ?? taskReportSectionValue(
                                    taskReportSectionModal.key,
                                  );
                                  if (!taskReportPlainText(currentValue).trim()) {
                                    throw new Error(
                                      "Add report content before submitting this TASK Report.",
                                    );
                                  }
                                  const taskAssignmentId =
                                    selectedAssignmentTask.assignment_id || selectedAssignmentId;
                                  if (!taskAssignmentId) {
                                    throw new Error(
                                      "This TASK Report is missing its assignment context. Reopen the TASK and try again.",
                                    );
                                  }
                                  if (reviewerId !== selectedAssignmentTask.reviewer_id) {
                                    const reviewerSaved = await selectAssignmentTaskReviewer(reviewerId);
                                    if (!reviewerSaved) {
                                      throw new Error("The selected reviewer could not be saved. The report remains a draft.");
                                    }
                                  }

                                  const submitted =
                                    await saveAssignmentTaskContribution(
                                      "Ready for Integration",
                                      {
                                        key: taskReportSectionModal.key,
                                        value: currentValue,
                                      },
                                      { throwOnError: true },
                                    );
                                  if (!submitted) {
                                    throw new Error(
                                      "The TASK Report could not be submitted to the selected reviewer. Check the error shown in the task workspace and try again.",
                                    );
                                  }
                                  setSelectedAssignmentTask((current) => current
                                    ? { ...current, reviewer_id: reviewerId, reviewer_name: selectedReviewer.name }
                                    : current);
                                  setAssignmentTasks((current) => current.map((task) =>
                                    task.id === selectedAssignmentTask.id
                                      ? { ...task, reviewer_id: reviewerId, reviewer_name: selectedReviewer.name }
                                      : task));
                                  setTaskReportSectionModal(null);
                                  setAssignmentNotice(
                                    `TASK Report submitted to ${selectedReviewer.name}. The submitted version is now locked for review.`,
                                  );
                                }}
                                onClose={() => {
                                  taskReportLatestEditorValueRef.current = null;
                                  setTaskReportSectionModal(null);
                                }}
                                onOpenFinalDocument={() => {
                                  void openSavedAssignmentTaskContributionReport();
                                }}
                              />
                            </Suspense>
                          )}

                        {assignmentTaskReportPreviewOpen && (
                          <>
                            
                            <TaskReportPreviewErrorBoundary onClose={closeAssignmentTaskReportPreview}>
                            <Suspense fallback={<div className="report-loading">Loading report preview...</div>}>
                              <TaskReportPreviewPanel
                              title={assignmentTaskReportPreviewTitle || "Task Report"}
                              html={assignmentTaskReportPreviewHtml}
                              isOwner={canEditSelectedTaskReport}
                              isReviewer={isSelectedTaskReviewer}
                              contributionStatus={selectedAssignmentTask?.contribution_status || "Draft"}
                              reviewerNames={authorizedTaskReviewers.map((person) => person.name)}
                              reviewerDetails={authorizedTaskReviewers.map(
                                (person) => `${person.name} — ${person.role}`,
                              )}
                              reviewerName={
                                selectedAssignmentTask?.reviewer_name ||
                                "the assigned reviewer"
                              }
                              reviewerOptions={taskReportReviewerCandidates}
                              selectedReviewerId={selectedAssignmentTask?.reviewer_id || ""}
                              reviewerSaving={assignmentTaskReviewSaving}
                              onReviewerChange={(reviewerId) => {
                                void selectAssignmentTaskReviewer(reviewerId);
                              }}
                              submissionReady={taskReportSubmissionReady}
                              missingSectionNames={taskReportMissingSectionNames}
                              contributionSaving={assignmentTaskContributionSaving}
                              reviewComment={assignmentTaskReviewComment}
                              reviewSaving={assignmentTaskReviewSaving}
                              reviewResult={assignmentTaskReviewResult}
                              onClose={closeAssignmentTaskReportPreview}
                              onCopy={(characters) => {
                                if (!selectedAssignmentTask?.id) return;
                                void api
                                  .logPreviewCopy(token, {
                                    entityType: "assignment_task",
                                    entityId: selectedAssignmentTask.id,
                                    source: "Task Report Preview",
                                    characters,
                                  })
                                  .catch(() => {});
                              }}
                              onSubmit={approveAndSendAssignmentTaskContribution}
                              onReviewCommentChange={setAssignmentTaskReviewComment}
                              onReviewDecision={(decision) =>
                                void reviewAssignmentTaskContribution(decision)
                              }
                              />
                            </Suspense>
                            </TaskReportPreviewErrorBoundary>
                          </>
                        )}

                        {isManager && assignmentTaskDeleteDialogOpen && (
                          <Suspense fallback={<div className="report-loading">Loading delete confirmation...</div>}>
                            <TaskDeleteDialog
                              taskTitle={selectedAssignmentTask.title}
                              reason={assignmentTaskDeleteReason}
                              confirmed={assignmentTaskDeleteConfirmed}
                              busy={assignmentTaskManagementBusy}
                              onReasonChange={setAssignmentTaskDeleteReason}
                              onConfirmedChange={setAssignmentTaskDeleteConfirmed}
                              onClose={() => setAssignmentTaskDeleteDialogOpen(false)}
                              onDelete={deleteSelectedAssignmentTask}
                            />
                          </Suspense>
                        )}

                        <Suspense fallback={<div className="report-loading">Loading task actions...</div>}>
                          <TaskWorkspaceFooter
                            contributionStatus={selectedAssignmentTask.contribution_status}
                            canEdit={canManageTaskOwner(selectedAssignmentTask) || selectedAssignmentTask.owner_id === user?.id}
                            taskStatus={selectedAssignmentTask.status}
                            workspaceSaving={assignmentTaskWorkspaceSaving}
                            managementBusy={assignmentTaskManagementBusy}
                            titleReady={Boolean(assignmentTaskWorkspaceForm.title.trim())}
                            onStart={() => saveAssignmentTaskWorkspace("start")}
                            onSave={() => saveAssignmentTaskWorkspace("save")}
                          />
                        </Suspense>
                    </TaskWorkspaceEntry>
                    </Suspense>
                          </section>
        )}

        {showLogout && (
          <div className="modal-backdrop">
            <section
              className="profile-modal logout-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button className="close" onClick={() => setShowLogout(false)}>
                  ×
                </button>
              <h2>Sign out</h2>
              <div className="logout-identity"><span>{user.initials}</span><div><strong>{user.name}</strong><small>{user.email}</small></div></div>
              <p>This ends your session on this device and returns you to the secure sign-in screen. Your saved work will remain available.</p>

              <div className="logout-actions">
                <button className="logout-cancel" onClick={() => setShowLogout(false)}>Stay signed in</button>
                <button
                  className="danger"
                  onClick={() => {
                    setShowLogout(false);
                    signOut();
                  }}
                >
                  Sign out
                </button>
              </div>
            </section>
          </div>
        )}

        {contextMenu&&<nav className="app-context-menu" aria-label="App actions" style={{left:contextMenu.x,top:contextMenu.y}} onClick={event=>event.stopPropagation()}>
          <span>APP ACTIONS</span>
          <button onClick={()=>{navigateTo("Dashboard");setContextMenu(null)}}><Icon name="dashboard"/>Dashboard</button>
          <button onClick={()=>{setContextMenu(null);window.setTimeout(()=>document.querySelector<HTMLInputElement>('.header-search input')?.focus(),0)}}><Icon name="search"/>Search</button>
          <button onClick={()=>{navigateTo("Notifications");setContextMenu(null)}}><Icon name="bell"/>Notifications</button>
          <button onClick={()=>{navigateTo("Notice Board");setContextMenu(null)}}><Icon name="announce"/>Expiring notices <b>{noticeRows.filter(item=>item.status==="Published"&&item.expires_at&&new Date(item.expires_at).getTime()>Date.now()&&new Date(item.expires_at).getTime()<=Date.now()+3*86400000).length}</b></button>
          <button onClick={()=>{refreshDashboard();setContextMenu(null)}}><Icon name="clock"/>Refresh data</button>
          <button onClick={()=>{setProfileMenuOpen(true);setContextMenu(null)}}><Icon name="team"/>Account menu</button>
          <small>Right-click actions are limited to REDESY.</small>
        </nav>}

        {externalResearchOpen && (
          <ExternalResearchImportModal token={token} users={team} onClose={() => setExternalResearchOpen(false)} onCreated={(created) => { setExternalResearchOpen(false); setSelectedResearch(null); setExternalResearchRows((current) => [created, ...current.filter((item) => item.id !== created.id)]); requestResearchEntryMode("Imported"); setSelectedExternalResearch(created); }} />
        )}
        {selectedExternalResearch && (
          <ExternalResearchReader token={token} item={selectedExternalResearch} onClose={() => setSelectedExternalResearch(null)} onUpdated={(updated) => { setSelectedExternalResearch(updated); setExternalResearchRows((current) => current.map((item) => item.id === updated.id ? updated : item)); }} onOpenRepository={(knowledgeId) => { setSelectedExternalResearch(null); setActive("Document Repository"); const target = documentRows.find((item) => item.id === knowledgeId); if (target) setReaderDocument(target); }} />
        )}

        {readerDocument && (
          <SecureRepositoryReader
            token={token}
            document={readerDocument}
            versionId={readerVersionId}
            onClose={() => {
              setReaderDocument(null);
              setReaderVersionId(undefined);
            }}
          />
        )}
        {pinnedChat&&active!=="Messages"&&<Suspense fallback={null}>
          <FloatingChatWindow
            token={token}
            currentUserId={user?.id}
            conversationId={pinnedChat.conversationId}
            name={pinnedChat.name}
            onClose={()=>setPinnedChat(null)}
            onExpand={()=>{
              sessionStorage.setItem("app2-open-message-conversation",pinnedChat.conversationId);
              navigateTo("Messages");
            }}
          />
        </Suspense>}
        <Suspense fallback={null}>
          <IncomingMessagePopup
            message={incomingMessage}
            currentUserId={user?.id}
            onDismiss={()=>setIncomingMessage(null)}
            onOpen={(conversationId)=>{
              sessionStorage.setItem("app2-open-message-conversation",conversationId);
              setIncomingMessage(null);
              navigateTo("Messages");
            }}
          />
        </Suspense>
        {workflowDecision && <WorkflowNextActionDialog {...workflowDecision} onClose={() => setWorkflowDecision(null)} />}
      </AppShell>
    </ThemeProvider>
  );
}

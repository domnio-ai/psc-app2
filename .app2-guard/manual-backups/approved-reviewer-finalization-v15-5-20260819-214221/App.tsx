import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  api,
  type AiResearchEngine,
  type AiResearchJob,
  type AnalyticsReport,
  type ApiAssignment,
  type ApiAssignmentReview,
  type ApiAssignmentSection,
  type ApiAssignmentTask,
  type ApiAssignmentTaskRequest,
  type ApiAttachment,
  type ApiHistory,
  type ApiNotification,
  type ApiUser,
  type AssignmentInput,
  type AssignmentSectionInput,
  type AuditLog,
  type CalendarItem,
  type DashboardResponse,
  type DocumentDeletionRequest,
  type DocumentItem,
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
import CalendarView from "./CalendarView";
import NoticeComposer from "./NoticeComposer";
import NotificationCenter from "./NotificationCenter";
import NoticeBoardWorkspace from "./NoticeBoardWorkspace";
import AIResearchChat from "./AIResearchChat";
import ExternalResearchImportModal from "./ExternalResearchImportModal";
import ExternalResearchReader from "./ExternalResearchReader";
import { ResearchAssignmentProgress } from "./modules/research/ResearchAssignmentProgress";
import "./assignment-overview-v4.css";

const DocumentReader = lazy(() => import("./DocumentReader"));
const ReportsModule = lazy(() => import("./ReportsModule"));
import FelixAssistant from "./FelixAssistant";
import FelixAdmin from "./FelixAdmin";
import AppShell from "./components/AppShell";
import ThemeProvider from "./components/ThemeProvider";
import WorkspaceHeader from "./components/WorkspaceHeader";
import AssignmentReportBuilder from "./AssignmentReportBuilder";
import AssignmentReportsPanel from "./AssignmentReportsPanel";
import TaskSectionWorkspace from "./TaskSectionWorkspace";
import "./assignment-tasks-assignment-modal.css";
import "./assignment-tasks-task-requests.css";
import "./assignment-task-workspace.css";
import "./task-review-action-clarity.css";
import "./user-access-password-reset.css";
import "./temporary-password-visibility.css";
import "./task-report-owner-access.css";
import "./workspace-document-overview.css";
import "./research-workspace-redesign-v1.css";
import "./research-work-progress.css";
import "./research-workflow-phase2.css";
import "./external-research-phase3.css";
import "./research-workspace-theme-v4.css";
import "./research-workspace-workflow-v5.css";
import "./research-workspace-simplified-v6.css";
import "./research-workspace-live-v8.css";
import "./research-workspace-evidence-v9.css";
import "./research-workspace-report-v10.css";
import "./research-workspace-template-library-v11.css";
import "./research-report-handoff-v11-1.css";
import "./research-review-v12.css";
import "./research-template-outline-v13.css";
import "./research-template-outline-v13-1.css";
import "./research-report-builder-templates-v14.css";
import "./research-report-builder-templates-v14-4.css";
import "./research-preview-review-v14-6.css";
import "./research-editor-preview-review-v14-7.css";
import "./research-editor-ribbon-v14-8.css";
import "./research-footer-preview-v14-9.css";
import "./research-report-reader-v14-10.css";
import "./research-report-reader-v14-11.css";
import "./research-review-finalization-v15.css";
import "./research-reviewer-selector-v15-1.css";

type IconName = keyof typeof icons;
type Role =
  | "Administrator"
  | "Research Manager"
  | "Research Officer"
  | "Reviewer";
type User = {
  id?: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
  rights: string[];
  mustChangePassword?: boolean;
};
type TeamMember = User & {
  id: string;
  division: string;
  active: number;
  completed: number;
  status: "Available" | "Busy" | "Away";
};
type StoredSession = { token: string; user: User };
const SESSION_KEY = "psc-app2-session";
const THEME_KEY = "psc-app2-theme";

const taskReportPlainText = (value: unknown) => {
  const raw = String(value ?? "");
  if (!raw.trim()) return "";
  const withBreaks = raw
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*li\b[^>]*>/gi, "â€¢ ")
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
type PreferenceForm = {
  emailNotifications: boolean;
  inAppNotifications: boolean;
  compactLayout: boolean;
  themeMode: "Dark" | "Light" | "System" | "Gold Grey" | "Navy Blue" | "Navy Blue";
  accentColor: "Gold" | "Blue" | "Green";
};

const defaultPreferences: PreferenceForm = {
  emailNotifications: true,
  inAppNotifications: true,
  compactLayout: false,
  themeMode: "Gold Grey",
  accentColor: "Gold",
};

function displayFileName(
  value: string | null | undefined,
  fallback = "Unnamed file",
) {
  const source = String(value || "").trim();
  if (!source) return fallback;
  let decoded = source.replaceAll("+", " ");
  for (let pass = 0; pass < 3 && /%[0-9a-f]{2}/i.test(decoded); pass += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return (
    decoded
      .replace(/%20/gi, " ")
      .replaceAll("_", " ")
      .replace(/\s+/g, " ")
      .trim() || fallback
  );
}

function displayDocumentTitle(value: string | null | undefined) {
  const title = displayFileName(value, "Untitled document");
  if (title !== title.toLowerCase()) return title;
  return title.replace(/\b(?:ai|app2|psc)\b|\b[a-z]/g, (word) =>
    word.toLowerCase() === "ai"
      ? "AI"
      : word.toLowerCase() === "app2"
        ? "App2"
        : word.toLowerCase() === "psc"
          ? "PSC"
          : word.toUpperCase(),
  );
}

function formatResearchDate(value: string | null | undefined) {
  if (!value) return "Open";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getFullYear() < 2000)
    return "Not set";
  return parsed.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeDocument<T extends DocumentItem>(item: T): T {
  return {
    ...item,
    title: displayDocumentTitle(item.title),
    original_name: displayFileName(item.original_name, "No file attached"),
    created_by_name: displayFileName(item.created_by_name, "Unknown user"),
  };
}

function felixLinkState(item: DocumentItem) {
  if (item.status === "Rejected")
    return { progress: 35, label: "Correction required", state: "failed" };
  if (item.status === "Draft")
    return { progress: 25, label: "Draft - not submitted", state: "waiting" };
  if (item.status === "Pending Approval")
    return { progress: 45, label: "Awaiting approval", state: "waiting" };
  if (item.status === "Archived")
    return { progress: 100, label: "Archived", state: "waiting" };
  if (item.felix_index_status === "Processing")
    return { progress: 82, label: "Linking to Felix", state: "active" };
  if (item.felix_index_status === "Completed")
    return { progress: 100, label: "Available to Felix", state: "complete" };
  if (item.felix_index_status === "Failed")
    return { progress: 100, label: "Felix linking failed", state: "failed" };
  return { progress: 62, label: "Queued for Felix", state: "active" };
}
const readThemePreferences = (): PreferenceForm => {
  try {
    return {
      ...defaultPreferences,
      ...JSON.parse(localStorage.getItem(THEME_KEY) || "{}"),
    };
  } catch {
    return defaultPreferences;
  }
};

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
    role: "Research Officer",
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
    role: "Research Manager",
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
    role: "Reviewer",
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
    role: "Administrator",
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
    completed: 8,
    status: "Busy",
  },
  {
    ...demoUsers[1],
    id: "2",
    division: "Research & Policy",
    active: 2,
    completed: 14,
    status: "Available",
  },
  {
    ...demoUsers[2],
    id: "3",
    division: "Quality Assurance",
    active: 4,
    completed: 11,
    status: "Busy",
  },
  {
    id: "4",
    name: "John Kamau",
    email: "john.kamau@publicservice.go.ke",
    role: "Research Officer",
    initials: "JK",
    rights: ["View assignments", "Update assigned work", "Collaborate"],
    division: "HR Research",
    active: 1,
    completed: 9,
    status: "Available",
  },
  {
    id: "5",
    name: "Faith Njeri",
    email: "faith.njeri@publicservice.go.ke",
    role: "Reviewer",
    initials: "FN",
    rights: ["Review submissions", "Comment", "Approve knowledge"],
    division: "Governance",
    active: 2,
    completed: 12,
    status: "Away",
  },
  {
    ...demoUsers[3],
    id: "6",
    division: "ICT",
    active: 0,
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
  check: "OK",
  warning: "!",
  announce: "N",
};

const navItems: [IconName, string][] = [
  ["dashboard", "Dashboard"],
  ["assignments", "Assignments"],
  ["knowledge", "Document Repository"],
  ["research", "Research Repository"],
  ["research", "AI Researcher"],
  ["settings", "Felix Administration"],
  ["documents", "Documents"],
  ["team", "Team & Users"],
  ["reports", "Reports & Analytics"],
  ["notifications", "Notifications"],
  ["announce", "Notice Board"],
  ["calendar", "Calendar"],
  ["audit", "Audit Logs"],
  ["settings", "Settings"],
];

const navGroups: { label: string; items: string[] }[] = [
  { label: "Main", items: ["Dashboard"] },
  { label: "Work", items: ["Assignments", "Research Repository", "Calendar"] },
  { label: "Knowledge", items: ["Document Repository"] },
  { label: "Organization", items: ["Team & Users", "Notice Board"] },
  { label: "Insights", items: ["Reports & Analytics", "AI Researcher"] },
  {
    label: "System",
    items: ["Notifications", "Settings", "Felix Administration", "Audit Logs"],
  },
];

const stats: [IconName, string, string, string][] = [
  ["assignments", "Active Assignments", "12", "yellow"],
  ["check", "Completed Assignments", "28", "orange"],
  ["knowledge", "Knowledge Items", "156", "yellow"],
  ["documents", "Documents", "342", "orange"],
  ["team", "Team Members", "24", "yellow"],
];

const assignments = [
  [
    "clock",
    "Policy Review on Performance Management",
    "HR Policy & Governance",
    "Due: 02 Aug 2026",
    "In Progress",
    "yellow",
  ],
  [
    "clock",
    "Research on Public Service Digital Transformation",
    "Digital Government",
    "Due: 10 Aug 2026",
    "In Progress",
    "orange",
  ],
  [
    "calendar",
    "Analysis of Establishment Register Data",
    "Establishment & Organisational Management",
    "Due: 15 Aug 2026",
    "Due Soon",
    "yellow",
  ],
  [
    "warning",
    "Study on Talent Management Practices",
    "Talent Management Division",
    "Due: 20 Jul 2026",
    "Overdue",
    "orange",
  ],
  [
    "check",
    "Benchmarking Report on Public Service Commissions",
    "Completed",
    "Completed: 18 Jul 2026",
    "Completed",
    "green",
  ],
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
  Administrator: navItems.map(([, label]) => label),
  "Research Manager": navItems
    .map(([, label]) => label)
    .filter((label) => label !== "Audit Logs" && label !== "Felix Administration"),
  "Research Officer": [
    "Dashboard",
    "Assignments",
    "Document Repository",
    "Documents",
    "Research Repository",
    "AI Researcher",
    "Reports & Analytics",
    "Team & Users",
    "Notifications",
    "Notice Board",
    "Calendar",
    "Settings",
  ],
  Reviewer: [
    "Dashboard",
    "Assignments",
    "Document Repository",
    "Documents",
    "Research Repository",
    "Reports & Analytics",
    "Notifications",
    "Notice Board",
    "Calendar",
    "Settings",
  ],
};

const navigationDisplayLabel = (label: string) =>
  label === "Research Repository" ? "Research Workspace" : label;
const navigationDescriptions: Record<string, string> = {
  Dashboard:
    "Open the department overview, workload summaries, announcements and recent activity.",
  Assignments: "Create, assign, track and complete departmental work.",
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
  "Notice Board":
    "Read approved public information or submit a notice for management approval.",
  Calendar: "Open live assignment deadlines and approved notice events.",
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
    "Check installed App2 component versions without downloading or installing software.",
};

const statDestinations: Record<string, string> = {
  "Active Assignments": "Assignments",
  "Completed Assignments": "Assignments",
  "Knowledge Items": "Document Repository",
  Documents: "Document Repository",
  "Team Members": "Team & Users",
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
  "Research Repository": {
    title: "Research Workspace",
    subtitle:
      "Plan, conduct, review and manage structured research work, evidence and outputs.",
    icon: "research",
  },
  Calendar: {
    title: "Calendar",
    subtitle:
      "Review assignment deadlines, approved events and scheduled activity.",
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
    subtitle: "Use permission-aware AI research and approved App2 evidence.",
    icon: "research",
  },
  Notifications: {
    title: "Notifications",
    subtitle: "Review workflow alerts and activity requiring your attention.",
    icon: "notifications",
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
    subtitle: "Inspect the read-only accountability record for App2 activity.",
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

const BUILT_IN_RESEARCH_REPORT_TEMPLATES = [
  {
    "template_key": "research-blank-report",
    "name": "Blank Research Report",
    "description": "Minimal unrestricted format for work that does not fit a predefined research structure.",
    "section_count": 1
  },
  {
    "template_key": "research-standard-report",
    "name": "Standard Research Report",
    "description": "General-purpose institutional research report suitable for most studies.",
    "section_count": 14
  },
  {
    "template_key": "research-quantitative-report",
    "name": "Quantitative Research Report",
    "description": "For studies based primarily on numerical data and statistical analysis.",
    "section_count": 18
  },
  {
    "template_key": "research-qualitative-report",
    "name": "Qualitative Research Report",
    "description": "For interviews, focus groups, observation and other qualitative inquiry.",
    "section_count": 18
  },
  {
    "template_key": "research-mixed-methods-report",
    "name": "Mixed Methods Research Report",
    "description": "For integrated quantitative and qualitative research.",
    "section_count": 18
  },
  {
    "template_key": "research-survey-report",
    "name": "Survey Research Report",
    "description": "For questionnaire-based staff, citizen, customer or institutional surveys.",
    "section_count": 18
  },
  {
    "template_key": "research-case-study-report",
    "name": "Case Study Research Report",
    "description": "For in-depth analysis of a programme, institution, event, process or bounded case.",
    "section_count": 18
  },
  {
    "template_key": "research-comparative-report",
    "name": "Comparative Research Report",
    "description": "For comparison of institutions, jurisdictions, programmes, groups or periods.",
    "section_count": 18
  },
  {
    "template_key": "research-cross-sectional-report",
    "name": "Cross-Sectional Study Report",
    "description": "For studies measuring variables at a defined point or period in time.",
    "section_count": 17
  },
  {
    "template_key": "research-longitudinal-report",
    "name": "Longitudinal / Cohort Study Report",
    "description": "For repeated observation of a population, cohort or indicators over time.",
    "section_count": 19
  },
  {
    "template_key": "research-evaluation-report",
    "name": "Programme / Policy Evaluation Report",
    "description": "For formal evaluation of programmes, policies, projects or services.",
    "section_count": 17
  },
  {
    "template_key": "research-baseline-report",
    "name": "Baseline Study Report",
    "description": "For pre-intervention benchmark measurement.",
    "section_count": 18
  },
  {
    "template_key": "research-midline-report",
    "name": "Midline Study Report",
    "description": "For interim measurement and course correction.",
    "section_count": 16
  },
  {
    "template_key": "research-endline-report",
    "name": "Endline Study Report",
    "description": "For final-period measurement and comparison with baseline or targets.",
    "section_count": 17
  },
  {
    "template_key": "research-impact-evaluation-report",
    "name": "Impact Evaluation Report",
    "description": "For causal or counterfactual assessment of intervention effects.",
    "section_count": 21
  },
  {
    "template_key": "research-needs-assessment-report",
    "name": "Needs Assessment Report",
    "description": "For identifying gaps between current conditions and desired services, capabilities or outcomes.",
    "section_count": 18
  },
  {
    "template_key": "research-situational-analysis-report",
    "name": "Situational Analysis Report",
    "description": "For current-state, trend, stakeholder, risk and opportunity analysis.",
    "section_count": 18
  },
  {
    "template_key": "research-feasibility-report",
    "name": "Feasibility Study Report",
    "description": "For assessing whether a proposed intervention, system, programme or policy is viable.",
    "section_count": 20
  },
  {
    "template_key": "research-policy-report",
    "name": "Policy Research Report",
    "description": "For evidence-to-policy analysis of a public problem, options and implementation implications.",
    "section_count": 20
  },
  {
    "template_key": "research-systematic-review-report",
    "name": "Systematic Review / Evidence Synthesis Report",
    "description": "For transparent evidence synthesis with documented search, selection and appraisal.",
    "section_count": 22
  },
  {
    "template_key": "research-scoping-review-report",
    "name": "Scoping Review Report",
    "description": "For broad evidence mapping, concepts and research-gap identification.",
    "section_count": 19
  },
  {
    "template_key": "research-rapid-evidence-report",
    "name": "Rapid Evidence Assessment Report",
    "description": "For time-bounded review using explicitly streamlined evidence methods.",
    "section_count": 17
  },
  {
    "template_key": "research-literature-review-report",
    "name": "Literature Review Report",
    "description": "For narrative or structured synthesis of published and grey literature.",
    "section_count": 16
  },
  {
    "template_key": "research-desk-review-report",
    "name": "Desk Review Report",
    "description": "For analysis of existing documents, administrative data, policies and secondary sources.",
    "section_count": 14
  },
  {
    "template_key": "research-action-research-report",
    "name": "Action Research Report",
    "description": "For iterative practitioner research organised around action, observation and reflection.",
    "section_count": 18
  },
  {
    "template_key": "research-organisational-diagnostic-report",
    "name": "Institutional / Organisational Diagnostic Report",
    "description": "For organisational structure, process, capability and performance diagnostics.",
    "section_count": 21
  },
  {
    "template_key": "research-benchmarking-report",
    "name": "Benchmarking Report",
    "description": "For comparison of performance or practices against peers, standards or benchmarks.",
    "section_count": 17
  },
  {
    "template_key": "research-technical-report",
    "name": "Technical Research Report",
    "description": "For detailed methods, specifications, analysis, validation and reproducibility.",
    "section_count": 18
  },
  {
    "template_key": "research-research-brief",
    "name": "Research Brief / Executive Summary",
    "description": "For concise decision-oriented communication of evidence, findings and implications.",
    "section_count": 9
  }
] as const;

export default function App() {
  const [now, setNow] = useState(new Date());
  const [active, setActive] = useState("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<{x:number;y:number}|null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [token, setToken] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
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
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(
    null,
  );
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | null
  >(null);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([
    {
      author: "Mary Wanjiku",
      text: "Please review the evidence matrix before Friday.",
      time: "10:24 AM",
    },
    {
      author: "Grace Muturi",
      text: "I have added review notes to section three.",
      time: "11:08 AM",
    },
  ]);
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
  const [dashboardActionQueue, setDashboardActionQueue] = useState<string | null>(null);
  const [dashboardRefreshState, setDashboardRefreshState] = useState<
    "idle" | "refreshing" | "failed"
  >("idle");
  const dashboardRequestRef = useRef<AbortController | null>(null);
  const [assignmentRows, setAssignmentRows] = useState<ApiAssignment[]>([]);
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignmentStatus, setAssignmentStatus] = useState("All");
  const [assignmentPriority, setAssignmentPriority] = useState("All");
  const [assignmentView, setAssignmentView] = useState<
    "List" | "Cards" | "Board" | "Calendar" | "Workload"
  >(() => {
    const saved = sessionStorage.getItem("app2-assignment-view");
    return ["List", "Cards", "Board", "Calendar", "Workload"].includes(
      saved || "",
    )
      ? (saved as "List" | "Cards" | "Board" | "Calendar" | "Workload")
      : "List";
  });
  const [assignmentDivision, setAssignmentDivision] = useState("All");
  const [assignmentMember, setAssignmentMember] = useState("All");
  const [assignmentDue, setAssignmentDue] = useState<
    "All" | "Due Soon" | "Overdue" | "No Due Date"
  >("All");
  const [assignmentHealth, setAssignmentHealth] = useState<
    "All" | "On Track" | "At Risk" | "Overdue"
  >("All");
  const [assignmentMine, setAssignmentMine] = useState(false);
  const [assignmentEditor, setAssignmentEditor] = useState<
    ApiAssignment | "new" | null
  >(null);
  const [assignmentSourceChoiceOpen, setAssignmentSourceChoiceOpen] = useState(false);
  const [assignmentCreationMode, setAssignmentCreationMode] = useState<"Internal" | "External">("Internal");
  const [assignmentForm, setAssignmentForm] = useState<AssignmentInput>({
    title: "",
    description: "",
    division: "",
    dueDate: null,
    priority: "Normal",
    memberIds: [],
  });
  const [assignmentFiles, setAssignmentFiles] = useState<ApiAttachment[]>([]);
  const [assignmentHistory, setAssignmentHistory] = useState<ApiHistory[]>([]);
  const [assignmentTasks, setAssignmentTasks] = useState<ApiAssignmentTask[]>(
    [],
  );
  const [assignmentReviews, setAssignmentReviews] = useState<
    ApiAssignmentReview[]
  >([]);
  const [assignmentSections, setAssignmentSections] = useState<
    ApiAssignmentSection[]
  >([]);
  const [assignmentWorkspaceTab, setAssignmentWorkspaceTab] = useState<
    | "Overview"
    | "Structure & Plan"
    | "Tasks"
    | "Contributions"
    | "Team"
    | "Documents"
    | "Reports"
    | "Discussion"
    | "Activity"
    | "Review"
  >("Overview");
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
  const [assignmentSectionEditor, setAssignmentSectionEditor] = useState<
    ApiAssignmentSection | "new" | null
  >(null);
  const [assignmentSectionSaving, setAssignmentSectionSaving] = useState(false);
  const [assignmentSectionForm, setAssignmentSectionForm] =
    useState<AssignmentSectionInput>({
      title: "",
      description: "",
      leadId: null,
      startDate: null,
      dueDate: null,
      status: "Not Started",
      progress: 0,
      isMandatory: true,
    });
  const [assignmentTaskDialogOpen, setAssignmentTaskDialogOpen] =
    useState(false);
  const [assignmentTaskSaving, setAssignmentTaskSaving] = useState(false);
  const [assignmentTaskDialogNotice, setAssignmentTaskDialogNotice] =
    useState("");
  const [assignmentTaskForm, setAssignmentTaskForm] = useState({
    title: "",
    description: "",
    ownerId: "",
    priority: "Normal",
    startDate: "",
    dueDate: "",
    notes: "",
    expectedContribution: "",
    assignmentPart: "",
    assignmentSectionId: "",
    taskPurpose: "",
    specificInstructions: "",
    expectedFindings: "",
    expectedOutput: "Standard Task Report",
    evidenceRequired: "",
    reviewerId: "",
    targetDocumentId: "",
    targetSectionId: "",
  });
  const [assignmentTaskTargetSections, setAssignmentTaskTargetSections] =
    useState<GeneratedDocumentSection[]>([]);

  const [assignmentTaskQuickOutputOpen, setAssignmentTaskQuickOutputOpen] =
    useState(false);
  const [assignmentTaskQuickOutputSaving, setAssignmentTaskQuickOutputSaving] =
    useState(false);
  const [assignmentTaskQuickOutputForm, setAssignmentTaskQuickOutputForm] =
    useState({ templateId: "", title: "", classification: "Official" });
  const [assignmentTaskRequests, setAssignmentTaskRequests] = useState<
    ApiAssignmentTaskRequest[]
  >([]);
  const [assignmentTaskRequestDialogOpen, setAssignmentTaskRequestDialogOpen] =
    useState(false);
  const [assignmentTaskRequestSaving, setAssignmentTaskRequestSaving] =
    useState(false);
  const [assignmentTaskRequestForm, setAssignmentTaskRequestForm] = useState({
    title: "",
    description: "",
    suggestedOwnerId: "",
    priority: "Normal",
    dueDate: "",
    reason: "",
  });
  const [assignmentTaskRequestReview, setAssignmentTaskRequestReview] =
    useState<ApiAssignmentTaskRequest | null>(null);
  const [
    assignmentTaskRequestReviewSaving,
    setAssignmentTaskRequestReviewSaving,
  ] = useState(false);
  const [assignmentTaskRequestReviewForm, setAssignmentTaskRequestReviewForm] =
    useState({
      title: "",
      description: "",
      ownerId: "",
      priority: "Normal",
      startDate: "",
      dueDate: "",
      notes: "",
      comments: "",
    });
  const [assignmentTaskFilter, setAssignmentTaskFilter] = useState<
    "All" | "My Tasks" | "Not Started" | "In Progress" | "Completed" | "Overdue"
  >("All");
  const [assignmentTaskSectionFilter, setAssignmentTaskSectionFilter] =
    useState("All");
  const [assignmentContributionFilter, setAssignmentContributionFilter] =
    useState<
      "All" | "Draft" | "Ready for Integration" | "Integrated" | "Accepted"
    >("All");
  const [assignmentCompileTaskIds, setAssignmentCompileTaskIds] = useState<
    string[]
  >([]);
  const [assignmentCompileKnowledgeIds, setAssignmentCompileKnowledgeIds] =
    useState<string[]>([]);
  const [assignmentCompiling, setAssignmentCompiling] = useState(false);
  const [selectedAssignmentTask, setSelectedAssignmentTask] =
    useState<ApiAssignmentTask | null>(null);
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
  const [assignmentTaskSectionSaving, setAssignmentTaskSectionSaving] =
    useState("");
  const [taskReportSectionModal, setTaskReportSectionModal] = useState<{
    key: string;
    mode: "edit" | "review";
  } | null>(null);
  const [
    assignmentTaskContributionSavedAt,
    setAssignmentTaskContributionSavedAt,
  ] = useState("");
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
  const [assignmentMemberId, setAssignmentMemberId] = useState("");
  const [assignmentMemberRole, setAssignmentMemberRole] =
    useState("Contributor");
  const [assignmentReviewComment, setAssignmentReviewComment] = useState("");
  const [assignmentReviewSaving, setAssignmentReviewSaving] = useState(false);
  const [assignmentNotice, setAssignmentNotice] = useState("");
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [knowledgeRows, setKnowledgeRows] = useState<KnowledgeItem[]>([]);
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const [knowledgeCategory, setKnowledgeCategory] = useState("All");
  const [knowledgeUploadOpen, setKnowledgeUploadOpen] = useState(false);
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
    category: "Policies & Guidelines",
    tags: "",
    sourceType: "App2 Upload",
    sourceUrl: "",
    originEntityId: "",
    directorate: "",
    documentType: "Document",
    subject: "",
    classification: "INTERNAL",
    felixEnabled: true,
  });
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
  const [researchRows, setResearchRows] = useState<ResearchProject[]>([]);
  const [researchPortfolioView, setResearchPortfolioView] = useState<
    "List" | "Cards"
  >(() =>
    sessionStorage.getItem("app2-research-view") === "Cards"
      ? "Cards"
      : "List",
  );
  const [researchSearch, setResearchSearch] = useState("");
  const [researchStatusFilter, setResearchStatusFilter] = useState("All");
  const [researchRepositoryMode, setResearchRepositoryMode] = useState<"Workspace" | "Imported">("Workspace");
  const [externalResearchRows, setExternalResearchRows] = useState<ExternalResearchImport[]>([]);
  const [externalResearchOpen, setExternalResearchOpen] = useState(false);
  const [selectedExternalResearch, setSelectedExternalResearch] = useState<ExternalResearchImport | null>(null);
  const [externalResearchSearch, setExternalResearchSearch] = useState("");
  const [externalResearchStatusFilter, setExternalResearchStatusFilter] = useState("All");
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
  const [researchReportSubmitting, setResearchReportSubmitting] = useState(false);
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
  const researchTemplateLibrary = [...BUILT_IN_RESEARCH_REPORT_TEMPLATES].sort(
    (a, b) => {
      if (a.template_key === "research-blank-report") return -1;
      if (b.template_key === "research-blank-report") return 1;
      return a.name.localeCompare(b.name);
    },
  );
  const researchDocumentTemplates = builderTemplates.filter(
    (template: DocumentTemplate) =>
      template.context === "Research" &&
      template.active &&
      ["Standard", "Approved"].includes(template.governance_status),
  );
  const assignmentTemplateParts = builderTemplates
    .filter(
      (template) =>
        template.context === "Assignment" &&
        template.active &&
        ["Standard", "Approved"].includes(template.governance_status),
    )
    .flatMap((template) =>
      (template.sections || []).map((section) => ({
        value: `${template.name} â†’ ${section.title}`,
        label: `${template.name} â†’ ${section.title}`,
        templateId: template.id,
        sectionKey: section.key,
      })),
    );

  const [workspaceDocuments, setWorkspaceDocuments] = useState<
    GeneratedDocumentSummary[]
  >([]);
  const [researchDocumentSearch, setResearchDocumentSearch] = useState("");
  const [researchDocumentStatus, setResearchDocumentStatus] = useState("All");
  const [researchDocumentCreateOpen, setResearchDocumentCreateOpen] =
    useState(false);
  const [builderCreating, setBuilderCreating] = useState(false);
  const [builderDocument, setBuilderDocument] =
    useState<GeneratedDocument | null>(null);
  const [assignmentReportPreviewMode, setAssignmentReportPreviewMode] =
    useState(false);
  const [builderSection, setBuilderSection] =
    useState<GeneratedDocumentSection | null>(null);
  const [builderContent, setBuilderContent] = useState("");
  const [builderDirty, setBuilderDirty] = useState(false);
  const [builderSaving, setBuilderSaving] = useState(false);
  const [builderSaveMessage, setBuilderSaveMessage] =
    useState("All changes saved");
  const [builderCreate, setBuilderCreate] = useState({
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
  const [researchSectionWorkspaceMode, setResearchSectionWorkspaceMode] =
    useState<"edit" | "review" | null>(null);
  const [researchReportGenerating, setResearchReportGenerating] =
    useState(false);
  const [researchDraftReviewerId, setResearchDraftReviewerId] = useState("");
  const [eligibleResearchReviewerRows, setEligibleResearchReviewerRows] =
    useState<ApiUser[]>([]);
  const [eligibleResearchReviewersLoading, setEligibleResearchReviewersLoading] =
    useState(false);
  const [researchSupportingDocumentIds, setResearchSupportingDocumentIds] =
    useState<string[]>([]);

  useEffect(() => {
    if (selectedResearch && researchTab === "Report" && selectedReportSection) {
      setResearchSectionWorkspaceMode("edit");
    }
  }, [selectedResearch?.id, researchTab, selectedReportSection?.id]);
  useEffect(() => {
    if (!selectedResearch || researchTab !== "Report") {
      if (!selectedResearch) setResearchReportVersions([]);
      return;
    }
    void api.researchReportVersions(token, selectedResearch.id)
      .then(setResearchReportVersions)
      .catch(() => setResearchReportVersions([]));
  }, [selectedResearch?.id, researchTab, token]);
  useEffect(() => {
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
  const [researchReviewerDraft, setResearchReviewerDraft] = useState<string[]>([]);
  const [researchReviewerSaving, setResearchReviewerSaving] = useState(false);
  const [researchAssignmentLinkId, setResearchAssignmentLinkId] = useState("");
  const [researchAssignmentCreating, setResearchAssignmentCreating] = useState(false);
  const [researchAssignmentDraft, setResearchAssignmentDraft] = useState<AssignmentInput>({
    title: "",
    description: "",
    division: "",
    dueDate: null,
    priority: "Normal",
    memberIds: [],
  });
  const [documentRows, setDocumentRows] = useState<DocumentItem[]>([]);
  const [documentSearch, setDocumentSearch] = useState("");
  const [documentStatus, setDocumentStatus] = useState("All");
  const [documentNotice, setDocumentNotice] = useState("");
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
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewRows, setReviewRows] = useState<ReviewItem[]>([]);
  const [reviewers, setReviewers] = useState<ApiUser[]>([]);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [noticeRows, setNoticeRows] = useState<NoticeItem[]>([]);
  const [calendarRows, setCalendarRows] = useState<CalendarItem[]>([]);
  const [noticeForm, setNoticeForm] = useState({
    title: "",
    body: "",
    severity: "Information",
    audienceRole: "",
    eventStart: "",
    eventEnd: "",
    expiresAt: "",
  });
  const [noticeNotice, setNoticeNotice] = useState("");
  const [reviewingNotice, setReviewingNotice] = useState<NoticeItem | null>(
    null,
  );
  const [noticeReason, setNoticeReason] = useState("");
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [reportFilters, setReportFilters] = useState({
    from: "",
    to: "",
    division: "",
    status: "",
  });
  const [reportNotice, setReportNotice] = useState("");
  const [userRows, setUserRows] = useState<ApiUser[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("All");
  const [userEditor, setUserEditor] = useState<ApiUser | "new" | null>(null);
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    role: "Research Officer",
    division: "",
    status: "Available",
    active: true,
    temporaryPassword: "",
  });
  const [userNotice, setUserNotice] = useState("");
  const [temporaryCredential, setTemporaryCredential] = useState("");
  const [createdAccount, setCreatedAccount] = useState<{
    name: string;
    email: string;
    password: string;
  } | null>(null);
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
    useState<PreferenceForm>(readThemePreferences);
  const [settingsNotice, setSettingsNotice] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const isManager =
    user?.role === "Administrator" || user?.role === "Research Manager";
  const assignedResearchReviewerIds = new Set(
    (selectedResearch?.reviewers || []).map((reviewer) => reviewer.reviewer_id),
  );
  const isResearchReportBuilder = Boolean(
    selectedResearch?.collaborators?.some(
      (member) =>
        member.id === user?.id &&
        (member.role || "Researcher") !== "Reviewer",
    ),
  );
  const canChooseResearchReviewer = Boolean(
    selectedResearch &&
      (isManager ||
        selectedResearch.lead_id === user?.id ||
        isResearchReportBuilder),
  );
  const eligibleResearchReviewers = eligibleResearchReviewerRows
    .filter(
      (candidate) =>
        candidate.active &&
        candidate.id !== selectedResearch?.lead_id,
    )
    .sort((a, b) => a.name.localeCompare(b.name));
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
  const canAdministerUsers = user?.role === "Administrator";
  const canReview = ["Administrator", "Research Manager", "Reviewer"].includes(
    user?.role || "",
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
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
      !roleNavigation[user.role].includes(active)
    )
      setActive("Dashboard");
  }, [active, user]);

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
    if ((active === "Research Repository" || active === "Dashboard") && token)
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
    if (active === "Dashboard" && token && canReview)
      api
        .documentReviews(token)
        .then((rows) => setReviewRows(rows.map(normalizeDocument)))
        .catch(() => setReviewRows([]));
  }, [active, token, canReview]);
  useEffect(() => {
    if (active !== "Dashboard" || !token) return;
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
    if (active === "AI Researcher" && token)
      Promise.all([api.aiResearchJobs(token), api.aiResearchEngine(token)])
        .then(([jobs, engine]) => {
          setAiResearchJobs(jobs);
          setAiResearchEngine(engine);
        })
        .catch((error) => setAiResearchNotice(error.message));
  }, [active, token]);
  useEffect(() => {
    if (!token) return;
    let activeRequest = true;
    const loadEngine = () =>
      api
        .aiResearchEngine(token)
        .then((engine) => {
          if (activeRequest) setAiResearchEngine(engine);
        })
        .catch(() => {});
    loadEngine();
    const timer = window.setInterval(loadEngine, 10000);
    return () => {
      activeRequest = false;
      window.clearInterval(timer);
    };
  }, [token]);
  useEffect(() => {
    if (active !== "Document Repository" || !token) return;
    let mounted = true;
    const loadDocuments = () =>
      api
        .documents(token)
        .then((documents) => {
          if (mounted) setDocumentRows(documents.map(normalizeDocument));
        })
        .catch((error) => {
          if (mounted)
            setDocumentNotice(
              error instanceof Error
                ? error.message
                : "Documents could not be loaded.",
            );
        });
    loadDocuments();
    if (canReview)
      api
        .documentReviews(token)
        .then((reviews) => {
          if (mounted) setReviewRows(reviews.map(normalizeDocument));
        })
        .catch(() => {});
    const timer = window.setInterval(loadDocuments, 10000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [active, token, canReview]);
  useEffect(() => {
    if (!token) return;
    const load = () =>
      api
        .notifications(token)
        .then(setNotifications)
        .catch(() => {});
    load();
    const timer = window.setInterval(load, 10000);
    return () => window.clearInterval(timer);
  }, [token]);
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
    if (!token || active !== "Calendar") return;
    const load = () =>
      api
        .calendar(token)
        .then(setCalendarRows)
        .catch(() => setCalendarRows([]));
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, [token, active, assignmentRows, noticeRows]);
  useEffect(() => {
    if (token && isManager && active === "Document Repository")
      api
        .users(token)
        .then((rows) =>
          setReviewers(
            rows.filter((member) =>
              ["Reviewer", "Research Manager", "Administrator"].includes(
                member.role,
              ),
            ),
          ),
        )
        .catch(() => {});
  }, [token, active]);
  useEffect(() => {
    if (token && isManager && active === "Reports & Analytics")
      api
        .analytics(token, reportFilters)
        .then(setReport)
        .catch((error) =>
          setReportNotice(
            error instanceof Error
              ? error.message
              : "Reports could not be loaded.",
          ),
        );
  }, [token, active, reportFilters]);
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
    if (token && user?.role === "Administrator" && active === "Audit Logs")
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
          setSettingsData(result);
          setSystemForm({
            organizationName: result.system.organization_name,
            departmentName: result.system.department_name,
            supportEmail: result.system.support_email,
            sessionMinutes: result.system.session_minutes,
            maxUploadMb: result.system.max_upload_mb,
            defaultRetentionDays: result.system.default_retention_days,
            documentCategories: result.system.document_categories.join(", "),
            maintenanceMode: result.system.maintenance_mode,
            emailNotifications: result.system.email_notifications,
          });
          setPreferenceForm({
            emailNotifications: result.preferences.email_notifications,
            inAppNotifications: result.preferences.in_app_notifications,
            compactLayout: result.preferences.compact_layout,
            themeMode: result.preferences.theme_mode || "Gold Grey",
            accentColor: result.preferences.accent_color || "Gold",
          });
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
    if (token && active === "Settings" && user?.role === "Administrator")
      api
        .emailDeliveryStatus(token)
        .then(setEmailDelivery)
        .catch(() => setEmailDelivery(null));
  }, [token, active, user?.role]);
  useEffect(() => {
    localStorage.setItem(THEME_KEY, JSON.stringify(preferenceForm));
  }, [preferenceForm]);
  useEffect(() => {
    localStorage.setItem(
      "psc-app2-sidebar-collapsed",
      String(sidebarCollapsed),
    );
  }, [sidebarCollapsed]);
  useEffect(() => {
    const describe = () => {
      document
        .querySelectorAll<HTMLElement>('button,[role="tab"],select')
        .forEach((element) => {
          if (element.title) return;
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
        });
    };
    describe();
    const observer = new MutationObserver(describe);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const rightsFor = (role: Role) =>
    role === "Administrator"
      ? ["Manage users", "Manage roles", "Audit activity", "Full system access"]
      : role === "Research Manager"
        ? [
            "Create assignments",
            "Assign members",
            "Approve work",
            "Manage research",
          ]
        : role === "Reviewer"
          ? [
              "Review submissions",
              "Comment",
              "Request changes",
              "Approve knowledge",
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
  const assignmentRef = (id: string) =>
    `ASG-${id
      .replace(/[^a-f0-9]/gi, "")
      .slice(0, 6)
      .toUpperCase()}`;
  const mapUser = (member: ApiUser): User => ({
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role as Role,
    initials: initialsFor(member.name),
    rights: rightsFor(member.role as Role),
    mustChangePassword: member.must_change_password,
  });
  const mapTeamMember = (member: ApiUser): TeamMember => ({
    ...mapUser(member),
    id: member.id,
    division: member.division,
    active: member.active_assignments || 0,
    completed: member.completed_assignments || 0,
    status: member.status as TeamMember["status"],
  });
  const navigateTo = (destination: string) => {
    setDashboardActionQueue(null);
    setActive(
      destination === "Documents" || destination === "Knowledge Repository"
        ? "Document Repository"
        : destination,
    );
    setMenuOpen(false);
  };
  const openKnowledgeUpload = () => {
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
    if (
      profile.role === "Administrator" ||
      profile.role === "Research Manager"
    ) {
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
    if (!email)
      return setPasswordMessage("Enter your official PSC email address first.");
    setSavingPassword(true);
    setPasswordMessage("");
    try {
      const result = await api.forgotPassword(email);
      if (result.resetToken) setResetToken(result.resetToken);
      setPasswordMessage(
        result.resetToken
          ? "Reset request created. Enter a new password below."
          : result.message,
      );
    } catch (error) {
      setPasswordMessage(
        error instanceof Error
          ? error.message
          : "Reset request could not be created.",
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword)
      return setPasswordMessage("New passwords do not match.");
    if (!resetToken) return requestReset();
    setSavingPassword(true);
    setPasswordMessage("");
    try {
      const result = await api.resetPassword(resetToken, newPassword);
      setPasswordMessage(result.message);
      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordMessage(
        error instanceof Error ? error.message : "Password could not be reset.",
      );
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
    setComments([
      ...comments,
      {
        author: user.name,
        text: comment.trim(),
        time: now.toLocaleTimeString("en-KE", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
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
  const refreshDashboard = async () => {
    if (!token || dashboardRequestRef.current) return;
    const controller = new AbortController();
    dashboardRequestRef.current = controller;
    setDashboardRefreshState("refreshing");
    try {
      setDashboardData(await api.dashboard(token, controller.signal));
      setDashboardRefreshState("idle");
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
      if (item.entity_type === "research_report_section" && item.entity_id) {
        const projects = researchRows.length
          ? researchRows
          : await api.research(token);
        if (!researchRows.length) setResearchRows(projects);
        const project = projects.find((row) => row.id === item.entity_id);
        if (project) {
          setActive("Research Repository");
          setSelectedResearch(project);
          setResearchTab("Report");
          setResearchPlanDraft({
            summary: project.summary || "",
            researchQuestion: project.research_question || "",
            objectives: project.objectives || "",
            methodology: project.methodology || "",
            startDate: project.start_date || "",
            endDate: project.end_date || "",
          });
          const [
            comments,
            report,
            sources,
            activityRows,
            templates,
            documents,
          ] = await Promise.all([
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
          const section =
            report.find((row) => item.body.includes(`â€œ${row.title}â€`)) ||
            report.find((row) => row.status === "Ready for Review") ||
            report[0];
          setSelectedReportSection(section || null);
          setReportContent(section?.content || "");
        }
        return;
      }
      if (item.entity_type === "generated_document" && item.entity_id) {
        setActive("Assignments");
        await openGeneratedDocument(item.entity_id);
        return;
      }
      if (item.entity_type === "assignment_task_request" && item.entity_id) {
        const assignments = assignmentRows.length ? assignmentRows : await api.assignments(token);
        if (!assignmentRows.length) setAssignmentRows(assignments);
        for (const assignment of assignments) {
          try {
            const requests = await api.assignmentTaskRequests(token, assignment.id);
            const request = requests.find((row) => row.id === item.entity_id);
            if (!request) continue;
            setActive("Assignments");
            await openAssignmentDetails(assignment);
            setAssignmentTaskRequests(requests);
            setAssignmentWorkspaceTab("Tasks");
            if (request.status === "Pending" && isManager) openAssignmentTaskRequestReview(request);
            await openNotification(item);
            return;
          } catch {
            // Continue until an accessible assignment contains this request.
          }
        }
        setActive("Assignments");
        return;
      }
      if (item.entity_type === "document_deletion_request") {
        setActive("Document Repository");
        await openNotification(item);
        return;
      }
      if (item.entity_type === "assignment_task" && item.entity_id) {
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

        const assignments = assignmentRows.length
          ? assignmentRows
          : await api.assignments(token);
        if (!assignmentRows.length) setAssignmentRows(assignments);
        for (const assignment of assignments) {
          try {
            const tasks = await api.assignmentTasks(token, assignment.id);
            const task = tasks.find((row) => row.id === item.entity_id);
            if (!task) continue;
            setActive("Assignments");
            await openAssignmentDetails(assignment);
            setAssignmentTasks(tasks);
            setAssignmentWorkspaceTab("Tasks");
            await openAssignmentTaskWorkspace(task, true);
            await openNotification(item);
            return;
          } catch {
            // Continue until an accessible assignment contains the task.
          }
        }
        setActive("Notifications");
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
                setAssignmentWorkspaceTab("Tasks");
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
              ? "Review"
              : /task|work/.test(text)
                ? "Tasks"
                : /document|report|output/.test(text)
                  ? "Documents"
                  : /team|member|assigned|responsib/.test(text)
                    ? "Team"
                    : "Overview",
          );
          if (/assigned|responsib/.test(text) && !looksLikeReview)
            await openNotification(item);
        }
        return;
      }
      if (item.entity_type === "external_research_import" && item.entity_id) {
        setActive("Research Repository");
        setResearchRepositoryMode("Imported");
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
          if (reviewTarget && /review|approve|correction|reject/.test(text)) setReviewDocument(reviewTarget);
          else if (documentTarget) setReaderDocument(documentTarget);
        }
        await openNotification(item);
        return;
      }
      if (item.entity_type === "notice") {
        setActive("Notice Board");
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
  const clearReadNotifications = async () => {
    setNotificationsLoading(true);
    try {
      await api.clearReadNotifications(token);
      setNotifications(await api.notifications(token));
    } finally {
      setNotificationsLoading(false);
    }
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
        setComments(
          rows.map((item) => ({
            author: item.author_name,
            text: item.body,
            time: new Date(item.created_at).toLocaleTimeString("en-KE", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          })),
        );
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

  const beginAssignmentCreation = (mode: "Internal" | "External") => {
    setAssignmentSourceChoiceOpen(false);
    setAssignmentCreationMode(mode);
    setAssignmentNotice("");
    setAssignmentEditor("new");
    setAssignmentForm({
      title: "",
      description: "",
      division: "",
      dueDate: null,
      priority: "Normal",
      memberIds: [],
    });
  };

  const startAssignment = (assignment?: ApiAssignment) => {
    if (!isManager) {
      setAssignmentNotice(
        "Only Administrators and Research Managers can create or edit assignments.",
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
      division: assignment.division,
      dueDate: assignment.due_date,
      priority: assignment.priority,
      memberIds: assignment.members.map((member) => member.id),
    });
  };

  const saveAssignment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setSavingAssignment(true);
    setAssignmentNotice("");
    try {
      if (assignmentEditor === "new") {
        const created = await api.createAssignment(
          token,
          assignmentCreationMode === "External"
            ? { ...assignmentForm, memberIds: [] }
            : assignmentForm,
        );
        await refreshAssignments();
        setAssignmentEditor(null);

        if (assignmentCreationMode === "External") {
          await openAssignmentDetails(created);
          setAssignmentWorkspaceTab("Reports");

          const templates = await api.documentTemplates(token, "Assignment");
          setBuilderTemplates(templates);
          const finalTemplate = templates.find(
            (item) =>
              item.template_key === "assignment-final-report" &&
              item.active &&
              ["Approved", "Standard"].includes(item.governance_status),
          );

          if (!finalTemplate) {
            setAssignmentNotice(
              "External assignment registered without assignees or tasks. Open Reports after the approved Final Assignment Report template is available, then import the completed external report.",
            );
          } else {
            const report = await api.createGeneratedDocument(token, {
              templateId: finalTemplate.id,
              context: "Assignment",
              contextId: created.id,
              title: `${created.title} â€” Final Assignment Report`,
              classification: "Official",
            });
            setWorkspaceDocuments(
              await api.generatedDocuments(token, "Assignment", created.id),
            );
            setAssignmentNotice(
              "External assignment registered. No staff or tasks were assigned. Import the completed report, then App2 will close authoring and require a reviewer before finalisation.",
            );
            await openGeneratedDocument(report.id, false);
          }
        } else {
          setAssignmentNotice("Assignment saved successfully.");
        }
      } else if (assignmentEditor) {
        await api.updateAssignment(token, assignmentEditor.id, assignmentForm);
        for (const memberId of assignmentForm.memberIds)
          await api.addMember(token, assignmentEditor.id, memberId);
        await refreshAssignments();
        setAssignmentEditor(null);
        setAssignmentNotice("Assignment saved successfully.");
      }
    } catch (error) {
      setAssignmentNotice(
        error instanceof Error
          ? error.message
          : "Assignment could not be saved.",
      );
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
    setAssignmentNotice("");
    try {
      const [assignments, tasks, reviews] = await Promise.all([
        api.assignments(token),
        api.assignmentTasks(token, assignment.id),
        api.assignmentReviews(token, assignment.id),
      ]);
      setAssignmentRows(assignments);
      setAssignmentTasks(tasks);
      setAssignmentReviews(reviews);
      setAssignmentTaskRequests([]);
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
  const latestAssignmentReview = assignmentReviews[0]?.decision || null;
  const assignmentFinalReports = workspaceDocuments
    .filter(
      (item) =>
        item.template_key === "assignment-final-report" ||
        /Final Assignment Report/i.test(item.title || ""),
    )
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  const latestFinalAssignmentReport = assignmentFinalReports[0] || null;
  const acceptedTaskReportCount = assignmentTasks.filter(
    (task) => task.contribution_status === "Accepted",
  ).length;
  const completedTaskCount = assignmentTasks.filter(
    (task) => task.status === "Completed",
  ).length;
  const allTaskReportsAccepted =
    assignmentTasks.length > 0 &&
    acceptedTaskReportCount === assignmentTasks.length;
  const finalAssignmentReportIsFinal = Boolean(
    latestFinalAssignmentReport &&
      (latestFinalAssignmentReport.status === "Final" ||
        latestFinalAssignmentReport.repository_document_id),
  );
  const finalReportStagePercent = latestFinalAssignmentReport
    ? latestFinalAssignmentReport.status === "Final" ||
      latestFinalAssignmentReport.repository_document_id
      ? 100
      : latestFinalAssignmentReport.status === "Approved"
        ? 96
        : ["Submitted", "Under Review"].includes(
              latestFinalAssignmentReport.status,
            )
          ? 92
          : latestFinalAssignmentReport.status === "Changes Requested"
            ? 88
            : 84
    : 0;
  const taskExecutionPercent = assignmentTasks.length
    ? Math.round((completedTaskCount / assignmentTasks.length) * 35)
    : 0;
  const taskReportPercent = assignmentTasks.length
    ? Math.round((acceptedTaskReportCount / assignmentTasks.length) * 30)
    : 0;
  const assignmentCompletion = finalAssignmentReportIsFinal
    ? 100
    : latestFinalAssignmentReport
      ? Math.max(70, finalReportStagePercent)
      : Math.min(
          80,
          (assignmentTasks.length ? 15 : 5) +
            taskExecutionPercent +
            taskReportPercent,
        );
  const assignmentDays = selectedAssignmentRecord?.due_date
    ? Math.ceil(
        (new Date(selectedAssignmentRecord.due_date).getTime() - Date.now()) /
          86400000,
      )
    : null;
  const assignmentLead =
    selectedAssignmentRecord?.members.find(
      (member) => member.role === "Lead",
    ) || selectedAssignmentRecord?.members[0];
  const hasExplicitAssignmentLead = Boolean(
    selectedAssignmentRecord?.members.some((member) => member.role === "Lead"),
  );
  const isAssignmentLead = Boolean(
    user?.id &&
      selectedAssignmentRecord &&
      (selectedAssignmentRecord.members.some(
        (member) => member.id === user.id && member.role === "Lead",
      ) ||
        (!hasExplicitAssignmentLead &&
          selectedAssignmentRecord.created_by === user.id)),
  );
  const isSelectedTaskOwner = Boolean(
    user?.id && selectedAssignmentTask?.owner_id === user.id,
  );
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
          ["Administrator", "Research Manager"].includes(member.role),
      )
      .map((member) => ({ id: member.id, name: member.name, role: member.role })),
  ].filter(
    (person, index, people) =>
      people.findIndex((candidate) => candidate.id === person.id) === index,
  );

  const pendingAssignmentTaskRequests = assignmentTaskRequests.filter(
    (request) => request.status === "Pending",
  );
  const assignmentNextTask =
    [...assignmentTasks]
      .filter((task) => task.status !== "Completed")
      .sort((a, b) =>
        (a.due_date || "9999").localeCompare(b.due_date || "9999"),
      )[0] || null;
  const assignmentOpenTasks = assignmentTasks.filter(
    (task) => task.status !== "Completed",
  );
  const assignmentPendingContributions = assignmentTasks.filter(
    (task) => task.contribution_status !== "Accepted",
  );
  const assignmentGeneratedReports = assignmentTasks.filter(
    (task) =>
      Number(task.contribution_report_version || 0) > 0 ||
      Boolean(task.contribution_title) ||
      task.contribution_status !== "Draft",
  );
  const assignmentReportStatusLabel = (
    status: ApiAssignmentTask["contribution_status"],
  ) =>
    status === "Draft"
      ? "Draft"
      : status === "Ready for Integration"
        ? "Submitted for Review"
        : status === "Integrated"
          ? "Approved Â· Final Report Pending"
          : status === "Accepted"
            ? "Final"
            : status;
  const assignmentReviewReady =
    assignmentTasks.length > 0 &&
    !assignmentOpenTasks.length &&
    !assignmentPendingContributions.length;
  const assignmentNextAction = !assignmentTasks.length
    ? {
        title: "Create the assignment work plan",
        label: "Open Tasks",
        tab: "Tasks" as const,
        detail: "Create the first task, assign an owner and set a due date.",
      }
    : assignmentNextTask
      ? {
          title: "Continue active task work",
          label: "Open Tasks",
          tab: "Tasks" as const,
          detail: `${assignmentNextTask.title} · ${assignmentNextTask.owner_name || "Unassigned"}${assignmentNextTask.due_date ? ` · due ${new Date(assignmentNextTask.due_date).toLocaleDateString("en-KE")}` : ""}`,
        }
      : assignmentPendingContributions.length
        ? {
            title: "Finish task-report review",
            label: "Open Tasks",
            tab: "Tasks" as const,
            detail: `${assignmentPendingContributions.length} task report${assignmentPendingContributions.length === 1 ? "" : "s"} still need submission, review or final acceptance.`,
          }
        : !latestFinalAssignmentReport
          ? {
              title: "Create the Final Assignment Report",
              label: "Open Reports",
              tab: "Reports" as const,
              detail:
                "All required task reports are accepted. Compile the Final Assignment Report from the approved task-report sources.",
            }
          : latestFinalAssignmentReport.status === "Changes Requested"
            ? {
                title: "Revise the Final Assignment Report",
                label: "Open Reports",
                tab: "Reports" as const,
                detail:
                  "The reviewer requested changes. Update the report and resubmit it.",
              }
            : ["Submitted", "Under Review"].includes(
                  latestFinalAssignmentReport.status,
                )
              ? {
                  title: "Final Assignment Report is under review",
                  label: "View Review",
                  tab: "Review" as const,
                  detail:
                    "The final report has been submitted. Review progress and any decision from the formal reviewer.",
                }
              : latestFinalAssignmentReport.status === "Approved" &&
                  !latestFinalAssignmentReport.repository_document_id
                ? {
                    title: "Publish the approved Final Assignment Report",
                    label: "Open Reports",
                    tab: "Reports" as const,
                    detail:
                      "The report is approved. Complete finalization and publish the controlled final copy.",
                  }
                : finalAssignmentReportIsFinal
                  ? {
                      title: "Assignment reporting is complete",
                      label: "View Final Report",
                      tab: "Reports" as const,
                      detail:
                        "The Final Assignment Report has been finalized and is available for reading.",
                    }
                  : {
                      title: "Continue the Final Assignment Report",
                      label: "Open Reports",
                      tab: "Reports" as const,
                      detail:
                        "A Final Assignment Report draft exists and still needs to be completed and submitted.",
                    };

  const assignmentOperationalStatus = !assignmentTasks.length
    ? "Planning"
    : assignmentNextTask
      ? "In Progress"
      : assignmentPendingContributions.length
        ? "Task Reporting"
        : !latestFinalAssignmentReport
          ? "Ready for Final Report"
          : latestFinalAssignmentReport.status === "Changes Requested"
            ? "Changes Requested"
            : ["Submitted", "Under Review"].includes(
                  latestFinalAssignmentReport.status,
                )
              ? "Final Report Review"
              : latestFinalAssignmentReport.status === "Approved" &&
                  !latestFinalAssignmentReport.repository_document_id
                ? "Approved · Finalization Pending"
                : finalAssignmentReportIsFinal
                  ? "Completed"
                  : "Final Report Draft";
  const assignmentWorkflowSteps = [
    { label: "Assign", help: "Create a task with an owner and due date." },
    { label: "Do Work", help: "Complete the assigned task." },
    { label: "Task Report", help: "Record results and evidence." },
    { label: "Review", help: "Review and accept the task report." },
    { label: "Complete", help: "Close the assignment after approval." },
  ];
  const assignmentWorkflowIndex =
    selectedAssignmentRecord?.status === "Completed" ||
    latestAssignmentReview === "Approved"
      ? 4
      : latestAssignmentReview === "Submitted" ||
          latestAssignmentReview === "Under Review" ||
          latestAssignmentReview === "Changes Requested" ||
          assignmentReviewReady
        ? 3
        : assignmentTasks.length && !assignmentOpenTasks.length
          ? 2
          : assignmentTasks.length
            ? 1
            : 0;
  const taskProgressPercent = assignmentTasks.length
    ? Math.round(
        assignmentTasks.reduce(
          (total, task) => total + Number(task.progress || 0),
          0,
        ) / assignmentTasks.length,
      )
    : 0;
  const assignmentProgressPercent =
    selectedAssignmentRecord?.status === "Completed"
      ? 100
      : assignmentTasks.length
        ? taskProgressPercent
        : 0;
  const assignmentDocumentCount =
    assignmentFiles.length +
    workspaceDocuments.length +
    knowledgeRows.filter((item) =>
      item.assignments?.some(
        (assignment) => assignment.id === selectedAssignmentId,
      ),
    ).length;
  const assignmentNeedsAttention =
    (assignmentDays !== null && assignmentDays < 0) ||
    !assignmentTasks.length ||
    !assignmentDocumentCount ||
    assignmentPendingContributions.length > 0;
  const filteredAssignmentTasks = assignmentTasks.filter(
    (task) =>
      (assignmentTaskFilter === "All" ||
        (assignmentTaskFilter === "My Tasks" &&
          task.owner_name === user?.name) ||
        (assignmentTaskFilter === "Overdue" &&
          Boolean(task.due_date) &&
          new Date(String(task.due_date)).getTime() < Date.now() &&
          task.status !== "Completed") ||
        task.status === assignmentTaskFilter) &&
      (assignmentTaskSectionFilter === "All" ||
        (assignmentTaskSectionFilter === "Unassigned" &&
          !task.assignment_section_id) ||
        task.assignment_section_id === assignmentTaskSectionFilter),
  );
  const taskDateValue = (value: string | null | undefined) => {
    if (!value) return "";
    const raw = String(value).trim();
    const isoDate = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoDate) return isoDate[1];
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return "";
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
  };
  const taskDateText = (value: string | null | undefined) => {
    const normalized = taskDateValue(value);
    if (!normalized) return "Not set";
    const parsed = new Date(`${normalized}T12:00:00`);
    return Number.isNaN(parsed.getTime())
      ? "Not set"
      : parsed.toLocaleDateString("en-KE", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
  };
  const taskDueMeta = (task: ApiAssignmentTask) => {
    const normalizedDue = taskDateValue(task.due_date);
    if (!normalizedDue) return { state: "none", label: "No deadline" };
    if (task.status === "Completed")
      return { state: "completed", label: "Completed" };
    const due = new Date(`${normalizedDue}T23:59:59`).getTime();
    const days = Math.ceil((due - Date.now()) / 86400000);
    if (days < 0)
      return {
        state: "overdue",
        label: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`,
      };
    if (days === 0) return { state: "today", label: "Due today" };
    if (days <= 3)
      return {
        state: "soon",
        label: `${days} day${days === 1 ? "" : "s"} left`,
      };
    return { state: "normal", label: `${days} days left` };
  };
  const taskOpenLabel = (task: ApiAssignmentTask) =>
    task.status === "Not Started"
      ? "Start Task"
      : task.status === "In Progress"
        ? "Continue Work"
        : task.status === "Blocked"
          ? "Open Blocked Task"
          : task.status === "Completed"
            ? "View Completed"
            : "Open Workspace";
  const taskHasReportDraft = (task: ApiAssignmentTask) =>
    Boolean(
      Number(task.contribution_report_version || 0) > 0 ||
        taskReportPlainText(task.contribution_title) ||
        taskReportPlainText(task.contribution_summary) ||
        taskReportPlainText(task.evidence_reviewed) ||
        taskReportPlainText(task.contribution_findings) ||
        taskReportPlainText(task.contribution_recommendations) ||
        taskReportPlainText(task.contribution_challenges) ||
        taskReportPlainText(task.contribution_next_actions),
    );
  const taskReportOwnerActionLabel = (task: ApiAssignmentTask) =>
    task.contribution_status === "Draft"
      ? taskHasReportDraft(task)
        ? "Continue Report"
        : "Start Report"
      : task.contribution_status === "Ready for Integration"
        ? "View Submitted Report"
        : task.contribution_status === "Integrated"
          ? "View Approved Report"
          : "View Final Report";
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
      | "Structure & Plan"
      | "Tasks"
      | "Contributions"
      | "Team"
      | "Documents"
      | "Reports"
      | "Discussion"
      | "Activity"
      | "Review",
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
          case "Structure & Plan": {
            const rows = await api.assignmentSections(
              token,
              selectedAssignmentId,
            );
            if (!cancelled) setAssignmentSections(rows);
            break;
          }
          case "Tasks": {
            const [rows, templates] = await Promise.all([
              api.assignmentTasks(token, selectedAssignmentId),
              api.documentTemplates(token, "Assignment"),
            ]);
            if (!cancelled) {
              setAssignmentTasks(rows);
              setBuilderTemplates(templates);
            }
            break;
          }

          case "Activity": {
            const rows = await api.history(token, selectedAssignmentId);
            if (!cancelled) setAssignmentHistory(rows);
            break;
          }

          case "Review": {
            const rows = await api.assignmentReviews(
              token,
              selectedAssignmentId,
            );
            if (!cancelled) setAssignmentReviews(rows);
            break;
          }

          case "Discussion": {
            const rows = await api.comments(token, selectedAssignmentId);
            if (!cancelled) {
              setComments(
                rows.map((item) => ({
                  author: item.author_name,
                  text: item.body,
                  time: new Date(item.created_at).toLocaleTimeString("en-KE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                })),
              );
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

          case "Contributions": {
            const rows = await api.assignmentTasks(token, selectedAssignmentId);
            if (!cancelled) setAssignmentTasks(rows);
            break;
          }
          case "Team":
            await refreshAssignments();
            break;
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

  const openAssignmentSectionEditor = (
    section: ApiAssignmentSection | "new",
  ) => {
    setAssignmentSectionEditor(section);
    setAssignmentSectionForm(
      section === "new"
        ? {
            title: "",
            description: "",
            leadId:
              selectedAssignmentRecord?.members.find(
                (member) => member.role === "Lead",
              )?.id || null,
            startDate: null,
            dueDate: selectedAssignmentRecord?.due_date || null,
            status: "Not Started",
            progress: 0,
            isMandatory: true,
          }
        : {
            title: section.title,
            description: section.description,
            leadId: section.lead_id,
            startDate: section.start_date,
            dueDate: section.due_date,
            status: section.status,
            progress: Number(section.progress),
            isMandatory: section.is_mandatory,
          },
    );
  };
  const refreshAssignmentSections = async () => {
    if (selectedAssignmentId)
      setAssignmentSections(
        await api.assignmentSections(token, selectedAssignmentId),
      );
  };
  const saveAssignmentSection = async () => {
    if (
      !selectedAssignmentId ||
      !assignmentSectionForm.title.trim() ||
      assignmentSectionSaving
    )
      return;
    if (
      assignmentSectionForm.startDate &&
      assignmentSectionForm.dueDate &&
      assignmentSectionForm.dueDate < assignmentSectionForm.startDate
    ) {
      setAssignmentNotice("Section due date cannot be before its start date.");
      return;
    }
    try {
      setAssignmentSectionSaving(true);
      if (assignmentSectionEditor === "new")
        await api.createAssignmentSection(token, selectedAssignmentId, {
          ...assignmentSectionForm,
          title: assignmentSectionForm.title.trim(),
          description: assignmentSectionForm.description.trim(),
        });
      else if (assignmentSectionEditor)
        await api.updateAssignmentSection(
          token,
          selectedAssignmentId,
          assignmentSectionEditor.id,
          {
            ...assignmentSectionForm,
            title: assignmentSectionForm.title.trim(),
            description: assignmentSectionForm.description.trim(),
          },
        );
      await refreshAssignmentSections();
      setAssignmentHistory(await api.history(token, selectedAssignmentId));
      setAssignmentSectionEditor(null);
      setAssignmentNotice("Assignment structure saved and recorded.");
    } catch (error) {
      setAssignmentNotice(
        error instanceof Error
          ? error.message
          : "Assignment section could not be saved.",
      );
    } finally {
      setAssignmentSectionSaving(false);
    }
  };
  const moveAssignmentSection = async (index: number, direction: -1 | 1) => {
    if (!selectedAssignmentId) return;
    const target = index + direction;
    if (target < 0 || target >= assignmentSections.length) return;
    const ordered = [...assignmentSections];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    try {
      setAssignmentSections(
        ordered.map((section, position) => ({
          ...section,
          section_order: position + 1,
        })),
      );
      setAssignmentSections(
        await api.reorderAssignmentSections(
          token,
          selectedAssignmentId,
          ordered.map((section, position) => ({
            id: section.id,
            sectionOrder: position + 1,
          })),
        ),
      );
      setAssignmentHistory(await api.history(token, selectedAssignmentId));
      setAssignmentNotice("Section order updated.");
    } catch (error) {
      await refreshAssignmentSections();
      setAssignmentNotice(
        error instanceof Error
          ? error.message
          : "Sections could not be reordered.",
      );
    }
  };
  const syncAssignmentSectionFromTasks = async (
    section: ApiAssignmentSection,
  ) => {
    if (!selectedAssignmentId) return;
    const tasks = assignmentTasks.filter(
      (task) => task.assignment_section_id === section.id,
    );
    if (!tasks.length) {
      setAssignmentNotice(
        "Add at least one task to this workstream before synchronizing progress.",
      );
      return;
    }
    const progress = Math.round(
      tasks.reduce((sum, task) => sum + Number(task.progress || 0), 0) /
        tasks.length,
    );
    const status: ApiAssignmentSection["status"] = tasks.some(
      (task) => task.status === "Blocked",
    )
      ? "Blocked"
      : tasks.every((task) => task.status === "Completed")
        ? "Completed"
        : tasks.some(
              (task) =>
                task.status === "In Progress" || Number(task.progress) > 0,
            )
          ? "In Progress"
          : "Not Started";
    try {
      await api.updateAssignmentSection(
        token,
        selectedAssignmentId,
        section.id,
        { progress, status },
      );
      await refreshAssignmentSections();
      setAssignmentHistory(await api.history(token, selectedAssignmentId));
      setAssignmentNotice(
        `${section.title} synchronized to ${progress}% from ${tasks.length} linked task${tasks.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      setAssignmentNotice(
        error instanceof Error
          ? error.message
          : "Section progress could not be synchronized.",
      );
    }
  };

  const openAssignmentTaskDialog = async () => {
    setAssignmentNotice("");
    setAssignmentTaskDialogNotice("");
    setAssignmentTaskForm({
      title: "",
      description: "",
      ownerId:
        selectedAssignmentRecord?.members?.find(
          (member) => member.role === "Lead",
        )?.id || "",
      priority: "Normal",
      startDate: new Date().toISOString().slice(0, 10),
      dueDate: "",
      notes: "",
      expectedContribution: "",
      assignmentPart: "",
      assignmentSectionId: "",
      taskPurpose: "",
      specificInstructions: "",
      expectedFindings: "",
      expectedOutput: "Standard Task Report",
      evidenceRequired: "",
      reviewerId: "",
      targetDocumentId: "",
      targetSectionId: "",
    });
    setAssignmentTaskTargetSections([]);
    setAssignmentTaskQuickOutputOpen(false);
    setAssignmentTaskQuickOutputForm({
      templateId: builderTemplates[0]?.id || "",
      title: "",
      classification: "Official",
    });
    setAssignmentTaskDialogOpen(true);
    if (selectedAssignmentId) {
      try {
        const [assignments, sections, tasks, templates, documents, users] =
          await Promise.all([
            api.assignments(token),
            api.assignmentSections(token, selectedAssignmentId),
            api.assignmentTasks(token, selectedAssignmentId),
            api.documentTemplates(token, "Assignment"),
            api.generatedDocuments(token, "Assignment", selectedAssignmentId),
            api.users(token),
          ]);
        setAssignmentRows(assignments);
        setAssignmentSections(sections);
        setAssignmentTasks(tasks);
        setBuilderTemplates(templates);
        setWorkspaceDocuments(documents);
        setUserRows(users);
        const assignment = assignments.find(
          (item) => item.id === selectedAssignmentId,
        );
        const lead = assignment?.members.find((member) => member.role === "Lead");
        setAssignmentTaskForm((current) => {
          const ownerId = current.ownerId || lead?.id || assignment?.members[0]?.id || "";
          const assignmentMemberIds = new Set(
            (assignment?.members || []).map((member) => member.id),
          );
          const preferredReviewer =
            (assignment?.members || [])
              .filter((member) => member.id !== ownerId)
              .map((member) => users.find((user) => user.id === member.id))
              .find(
                (candidate) =>
                  candidate?.active &&
                  ["Research Officer", "Reviewer", "Research Manager"].includes(
                    candidate.role,
                  ),
              ) ||
            users.find(
              (candidate) =>
                candidate.active &&
                candidate.role === "Research Manager" &&
                candidate.id !== ownerId,
            );
          return {
            ...current,
            ownerId,
            reviewerId:
              current.reviewerId &&
              current.reviewerId !== ownerId &&
              (assignmentMemberIds.has(current.reviewerId) ||
                users.some(
                  (candidate) =>
                    candidate.id === current.reviewerId &&
                    candidate.active &&
                    candidate.role === "Research Manager",
                ))
                ? current.reviewerId
                : preferredReviewer?.id || "",
          };
        });
      } catch (error) {
        setAssignmentTaskDialogNotice(
          error instanceof Error
            ? error.message
            : "Assignment workstreams could not be loaded.",
        );
      }
    }
  };
  const createStarterWorkstreamsFromTaskDialog = async () => {
    if (!selectedAssignmentId) return;
    try {
      setAssignmentTaskDialogNotice("");
      const sections = await api.createAssignmentStarterStructure(
        token,
        selectedAssignmentId,
      );
      setAssignmentSections(sections);
      setAssignmentTaskForm((current) => ({
        ...current,
        assignmentSectionId: sections[0]?.id || "",
      }));
    } catch (error) {
      setAssignmentTaskDialogNotice(
        error instanceof Error ? error.message : "Workstreams could not be created.",
      );
    }
  };

  const createAssignmentTask = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (
      !assignmentTaskForm.title.trim() ||
      !assignmentTaskForm.ownerId ||
      !assignmentTaskForm.dueDate ||
      !assignmentTaskForm.specificInstructions.trim() ||
      !assignmentTaskForm.reviewerId
    ) {
      setAssignmentTaskDialogNotice(
        "Complete Task title, Assignee, Due date, Instructions and Reviewer before creating the task.",
      );
      return;
    }
    if (assignmentTaskForm.ownerId === assignmentTaskForm.reviewerId) {
      setAssignmentTaskDialogNotice(
        "The assignee cannot review their own task. Choose a different reviewer.",
      );
      return;
    }
    if (!selectedAssignmentId || assignmentTaskSaving) return;
    setAssignmentTaskSaving(true);
    setAssignmentNotice("");
    setAssignmentTaskDialogNotice("");
    try {
      await api.createAssignmentTask(token, selectedAssignmentId, {
        title: assignmentTaskForm.title.trim(),
        description: assignmentTaskForm.description.trim(),
        ownerId: assignmentTaskForm.ownerId || null,
        priority: assignmentTaskForm.priority,
        status: "Not Started",
        progress: 0,
        startDate: assignmentTaskForm.startDate || null,
        dueDate: assignmentTaskForm.dueDate || null,
        notes: assignmentTaskForm.notes.trim(),
        expectedContribution: assignmentTaskForm.expectedContribution.trim(),
        assignmentPart: assignmentTaskForm.assignmentPart.trim(),
        assignmentSectionId: assignmentTaskForm.assignmentSectionId || null,
        taskPurpose:
          assignmentTaskForm.taskPurpose.trim() || assignmentTaskForm.title.trim(),
        specificInstructions: assignmentTaskForm.specificInstructions.trim(),
        expectedFindings: assignmentTaskForm.expectedFindings.trim(),
        expectedOutput: assignmentTaskForm.expectedOutput,
        evidenceRequired: assignmentTaskForm.evidenceRequired.trim(),
        reviewerId: assignmentTaskForm.reviewerId || null,
        targetDocumentId: assignmentTaskForm.targetDocumentId || null,
        targetSectionId: assignmentTaskForm.targetSectionId || null,
      });
      const [tasks, history] = await Promise.all([
        api.assignmentTasks(token, selectedAssignmentId),
        api.history(token, selectedAssignmentId),
      ]);
      setAssignmentTasks(tasks);
      setAssignmentHistory(history);
      setAssignmentTaskDialogOpen(false);
      setAssignmentNotice("Task assigned successfully.");
    } catch (error) {
      setAssignmentTaskDialogNotice(
        error instanceof Error ? error.message : "Task could not be assigned.",
      );
    } finally {
      setAssignmentTaskSaving(false);
    }
  };

  const openAssignmentTaskRequestDialog = () => {
    setAssignmentNotice("");
    setAssignmentTaskRequestForm({
      title: "",
      description: "",
      suggestedOwnerId: "",
      priority: "Normal",
      dueDate: "",
      reason: "",
    });
    setAssignmentTaskRequestDialogOpen(true);
  };

  const submitAssignmentTaskRequest = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (
      !selectedAssignmentId ||
      !assignmentTaskRequestForm.title.trim() ||
      !assignmentTaskRequestForm.reason.trim() ||
      assignmentTaskRequestSaving
    )
      return;
    setAssignmentTaskRequestSaving(true);
    setAssignmentNotice("");
    try {
      await api.createAssignmentTaskRequest(token, selectedAssignmentId, {
        title: assignmentTaskRequestForm.title.trim(),
        description: assignmentTaskRequestForm.description.trim(),
        suggestedOwnerId: assignmentTaskRequestForm.suggestedOwnerId || null,
        priority: assignmentTaskRequestForm.priority,
        dueDate: assignmentTaskRequestForm.dueDate || null,
        reason: assignmentTaskRequestForm.reason.trim(),
      });
      const [requests, history] = await Promise.all([
        api.assignmentTaskRequests(token, selectedAssignmentId),
        api.history(token, selectedAssignmentId),
      ]);
      setAssignmentTaskRequests(requests);
      setAssignmentHistory(history);
      setAssignmentTaskRequestDialogOpen(false);
      setAssignmentNotice("Task request submitted for manager approval.");
    } catch (error) {
      setAssignmentNotice(
        error instanceof Error
          ? error.message
          : "Task request could not be submitted.",
      );
    } finally {
      setAssignmentTaskRequestSaving(false);
    }
  };

  const openAssignmentTaskRequestReview = (
    request: ApiAssignmentTaskRequest,
  ) => {
    setAssignmentNotice("");
    setAssignmentTaskRequestReview(request);
    setAssignmentTaskRequestReviewForm({
      title: request.title,
      description: request.description || "",
      ownerId: request.suggested_owner_id || "",
      priority: request.priority || "Normal",
      startDate: new Date().toISOString().slice(0, 10),
      dueDate: request.due_date || "",
      notes: "",
      comments: "",
    });
  };

  const decideAssignmentTaskRequest = async (
    decision: "Approved" | "Rejected",
  ) => {
    if (
      !selectedAssignmentId ||
      !assignmentTaskRequestReview ||
      assignmentTaskRequestReviewSaving
    )
      return;
    if (
      decision === "Rejected" &&
      !assignmentTaskRequestReviewForm.comments.trim()
    ) {
      setAssignmentNotice("Enter a reason before rejecting the task request.");
      return;
    }
    setAssignmentTaskRequestReviewSaving(true);
    setAssignmentNotice("");
    try {
      await api.decideAssignmentTaskRequest(
        token,
        selectedAssignmentId,
        assignmentTaskRequestReview.id,
        {
          decision,
          comments: assignmentTaskRequestReviewForm.comments.trim(),
          title: assignmentTaskRequestReviewForm.title.trim(),
          description: assignmentTaskRequestReviewForm.description.trim(),
          ownerId: assignmentTaskRequestReviewForm.ownerId || null,
          priority: assignmentTaskRequestReviewForm.priority,
          startDate: assignmentTaskRequestReviewForm.startDate || null,
          dueDate: assignmentTaskRequestReviewForm.dueDate || null,
          notes: assignmentTaskRequestReviewForm.notes.trim(),
        },
      );
      const [tasks, requests, history] = await Promise.all([
        api.assignmentTasks(token, selectedAssignmentId),
        api.assignmentTaskRequests(token, selectedAssignmentId),
        api.history(token, selectedAssignmentId),
      ]);
      setAssignmentTasks(tasks);
      setAssignmentTaskRequests(requests);
      setAssignmentHistory(history);
      setAssignmentTaskRequestReview(null);
      setAssignmentNotice(
        decision === "Approved"
          ? "Task request approved and converted to a task."
          : "Task request rejected.",
      );
    } catch (error) {
      setAssignmentNotice(
        error instanceof Error
          ? error.message
          : "Task request decision could not be saved.",
      );
    } finally {
      setAssignmentTaskRequestReviewSaving(false);
    }
  };

  const changeAssignmentTask = async (
    task: ApiAssignmentTask,
    status: string,
  ) => {
    if (!selectedAssignmentId) return;
    try {
      await api.updateAssignmentTask(token, selectedAssignmentId, task.id, {
        title: task.title,
        description: task.description,
        ownerId: task.owner_id,
        priority: task.priority,
        status,
        progress: status === "Completed" ? 100 : task.progress,
        startDate: task.start_date,
        dueDate: task.due_date,
        notes: task.notes,
        expectedContribution: task.expected_contribution,
        assignmentPart: task.assignment_part,
        assignmentSectionId: task.assignment_section_id,
        targetDocumentId: task.target_document_id,
        targetSectionId: task.target_section_id,
        taskPurpose: task.task_purpose,
        specificInstructions: task.specific_instructions,
        expectedFindings: task.expected_findings,
        expectedOutput: task.expected_output,
        evidenceRequired: task.evidence_required,
        reviewerId: task.reviewer_id,
      });
      setAssignmentTasks(
        await api.assignmentTasks(token, selectedAssignmentId),
      );
      setAssignmentHistory(await api.history(token, selectedAssignmentId));
      if (status === "Completed")
        await resolveActionNotifications("assignment", selectedAssignmentId);
    } catch (error) {
      setAssignmentNotice(
        error instanceof Error ? error.message : "Task could not be updated.",
      );
    }
  };
  const openAssignmentTaskWorkspace = async (
    task: ApiAssignmentTask,
    openReport = false,
  ) => {
    setSelectedAssignmentTask(task);
    setAssignmentTaskWorkspaceForm({
      title: task.title,
      description: task.description || "",
      ownerId: task.owner_id || "",
      priority: task.priority,
      status: task.status,
      progress: Number(task.progress || 0),
      startDate: taskDateValue(task.start_date),
      dueDate: taskDateValue(task.due_date),
      notes: task.notes || "",
      expectedContribution: task.expected_contribution || "",
      assignmentPart: task.assignment_part || "",
      assignmentSectionId: task.assignment_section_id || "",
      targetDocumentId: task.target_document_id || "",
      targetSectionId: task.target_section_id || "",
      taskPurpose: task.task_purpose || "",
      specificInstructions: task.specific_instructions || "",
      expectedFindings: task.expected_findings || "",
      expectedOutput: task.expected_output || "Task Report",
      evidenceRequired: task.evidence_required || "",
      reviewerId: task.reviewer_id || "",
      contributionTitle: taskReportPlainText(task.contribution_title),
      contributionSummary: taskReportPlainText(task.contribution_summary),
      contributionFindings: taskReportPlainText(task.contribution_findings),
      contributionRecommendations: taskReportPlainText(task.contribution_recommendations),
      evidenceReviewed: taskReportPlainText(task.evidence_reviewed),
      contributionChallenges: taskReportPlainText(task.contribution_challenges),
      contributionNextActions: taskReportPlainText(task.contribution_next_actions),
      contributionStatus: task.contribution_status || "Draft",
    });
    setAssignmentTaskTargetSections([]);
    if (task.target_document_id) {
      try {
        const document = await api.generatedDocument(
          token,
          task.target_document_id,
        );
        setAssignmentTaskTargetSections(document.sections || []);
      } catch {}
    }
    setAssignmentTaskContributionSavedAt("");
    setTaskReportSectionModal(
      openReport
        ? {
            key: "title",
            mode:
              user?.id === task.owner_id && task.contribution_status === "Draft"
                ? "edit"
                : "review",
          }
        : null,
    );
    setAssignmentTaskReviewComment("");
    setAssignmentTaskReviewResult(null);
    setAssignmentTaskReportPreviewOpen(false);
    setAssignmentTaskReportPreviewHtml("");
    setAssignmentNotice(
      openReport && task.owner_id === user?.id && task.contribution_status === "Draft"
        ? taskHasReportDraft(task)
          ? "Continue your saved task report. Save Draft and Preview Report before submission."
          : "Task report ready. Start writing, then Save Draft and Preview Report before submission."
        : "",
    );

    if (
      openReport &&
      task.reviewer_id === user?.id &&
      task.contribution_status === "Ready for Integration"
    ) {
      window.setTimeout(() => {
        void openTaskReportPreviewForTask(task, true);
      }, 0);
      return;
    }

    if (openReport) focusTaskReportEditor();
  };
  const openAssignmentTaskReport = async (task: ApiAssignmentTask) => {
    if (!selectedAssignmentId) return;
    if (task.owner_id !== user?.id) {
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
          {
            title: task.title,
            description: task.description,
            ownerId: task.owner_id,
            priority: task.priority,
            status: "In Progress",
            progress: Number(task.progress || 0),
            startDate: task.start_date || new Date().toISOString().slice(0, 10),
            dueDate: task.due_date,
            notes: task.notes || "",
            expectedContribution: task.expected_contribution,
            assignmentPart: task.assignment_part,
            assignmentSectionId: task.assignment_section_id,
            targetDocumentId: task.target_document_id,
            targetSectionId: task.target_section_id,
            taskPurpose: task.task_purpose,
            specificInstructions: task.specific_instructions,
            expectedFindings: task.expected_findings,
            expectedOutput: task.expected_output,
            evidenceRequired: task.evidence_required,
            reviewerId: task.reviewer_id,
          },
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
    action: "save" | "start" | "complete" = "save",
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
      const status =
        action === "start"
          ? "In Progress"
          : action === "complete"
            ? "Completed"
            : assignmentTaskWorkspaceForm.status;
      const progress =
        action === "complete"
          ? 100
          : Math.max(
              0,
              Math.min(100, Number(assignmentTaskWorkspaceForm.progress || 0)),
            );
      const startDate =
        action === "start" && !assignmentTaskWorkspaceForm.startDate
          ? new Date().toISOString().slice(0, 10)
          : assignmentTaskWorkspaceForm.startDate;
      await api.updateAssignmentTask(
        token,
        selectedAssignmentId,
        selectedAssignmentTask.id,
        {
          title: isManager
            ? assignmentTaskWorkspaceForm.title.trim()
            : selectedAssignmentTask.title,
          description: isManager
            ? assignmentTaskWorkspaceForm.description.trim()
            : selectedAssignmentTask.description,
          ownerId: isManager
            ? assignmentTaskWorkspaceForm.ownerId || null
            : selectedAssignmentTask.owner_id,
          priority: isManager
            ? assignmentTaskWorkspaceForm.priority
            : selectedAssignmentTask.priority,
          status,
          progress: status === "Completed" ? 100 : progress,
          startDate: startDate || null,
          dueDate: isManager
            ? assignmentTaskWorkspaceForm.dueDate || null
            : selectedAssignmentTask.due_date,
          notes: assignmentTaskWorkspaceForm.notes.trim(),
          expectedContribution: isManager
            ? assignmentTaskWorkspaceForm.expectedContribution.trim()
            : selectedAssignmentTask.expected_contribution,
          assignmentPart: isManager
            ? assignmentTaskWorkspaceForm.assignmentPart.trim()
            : selectedAssignmentTask.assignment_part,
          assignmentSectionId: isManager
            ? assignmentTaskWorkspaceForm.assignmentSectionId || null
            : selectedAssignmentTask.assignment_section_id,
          taskPurpose: isManager
            ? assignmentTaskWorkspaceForm.taskPurpose.trim()
            : selectedAssignmentTask.task_purpose,
          specificInstructions: isManager
            ? assignmentTaskWorkspaceForm.specificInstructions.trim()
            : selectedAssignmentTask.specific_instructions,
          expectedFindings: isManager
            ? assignmentTaskWorkspaceForm.expectedFindings.trim()
            : selectedAssignmentTask.expected_findings,
          expectedOutput: isManager
            ? assignmentTaskWorkspaceForm.expectedOutput
            : selectedAssignmentTask.expected_output,
          evidenceRequired: isManager
            ? assignmentTaskWorkspaceForm.evidenceRequired.trim()
            : selectedAssignmentTask.evidence_required,
          reviewerId: isManager
            ? assignmentTaskWorkspaceForm.reviewerId || null
            : selectedAssignmentTask.reviewer_id,
          targetDocumentId: isManager
            ? assignmentTaskWorkspaceForm.targetDocumentId || null
            : selectedAssignmentTask.target_document_id,
          targetSectionId: isManager
            ? assignmentTaskWorkspaceForm.targetSectionId || null
            : selectedAssignmentTask.target_section_id,
        },
      );
      const [tasks, history] = await Promise.all([
        api.assignmentTasks(token, selectedAssignmentId),
        api.history(token, selectedAssignmentId),
      ]);
      setAssignmentTasks(tasks);
      setAssignmentHistory(history);
      const refreshed =
        tasks.find((task) => task.id === selectedAssignmentTask.id) || null;
      setSelectedAssignmentTask(refreshed);
      if (refreshed)
        setAssignmentTaskWorkspaceForm({
          title: refreshed.title,
          description: refreshed.description || "",
          ownerId: refreshed.owner_id || "",
          priority: refreshed.priority,
          status: refreshed.status,
          progress: Number(refreshed.progress || 0),
          startDate: taskDateValue(refreshed.start_date),
          dueDate: taskDateValue(refreshed.due_date),
          notes: refreshed.notes || "",
          expectedContribution: refreshed.expected_contribution || "",
          assignmentPart: refreshed.assignment_part || "",
          assignmentSectionId: refreshed.assignment_section_id || "",
          taskPurpose: refreshed.task_purpose || "",
          specificInstructions: refreshed.specific_instructions || "",
          expectedFindings: refreshed.expected_findings || "",
          expectedOutput: refreshed.expected_output || "Task Report",
          evidenceRequired: refreshed.evidence_required || "",
          reviewerId: refreshed.reviewer_id || "",
          targetDocumentId: refreshed.target_document_id || "",
          targetSectionId: refreshed.target_section_id || "",
          contributionTitle: taskReportPlainText(refreshed.contribution_title),
          contributionSummary: taskReportPlainText(refreshed.contribution_summary),
          contributionFindings: taskReportPlainText(refreshed.contribution_findings),
          contributionRecommendations:
            taskReportPlainText(refreshed.contribution_recommendations),
          evidenceReviewed: taskReportPlainText(refreshed.evidence_reviewed),
          contributionChallenges: taskReportPlainText(refreshed.contribution_challenges),
          contributionNextActions: taskReportPlainText(refreshed.contribution_next_actions),
          contributionStatus: refreshed.contribution_status || "Draft",
        });
      setAssignmentNotice(
        action === "start"
          ? "Task started successfully."
          : action === "complete"
            ? "Task completed successfully."
            : "Task saved successfully.",
      );
      if (status === "Completed")
        await resolveActionNotifications("assignment", selectedAssignmentId);
    } catch (error) {
      setAssignmentNotice(
        error instanceof Error ? error.message : "Task could not be saved.",
      );
    } finally {
      setAssignmentTaskWorkspaceSaving(false);
    }
  };
  const createTaskContributionOutput = async (
    scope: "create" | "workspace",
  ) => {
    if (
      !selectedAssignmentId ||
      !assignmentTaskQuickOutputForm.templateId ||
      !assignmentTaskQuickOutputForm.title.trim() ||
      assignmentTaskQuickOutputSaving
    )
      return;
    setAssignmentTaskQuickOutputSaving(true);
    setAssignmentNotice("");
    try {
      const created = await api.createGeneratedDocument(token, {
        templateId: assignmentTaskQuickOutputForm.templateId,
        context: "Assignment",
        contextId: selectedAssignmentId,
        title: assignmentTaskQuickOutputForm.title.trim(),
        classification: assignmentTaskQuickOutputForm.classification,
      });
      const [documents, document] = await Promise.all([
        api.generatedDocuments(token, "Assignment", selectedAssignmentId),
        api.generatedDocument(token, created.id),
      ]);
      setWorkspaceDocuments(documents);
      setAssignmentTaskTargetSections(document.sections || []);
      if (scope === "create") {
        setAssignmentTaskForm((current) => ({
          ...current,
          targetDocumentId: created.id,
          targetSectionId: "",
        }));
      } else {
        setAssignmentTaskWorkspaceForm((current) => ({
          ...current,
          targetDocumentId: created.id,
          targetSectionId: "",
        }));
      }
      setAssignmentTaskQuickOutputOpen(false);
      setAssignmentTaskQuickOutputForm({
        templateId: builderTemplates[0]?.id || "",
        title: "",
        classification: "Official",
      });
      setAssignmentNotice(
        "Assignment output created and linked to this task. Choose a target section when needed.",
      );
    } catch (error) {
      setAssignmentNotice(
        error instanceof Error
          ? error.message
          : "Assignment output could not be created.",
      );
    } finally {
      setAssignmentTaskQuickOutputSaving(false);
    }
  };

  const persistTaskWorkspaceForContribution = async () => {
    if (!selectedAssignmentId || !selectedAssignmentTask) return;
    const status = assignmentTaskWorkspaceForm.status;
    const progress = Math.max(
      0,
      Math.min(100, Number(assignmentTaskWorkspaceForm.progress || 0)),
    );
    await api.updateAssignmentTask(
      token,
      selectedAssignmentId,
      selectedAssignmentTask.id,
      {
        title: isManager
          ? assignmentTaskWorkspaceForm.title.trim()
          : selectedAssignmentTask.title,
        description: isManager
          ? assignmentTaskWorkspaceForm.description.trim()
          : selectedAssignmentTask.description,
        ownerId: isManager
          ? assignmentTaskWorkspaceForm.ownerId || null
          : selectedAssignmentTask.owner_id,
        priority: isManager
          ? assignmentTaskWorkspaceForm.priority
          : selectedAssignmentTask.priority,
        status,
        progress: status === "Completed" ? 100 : progress,
        startDate: assignmentTaskWorkspaceForm.startDate || null,
        dueDate: isManager
          ? assignmentTaskWorkspaceForm.dueDate || null
          : selectedAssignmentTask.due_date,
        notes: assignmentTaskWorkspaceForm.notes.trim(),
        expectedContribution: isManager
          ? assignmentTaskWorkspaceForm.expectedContribution.trim()
          : selectedAssignmentTask.expected_contribution,
        assignmentPart: isManager
          ? assignmentTaskWorkspaceForm.assignmentPart.trim()
          : selectedAssignmentTask.assignment_part,
        assignmentSectionId: isManager
          ? assignmentTaskWorkspaceForm.assignmentSectionId || null
          : selectedAssignmentTask.assignment_section_id,
        taskPurpose: isManager
          ? assignmentTaskWorkspaceForm.taskPurpose.trim()
          : selectedAssignmentTask.task_purpose,
        specificInstructions: isManager
          ? assignmentTaskWorkspaceForm.specificInstructions.trim()
          : selectedAssignmentTask.specific_instructions,
        expectedFindings: isManager
          ? assignmentTaskWorkspaceForm.expectedFindings.trim()
          : selectedAssignmentTask.expected_findings,
        expectedOutput: isManager
          ? assignmentTaskWorkspaceForm.expectedOutput
          : selectedAssignmentTask.expected_output,
        evidenceRequired: isManager
          ? assignmentTaskWorkspaceForm.evidenceRequired.trim()
          : selectedAssignmentTask.evidence_required,
        reviewerId: isManager
          ? assignmentTaskWorkspaceForm.reviewerId || null
          : selectedAssignmentTask.reviewer_id,
        targetDocumentId: isManager
          ? assignmentTaskWorkspaceForm.targetDocumentId || null
          : selectedAssignmentTask.target_document_id,
        targetSectionId: isManager
          ? assignmentTaskWorkspaceForm.targetSectionId || null
          : selectedAssignmentTask.target_section_id,
      },
    );
  };

  const applySavedTaskContribution = (saved: ApiAssignmentTask) => {
    setSelectedAssignmentTask(saved);
    setAssignmentTasks((current) =>
      current.map((task) => (task.id === saved.id ? saved : task)),
    );
    setAssignmentTaskWorkspaceForm((current) => ({
      ...current,
      contributionTitle: taskReportPlainText(saved.contribution_title),
      contributionSummary: taskReportPlainText(saved.contribution_summary),
      contributionFindings: taskReportPlainText(saved.contribution_findings),
      contributionRecommendations: taskReportPlainText(saved.contribution_recommendations),
      evidenceReviewed: taskReportPlainText(saved.evidence_reviewed),
      contributionChallenges: taskReportPlainText(saved.contribution_challenges),
      contributionNextActions: taskReportPlainText(saved.contribution_next_actions),
      contributionStatus: saved.contribution_status || "Draft",
    }));
  };

  const saveAssignmentTaskContribution = async (
    statusOverride?:
      | "Draft"
      | "Ready for Integration"
      | "Integrated"
      | "Accepted",
  ) => {
    if (
      !selectedAssignmentId ||
      !selectedAssignmentTask ||
      assignmentTaskContributionSaving
    )
      return false;
    setAssignmentTaskContributionSaving(true);
    setAssignmentNotice("");
    try {
      const status =
        statusOverride || assignmentTaskWorkspaceForm.contributionStatus;
      const contributionTitle =
        taskReportPlainText(assignmentTaskWorkspaceForm.contributionTitle) ||
        `${selectedAssignmentTask.title} â€” Contribution Report`;
      const saved = await api.updateAssignmentTaskContribution(
        token,
        selectedAssignmentId,
        selectedAssignmentTask.id,
        {
          contributionTitle,
          contributionSummary:
            taskReportPlainText(assignmentTaskWorkspaceForm.contributionSummary),
          contributionFindings:
            taskReportPlainText(assignmentTaskWorkspaceForm.contributionFindings),
          contributionRecommendations:
            taskReportPlainText(assignmentTaskWorkspaceForm.contributionRecommendations),
          evidenceReviewed: taskReportPlainText(assignmentTaskWorkspaceForm.evidenceReviewed),
          contributionChallenges:
            taskReportPlainText(assignmentTaskWorkspaceForm.contributionChallenges),
          contributionNextActions:
            taskReportPlainText(assignmentTaskWorkspaceForm.contributionNextActions),
          workNotes: assignmentTaskWorkspaceForm.notes.trim(),
          contributionStatus: status,
        },
      );
      applySavedTaskContribution(saved);
      setAssignmentTaskWorkspaceForm((current) => ({
        ...current,
        contributionTitle:
          saved.contribution_title || current.contributionTitle,
      }));
      setAssignmentHistory(await api.history(token, selectedAssignmentId));
      const time = new Date().toLocaleTimeString("en-KE", {
        hour: "2-digit",
        minute: "2-digit",
      });
      setAssignmentTaskContributionSavedAt(time);
      setAssignmentNotice(
        status === "Draft"
          ? `Draft saved successfully at ${time}. Next step: Preview Report.`
          : status === "Ready for Integration"
            ? `Task report submitted to ${saved.reviewer_name || selectedAssignmentTask.reviewer_name || "the assigned reviewer"}.`
            : `Contribution updated to ${assignmentReportStatusLabel(status as ApiAssignmentTask["contribution_status"])}.`,
      );
      if (["Integrated", "Accepted"].includes(status))
        await resolveActionNotifications(
          "assignment_task",
          selectedAssignmentTask.id,
        );
      return true;
    } catch (error) {
      setAssignmentNotice(
        error instanceof Error
          ? error.message
          : "Contribution could not be saved.",
      );
      return false;
    } finally {
      setAssignmentTaskContributionSaving(false);
    }
  };

  const updateTaskReportSection = async (
    sectionKey: string,
    status: "Draft" | "In Review" | "Final",
    contentOverride?: string,
  ) => {
    if (
      !selectedAssignmentId ||
      !selectedAssignmentTask ||
      assignmentTaskSectionSaving
    )
      return false;
    setAssignmentTaskSectionSaving(sectionKey);
    setAssignmentNotice("");
    try {
      const updated = await api.updateAssignmentTaskContributionSection(
        token,
        selectedAssignmentId,
        selectedAssignmentTask.id,
        {
          sectionKey,
          status,
          content: contentOverride ?? taskReportSectionValue(sectionKey),
        },
      );
      setSelectedAssignmentTask(updated);
      setAssignmentTasks((current) =>
        current.map((task) =>
          task.id === updated.id
            ? updated
            : task,
        ),
      );
      setAssignmentNotice(`${status} status saved for this report section.`);
      return true;
    } catch (error) {
      setAssignmentNotice(
        error instanceof Error
          ? error.message
          : "Report section status could not be saved.",
      );
      return false;
    } finally {
      setAssignmentTaskSectionSaving("");
    }
  };

  const taskReportSectionControls = (sectionKey: string) => {
    const status =
      selectedAssignmentTask?.contribution_section_statuses?.[sectionKey] ||
      "Draft";
    const reportIsDraft =
      selectedAssignmentTask?.contribution_status === "Draft";
    const reportIsRejected = selectedAssignmentTask?.status === "Blocked";
    const canEditSection = Boolean(
      isSelectedTaskOwner && reportIsDraft && !reportIsRejected,
    );
    return (
      <div className="task-report-section-actions">
        <b className={`section-${status.toLowerCase().replaceAll(" ", "-")}`}>
          {status}
        </b>
        <small>
          {canEditSection
            ? "Edit directly in this Task Workspace"
            : "Read-only for this workflow stage"}
        </small>
      </div>
    );
  };

  const renderTaskReportOwnerFeedback = () => {
    if (
      !isSelectedTaskOwner ||
      latestSelectedTaskReview?.action !== "TASK_REPORT_CHANGES_REQUESTED"
    )
      return null;
    return (
      <section className="task-review-feedback-card">
        <span className="workspace-eyebrow">REVIEW FEEDBACK</span>
        <h4>Changes requested</h4>
        <p>
          {String(
            latestSelectedTaskReview.details?.comments ||
              "The reviewer returned this report for revision.",
          )}
        </p>
        <small>Revise the draft and submit it again when ready.</small>
      </section>
    );
  };

  const renderTaskWorkflowAccessNotice = () => {
    if (!selectedAssignmentTask) return null;
    const status = assignmentTaskWorkspaceForm.contributionStatus;
    const reviewerName = selectedAssignmentTask.reviewer_name || "the assigned reviewer";
    const ownerName = selectedAssignmentTask.owner_name || "the task owner";
    let title = "Task report status";
    let detail = "";
    let tone = "neutral";

    if (selectedAssignmentTask.status === "Blocked") {
      title = "Rejected Â· management action required";
      detail = isSelectedTaskOwner
        ? "This rejected version is locked. Wait for the assignment lead or manager to reopen it for revision."
        : "The rejected version is preserved. An authorised manager or assignment lead must reopen it before the owner can revise it.";
      tone = "danger";
    } else if (status === "Draft") {
      if (isSelectedTaskOwner) {
        title = "Draft Â· your report";
        detail = `Edit the report, save the draft and preview it before submitting it to ${reviewerName}.`;
        tone = "owner";
      } else if (isSelectedTaskReviewer) {
        title = "Draft Â· not yet submitted";
        detail = `You are the assigned reviewer. ${ownerName} is still preparing the report; review controls will appear automatically after submission.`;
        tone = "waiting";
      } else {
        title = "Draft Â· management view";
        detail = `${ownerName} owns this draft. It will be reviewed by ${reviewerName} after submission. Report content is read-only for you.`;
        tone = "waiting";
      }
    } else if (status === "Ready for Integration") {
      if (isSelectedTaskReviewer) {
        title = "Submitted Â· your decision required";
        detail = `Review the frozen submission from ${ownerName}, then approve it, request changes or reject it.`;
        tone = "review";
      } else if (isSelectedTaskOwner) {
        title = "Submitted Â· locked for review";
        detail = `Your submitted version is frozen while ${reviewerName} reviews it. You can preview it but cannot edit it.`;
        tone = "waiting";
      } else {
        title = "Submitted Â· under review";
        detail = `The frozen report is awaiting a decision from ${reviewerName}.`;
        tone = "waiting";
      }
    } else if (status === "Integrated") {
      title = "Approved Â· final report pending";
      detail = isSelectedTaskReviewer
        ? "The submission is approved. Generate the final task report and save it to the Document Repository to complete the task."
        : `The report has been approved. ${reviewerName} or an authorised finaliser must generate the final repository report.`;
      tone = "approved";
    } else if (status === "Accepted") {
      title = "Final Â· repository record created";
      detail = "The approved final task report is complete, preserved in the Document Repository and now counts toward assignment progress.";
      tone = "final";
    }

    return (
      <div className={`task-report-access-notice ${tone}`}>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
    );
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
        "Generating the approved DOCX, publishing it to the Document Repository and completing the taskâ€¦",
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
        refreshed = context.task;
        setAssignmentRows((current) => {
          const withoutCurrent = current.filter((item) => item.id !== context.assignment.id);
          return [...withoutCurrent, context.assignment];
        });
        setAssignmentTasks([context.task]);
      } catch {
        setAssignmentTasks((current) => {
          const withoutCurrent = current.filter((task) => task.id !== updated.id);
          return [...withoutCurrent, updated];
        });
      }

      setSelectedAssignmentTask(refreshed);
      applySavedTaskContribution(refreshed);

      const message = updated.repository_document_title
        ? `Final approved task report generated and published to the Document Repository as "${updated.repository_document_title}". The task is complete and now counts toward assignment progress.`
        : "Final approved task report generated and published to the Document Repository. The task is complete and now counts toward assignment progress.";
      setAssignmentNotice(message);
      setAssignmentTaskReviewResult({ tone: "success", message });

      setAssignmentTaskReportPreviewTitle(report.title);
      setAssignmentTaskReportPreviewHtml(report.html);
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

  const renderTaskReviewDecision = () => {
    if (!canReviewSelectedTask || !selectedAssignmentTask) return null;

    const status = assignmentTaskWorkspaceForm.contributionStatus;

    if (status === "Integrated") {
      return (
        <section className="task-review-decision-card task-review-approved-card">
          <header>
            <div>
              <span className="workspace-eyebrow">REVIEW APPROVED</span>
              <h3>Generate the final task report</h3>
              <p>
                The submitted report has been approved. Generate the immutable
                final report to complete this task, publish the approved DOCX directly to the
                Document Repository, and make it available to the assignment report.
              </p>
            </div>
            <b>{selectedAssignmentTask.reviewer_name || "Assigned reviewer"}</b>
          </header>
          <button
            type="button"
            className="task-review-open-report"
            disabled={assignmentTaskReportPreviewBusy}
            onClick={openSavedAssignmentTaskContributionReport}
          >
            {assignmentTaskReportPreviewBusy
              ? "Opening approved report..."
              : "Preview approved submission"}
          </button>
          <footer>
            <button
              type="button"
              className="task-review-accept"
              disabled={assignmentTaskFinalizing}
              onClick={() => void finalizeAssignmentTaskContribution()}
            >
              {assignmentTaskFinalizing
                ? "Generating & Saving..."
                : "Generate Final Report & Save to Repository"}
            </button>
          </footer>
          {assignmentTaskReviewResult && (
            <div
              className={`task-review-result ${assignmentTaskReviewResult.tone}`}
              role="status"
            >
              {assignmentTaskReviewResult.message}
            </div>
          )}
        </section>
      );
    }

    if (selectedAssignmentTask.status === "Blocked") {
      const rejectionReason =
        latestSelectedTaskReview?.action === "TASK_REPORT_REJECTED"
          ? String(latestSelectedTaskReview.details?.comments || "")
          : "";
      return (
        <section className="task-review-rejected-card">
          <header>
            <div>
              <span className="workspace-eyebrow">SUBMISSION REJECTED</span>
              <h3>Management action required</h3>
              <p>
                This rejected version is preserved in history and cannot be
                edited or finalized.
              </p>
            </div>
            <b>Rejected</b>
          </header>
          {rejectionReason && (
            <div className="task-review-rejection-reason">
              <span>Reason</span>
              <p>{rejectionReason}</p>
            </div>
          )}
          {(isManager || isAssignmentLead) ? (
            <footer>
              <button
                type="button"
                className="task-review-reopen"
                disabled={assignmentTaskReviewSaving}
                onClick={async () => {
                  if (!selectedAssignmentId || !selectedAssignmentTask) return;
                  setAssignmentTaskReviewSaving(true);
                  setAssignmentNotice("");
                  try {
                    const reopened = await api.reopenRejectedAssignmentTask(
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
                }}
              >
                {assignmentTaskReviewSaving ? "Reopening..." : "Reopen for Revision"}
              </button>
            </footer>
          ) : (
            <p className="task-review-rejected-wait">
              Wait for the assignment lead or manager to reopen or reassign this task.
            </p>
          )}
        </section>
      );
    }

    if (status !== "Ready for Integration") return null;

    return (
      <section className="task-review-decision-card">
        <header>
          <div>
            <span className="workspace-eyebrow">REVIEW DECISION</span>
            <h3>Review submitted task report</h3>
            <p>
              Read the frozen submitted report and supporting evidence before
              recording a decision.
            </p>
          </div>
          <b>{selectedAssignmentTask.reviewer_name || "Assigned reviewer"}</b>
        </header>
        <button
          type="button"
          className="task-review-open-report"
          disabled={assignmentTaskReportPreviewBusy}
          onClick={openSavedAssignmentTaskContributionReport}
        >
          {assignmentTaskReportPreviewBusy
            ? "Opening report..."
            : "Preview submitted report"}
        </button>
        <label>
          <span>Reviewer comments</span>
          <textarea
            rows={4}
            value={assignmentTaskReviewComment}
            onChange={(event) =>
              setAssignmentTaskReviewComment(event.target.value)
            }
            placeholder="Record corrections, evidence gaps or an approval note."
          />
        </label>
        <footer>
          <button
            type="button"
            className="task-review-changes"
            disabled={
              assignmentTaskReviewSaving ||
              !assignmentTaskReviewComment.trim()
            }
            onClick={() =>
              void reviewAssignmentTaskContribution("Changes Requested")
            }
          >
            {assignmentTaskReviewSaving ? "Recording..." : "Request Changes"}
          </button>
          <button
            type="button"
            className="task-review-reject"
            disabled={
              assignmentTaskReviewSaving ||
              !assignmentTaskReviewComment.trim()
            }
            onClick={() => void reviewAssignmentTaskContribution("Rejected")}
          >
            {assignmentTaskReviewSaving ? "Recording..." : "Reject Submission"}
          </button>
          <button
            type="button"
            className="task-review-accept"
            disabled={assignmentTaskReviewSaving}
            onClick={() => void reviewAssignmentTaskContribution("Approved")}
          >
            {assignmentTaskReviewSaving ? "Recording approval..." : "Approve Report"}
          </button>
        </footer>
        {assignmentTaskReviewResult && (
          <div className={`task-review-result ${assignmentTaskReviewResult.tone}`} role="status">
            {assignmentTaskReviewResult.message}
          </div>
        )}
      </section>
    );
  };

  const taskReportSectionName = (key: string) =>
    ({
      title: "Output title",
      workCompleted: "Work completed",
      evidence: "Evidence reviewed",
      findings: "Key findings",
      recommendations: "Recommendations",
      challenges: "Challenges or limitations",
      nextActions: "Next actions",
    })[key] || "Report section";
  const taskReportSectionValue = (key: string) =>
    ({
      title: assignmentTaskWorkspaceForm.contributionTitle,
      workCompleted: assignmentTaskWorkspaceForm.contributionSummary,
      evidence: assignmentTaskWorkspaceForm.evidenceReviewed,
      findings: assignmentTaskWorkspaceForm.contributionFindings,
      recommendations: assignmentTaskWorkspaceForm.contributionRecommendations,
      challenges: assignmentTaskWorkspaceForm.contributionChallenges,
      nextActions: assignmentTaskWorkspaceForm.contributionNextActions,
    })[key] || "";
  const setTaskReportSectionValue = (key: string, value: string) =>
    setAssignmentTaskWorkspaceForm((current) => ({
      ...current,
      ...(key === "title"
        ? { contributionTitle: value }
        : key === "workCompleted"
          ? { contributionSummary: value }
          : key === "evidence"
            ? { evidenceReviewed: value }
            : key === "findings"
              ? { contributionFindings: value }
              : key === "recommendations"
                ? { contributionRecommendations: value }
                : key === "challenges"
                  ? { contributionChallenges: value }
                  : { contributionNextActions: value }),
    }));

  const previewAssignmentTaskContribution = async () => {
    if (
      !selectedAssignmentId ||
      !selectedAssignmentTask ||
      assignmentTaskReportPreviewBusy
    )
      return;
    setAssignmentTaskReportPreviewBusy(true);
    setAssignmentNotice("");
    try {
      const contributionTitle =
        taskReportPlainText(assignmentTaskWorkspaceForm.contributionTitle) ||
        `${selectedAssignmentTask.title} â€” Contribution Report`;
      const saved = await api.updateAssignmentTaskContribution(
        token,
        selectedAssignmentId,
        selectedAssignmentTask.id,
        {
          contributionTitle,
          contributionSummary:
            taskReportPlainText(assignmentTaskWorkspaceForm.contributionSummary),
          contributionFindings:
            taskReportPlainText(assignmentTaskWorkspaceForm.contributionFindings),
          contributionRecommendations:
            taskReportPlainText(assignmentTaskWorkspaceForm.contributionRecommendations),
          evidenceReviewed: taskReportPlainText(assignmentTaskWorkspaceForm.evidenceReviewed),
          contributionChallenges:
            taskReportPlainText(assignmentTaskWorkspaceForm.contributionChallenges),
          contributionNextActions:
            taskReportPlainText(assignmentTaskWorkspaceForm.contributionNextActions),
          workNotes: assignmentTaskWorkspaceForm.notes.trim(),
          contributionStatus: "Draft",
        },
      );
      applySavedTaskContribution(saved);
      const preview = await api.previewAssignmentTaskContribution(
        token,
        selectedAssignmentId,
        selectedAssignmentTask.id,
        {
          contributionTitle,
          contributionSummary:
            taskReportPlainText(assignmentTaskWorkspaceForm.contributionSummary),
          contributionFindings:
            taskReportPlainText(assignmentTaskWorkspaceForm.contributionFindings),
          contributionRecommendations:
            taskReportPlainText(assignmentTaskWorkspaceForm.contributionRecommendations),
          evidenceReviewed: taskReportPlainText(assignmentTaskWorkspaceForm.evidenceReviewed),
          contributionChallenges:
            taskReportPlainText(assignmentTaskWorkspaceForm.contributionChallenges),
          contributionNextActions:
            taskReportPlainText(assignmentTaskWorkspaceForm.contributionNextActions),
          workNotes: assignmentTaskWorkspaceForm.notes.trim(),
        },
      );
      setAssignmentTaskReportPreviewTitle(preview.title);
      setAssignmentTaskReportPreviewHtml(preview.html);
      setAssignmentTaskReportPreviewOpen(true);
      const time = new Date().toLocaleTimeString("en-KE", {
        hour: "2-digit",
        minute: "2-digit",
      });
      setAssignmentTaskContributionSavedAt(time);
      setAssignmentNotice(
        "Draft saved. Review the generated report before submitting it to the assigned reviewer.",
      );
    } catch (error) {
      setAssignmentNotice(
        error instanceof Error
          ? error.message
          : "Contribution report could not be prepared.",
      );
    } finally {
      setAssignmentTaskReportPreviewBusy(false);
    }
  };

  const openTaskReportPreviewForTask = async (
    task: ApiAssignmentTask,
    reviewMode = false,
  ) => {
    if (assignmentTaskReportPreviewBusy) return;
    const assignmentId = task.assignment_id || selectedAssignmentId;
    if (!assignmentId) {
      setAssignmentNotice("This Task Report is missing its assignment context.");
      return;
    }

    setSelectedAssignmentId(assignmentId);
    setSelectedAssignmentTask(task);
    setAssignmentTaskWorkspaceForm({
      title: task.title,
      description: task.description || "",
      ownerId: task.owner_id || "",
      priority: task.priority,
      status: task.status,
      progress: Number(task.progress || 0),
      startDate: taskDateValue(task.start_date),
      dueDate: taskDateValue(task.due_date),
      notes: task.notes || "",
      expectedContribution: task.expected_contribution || "",
      assignmentPart: task.assignment_part || "",
      assignmentSectionId: task.assignment_section_id || "",
      targetDocumentId: task.target_document_id || "",
      targetSectionId: task.target_section_id || "",
      taskPurpose: task.task_purpose || "",
      specificInstructions: task.specific_instructions || "",
      expectedFindings: task.expected_findings || "",
      expectedOutput: task.expected_output || "Task Report",
      evidenceRequired: task.evidence_required || "",
      reviewerId: task.reviewer_id || "",
      contributionTitle: taskReportPlainText(task.contribution_title),
      contributionSummary: taskReportPlainText(task.contribution_summary),
      contributionFindings: taskReportPlainText(task.contribution_findings),
      contributionRecommendations: taskReportPlainText(task.contribution_recommendations),
      evidenceReviewed: taskReportPlainText(task.evidence_reviewed),
      contributionChallenges: taskReportPlainText(task.contribution_challenges),
      contributionNextActions: taskReportPlainText(task.contribution_next_actions),
      contributionStatus: task.contribution_status || "Draft",
    });
    setTaskReportSectionModal(null);
    setAssignmentTaskReviewComment("");
    setAssignmentTaskReviewResult(null);
    setAssignmentTaskReportPreviewBusy(true);
    setAssignmentNotice("");

    try {
      const report = await api.assignmentTaskContributionReport(
        token,
        assignmentId,
        task.id,
      );
      setAssignmentTaskReportPreviewTitle(report.title);
      setAssignmentTaskReportPreviewHtml(report.html);
      setAssignmentTaskReportPreviewOpen(true);

      if (reviewMode && task.contribution_status === "Ready for Integration") {
        setAssignmentNotice("Review the submitted Task Report in the preview and record your decision below it.");
      } else if (task.contribution_status === "Accepted") {
        setAssignmentNotice("This is the final approved Task Report. Its review decision has already been recorded.");
      }
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

  const openSavedAssignmentTaskContributionReport = async () => {
    if (
      !selectedAssignmentId ||
      !selectedAssignmentTask ||
      assignmentTaskReportPreviewBusy
    )
      return;
    setAssignmentTaskReportPreviewBusy(true);
    setAssignmentNotice("");
    try {
      const report = await api.assignmentTaskContributionReport(
        token,
        selectedAssignmentId,
        selectedAssignmentTask.id,
      );
      setAssignmentTaskReportPreviewTitle(report.title);
      setAssignmentTaskReportPreviewHtml(report.html);
      setAssignmentTaskReportPreviewOpen(true);
    } catch (error) {
      setAssignmentNotice(
        error instanceof Error
          ? error.message
          : "Contribution report could not be opened.",
      );
    } finally {
      setAssignmentTaskReportPreviewBusy(false);
    }
  };

  const generateAssignmentTaskReportFromList = async (
    task: ApiAssignmentTask,
  ) => {
    if (!selectedAssignmentId || assignmentTaskReportPreviewBusy) return;
    setAssignmentTaskReportPreviewBusy(true);
    setAssignmentNotice("Preparing the latest saved task report...");
    try {
      await openAssignmentTaskWorkspace(task, false);
      const preview = await api.previewAssignmentTaskContribution(
        token,
        selectedAssignmentId,
        task.id,
        {
          contributionTitle:
            task.contribution_title || `${task.title} â€” Contribution Report`,
          contributionSummary: taskReportPlainText(task.contribution_summary),
          contributionFindings: taskReportPlainText(task.contribution_findings),
          contributionRecommendations: taskReportPlainText(task.contribution_recommendations),
          evidenceReviewed: taskReportPlainText(task.evidence_reviewed),
          contributionChallenges: taskReportPlainText(task.contribution_challenges),
          contributionNextActions: taskReportPlainText(task.contribution_next_actions),
          workNotes: task.notes || "",
        },
      );
      setAssignmentTaskReportPreviewTitle(preview.title);
      setAssignmentTaskReportPreviewHtml(preview.html);
      setAssignmentTaskReportPreviewOpen(true);
      setAssignmentNotice("Report generated from the latest saved draft.");
    } catch (error) {
      setAssignmentNotice(
        error instanceof Error
          ? error.message
          : "The task report could not be generated.",
      );
    } finally {
      setAssignmentTaskReportPreviewBusy(false);
    }
  };

  const approveAndSendAssignmentTaskContribution = async () => {
    const ok = await saveAssignmentTaskContribution("Ready for Integration");
    if (ok) setAssignmentTaskReportPreviewOpen(false);
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
          ? "Recording approvalâ€¦"
          : "Recording reviewer decisionâ€¦",
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
      setAssignmentTaskReportPreviewOpen(false);
      const message =
        decision === "Approved"
          ? "Task report approved. It is now Approved Â· Final Report Pending. Generate the final report to complete the task."
          : decision === "Rejected"
            ? "Submission rejected. It is locked until the assignment lead or a manager reopens it for revision or reassignment."
            : "Changes requested. The report has returned to the researcher as a draft for revision.";
      setAssignmentNotice(message);
      setAssignmentTaskReviewResult({ tone: "success", message });
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

  const addAssignmentMember = async () => {
    if (!selectedAssignmentId || !assignmentMemberId) return;
    try {
      await api.addMember(
        token,
        selectedAssignmentId,
        assignmentMemberId,
        assignmentMemberRole,
      );
      setAssignmentRows(await api.assignments(token));
      setAssignmentMemberId("");
      setAssignmentHistory(await api.history(token, selectedAssignmentId));
    } catch (error) {
      setAssignmentNotice(
        error instanceof Error ? error.message : "Member could not be added.",
      );
    }
  };
  const recordAssignmentReview = async (
    decision: ApiAssignmentReview["decision"],
  ) => {
    if (!selectedAssignmentId || assignmentReviewSaving) return;
    setAssignmentReviewSaving(true);
    setAssignmentNotice("");
    try {
      await api.reviewAssignment(
        token,
        selectedAssignmentId,
        decision,
        assignmentReviewComment.trim(),
      );
      setAssignmentReviewComment("");
      setAssignmentReviews(
        await api.assignmentReviews(token, selectedAssignmentId),
      );
      await refreshAssignments();
      setAssignmentHistory(await api.history(token, selectedAssignmentId));
      await resolveActionNotifications("assignment", selectedAssignmentId);
      setAssignmentNotice(`${decision} recorded successfully.`);
    } catch (error) {
      setAssignmentNotice(
        error instanceof Error
          ? error.message
          : "Review decision could not be recorded.",
      );
    } finally {
      setAssignmentReviewSaving(false);
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
                ["Reviewer", "Research Manager", "Administrator"].includes(
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
  const selectBuilderSection = async (section: GeneratedDocumentSection) => {
    if (!builderDocument) return;
    if (builderDirty) await saveBuilderSection(false);
    if (
      builderSection &&
      builderSection.id !== section.id &&
      builderDocument.context === "Assignment"
    )
      await api
        .unlockGeneratedDocumentSection(
          token,
          builderDocument.id,
          builderSection.id,
        )
        .catch(() => {});
    setBuilderSection(section);
    setBuilderContent(section.content || "");
    setBuilderDirty(false);
    setBuilderSaveMessage("All changes saved");
    if (
      builderDocument.context === "Assignment" &&
      !["Submitted", "Under Review", "Approved", "Final"].includes(
        builderDocument.status,
      )
    ) {
      try {
        await api.lockGeneratedDocumentSection(
          token,
          builderDocument.id,
          section.id,
        );
      } catch (error) {
        setBuilderSaveMessage(
          error instanceof Error ? error.message : "Section is read-only.",
        );
      }
    }
  };
  const createWorkspaceDocument = async (
    context: "Assignment" | "Research",
    contextId: string,
  ) => {
    const workspaceTitle =
      context === "Assignment"
        ? selectedAssignmentRecord?.title || selectedAssignment || "Assignment Report"
        : builderCreate.title.trim();
    if (!builderCreate.templateId || !workspaceTitle) return;
    try {
      setBuilderCreating(true);
      const created = await api.createGeneratedDocument(token, {
        templateId: builderCreate.templateId,
        context,
        contextId,
        title: workspaceTitle,
        classification: builderCreate.classification,
      });
      setWorkspaceDocuments(
        await api.generatedDocuments(token, context, contextId),
      );
      setBuilderCreate({ ...builderCreate, title: "" });
      if (context === "Research") {
        setResearchDocumentCreateOpen(false);
        setResearchActivity(await api.researchActivity(token, contextId));
        setResearchWorkspaceNotice(
          `Document ${created.reference} created. You can now complete its sections and save your work.`,
        );
      }
      await openGeneratedDocument(created.id);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Document could not be created.";
      if (context === "Research") setResearchWorkspaceNotice(message);
      else setAssignmentNotice(message);
    } finally {
      setBuilderCreating(false);
    }
  };
  const createAssignmentReport = async (templateId: string, title: string) => {
    if (!selectedAssignmentId) return;
    const created = await api.createGeneratedDocument(token, {
      templateId,
      context: "Assignment",
      contextId: selectedAssignmentId,
      title,
      classification: "Official",
    });
    setWorkspaceDocuments(
      await api.generatedDocuments(token, "Assignment", selectedAssignmentId),
    );
    await openGeneratedDocument(created.id);
  };
  const compileAssignmentReport = async (
    reportType: "Progress" | "Final",
    taskIds: string[],
    knowledgeIds: string[],
  ) => {
    if (!selectedAssignmentId || !selectedAssignmentRecord) {
      throw new Error("The assignment context is not loaded. Reopen the assignment and try again.");
    }
    if (!taskIds.length) {
      throw new Error("At least one final approved Task Report is required.");
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
          ? `${selectedAssignmentRecord.title} â€” Final Assignment Report`
          : `${selectedAssignmentRecord.title} â€” Progress Report â€” ${new Date().toLocaleDateString("en-KE", { month: "long", year: "numeric" })}`;

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
      setAssignmentNotice(message);
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
    await api.submitAssignmentReport(token, documentId, {
      reviewerId,
      reviewDueDate: null,
      comments,
    });
    if (selectedAssignmentId)
      setWorkspaceDocuments(
        await api.generatedDocuments(token, "Assignment", selectedAssignmentId),
      );
    await refreshNotifications();
    setAssignmentNotice("Assignment report submitted to the assigned reviewer.");
  };
  const reviewAssignmentReportDecision = async (
    documentId: string,
    decision: "Changes Requested" | "Rejected" | "Approved",
    comments: string,
  ) => {
    await api.reviewAssignmentReport(token, documentId, decision, comments);
    if (selectedAssignmentId)
      setWorkspaceDocuments(
        await api.generatedDocuments(token, "Assignment", selectedAssignmentId),
      );
    await resolveActionNotifications("generated_document", documentId);
    setAssignmentNotice(
      decision === "Approved"
        ? "Assignment report approved. The assigned reviewer can now generate the final repository copy."
        : decision === "Rejected"
          ? "Assignment report rejected. The rejected version remains in review history and cannot be finalized."
          : "Changes requested. The report has been returned for revision.",
    );
  };
  const finalizeAssignmentReport = async (documentId: string) => {
    const result = await api.finalizeAssignmentReport(token, documentId);
    if (selectedAssignmentId) {
      const [documents, assignments] = await Promise.all([
        api.generatedDocuments(token, "Assignment", selectedAssignmentId),
        api.assignments(token),
      ]);
      setWorkspaceDocuments(documents);
      setAssignmentRows(assignments);
    }
    await refreshNotifications();
    setAssignmentNotice(
      `Final Assignment Report published to the Document Repository as â€œ${result.repository_document_title}â€.`,
    );
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
        `${builderFelixAction} for the controlled ${builderDocument.context} document section "${builderSection.title}". Return a suggestion only; do not claim to edit, approve, or publish it. Use approved App2 evidence when evidence is needed and identify any evidence gap.\n\nCurrent section:\n${builderContent}`,
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
      const message = `${sourceType === "Research" ? "Document" : "Report"} â€œ${file.name}â€ attached successfully.`;
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

  const deadlineState = (
    dateValue: string | null | undefined,
    statusValue?: string,
  ) => {
    if (statusValue === "Completed") return "completed";
    if (!dateValue) return "new";
    const dateOnly =
      String(dateValue).match(/^\d{4}-\d{2}-\d{2}/)?.[0] || String(dateValue);
    const due = new Date(`${dateOnly}T23:59:59`);
    if (Number.isNaN(due.getTime())) return "new";
    const days = (due.getTime() - Date.now()) / 86400000;
    if (days < 0) return "overdue";
    if (days <= 7) return "almost-due";
    return "new";
  };

  const deadlineLabel = (
    dateValue: string | null | undefined,
    statusValue?: string,
  ) => {
    const state = deadlineState(dateValue, statusValue);
    if (state === "completed") return "Completed";
    if (state === "overdue") return "Overdue";
    if (state === "almost-due") return "Almost due";
    return "On track";
  };

  const matchesDeadlineFilter = (
    filter: string,
    dateValue: string | null | undefined,
    statusValue?: string,
  ) => {
    if (filter === "All") return true;
    const state = deadlineState(dateValue, statusValue);
    if (filter === "On Track") return state === "new";
    if (filter === "Almost Due") return state === "almost-due";
    if (filter === "Overdue") return state === "overdue";
    if (filter === "Completed") return state === "completed";
    return statusValue === filter;
  };

  const dashboardDeadlineStats: [IconName, string, number, string, string][] = [
    [
      "assignments",
      "On Track Assignments",
      assignmentRows.filter(
        (item) => deadlineState(item.due_date, item.status) === "new",
      ).length,
      "deadline-green",
      "Assignments",
    ],
    [
      "clock",
      "Almost Due Assignments",
      assignmentRows.filter(
        (item) => deadlineState(item.due_date, item.status) === "almost-due",
      ).length,
      "deadline-orange",
      "Assignments",
    ],
    [
      "warning",
      "Overdue Assignments",
      assignmentRows.filter(
        (item) => deadlineState(item.due_date, item.status) === "overdue",
      ).length,
      "deadline-red",
      "Assignments",
    ],
    [
      "research",
      "On Track Research",
      researchRows.filter(
        (project) =>
          project.status !== "Archived" &&
          deadlineState(project.end_date, project.status) === "new",
      ).length,
      "deadline-green",
      "Research Repository",
    ],
    [
      "clock",
      "Almost Due Research",
      researchRows.filter(
        (project) =>
          project.status !== "Archived" &&
          deadlineState(project.end_date, project.status) === "almost-due",
      ).length,
      "deadline-orange",
      "Research Repository",
    ],
    [
      "warning",
      "Overdue Research",
      researchRows.filter(
        (project) =>
          project.status !== "Archived" &&
          deadlineState(project.end_date, project.status) === "overdue",
      ).length,
      "deadline-red",
      "Research Repository",
    ],
  ];

  const dashboardNow = new Date();
  const actionRequiredNotifications = notifications
    .filter((item) => {
      if (item.read_at) return false;
      const text = `${item.title} ${item.body}`;
      if (
        !/(review|approve|approval|changes requested|correction|overdue|due|assigned|responsible|action required|attention)/i.test(
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
  const dashboardMonth = dashboardNow.getMonth();
  const dashboardYear = dashboardNow.getFullYear();
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
  const completedThisMonth = assignmentRows.filter((item) => {
    if (item.status !== "Completed" || !item.updated_at) return false;
    const updated = new Date(item.updated_at);
    return (
      updated.getFullYear() === dashboardYear &&
      updated.getMonth() === dashboardMonth
    );
  });
  const myDashboardAssignments = assignmentRows.filter(
    (item) =>
      item.members.some((member) => member.name === user?.name) || !isManager,
  );
  const riskDashboardAssignments = activeDashboardAssignments.filter(
    (item) =>
      ["Critical", "High"].includes(item.priority) ||
      ["Blocked", "Overdue"].includes(item.status) ||
      overdueDashboardAssignments.some((overdue) => overdue.id === item.id),
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
  const dashboardAttentionAssignments = isManager
    ? managerAttentionAssignments
    : myDashboardAssignments;
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
  const dashboardWorkload = (
    team.length
      ? team
      : assignmentRows
          .flatMap((item) => item.members)
          .map((member) => ({
            ...member,
            email: "",
            initials: initialsFor(member.name),
            rights: [],
            division: "",
            active: 0,
            completed: 0,
            status: "Available" as const,
          }))
  ).reduce<
    Record<
      string,
      {
        name: string;
        division: string;
        active: number;
        overdue: number;
        dueSoon: number;
      }
    >
  >(
    (result, member) => {
      if (!result[member.name])
        result[member.name] = {
          name: member.name,
          division: "division" in member ? member.division : "",
          active: 0,
          overdue: 0,
          dueSoon: 0,
        };
      const memberAssignments = activeDashboardAssignments.filter((item) =>
        item.members.some((person) => person.name === member.name),
      );
      result[member.name].active = memberAssignments.length;
      result[member.name].overdue = memberAssignments.filter((item) => {
        const days = dashboardDaysUntilDue(item.due_date);
        return days !== null && days < 0;
      }).length;
      result[member.name].dueSoon = memberAssignments.filter((item) => {
        const days = dashboardDaysUntilDue(item.due_date);
        return days !== null && days >= 0 && days <= 7;
      }).length;
      return result;
    },
    {},
  );

  const isResearcherDashboard = user?.role === "Research Officer";
  const isReviewerDashboard = user?.role === "Reviewer";
  const personalDashboardTasks = (dashboardData?.myWork || []).filter(
    (item) => item.type === "Task",
  );
  const personalDashboardReviews = (dashboardData?.myWork || []).filter(
    (item) => item.type === "Review",
  );
  const personalDashboardFinalizations = (dashboardData?.myWork || []).filter(
    (item) => item.type === "Finalization",
  );
  const personalTaskDeadlines = (dashboardData?.deadlines || []).filter(
    (item) => item.type === "Task",
  );
  const personalReviewDeadlines = (dashboardData?.deadlines || []).filter(
    (item) => item.type === "Review",
  );
  const dashboardReviewNotifications = notifications.filter((item) =>
    /(review|changes requested|approved|approval)/i.test(
      `${item.title} ${item.body}`,
    ),
  );
  const researcherDueSoonCount = personalTaskDeadlines.filter(
    (item) => typeof item.days === "number" && item.days >= 0 && item.days <= 7,
  ).length;
  const researcherOverdueCount = personalTaskDeadlines.filter(
    (item) => typeof item.days === "number" && item.days < 0,
  ).length;
  const researcherAwaitingReviewCount = personalDashboardTasks.filter(
    (item) => item.status === "Ready for Review",
  ).length;
  const reviewerDueSoonCount = personalReviewDeadlines.filter(
    (item) => typeof item.days === "number" && item.days >= 0 && item.days <= 7,
  ).length;
  const reviewerOverdueCount = personalReviewDeadlines.filter(
    (item) => typeof item.days === "number" && item.days < 0,
  ).length;
  const reviewerInProgressCount = personalDashboardReviews.filter(
    (item) => item.status === "Under Review",
  ).length;
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
  const openContextualTaskReview = async (taskId: string) => {
    const context = await api.taskReviewContext(token, taskId);

    setActive("Assignments");
    setAssignmentRows((current) => {
      const withoutCurrent = current.filter((item) => item.id !== context.assignment.id);
      return [...withoutCurrent, context.assignment];
    });
    setSelectedAssignment(context.assignment.title);
    setSelectedAssignmentId(context.assignment.id);
    setBuilderCreate((current) => ({ ...current, title: context.assignment.title }));
    setAssignmentWorkspaceTab("Tasks");

    // A contextual task reviewer gets only the explicitly assigned review item.
    // Do not load assignment-wide tasks, comments, history, attachments or reviews.
    setAssignmentTasks([context.task]);
    setAssignmentReviews([]);
    setAssignmentTaskRequests([]);
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
    reviewKind?: "Task Report" | "Generated Document" | "Knowledge" | null;
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

    // Preserve the existing modules for document/repository reviews.
    navigateTo(item.destination);
  };

  const openDashboardMetric = (label: string, destination: string) => {
    const key =
      label === "Active Tasks"
        ? "active-tasks"
        : label === "Due Soon"
          ? isResearcherDashboard
            ? "task-due-soon"
            : isReviewerDashboard
              ? "review-due-soon"
              : "assignment-due-soon"
          : label === "Overdue"
            ? isResearcherDashboard
              ? "task-overdue"
              : isReviewerDashboard
                ? "review-overdue"
                : "assignment-overdue"
            : label === "Awaiting Review"
              ? "task-awaiting-review"
              : label === "My Reviews" || label === "Waiting for Review"
                ? "my-reviews"
                : label === "Final Reports"
                  ? "my-finalizations"
                : label === "In Review"
                  ? "reviews-in-progress"
                  : label === "Review Notices"
                    ? "review-notices"
                    : label === "Active Assignments"
                      ? "active-assignments"
                      : label === "Document Reviews"
                        ? "document-reviews"
                        : label === "Active Research"
                          ? "active-research"
                          : label === "Awaiting Publication"
                            ? "awaiting-publication"
                            : null;
    if (key) setDashboardActionQueue(key);
    else navigateTo(destination);
  };

  const dashboardQueueTitle = (() => {
    switch (dashboardActionQueue) {
      case "management-attention": return "Assignments needing attention";
      case "active-assignments": return "Active assignments";
      case "assignment-due-soon": return "Assignments due soon";
      case "assignment-overdue": return "Overdue assignments";
      case "active-tasks": return "My active tasks";
      case "task-due-soon": return "My tasks due soon";
      case "task-overdue": return "My overdue tasks";
      case "task-awaiting-review": return "My work awaiting review";
      case "my-reviews": return "My review queue";
      case "my-finalizations": return "Approved reports awaiting final generation";
      case "review-due-soon": return "Reviews due soon";
      case "review-overdue": return "Overdue reviews";
      case "reviews-in-progress": return "Reviews in progress";
      case "review-notices": return "Review notifications";
      case "document-reviews": return "Documents awaiting review";
      case "active-research": return "Active research";
      case "awaiting-publication": return "Documents awaiting publication";
      default: return "Action queue";
    }
  })();

  const dashboardQueueWorkItems = (() => {
    if (dashboardActionQueue === "active-tasks") return personalDashboardTasks;
    if (dashboardActionQueue === "task-due-soon") return personalTaskDeadlines.filter((item) => typeof item.days === "number" && item.days >= 0 && item.days <= 7);
    if (dashboardActionQueue === "task-overdue") return personalTaskDeadlines.filter((item) => typeof item.days === "number" && item.days < 0);
    if (dashboardActionQueue === "task-awaiting-review") return personalDashboardTasks.filter((item) => item.status === "Ready for Review");
    if (dashboardActionQueue === "my-reviews") return personalDashboardReviews;
    if (dashboardActionQueue === "my-finalizations") return personalDashboardFinalizations;
    if (dashboardActionQueue === "review-due-soon") return personalReviewDeadlines.filter((item) => typeof item.days === "number" && item.days >= 0 && item.days <= 7);
    if (dashboardActionQueue === "review-overdue") return personalReviewDeadlines.filter((item) => typeof item.days === "number" && item.days < 0);
    if (dashboardActionQueue === "reviews-in-progress") return personalDashboardReviews.filter((item) => item.status === "Under Review");
    return [];
  })();

  const dashboardQueueAssignments = (() => {
    if (dashboardActionQueue === "management-attention") return dashboardAttentionAssignments;
    if (dashboardActionQueue === "active-assignments") return activeDashboardAssignments;
    if (dashboardActionQueue === "assignment-due-soon") return dueSoonDashboardAssignments;
    if (dashboardActionQueue === "assignment-overdue") return overdueDashboardAssignments;
    return [];
  })();

  const dashboardQueueDocumentReviews = dashboardActionQueue === "document-reviews" || dashboardActionQueue === "awaiting-publication"
    ? reviewRows
    : [];
  const dashboardQueueResearch = dashboardActionQueue === "active-research"
    ? researchRows.filter((item) => !["Completed", "Archived"].includes(item.status))
    : [];
  const dashboardQueueNotifications = dashboardActionQueue === "review-notices"
    ? dashboardReviewNotifications
    : [];

  const assignmentDisplayStatus = (item: ApiAssignment) =>
    item.workflow_status || item.status;

  const assignmentHealthFor = (
    item: ApiAssignment,
  ): "On Track" | "At Risk" | "Overdue" => {
    if (
      item.status !== "Completed" &&
      deadlineState(item.due_date, item.status) === "overdue"
    )
      return "Overdue";
    if (
      item.status !== "Completed" &&
      (item.priority === "Critical" ||
        item.status === "Ready for Review" ||
        deadlineState(item.due_date, item.status) === "almost-due")
    )
      return "At Risk";
    return "On Track";
  };

  const filteredAssignments = assignmentRows.filter((item) => {
    const text =
      `${item.title} ${item.description} ${item.division}`.toLowerCase();
    const dueState = deadlineState(item.due_date, item.status);
    const matchesDue =
      assignmentDue === "All" ||
      (assignmentDue === "Due Soon" && dueState === "almost-due") ||
      (assignmentDue === "Overdue" && dueState === "overdue") ||
      (assignmentDue === "No Due Date" && !item.due_date);
    return (
      text.includes(assignmentSearch.toLowerCase()) &&
      (assignmentStatus === "All" || item.status === assignmentStatus) &&
      (assignmentPriority === "All" || item.priority === assignmentPriority) &&
      (assignmentDivision === "All" || item.division === assignmentDivision) &&
      (assignmentMember === "All" ||
        item.members.some((member) => member.id === assignmentMember)) &&
      (assignmentHealth === "All" ||
        assignmentHealthFor(item) === assignmentHealth) &&
      (!assignmentMine ||
        item.members.some((member) => member.name === user?.name)) &&
      matchesDue
    );
  });
  const clearAssignmentFilters = () => {
    setAssignmentSearch("");
    setAssignmentStatus("All");
    setAssignmentPriority("All");
    setAssignmentDivision("All");
    setAssignmentMember("All");
    setAssignmentDue("All");
    setAssignmentHealth("All");
    setAssignmentMine(false);
  };

  const uploadKnowledge = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!knowledgeFile || !token)
      return setKnowledgeNotice(
        "Choose a PDF, DOCX, TXT or MD document first.",
      );
    if (
      ["Research", "Assignment", "Task", "App2 Report"].includes(
        knowledgeForm.sourceType,
      ) &&
      !knowledgeForm.originEntityId
    )
      return setKnowledgeNotice("Select the originating App2 record.");
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
        label: "Creating secure App2 record",
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
        category: "Policies & Guidelines",
        tags: "",
        sourceType: "App2 Upload",
        sourceUrl: "",
        originEntityId: "",
        directorate: "",
        documentType: "Document",
        subject: "",
        classification: "INTERNAL",
        felixEnabled: true,
      });
      setKnowledgeNotice(
        "Upload complete. Felix remains separate unless enabled for the approved document.",
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

  const openKnowledge = async (item: KnowledgeItem) => {
    setSelectedKnowledge({
      ...item,
      title: displayFileName(item.title),
      original_name: displayFileName(item.original_name),
    });
    try {
      setKnowledgeVersions(
        (await api.knowledgeVersions(token, item.id)).map((version) => ({
          ...version,
          original_name: displayFileName(version.original_name),
        })),
      );
    } catch (error) {
      setKnowledgeNotice(
        error instanceof Error
          ? error.message
          : "Versions could not be loaded.",
      );
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
  const filteredKnowledge = knowledgeRows
    .map((item) => ({
      ...item,
      title: displayFileName(item.title, "Untitled document"),
      original_name: displayFileName(item.original_name, "No file attached"),
      tags: Array.isArray(item.tags) ? item.tags : [],
    }))
    .filter(
      (item) =>
        `${item.title} ${item.description || ""} ${item.tags.join(" ")}`
          .toLowerCase()
          .includes(knowledgeSearch.toLowerCase()) &&
        (knowledgeCategory === "All" || item.category === knowledgeCategory),
    );
  const saveResearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      researchForm.startDate &&
      researchForm.endDate &&
      researchForm.endDate < researchForm.startDate
    ) {
      alert("Research end date must be on or after its start date.");
      return;
    }
    await api.createResearch(token, {
      ...researchForm,
      startDate: researchForm.startDate || null,
      endDate: researchForm.endDate || null,
      leadId: researchForm.leadId || null,
      assignmentId: researchForm.assignmentId || null,
    });
    setResearchRows(await api.research(token));
    setResearchForm({
      title: "",
      summary: "",
      researchQuestion: "",
      objectives: "",
      methodology: "",
      startDate: "",
      endDate: "",
      leadId: "",
      assignmentId: "",
      collaboratorIds: [],
      reviewerIds: [],
      knowledgeIds: [],
    });
    setResearchFormStep(1);
    setResearchOpen(false);
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
        division: "",
        dueDate: null,
        priority: "Normal",
        memberIds: [],
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
  const refreshDocuments = async () =>
    setDocumentRows((await api.documents(token)).map(normalizeDocument));
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
  const filteredDocuments = documentRows
    .map(normalizeDocument)
    .filter(
      (item) =>
        `${item.title} ${item.description} ${item.category}`
          .toLowerCase()
          .includes(documentSearch.toLowerCase()) &&
        (documentStatus === "All" || item.status === documentStatus),
    );
  const filteredResearchRows = researchRows.filter((project) => {
    const haystack = `${project.title} ${project.summary || ""} ${project.research_question || ""} ${project.lead_name || ""} ${project.collaborators.map((person) => person.name).join(" ")}`.toLowerCase();
    return (
      haystack.includes(researchSearch.trim().toLowerCase()) &&
      (researchStatusFilter === "All" || project.status === researchStatusFilter)
    );
  });
  const filteredExternalResearchRows = externalResearchRows.filter((item) => {
    const haystack = `${item.title} ${item.description || ""} ${item.author || ""} ${item.institution || ""} ${item.directorate || ""} ${item.research_type || ""}`.toLowerCase();
    return haystack.includes(externalResearchSearch.trim().toLowerCase()) &&
      (externalResearchStatusFilter === "All" || item.status === externalResearchStatusFilter);
  });
  const canEditResearchPlan = Boolean(selectedResearch && isManager);
  const canManageResearchTeam = Boolean(
    selectedResearch && (isManager || selectedResearch.lead_id === user?.id),
  );
  const researchAttachedDocuments = selectedResearch
    ? knowledgeRows.filter(
        (item) =>
          item.origin_links?.some(
            (link) =>
              link.type === "research" && link.id === selectedResearch.id,
          ) &&
          !researchRepositoryDocuments.some((linked) => linked.id === item.id),
      )
    : [];
  const researchNextAction = !selectedResearch
    ? null
    : selectedResearch.status === "Planning"
      ? {
          title: "Review the Research Brief",
          detail: "Confirm the research question, objectives, methodology, team and timeline before work begins.",
          label: "Preview Research Brief",
          tab: "Overview" as const,
        }
      : selectedResearch.status === "Active" &&
          !researchReport.some((section) => Boolean(section.content.trim()))
        ? {
            title: "Continue Research Work",
            detail: "Complete the planned work and add the evidence needed for the report.",
            label: "Continue Research Work",
            tab: "Work" as const,
          }
        : selectedResearch.status === "Active"
          ? {
              title: "Build the Research Report",
              detail: "Use approved evidence and completed research work to prepare the controlled report.",
              label: "Open Report Builder",
              tab: "Report" as const,
            }
          : selectedResearch.status === "Under Review"
            ? {
                title: "Review the Submitted Report",
                detail: "The submitted version is locked while the assigned reviewer assesses it.",
                label: "Open Review",
                tab: "Review" as const,
              }
            : {
                title: selectedResearch.status === "Archived" ? "Research archived" : "Research complete",
                detail: "Read the approved output and review the institutional activity record.",
                label: "View Activity",
                tab: "Activity" as const,
              };

  const refreshReviews = async () => {
    if (canReview)
      setReviewRows((await api.documentReviews(token)).map(normalizeDocument));
  };
  const reviewDocumentAction = async (approved: boolean) => {
    if (!reviewDocument) return;
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
      setDocumentNotice(
        approved
          ? "Document approved and published. The author has been notified."
          : "Document rejected and returned for correction. The author has been notified.",
      );
      setReviewDocument(null);
      setRejectionReason("");
    } catch (error) {
      setDocumentNotice(
        error instanceof Error
          ? error.message
          : "Review could not be completed.",
      );
    }
  };
  const assignReviewer = async (item: ReviewItem, reviewerId: string) => {
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
  const exportReportCsv = () => {
    if (!report) return;
    const rows = [
      [
        "Section",
        "Name",
        "Total",
        "Completed / Approved",
        "Rejected / Pending",
      ],
      ...report.assignmentStatuses.map((row) => [
        "Assignments",
        row.status,
        row.total,
        "",
        "",
      ]),
      ...report.divisions.map((row) => [
        "Division",
        row.division,
        row.total,
        row.completed,
        "",
      ]),
      ...report.documentStatuses.map((row) => [
        "Documents",
        row.status,
        row.total,
        "",
        "",
      ]),
      ...report.researchStatuses.map((row) => [
        "Research",
        row.status,
        row.total,
        "",
        "",
      ]),
      ...report.reviewers.map((row) => [
        "Reviewer",
        row.name,
        row.approved + row.rejected + row.pending,
        row.approved,
        `${row.rejected} rejected; ${row.pending} pending`,
      ]),
      ...report.people.map((row) => [
        "Person",
        row.name,
        row.assigned,
        row.completed,
        `${row.overdue} overdue; ${row.completion_rate}% completion`,
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
    link.download = `psc-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setReportNotice("CSV report exported.");
  };
  const filteredUsers = userRows.filter(
    (member) =>
      `${member.name} ${member.email} ${member.division}`
        .toLowerCase()
        .includes(userSearch.toLowerCase()) &&
      (userRoleFilter === "All" || member.role === userRoleFilter),
  );
  const openUserEditor = (member?: ApiUser) => {
    if (member) {
      setUserEditor(member);
      setUserForm({
        name: member.name,
        email: member.email,
        role: member.role,
        division: member.division,
        status: member.status,
        active: member.active,
        temporaryPassword: "",
      });
    } else {
      setUserEditor("new");
      setUserForm({
        name: "",
        email: "",
        role: "Research Officer",
        division: "",
        status: "Available",
        active: true,
        temporaryPassword: "",
      });
    }
    setTemporaryCredential("");
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
          ...(userForm.temporaryPassword
            ? { temporaryPassword: userForm.temporaryPassword }
            : {}),
        });
        setCreatedAccount({
          name: created.name,
          email: created.email,
          password: created.temporary_password,
        });
        setUserNotice("Account created successfully.");
        setUserEditor(null);
      } else if (userEditor) {
        await api.updateUser(token, userEditor.id, {
          name: userForm.name,
          email: userForm.email,
          role: userForm.role,
          division: userForm.division,
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
  const resetMemberPassword = async (member: ApiUser) => {
    if (!canAdministerUsers) {
      setUserNotice(
        "Administrator access only: password resets change account credentials and end existing sessions.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Reset password for ${member.name}?\n\nThis will create a new temporary password and immediately end all existing sessions for this account.`,
    );

    if (!confirmed) return;

    try {
      setTemporaryCredential("");
      setUserNotice(`Resetting ${member.name}'s password...`);
      const result = await api.resetUserPassword(token, member.id);
      setTemporaryCredential(result.temporaryPassword);
      setUserNotice(
        `${member.name}'s password was reset. Existing sessions were ended and the user must change the temporary password after signing in.`,
      );
      setUserRows(await api.users(token));
    } catch (error) {
      setUserNotice(
        error instanceof Error ? error.message : "Password could not be reset.",
      );
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
    setSavingSettings(true);
    setSettingsNotice("");
    try {
      await api.updatePreferences(token, preferenceForm);
      setSettingsData(await api.settings(token));
      setSettingsNotice("Your preferences were saved.");
    } catch (error) {
      setSettingsNotice(
        error instanceof Error
          ? error.message
          : "Preferences could not be saved.",
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
          ? `â€œ${selectedReportSection.title}â€ approved.`
          : status === "Ready for Review"
            ? `â€œ${selectedReportSection.title}â€ sent to ${selectedReportSection.reviewer_name || "the assigned reviewer"} with an action notification.`
            : `â€œ${selectedReportSection.title}â€ returned to ${status}.`,
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
  const saveResearchSectionDraft = async (contentOverride?: string) => {
    if (!selectedResearch || !selectedReportSection) return false;
    const contentToSave =
      typeof contentOverride === "string" ? contentOverride : reportContent;
    try {
      setReportSaving(true);
      const draftStatus: ResearchReportSection["status"] = contentToSave.trim()
        ? "In Progress"
        : "Draft";
      await api.updateResearchReportSection(
        token,
        selectedResearch.id,
        selectedReportSection.id,
        {
          content: contentToSave,
          status: draftStatus,
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
      setResearchWorkspaceNotice(
        `Draft saved for â€œ${selectedReportSection.title}â€. It has not been submitted for review.`,
      );
      return true;
    } catch (error) {
      setResearchWorkspaceNotice(
        error instanceof Error
          ? error.message
          : "The section draft could not be saved.",
      );
      return false;
    } finally {
      setReportSaving(false);
    }
  };

  const submitCompleteResearchReport = async () => {
    if (!selectedResearch || !researchDraftReviewerId) return;
    try {
      setResearchReportSubmitting(true);

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
        title: `${selectedResearch.title} â€” Research Report`,
        reviewerId: researchDraftReviewerId,
      });
      setResearchReportVersions(await api.researchReportVersions(token, selectedResearch.id));
      setResearchReport(await api.researchReport(token, selectedResearch.id));
      const projects = await api.research(token);
      setResearchRows(projects);
      setSelectedResearch(projects.find((item) => item.id === selectedResearch.id) || selectedResearch);
      setResearchActivity(await api.researchActivity(token, selectedResearch.id));
      setNotifications(await api.notifications(token));
      setResearchWorkspaceNotice("Research report submitted as a locked version. The project is now Under Review and awaits the assigned reviewerâ€™s decision.");
    } catch (error) {
      setResearchWorkspaceNotice(error instanceof Error ? error.message : "Research report could not be submitted.");
    } finally {
      setResearchReportSubmitting(false);
    }
  };

  const decideCompleteResearchReport = async (decision: "Approved" | "Changes Requested" | "Rejected") => {
    if (!selectedResearch || !researchReportVersions[0]) return;
    try {
      setResearchReportSubmitting(true);
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
      setResearchActivity(await api.researchActivity(token, selectedResearch.id));
      setNotifications(await api.notifications(token));
      setResearchWorkspaceNotice(decision === "Approved" ? "Research report approved. Final controlled report can now be generated." : decision === "Changes Requested" ? "Changes requested. The submitted version remains locked and a new editable revision is open." : "Research report rejected. The rejected version remains preserved in history.");
    } catch (error) {
      setResearchWorkspaceNotice(error instanceof Error ? error.message : "Reviewer decision could not be recorded.");
    } finally {
      setResearchReportSubmitting(false);
    }
  };

  const markResearchCompleted = async () => {
    if (!selectedResearch) return;
    try {
      setResearchReportSubmitting(true);
      await api.updateResearchStatus(token, selectedResearch.id, "Completed");
      const projects = await api.research(token);
      setResearchRows(projects);
      const refreshed = projects.find((item) => item.id === selectedResearch.id) || selectedResearch;
      setSelectedResearch(refreshed);
      setResearchActivity(await api.researchActivity(token, selectedResearch.id));
      setNotifications(await api.notifications(token));
      setResearchWorkspaceNotice("Research marked completed. The approved report, linked work, evidence and activity history remain retained as the governed research record.");
    } catch (error) {
      setResearchWorkspaceNotice(error instanceof Error ? error.message : "Research could not be marked completed.");
    } finally {
      setResearchReportSubmitting(false);
    }
  };

  if (authLoading)
    return (
      <div className="auth-loading">
        <div className="login-spinner" />
        <strong>Restoring your secure session...</strong>
      </div>
    );

  if (!user) {
    return (
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
            {now.toLocaleDateString("en-KE", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}{" "}
            | {now.toLocaleTimeString("en-KE")}
          </div>
          <p className="login-kicker">MEMBER ACCESS</p>
          <h2>Welcome back</h2>
          <p>Sign in using your official PSC email address.</p>
          <form onSubmit={signIn}>
            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@publicservice.go.ke"
                required
              />
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
          <div className="demo-accounts">
            <strong>Test profiles</strong>
            {demoUsers.map((member) => (
              <button
                key={member.email}
                onClick={() => {
                  setEmail(member.email);
                  setPassword("PSC@2026");
                }}
              >
                <span>{member.initials}</span>
                <div>
                  {member.name}
                  <small>{member.role}</small>
                </div>
              </button>
            ))}
            <p>
              Password for testing: <b>PSC@2026</b>
            </p>
          </div>
        </section>
        {passwordMode === "forgot" && (
          <div className="modal-backdrop" onClick={() => setPasswordMode(null)}>
            <section
              className="profile-modal password-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <button className="close" onClick={() => setPasswordMode(null)}>
                Ã—
              </button>
              <h2>Reset password</h2>
              <p>
                Request a secure, single-use reset for your official PSC
                account.
              </p>
              <form onSubmit={resetPassword}>
                <label>
                  Email address
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </label>
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
                      ? "Preparing reset..."
                      : "Request password reset"}
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
    );
  }

  const currentWorkspace = workspaceMeta[active] || workspaceMeta.Dashboard;

  return (
    <ThemeProvider
      mode={preferenceForm.themeMode}
      accent={preferenceForm.accentColor}
    >
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
                  Boolean(item && roleNavigation[user.role].includes(item[1])),
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
                  {visible.map(([icon, label]) => (
                    <button
                      key={label}
                      title={navigationDescriptions[label]}
                      data-tooltip={navigationDescriptions[label]}
                      aria-current={active === label ? "page" : undefined}
                      className={active === label ? "active" : ""}
                      onClick={() => navigateTo(label)}
                    >
                      <Icon name={icon} />
                      <span>{navigationDisplayLabel(label)}</span>
                      {label === "Notifications" &&
                        notifications.filter((item) => !item.read_at).length >
                          0 && (
                          <b>
                            {
                              notifications.filter((item) => !item.read_at)
                                .length
                            }
                          </b>
                        )}
                    </button>
                  ))}
                </section>
              ) : null;
            })}
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

        <main>
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
                <p>{now.toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} Â· {user.role}</p>
              </> : <>
                <h1>RESEARCH DEPARTMENT</h1>
                <p>ASSIGNMENT & KNOWLEDGE MANAGEMENT SYSTEM</p>
              </>}
            </div>
            <div className="header-actions">
              {active === "Dashboard" && <div className="header-dashboard-live">
                <span className={dashboardRefreshState === "failed" ? "failed" : "live"}><i/>{dashboardRefreshState === "failed" ? "Refresh failed" : "Live"}</span>
                <small>{dashboardData ? `Updated ${new Date(dashboardData.generatedAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}` : "Loading..."}</small>
                <button onClick={refreshDashboard} disabled={dashboardRefreshState === "refreshing"}>{dashboardRefreshState === "refreshing" ? "Refreshing..." : "Refresh"}</button>
              </div>}
              <div className="live-time">
                <span>
                  {now.toLocaleDateString("en-KE", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <strong>
                  {now.toLocaleTimeString("en-KE", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </strong>
              </div>
              <label className="header-search">
                <Icon name="search" />
                <input
                  aria-label="Search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                />
              </label>
              <button
                className="notification-button"
                aria-label="Notifications"
                data-tooltip="Open notifications about document assignments, approvals, rejections and other system activity."
                onClick={() => setActive("Notifications")}
              >
                <Icon name="bell" />
                {notifications.filter((item) => !item.read_at).length > 0 && (
                  <b>{notifications.filter((item) => !item.read_at).length}</b>
                )}
              </button>
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
                <span>âŒ„</span>
              </button>
            </div>
          </header>

          <div
            className={`dashboard-content ${active === "Dashboard" ? "dashboard-active" : active === "Assignments" ? "assignments-active" : active === "Document Repository" || active === "Documents" ? "documents-active" : active === "Research Repository" ? "research-active" : active === "AI Researcher" ? "ai-research-active" : active === "Felix Administration" ? "felix-admin-active" : active === "Notifications" ? "notifications-active" : active === "Notice Board" ? "notice-board-active" : active === "Calendar" ? "calendar-active" : active === "Reports & Analytics" ? "reports-active" : active === "Team & Users" ? "users-active" : active === "Audit Logs" ? "audit-active" : active === "Settings" ? "settings-active" : ""}`}
          >
            {active !== "Profile" && active !== "Dashboard" && (
              <WorkspaceHeader
                eyebrow={active === "Dashboard" ? "APP2" : "WORKSPACE"}
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
                      user?.role === "Administrator",
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
                    user?.role === "Administrator" && (
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
                              ? `${emailDelivery.host}:${emailDelivery.port}  |  ${emailDelivery.from}`
                              : "Add approved SMTP credentials to backend/.env, install nodemailer, and restart the backend."}
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
                      {user?.role === "Administrator" && (
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
                                : "App2 will continue creating in-app notifications only."}
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
                              Keep a notification copy inside App2 for
                              assignments, reviews and decisions.
                            </small>
                          </span>
                        </label>
                        <div className="email-event-list">
                          <strong>Email events</strong>
                          <ul>
                            <li>New assignment or reassignment</li>
                            <li>Upcoming due date and overdue work</li>
                            <li>Document review request</li>
                            <li>Approval, rejection or correction request</li>
                            <li>Password and account security notice</li>
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
                      {user?.role === "Administrator" && (
                        <form
                          className="settings-panel system-settings"
                          onSubmit={saveSystemSettings}
                        >
                          <header>
                            <div>
                              <p>ADMINISTRATOR</p>
                              <h3>Organization defaults</h3>
                            </div>
                            <span data-tooltip="Shared labels and document classifications used throughout App2.">
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
                          ["Dark", "Light", "System", "Gold Grey", "Navy Blue"] as const
                        ).map((theme) => (
                          <button
                            type="button"
                            className={
                              preferenceForm.themeMode === theme
                                ? "selected"
                                : ""
                            }
                            onClick={() =>
                              setPreferenceForm({
                                ...preferenceForm,
                                themeMode: theme,
                              })
                            }
                            key={theme}
                          >
                            <i
                              className={`theme-preview ${theme.toLowerCase().replaceAll(" ", "-")}`}
                            />
                            <strong>{theme}</strong>
                            <small>
                              {theme === "Navy Blue"
                                ? "Low-contrast, eye-friendly navy"
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
                            onClick={() =>
                              setPreferenceForm({
                                ...preferenceForm,
                                accentColor: accent,
                              })
                            }
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
                          onChange={(event) =>
                            setPreferenceForm({
                              ...preferenceForm,
                              compactLayout: event.target.checked,
                            })
                          }
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
                    user?.role === "Administrator" && (
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
                                Record App2 as undergoing planned maintenance.
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
                    user?.role === "Administrator" && (
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
                              Back up App2 and PostgreSQL before applying an
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
            <section className="user-management-view">
              <div className="assignment-page-head">
                <div>
                  <p>USER & ROLE MANAGEMENT</p>
                  <h2>People, access and workload</h2>
                  <span>
                    Manage active accounts, organizational roles, divisions and
                    secure access.
                  </span>
                </div>
                {canAdministerUsers ? (
                  <button onClick={() => openUserEditor()}>
                    + Create account
                  </button>
                ) : isManager ? (
                  <span className="user-admin-access-note">
                    Administrator access only
                  </span>
                ) : null}
              </div>
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
                        "Administrator",
                        "Research Manager",
                        "Research Officer",
                        "Reviewer",
                      ].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                    <span>{filteredUsers.length} people</span>
                  </div>
                  {isManager && !canAdministerUsers && (
                    <div className="session-message">
                      <strong>Directory & workload view.</strong>{" "}
                      Account credentials, roles, activation and password resets
                      require an Administrator.
                    </div>
                  )}
                  {userNotice && (
                    <div className="session-message">{userNotice}</div>
                  )}
                  {temporaryCredential && (
                    <div className="temporary-credential">
                      <div>
                        <strong>Temporary password â€” copy now</strong>
                        <span>{temporaryCredential}</span>
                        <small>
                          Existing sessions have been ended. Share this password
                          through an approved secure channel. The user must change
                          it after signing in. It is not stored in readable form.
                        </small>
                      </div>
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(temporaryCredential)
                        }
                      >
                        Copy password
                      </button>
                      <button onClick={() => setTemporaryCredential("")}>
                        Dismiss
                      </button>
                    </div>
                  )}
                  <div className="user-table">
                    <div className="user-table-head">
                      <span>Member</span>
                      <span>Role & division</span>
                      <span>Workload</span>
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
                        </div>
                        <div>
                          <strong>
                            {member.active_assignments || 0} active
                          </strong>
                          <small>
                            {member.completed_assignments || 0} completed
                          </small>
                        </div>
                        <span>{member.status}</span>
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
                          {canAdministerUsers ? (
                            <>
                              <button
                                data-tooltip="Edit the member's identity, role, division, availability and account status."
                                onClick={() => openUserEditor(member)}
                              >
                                Edit account
                              </button>
                              <button
                                className="user-reset-password-action"
                                data-tooltip="Create a new temporary password and immediately end all existing sessions for this account."
                                onClick={() => resetMemberPassword(member)}
                              >
                                Reset password
                              </button>
                            </>
                          ) : (
                            <span
                              className="user-view-only"
                              title="Only an Administrator can change account credentials or access."
                            >
                              View only
                            </span>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
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
                    <div className="matrix-table">
                      <div>
                        <b>Capability</b>
                        <b>Administrator</b>
                        <b>Research Manager</b>
                        <b>Reviewer</b>
                        <b>Research Officer</b>
                      </div>
                      {[
                        ["Manage accounts", "âœ“", "âœ“", "-", "-"],
                        ["Create assignments", "âœ“", "âœ“", "-", "-"],
                        ["Approve documents", "âœ“", "âœ“", "âœ“", "-"],
                        ["Manage research", "âœ“", "âœ“", "Review", "Assigned"],
                        ["Reports & analytics", "âœ“", "âœ“", "-", "-"],
                        ["Audit logs", "âœ“", "-", "-", "-"],
                      ].map((row) => (
                        <div key={row[0]}>
                          {row.map((cell, index) => (
                            <span key={`${row[0]}-${index}`}>{cell}</span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </section>
            <Suspense
              fallback={<div className="report-loading">Loading reportsâ€¦</div>}
            >
              <ReportsModule
                token={token}
                active={active === "Reports & Analytics"}
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
            <section className="legacy-reports-management-view">
              <div className="assignment-page-head">
                <div>
                  <p>REPORTS & ANALYTICS</p>
                  <h2>Department performance overview</h2>
                  <span>
                    Live assignment, document, research and reviewer performance
                    from PostgreSQL.
                  </span>
                </div>
                <div className="report-export">
                  <button
                    data-tooltip="Download the currently filtered report as a spreadsheet-compatible CSV file."
                    onClick={exportReportCsv}
                  >
                    Export CSV
                  </button>
                  <button
                    data-tooltip="Open the browser print dialog. Choose Save as PDF to create a PDF report."
                    onClick={() => window.print()}
                  >
                    Print / PDF
                  </button>
                </div>
              </div>
              <div className="report-filters">
                <label>
                  From
                  <input
                    type="date"
                    value={reportFilters.from}
                    onChange={(event) =>
                      setReportFilters({
                        ...reportFilters,
                        from: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={reportFilters.to}
                    onChange={(event) =>
                      setReportFilters({
                        ...reportFilters,
                        to: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Division
                  <select
                    value={reportFilters.division}
                    onChange={(event) =>
                      setReportFilters({
                        ...reportFilters,
                        division: event.target.value,
                      })
                    }
                  >
                    <option value="">All divisions</option>
                    {[
                      ...new Set(assignmentRows.map((item) => item.division)),
                    ].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Assignment status
                  <select
                    value={reportFilters.status}
                    onChange={(event) =>
                      setReportFilters({
                        ...reportFilters,
                        status: event.target.value,
                      })
                    }
                  >
                    <option value="">All statuses</option>
                    {[
                      "Not Started",
                      "In Progress",
                      "Ready for Review",
                      "Completed",
                      "Overdue",
                    ].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={() =>
                    setReportFilters({
                      from: "",
                      to: "",
                      division: "",
                      status: "",
                    })
                  }
                >
                  Clear filters
                </button>
              </div>
              {reportNotice && (
                <div className="session-message">{reportNotice}</div>
              )}
              {report && (
                <>
                  <div className="report-kpis">
                    <article>
                      <span>Total assignments</span>
                      <strong>{report.summary.total}</strong>
                    </article>
                    <article>
                      <span>Completion rate</span>
                      <strong>{report.summary.completion_rate}%</strong>
                    </article>
                    <article>
                      <span>Overdue</span>
                      <strong>{report.summary.overdue}</strong>
                    </article>
                    <article>
                      <span>Pending reviews</span>
                      <strong>{report.summary.pending_reviews}</strong>
                    </article>
                    <article>
                      <span>Builder reviews</span>
                      <strong>
                        {report.summary.generated_document_reviews || 0}
                      </strong>
                    </article>
                    <article>
                      <span>Approved outputs</span>
                      <strong>
                        {report.summary.approved_generated_documents || 0}
                      </strong>
                    </article>
                    <article>
                      <span>Published documents</span>
                      <strong>{report.summary.published_documents}</strong>
                    </article>
                    <article>
                      <span>Active research</span>
                      <strong>{report.summary.active_research}</strong>
                    </article>
                  </div>
                  <div className="report-grid">
                    <article className="report-panel">
                      <header>
                        <h3>Assignment status</h3>
                        <span data-tooltip="Shows how the filtered assignments are distributed across each workflow stage.">
                          What this means
                        </span>
                      </header>
                      {report.assignmentStatuses.map((row) => (
                        <div className="metric-row" key={row.status}>
                          <span>{row.status}</span>
                          <i>
                            <b
                              style={{
                                width: `${Math.max(4, (row.total / Math.max(1, report.summary.total)) * 100)}%`,
                              }}
                            />
                          </i>
                          <strong>{row.total}</strong>
                        </div>
                      ))}
                    </article>
                    <article className="report-panel">
                      <header>
                        <h3>Six-month trend</h3>
                        <span data-tooltip="Created shows new assignments opened each month; completed shows assignments whose current status is Completed.">
                          How to read
                        </span>
                      </header>
                      <div className="trend-chart">
                        {report.trends.map((row) => (
                          <div key={row.month}>
                            <span>
                              <i
                                style={{
                                  height: `${Math.max(8, row.created * 14)}px`,
                                }}
                              />
                              <i
                                className="completed"
                                style={{
                                  height: `${Math.max(5, row.completed * 14)}px`,
                                }}
                              />
                            </span>
                            <small>{row.month.split(" ")[0]}</small>
                            <b>
                              {row.created}/{row.completed}
                            </b>
                          </div>
                        ))}
                      </div>
                    </article>
                    <article className="report-panel">
                      <header>
                        <h3>Documents</h3>
                        <span data-tooltip="Tracks documents at every stage, including items waiting for approval, published records and rejected submissions.">
                          Status guide
                        </span>
                      </header>
                      {report.documentStatuses.map((row) => (
                        <div className="simple-metric" key={row.status}>
                          <span>{row.status}</span>
                          <strong>{row.total}</strong>
                        </div>
                      ))}
                    </article>
                    <article className="report-panel">
                      <header>
                        <h3>Research portfolio</h3>
                        <span data-tooltip="Shows live research projects grouped by their current lifecycle status.">
                          Status guide
                        </span>
                      </header>
                      {report.researchStatuses.map((row) => (
                        <div className="simple-metric" key={row.status}>
                          <span>{row.status}</span>
                          <strong>{row.total}</strong>
                        </div>
                      ))}
                    </article>
                  </div>
                  <div className="report-panel reviewer-report">
                    <header>
                      <h3>Reviewer performance and workload</h3>
                      <span data-tooltip="Approved and rejected count recorded decisions in the selected period. Pending is the reviewer's current assigned queue.">
                        Metric definitions
                      </span>
                    </header>
                    <div className="reviewer-table">
                      <div>
                        <b>Reviewer</b>
                        <b>Approved</b>
                        <b>Rejected</b>
                        <b>Pending</b>
                      </div>
                      {report.reviewers.map((row) => (
                        <div key={row.id}>
                          <strong>{row.name}</strong>
                          <span>{row.approved}</span>
                          <span>{row.rejected}</span>
                          <span>{row.pending}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="report-panel people-performance">
                    <header>
                      <h3>Performance per person</h3>
                      <span data-tooltip="Completion percentage is completed assignments divided by assignments allocated to the person. Overdue includes work marked Overdue or past its due date.">
                        How performance is calculated
                      </span>
                    </header>
                    <div className="people-chart">
                      {report.people.map((person) => (
                        <article key={person.id}>
                          <div>
                            <strong>{person.name}</strong>
                            <small>
                              {person.role} | {person.division}
                            </small>
                          </div>
                          <div className="person-bar">
                            <i>
                              <b
                                style={{ width: `${person.completion_rate}%` }}
                              />
                            </i>
                            <strong>{person.completion_rate}%</strong>
                          </div>
                          <dl>
                            <div>
                              <dt>Assigned</dt>
                              <dd>{person.assigned}</dd>
                            </div>
                            <div>
                              <dt>Completed</dt>
                              <dd>{person.completed}</dd>
                            </div>
                            <div
                              className={person.overdue ? "has-overdue" : ""}
                            >
                              <dt>Overdue</dt>
                              <dd>{person.overdue}</dd>
                            </div>
                          </dl>
                        </article>
                      ))}
                    </div>
                  </div>
                  <div className="report-panel division-report">
                    <header>
                      <h3>Performance by division</h3>
                      <span data-tooltip="Compares total assignments created by each division with how many are currently completed.">
                        Metric definitions
                      </span>
                    </header>
                    {report.divisions.map((row) => (
                      <div className="metric-row" key={row.division}>
                        <span>{row.division}</span>
                        <i>
                          <b
                            style={{
                              width: `${Math.max(4, (row.completed / Math.max(1, row.total)) * 100)}%`,
                            }}
                          />
                        </i>
                        <strong>
                          {row.completed}/{row.total}
                        </strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
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
              <NoticeBoardWorkspace
                rows={noticeRows}
                form={noticeForm}
                setForm={setNoticeForm}
                notice={noticeNotice}
                isManager={isManager}
                token={token}
                onRowsChange={setNoticeRows}
                onSubmit={submitNotice}
                onReview={(item) => {
                  setReviewingNotice(item);
                  setNoticeReason("");
                }}
                onDelete={deleteNotice}
              />
              {noticeNotice && (
                <div className="session-message">{noticeNotice}</div>
              )}
              <NoticeComposer
                form={noticeForm}
                setForm={setNoticeForm}
                onSubmit={submitNotice}
              />
              <div className="notice-board-grid">
                <form className="notice-composer" onSubmit={submitNotice}>
                  <h3>Submit a public notice</h3>
                  <label>
                    Title
                    <input
                      value={noticeForm.title}
                      onChange={(event) =>
                        setNoticeForm({
                          ...noticeForm,
                          title: event.target.value,
                        })
                      }
                      minLength={3}
                      maxLength={200}
                      required
                    />
                  </label>
                  <label>
                    Information
                    <textarea
                      value={noticeForm.body}
                      onChange={(event) =>
                        setNoticeForm({
                          ...noticeForm,
                          body: event.target.value,
                        })
                      }
                      minLength={3}
                      maxLength={4000}
                      required
                    />
                  </label>
                  <div className="form-pair">
                    <label>
                      Importance
                      <select
                        value={noticeForm.severity}
                        onChange={(event) =>
                          setNoticeForm({
                            ...noticeForm,
                            severity: event.target.value,
                          })
                        }
                      >
                        <option>Information</option>
                        <option>Important</option>
                        <option>Urgent</option>
                      </select>
                    </label>
                    <label>
                      Audience
                      <select
                        value={noticeForm.audienceRole}
                        onChange={(event) =>
                          setNoticeForm({
                            ...noticeForm,
                            audienceRole: event.target.value,
                          })
                        }
                      >
                        <option value="">All members</option>
                        {[
                          "Administrator",
                          "Research Manager",
                          "Research Officer",
                          "Reviewer",
                        ].map((role) => (
                          <option key={role}>{role}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="form-pair">
                    <label>
                      Event starts (optional)
                      <input
                        type="datetime-local"
                        value={noticeForm.eventStart}
                        onChange={(event) =>
                          setNoticeForm({
                            ...noticeForm,
                            eventStart: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Event ends (optional)
                      <input
                        type="datetime-local"
                        value={noticeForm.eventEnd}
                        min={noticeForm.eventStart}
                        onChange={(event) =>
                          setNoticeForm({
                            ...noticeForm,
                            eventEnd: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                  <button className="settings-save">Submit for approval</button>
                </form>
                <div className="notice-list">
                  <h3>Published notices</h3>
                  {noticeRows
                    .filter((item) => item.status === "Published")
                    .map((item) => (
                      <article
                        className={item.severity.toLowerCase()}
                        key={item.id}
                      >
                        <header>
                          <b>{item.severity}</b>
                          <time>
                            {new Date(item.created_at).toLocaleString("en-KE")}
                          </time>
                        </header>
                        <h4>{item.title}</h4>
                        <p>{item.body}</p>
                        <small>
                          Posted by {item.created_by_name}
                          {item.event_start
                            ? `  |  Event ${new Date(item.event_start).toLocaleString("en-KE")}`
                            : ""}
                        </small>
                      </article>
                    ))}
                  {!noticeRows.some((item) => item.status === "Published") && (
                    <p className="queue-empty">
                      No approved notices are currently published.
                    </p>
                  )}
                </div>
              </div>
              {isManager && (
                <section className="notice-approval">
                  <h3>Approval queue</h3>
                  {noticeRows
                    .filter((item) => item.status === "Pending Approval")
                    .map((item) => (
                      <article key={item.id}>
                        <div>
                          <strong>{item.title}</strong>
                          <small>
                            {item.created_by_name} | {item.severity}
                          </small>
                          <p>{item.body}</p>
                        </div>
                        <button
                          onClick={() => {
                            setReviewingNotice(item);
                            setNoticeReason("");
                          }}
                        >
                          Review
                        </button>
                      </article>
                    ))}
                  {!noticeRows.some(
                    (item) => item.status === "Pending Approval",
                  ) && (
                    <p className="queue-empty">
                      No notices are awaiting approval.
                    </p>
                  )}
                </section>
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
                <CalendarView
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
                />
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
                  {notifications.filter((item) => !item.read_at).length} unread
                </b>
              </div>
              <NotificationCenter
                items={notifications}
                loading={notificationsLoading}
                onOpen={openNotification}
                onNavigate={navigateNotification}
                onMarkAll={markAllNotificationsRead}
                onRefresh={refreshNotifications}
              />
              <div className="notification-list legacy-notification-list">
                {notifications.map((item) => (
                  <button
                    className={item.read_at ? "read" : "unread"}
                    key={item.id}
                    onClick={async () => {
                      if (!item.read_at) {
                        await api.readNotification(token, item.id);
                        setNotifications(await api.notifications(token));
                      }
                      await navigateNotification(item);
                    }}
                  >
                    <Icon name="notifications" />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.body}</small>
                      <time>
                        {new Date(item.created_at).toLocaleString("en-KE")}
                      </time>
                    </span>
                  </button>
                ))}
                {!notifications.length && (
                  <div className="assignment-empty">
                    <Icon name="notifications" />
                    <h3>No notifications yet</h3>
                    <p>
                      Assignments, research reviews and Notice Board activity
                      will appear here.
                    </p>
                  </div>
                )}
              </div>
            </section>
            <section className="document-management-view">
              <div className="assignment-page-head">
                <div>
                  <p>CENTRAL REPOSITORY</p>
                  <h2>Document Repository</h2>
                  <span>
                    One controlled home for evidence, reports, policies,
                    versions, reviews, publication and retention.
                  </span>
                </div>
                <button onClick={openKnowledgeUpload}>+ Add document</button>
              </div>
              <div className="repository-summary">
                <button
                  className={documentStatus === "All" ? "active" : ""}
                  onClick={() => setDocumentStatus("All")}
                >
                  <strong>{documentRows.length}</strong>
                  <span>All documents</span>
                </button>
                <button
                  className={documentStatus === "Published" ? "active" : ""}
                  onClick={() => setDocumentStatus("Published")}
                >
                  <strong>
                    {
                      documentRows.filter((item) => item.status === "Published")
                        .length
                    }
                  </strong>
                  <span>Published</span>
                </button>
                <button
                  className={
                    documentStatus === "Pending Approval" ? "active" : ""
                  }
                  onClick={() => setDocumentStatus("Pending Approval")}
                >
                  <strong>{reviewRows.length}</strong>
                  <span>Awaiting review</span>
                </button>
                <button
                  className={documentStatus === "Draft" ? "active" : ""}
                  onClick={() => setDocumentStatus("Draft")}
                >
                  <strong>
                    {
                      documentRows.filter((item) =>
                        ["Draft", "Rejected"].includes(item.status),
                      ).length
                    }
                  </strong>
                  <span>Drafts & changes</span>
                </button>
                <button
                  className={documentStatus === "Archived" ? "active" : ""}
                  onClick={() => setDocumentStatus("Archived")}
                >
                  <strong>
                    {
                      documentRows.filter((item) => item.status === "Archived")
                        .length
                    }
                  </strong>
                  <span>Archived</span>
                </button>
              </div>
              <div className="assignment-toolbar">
                <label>
                  <Icon name="search" />
                  <input
                    value={documentSearch}
                    onChange={(event) => setDocumentSearch(event.target.value)}
                    placeholder="Search title, description or category"
                  />
                </label>
                <select
                  value={documentStatus}
                  onChange={(event) => setDocumentStatus(event.target.value)}
                >
                  {[
                    "All",
                    "Draft",
                    "Pending Approval",
                    "Published",
                    "Rejected",
                    "Archived",
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                <span>{filteredDocuments.length} documents</span>
              </div>
              {documentNotice && (
                <div className="session-message">{documentNotice}</div>
              )}
              {isManager && (
                <section className="deletion-approval-queue">
                  <header>
                    <div>
                      <p>DELETION REQUESTS</p>
                      <h3>
                        {
                          deletionRequests.filter(
                            (item) => item.status === "Pending",
                          ).length
                        }{" "}
                        awaiting manager approval
                      </h3>
                    </div>
                  </header>
                  {deletionRequests
                    .filter((item) => item.status === "Pending")
                    .map((item) => (
                      <article key={item.id}>
                        <div>
                          <strong>{item.knowledge_title}</strong>
                          <small>
                            Requested by {item.requested_by_name} Â·{" "}
                            {new Date(item.created_at).toLocaleDateString(
                              "en-KE",
                            )}
                          </small>
                          <p>{item.reason}</p>
                        </div>
                        <button
                          onClick={() => {
                            setDeletionDecision(item);
                            setDeletionDecisionComments("");
                          }}
                        >
                          Review request
                        </button>
                      </article>
                    ))}
                  {!deletionRequests.some(
                    (item) => item.status === "Pending",
                  ) && (
                    <p className="queue-empty">
                      No document deletion requests are awaiting approval.
                    </p>
                  )}
                </section>
              )}
              {canReview && (
                <section className="review-queue">
                  <header>
                    <div>
                      <p>REVIEW QUEUE</p>
                      <h3>
                        {reviewRows.length} document
                        {reviewRows.length === 1 ? "" : "s"} awaiting a decision
                      </h3>
                    </div>
                    <span data-tooltip="Step 1: open Versions and inspect the latest file. Step 2: assign a reviewer when required. Step 3: approve for publication or reject with clear correction notes.">
                      How review works
                    </span>
                  </header>
                  {reviewRows.map((item) => (
                    <article key={item.id}>
                      <div>
                        <strong>{item.title}</strong>
                        <small>
                          {item.category} | Submitted by {item.created_by_name}
                        </small>
                      </div>
                      {isManager ? (
                        <select
                          aria-label={`Reviewer for ${item.title}`}
                          value={item.reviewer_id || ""}
                          onChange={(event) =>
                            assignReviewer(item, event.target.value)
                          }
                        >
                          <option value="">Unassigned</option>
                          {reviewers.map((reviewer) => (
                            <option key={reviewer.id} value={reviewer.id}>
                              {reviewer.name} | {reviewer.role}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>
                          {item.reviewer_name || "Available to review"}
                        </span>
                      )}
                      <button
                        data-tooltip="Inspect every uploaded version before recording a decision."
                        onClick={() => openDocumentVersions(item)}
                      >
                        Inspect versions
                      </button>
                      <button
                        className="approve"
                        data-tooltip="Open the review form. Approval publishes the latest version and notifies its author."
                        onClick={() => {
                          setReviewDocument(item);
                          setRejectionReason("");
                        }}
                      >
                        Review now
                      </button>
                    </article>
                  ))}
                  {!reviewRows.length && (
                    <p className="queue-empty">
                      The review queue is clear. Newly submitted documents will
                      appear here automatically.
                    </p>
                  )}
                </section>
              )}
              <div className="document-table repository-table">
                <div className="document-table-head">
                  <span>Document</span>
                  <span>Source</span>
                  <span>Status</span>
                  <span>Accountability</span>
                  <span>Retention</span>
                  <span>Felix review</span>
                  <span>Actions</span>
                </div>
                {filteredDocuments.map((item) => (
                  <article key={item.id}>
                    <div className="document-name">
                      <Icon name="documents" />
                      <span>
                        <strong>{item.title}</strong>
                        <small>
                          {item.category} Â· uploaded by {item.created_by_name}
                        </small>
                        <div
                          className={`felix-link-status ${felixLinkState(item).state}`}
                          title={
                            item.felix_index_error || felixLinkState(item).label
                          }
                        >
                          <span>
                            <i
                              style={{
                                width: `${felixLinkState(item).progress}%`,
                              }}
                            />
                          </span>
                          <em>Felix: {felixLinkState(item).label}</em>
                        </div>
                      </span>
                    </div>
                    <div className="repository-source">
                      <b>{item.source_type || "App2 Upload"}</b>
                      {item.origin_links?.map((link) => (
                        <small key={`${link.type}-${link.id}`}>
                          {link.type}: {link.title || link.id}
                        </small>
                      ))}
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
                    <b
                      className={`doc-state ${item.status.toLowerCase().replace(" ", "-")}`}
                    >
                      {item.status}
                    </b>
                    <div className="repository-accountability">
                      <small>
                        <b>Worked:</b>{" "}
                        {item.worked_by?.length
                          ? item.worked_by.join(", ")
                          : item.created_by_name}
                      </small>
                      <small>
                        <b>Reviewed:</b> {item.reviewer_name || "Not reviewed"}
                      </small>
                      <small>
                        <b>Approved:</b>{" "}
                        {item.approved_by_name || "Not approved"}
                      </small>
                    </div>
                    <span>
                      {item.retention_until
                        ? new Date(item.retention_until).toLocaleDateString(
                            "en-KE",
                          )
                        : "Not set"}
                    </span>
                    <button
                      className={`felix-review-link ${item.felix_index_status === "Completed" ? "ready" : ""}`}
                      disabled={item.felix_index_status !== "Completed"}
                      onClick={() => openFelixDocumentReview(item)}
                    >
                      {item.felix_index_status === "Completed"
                        ? "Review with Felix"
                        : "Waiting for Felix"}
                    </button>
                    <div className="document-actions">
                      <button
                        className="approve"
                        onClick={() => setReaderDocument(item)}
                      >
                        Read
                      </button>
                      <button onClick={() => openDocumentVersions(item)}>
                        Versions
                      </button>
                      <button onClick={() => toggleDocumentLock(item)}>
                        {item.locked_by_name ? "Check in" : "Check out"}
                      </button>
                      {isManager && (
                        <button
                          onClick={() => {
                            setRetentionDocument(item);
                            setRetentionDate(item.retention_until || "");
                          }}
                        >
                          Retention
                        </button>
                      )}
                      {canReview && item.status === "Pending Approval" && (
                        <button
                          className="approve"
                          onClick={() => {
                            setReviewDocument(item);
                            setRejectionReason("");
                          }}
                        >
                          Review
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              {!!filteredDocuments.length && (
                <details className="repository-deletion-controls" open>
                  <summary>Document archive and deletion</summary>
                  <p>
                    Archive a document from its card when it should remain in
                    the institutional record. Permanent deletion requires a
                    reason and approval by a Research Manager or Administrator.
                  </p>
                  <div>
                    {filteredDocuments.map((item) => (
                      <article key={item.id}>
                        <span>
                          <strong>{item.title}</strong>
                          <small>
                            {item.status} Â· {item.source_type || "App2 Upload"}
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
                  <h3>No documents found</h3>
                  <p>Upload a document or adjust the filters.</p>
                </div>
              )}
            </section>
            <section className="research-management-view">
              <div className="assignment-page-head research-repository-head">
                <div><p>RESEARCH WORKSPACE</p><h2>Research portfolio</h2><span>Manage active research, evidence, reviews and completed external research from one governed workspace.</span></div>
                <div className="research-repository-actions">
                  {user?.role !== "Reviewer" && <button className="research-import-action" onClick={() => setExternalResearchOpen(true)}>Import external research</button>}
                  {isManager && <button className="research-primary-action" onClick={() => setResearchSourceChoiceOpen(true)}><span aria-hidden="true">+</span> Create research</button>}
                </div>
              </div>
              <div className="research-portfolio-summary" aria-label="Research portfolio summary">
                {[
                  ["Research workspaces", researchRows.length],
                  ["Imported research", externalResearchRows.length],
                  ["Awaiting review", externalResearchRows.filter((item) => ["Pending Review","Resubmitted","Under Review"].includes(item.status)).length + researchRows.filter((item) => item.status === "Under Review").length],
                  ["Completed", externalResearchRows.filter((item) => item.status === "Published").length + researchRows.filter((item) => item.status === "Completed").length],
                ].map(([label, value]) => <article key={String(label)}><small>{label}</small><strong>{value}</strong></article>)}
              </div>
              <div className="research-repository-mode" role="tablist" aria-label="Research record type">
                <button type="button" role="tab" aria-selected={researchRepositoryMode === "Workspace"} className={researchRepositoryMode === "Workspace" ? "active" : ""} onClick={() => setResearchRepositoryMode("Workspace")}>Research Workspaces <b>{researchRows.length}</b></button>
                <button type="button" role="tab" aria-selected={researchRepositoryMode === "Imported"} className={researchRepositoryMode === "Imported" ? "active" : ""} onClick={() => setResearchRepositoryMode("Imported")}>Imported Research <b>{externalResearchRows.length}</b></button>
              </div>
              {researchRepositoryMode === "Workspace" ? <>
                <div className="research-portfolio-toolbar">
                  <label className="research-search-field"><span>Search research</span><input value={researchSearch} onChange={(event) => setResearchSearch(event.target.value)} placeholder="Search by title, question, researcher or keyword"/></label>
                  <label className="research-status-filter"><span>Status</span><select value={researchStatusFilter} onChange={(event) => setResearchStatusFilter(event.target.value)}>{["All", "Planning", "Active", "Under Review", "Completed", "Archived"].map((value) => <option key={value}>{value}</option>)}</select></label>
                  <div className="assignment-view-switch" role="tablist" aria-label="Research portfolio views">{(["List", "Cards"] as const).map((view) => <button type="button" role="tab" aria-selected={researchPortfolioView === view} className={researchPortfolioView === view ? "active" : ""} key={view} onClick={() => { setResearchPortfolioView(view); sessionStorage.setItem("app2-research-view", view); }}>{view}</button>)}</div>
                  <strong>{filteredResearchRows.length} of {researchRows.length}</strong>
                </div>
              <div
                className={`research-grid ${researchPortfolioView === "List" ? "list-view" : "card-view"}`}
                aria-label="Research project portfolio"
              >
                {filteredResearchRows.map((project) => (
                  <article key={project.id}>
                    <span
                      className={`research-status status-${project.status.toLowerCase().replaceAll(" ", "-")}`}
                    >
                      {project.status}
                    </span>

                    <h3>{project.title}</h3>

                    <p>{project.summary}</p>

                    <dl>
                      <div>
                        <dt>Lead</dt>
                        <dd>{project.lead_name}</dd>
                      </div>

                      <div>
                        <dt>Timeline</dt>
                        <dd>
                          {project.start_date
                            ? formatResearchDate(project.start_date)
                            : "Not set"}{" "}
                          â€“ {formatResearchDate(project.end_date)}
                        </dd>
                      </div>
                    </dl>

                    <h4>Research question</h4>

                    <p>{project.research_question || "Not defined"}</p>

                    <div className="research-collaborators">
                      {project.collaborators.map((person) => (
                        <b key={person.id}>{person.name}</b>
                      ))}
                      {!project.collaborators.length && (
                        <small>No collaborators assigned</small>
                      )}
                    </div>

                    <div className="research-card-actions">
                      <button
                        className="research-open-workspace"
                        type="button"
                        onClick={async () => {
                        setSelectedResearch(project);
                        setResearchPlanDraft({
                          summary: project.summary || "",
                          researchQuestion: project.research_question || "",
                          objectives: project.objectives || "",
                          methodology: project.methodology || "",
                          startDate: project.start_date || "",
                          endDate: project.end_date || "",
                        });
                        setResearchTeamDraft({
                          leadId: project.lead_id,
                          collaborators: project.collaborators.map(
                            (person) => ({
                              userId: person.id,
                              role: [
                                "Researcher",
                                "Analyst",
                                "Reviewer",
                                "Subject Matter Expert",
                              ].includes(person.role)
                                ? person.role
                                : "Researcher",
                            }),
                          ),
                        });
                        setResearchTab("Overview");
                        setSelectedReportSection(null);
                        setReportContent("");

                        try {
                          const [
                            comments,
                            report,
                            sources,
                            activityRows,
                            templates,
                            documents,
                          ] = await Promise.all([
                            api.researchComments(token, project.id),
                            api.researchReport(token, project.id),
                            api.researchSources(token, project.id),
                            api.researchActivity(token, project.id),
                            api.documentTemplates(token, "Research"),
                            api.generatedDocuments(
                              token,
                              "Research",
                              project.id,
                            ),
                          ]);

                          setResearchComments(comments);
                          setResearchReport(report);
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
                          }
                        } catch (error) {
                          setResearchComments([]);
                          setResearchReport([]);
                          setSelectedReportSection(null);

                          alert(
                            error instanceof Error
                              ? error.message
                              : "Research workspace could not be loaded.",
                          );
                        }
                        }}
                      >
                        Open workspace <span aria-hidden="true">â†’</span>
                      </button>
                    </div>
                  </article>
                ))}
                {!filteredResearchRows.length && (
                  <div className="assignment-empty research-empty-state">
                    <Icon name="research" />
                    <h3>No research matches these filters</h3>
                    <p>Clear the search or choose a broader status.</p>
                  </div>
                )}
              </div>

              </> : <>
                <div className="research-portfolio-toolbar">
                  <label className="research-search-field"><span>Search imported research</span><input value={externalResearchSearch} onChange={(event) => setExternalResearchSearch(event.target.value)} placeholder="Title, author, institution or topic"/></label>
                  <label className="research-status-filter"><span>Review status</span><select value={externalResearchStatusFilter} onChange={(event) => setExternalResearchStatusFilter(event.target.value)}>{["All","Pending Review","Under Review","Revision Requested","Resubmitted","Published","Rejected"].map((value) => <option key={value}>{value}</option>)}</select></label>
                  <strong>{filteredExternalResearchRows.length} of {externalResearchRows.length}</strong>
                </div>
                <div className="external-research-list" aria-label="Imported research records">
                  {filteredExternalResearchRows.map((item) => <article className="external-research-row" key={item.id}>
                    <div><span className="external-origin-badge">IMPORTED Â· READER ONLY</span><h3>{item.title}</h3><p>{item.description || item.research_type}</p></div>
                    <dl><dt>Submitted by</dt><dd>{item.submitted_by_name}</dd></dl>
                    <dl className="external-hide-tablet"><dt>Reviewer(s)</dt><dd>{item.reviewers?.map((reviewer) => reviewer.name).join(", ") || "Not assigned"}</dd></dl>
                    <dl><dt>Status</dt><dd>{item.status}</dd></dl>
                    <button type="button" onClick={() => setSelectedExternalResearch(item)}>{item.can_review && ["Pending Review","Resubmitted","Under Review"].includes(item.status) ? "Review" : item.status === "Revision Requested" && item.can_upload_revision ? "Open revision" : "Open reader"} â†’</button>
                  </article>)}
                  {!filteredExternalResearchRows.length && <div className="assignment-empty research-empty-state"><Icon name="research"/><h3>No imported research matches these filters</h3><p>Import completed research or adjust the search and review status.</p></div>}
                </div>
              </>}
            </section>
            <section className="ai-research-management-view">
              <div className="assignment-page-head">
                <div>
                  <p>AI RESEARCHER</p>
                  <h2>Evidence-led research workspace</h2>
                  <span>
                    Research approved App2 documents and live local records while
                    keeping every result offline and under human review.
                  </span>
                </div>
                <button onClick={() => setAiResearchOpen(true)}>
                  + Plan research
                </button>
              </div>
              <AIResearchChat
                engine={aiResearchEngine}
                jobs={aiResearchJobs}
                userRole={user.role}
                reviewRequest={felixReviewRequest}
                onAsk={askAiResearch}
                onAction={runFelixAction}
                onListProposals={listChangeProposals}
                onCreateProposal={createChangeProposal}
                onDecideProposal={decideChangeProposal}
              />
              <div className="ai-engine-card">
                <div>
                  <strong>Offline App2 mode</strong>
                  <span>No internet or paid provider. Felix uses local App2 evidence only.</span>
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
                      Create a question and Felix will research approved App2
                      documents using the local AI engine.
                    </p>
                  </div>
                )}
              </div>
            </section>
            {user?.role === "Administrator" && (
              <section className="felix-admin-management-view">
                <FelixAdmin token={token} />
              </section>
            )}
            <section className="knowledge-management-view">
              <div className="assignment-page-head">
                <div>
                  <p>KNOWLEDGE REPOSITORY</p>
                  <h2>Institutional knowledge library</h2>
                  <span>
                    Policies, reports, circulars, research papers, books and
                    reusable templates.
                  </span>
                </div>
                <button onClick={openKnowledgeUpload}>
                  + Upload knowledge
                </button>
              </div>
              <div className="assignment-toolbar">
                <label>
                  <Icon name="search" />
                  <input
                    value={knowledgeSearch}
                    onChange={(event) => setKnowledgeSearch(event.target.value)}
                    placeholder="Search documents, descriptions or tags"
                  />
                </label>
                <select
                  value={knowledgeCategory}
                  onChange={(event) => setKnowledgeCategory(event.target.value)}
                >
                  {[
                    "All",
                    "Policy",
                    "Report",
                    "Circular",
                    "Research Paper",
                    "Book",
                    "Template",
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                <span>{filteredKnowledge.length} items</span>
              </div>
              {knowledgeNotice && (
                <div className="session-message">{knowledgeNotice}</div>
              )}
              <div className="knowledge-library">
                {filteredKnowledge.map((item) => (
                  <article key={item.id}>
                    <div>
                      <Icon name="documents" />
                      <span>{item.category}</span>
                      <em>{item.status}</em>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.description || "No description provided."}</p>
                    <small>
                      {item.original_name} | {Math.ceil(item.size_bytes / 1024)}{" "}
                      KB
                    </small>
                    <div className="tag-row">
                      {item.tags.map((tag) => (
                        <b key={tag}>{tag}</b>
                      ))}
                    </div>
                    <footer>
                      <span>
                        v{item.latest_version} | {item.created_by_name}
                      </span>
                      <button onClick={() => openKnowledge(item)}>
                        Versions & download
                      </button>
                      {canReview && item.status === "Pending Approval" && (
                        <button
                          data-tooltip="Approve and publish this document after reviewing its metadata and latest version."
                          onClick={async () => {
                            await api.approveKnowledge(token, item.id, true);
                            setKnowledgeRows(await api.knowledge(token));
                          }}
                        >
                          Publish
                        </button>
                      )}
                      {isManager && (
                        <button
                          className="reject"
                          data-tooltip="Permanently delete this document and every stored version."
                          onClick={() => removeKnowledge(item)}
                        >
                          Delete
                        </button>
                      )}
                    </footer>
                  </article>
                ))}
              </div>
            </section>
            <section className="assignment-management-view">
              <div className="assignment-phase3">
                <header className="assignment-phase3-head">
                  <div>
                    <p>ASSIGNMENT MANAGEMENT</p>
                    <h2>Institutional work portfolio</h2>
                    <span>
                      Create, allocate, monitor and review permitted
                      assignments.
                    </span>
                  </div>
                  {isManager && (
                    <button onClick={() => startAssignment()}>
                      + New Assignment
                    </button>
                  )}
                </header>
                <div className="assignment-command-bar">
                  <div
                    className="assignment-view-switch"
                    role="tablist"
                    aria-label="Assignment views"
                  >
                    {(["List", "Cards", "Board", "Calendar", "Workload"] as const).map(
                      (view) => (
                        <button
                          role="tab"
                          aria-selected={assignmentView === view}
                          className={assignmentView === view ? "active" : ""}
                          key={view}
                          onClick={() => {
                            setAssignmentView(view);
                            sessionStorage.setItem("app2-assignment-view", view);
                          }}
                        >
                          {view}
                        </button>
                      ),
                    )}
                  </div>
                  <strong>
                    {filteredAssignments.length} of {assignmentRows.length}{" "}
                    assignments
                  </strong>
                </div>
                <div className="assignment-filters">
                  <label className="assignment-filter-search">
                    <span>Search</span>
                    <input
                      value={assignmentSearch}
                      onChange={(event) =>
                        setAssignmentSearch(event.target.value)
                      }
                      placeholder="Reference, title, division or description"
                    />
                  </label>
                  <label>
                    <span>Status</span>
                    <select
                      value={assignmentStatus}
                      onChange={(event) =>
                        setAssignmentStatus(event.target.value)
                      }
                    >
                      {[
                        "All",
                        "Not Started",
                        "In Progress",
                        "Ready for Review",
                        "Completed",
                        "Overdue",
                      ].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Priority</span>
                    <select
                      value={assignmentPriority}
                      onChange={(event) =>
                        setAssignmentPriority(event.target.value)
                      }
                    >
                      {["All", "Low", "Normal", "High", "Critical"].map(
                        (value) => (
                          <option key={value}>{value}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    <span>Division</span>
                    <select
                      value={assignmentDivision}
                      onChange={(event) =>
                        setAssignmentDivision(event.target.value)
                      }
                    >
                      <option>All</option>
                      {[...new Set(assignmentRows.map((item) => item.division))]
                        .sort()
                        .map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                    </select>
                  </label>
                  <label>
                    <span>Team member</span>
                    <select
                      value={assignmentMember}
                      onChange={(event) =>
                        setAssignmentMember(event.target.value)
                      }
                    >
                      <option value="All">All</option>
                      {[
                        ...new Map(
                          assignmentRows
                            .flatMap((item) => item.members)
                            .map((member) => [member.id, member]),
                        ).values(),
                      ]
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((member) => (
                          <option value={member.id} key={member.id}>
                            {member.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    <span>Due</span>
                    <select
                      value={assignmentDue}
                      onChange={(event) =>
                        setAssignmentDue(
                          event.target.value as typeof assignmentDue,
                        )
                      }
                    >
                      {["All", "Due Soon", "Overdue", "No Due Date"].map(
                        (value) => (
                          <option key={value}>{value}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    <span>Health</span>
                    <select
                      value={assignmentHealth}
                      onChange={(event) =>
                        setAssignmentHealth(
                          event.target.value as typeof assignmentHealth,
                        )
                      }
                    >
                      {["All", "On Track", "At Risk", "Overdue"].map(
                        (value) => (
                          <option key={value}>{value}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="my-assignments-filter">
                    <input
                      type="checkbox"
                      checked={assignmentMine}
                      onChange={(event) =>
                        setAssignmentMine(event.target.checked)
                      }
                    />
                    <span>My assignments</span>
                  </label>
                  <button
                    className="clear-assignment-filters"
                    onClick={clearAssignmentFilters}
                  >
                    Clear
                  </button>
                </div>
                {assignmentNotice && (
                  <div className="session-message">{assignmentNotice}</div>
                )}
                {assignmentView === "List" && (
                  <div className="assignment-list-view">
                    <div className="assignment-list-head">
                      <span>Reference / Assignment</span>
                      <span>Division</span>
                      <span>Lead & Team</span>
                      <span>Priority</span>
                      <span>Status</span>
                      <span>Due</span>
                      <span>Health</span>
                      <span>Actions</span>
                    </div>
                    {filteredAssignments.map((item) => {
                      const lead =
                        item.members.find((member) => member.role === "Lead") ||
                        item.members[0];
                      const normalizedDueDate = taskDateValue(item.due_date);
                      const days = normalizedDueDate
                        ? Math.ceil(
                            (new Date(`${normalizedDueDate}T23:59:59`).getTime() -
                              Date.now()) /
                              86400000,
                          )
                        : null;
                      return (
                        <article key={item.id}>
                          <button
                            className="assignment-name-cell"
                            onClick={() => openAssignmentDetails(item)}
                          >
                            <small>{assignmentRef(item.id)}</small>
                            <strong>{item.title}</strong>
                          </button>
                          <span>{item.division}</span>
                          <span>
                            <strong>{lead?.name || "Unassigned"}</strong>
                            <small>
                              {item.members.length} team member
                              {item.members.length === 1 ? "" : "s"}
                            </small>
                          </span>
                          <b
                            className={`assignment-priority ${item.priority.toLowerCase()}`}
                          >
                            {item.priority}
                          </b>
                          <span>{assignmentDisplayStatus(item)}</span>
                          <span>
                            <strong>
                              {item.due_date
                                ? new Date(item.due_date).toLocaleDateString(
                                    "en-KE",
                                  )
                                : "Not set"}
                            </strong>
                            <small>
                              {days === null
                                ? "No deadline"
                                : days < 0
                                  ? `${Math.abs(days)} days overdue`
                                  : days === 0
                                    ? "Due today"
                                    : `${days} days left`}
                            </small>
                          </span>
                          <b
                            className={`assignment-health ${assignmentHealthFor(item).toLowerCase().replaceAll(" ", "-")}`}
                          >
                            {assignmentHealthFor(item)}
                          </b>
                          <div className="assignment-row-actions">
                            <button onClick={() => openAssignmentDetails(item)}>
                              Open workspace
                            </button>
                            {isManager && (
                              <>
                                <button onClick={() => startAssignment(item)}>
                                  Edit
                                </button>
                                <button
                                  className="danger"
                                  onClick={() => removeAssignment(item)}
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </article>
                      );
                    })}
                    {!filteredAssignments.length && (
                      <div className="assignment-empty">
                        <Icon name="assignments" />
                        <h3>No assignments match these filters</h3>
                        <p>Clear the filters or create a new assignment.</p>
                      </div>
                    )}
                  </div>
                )}
                {assignmentView === "Cards" && (
                  <div className="assignment-card-view">
                    {filteredAssignments.map((item) => {
                      const lead =
                        item.members.find((member) => member.role === "Lead") ||
                        item.members[0];
                      return (
                        <article key={item.id}>
                          <header>
                            <small>{assignmentRef(item.id)}</small>
                            <b
                              className={`assignment-priority ${item.priority.toLowerCase()}`}
                            >
                              {item.priority}
                            </b>
                          </header>
                          <button
                            className="assignment-card-title"
                            onClick={() => openAssignmentDetails(item)}
                          >
                            {item.title}
                          </button>
                          <p>{item.description || "No description provided."}</p>
                          <dl>
                            <div><dt>Status</dt><dd>{assignmentDisplayStatus(item)}</dd></div>
                            <div><dt>Health</dt><dd>{assignmentHealthFor(item)}</dd></div>
                            <div><dt>Lead</dt><dd>{lead?.name || "Unassigned"}</dd></div>
                            <div><dt>Due</dt><dd>{item.due_date ? formatResearchDate(item.due_date) : "Not set"}</dd></div>
                          </dl>
                          <footer>
                            <span>
                              {item.division} Â· {item.members.length} team member
                              {item.members.length === 1 ? "" : "s"}
                            </span>
                            <div className="assignment-row-actions">
                              <button onClick={() => openAssignmentDetails(item)}>Open workspace</button>
                              {isManager && <button onClick={() => startAssignment(item)}>Edit</button>}
                            </div>
                          </footer>
                        </article>
                      );
                    })}
                    {!filteredAssignments.length && (
                      <div className="assignment-empty">
                        <Icon name="assignments" />
                        <h3>No assignments match these filters</h3>
                        <p>Clear the filters or create a new assignment.</p>
                      </div>
                    )}
                  </div>
                )}
                {assignmentView === "Board" && (
                  <div className="assignment-kanban">
                    {[
                      "Not Started",
                      "In Progress",
                      "Ready for Review",
                      "Completed",
                      "Overdue",
                    ].map((status) => (
                      <section key={status}>
                        <header>
                          <span>{status}</span>
                          <b>
                            {
                              filteredAssignments.filter(
                                (item) => item.status === status,
                              ).length
                            }
                          </b>
                        </header>
                        {filteredAssignments
                          .filter((item) => item.status === status)
                          .map((item) => (
                            <article key={item.id}>
                              <div>
                                <small>{assignmentRef(item.id)}</small>
                                <b
                                  className={`assignment-priority ${item.priority.toLowerCase()}`}
                                >
                                  {item.priority}
                                </b>
                              </div>
                              <button
                                onClick={() => openAssignmentDetails(item)}
                              >
                                {item.title}
                              </button>
                              <p>{item.division}</p>
                              <footer>
                                <span>
                                  {item.members
                                    .slice(0, 3)
                                    .map((member) => initialsFor(member.name))
                                    .join("  |  ") || "Unassigned"}
                                </span>
                                <time>
                                  {item.due_date
                                    ? new Date(
                                        item.due_date,
                                      ).toLocaleDateString("en-KE")
                                    : "No due date"}
                                </time>
                                <button
                                  type="button"
                                  className="assignment-open-workspace"
                                  onClick={() => openAssignmentDetails(item)}
                                >
                                  Open workspace
                                </button>
                              </footer>
                            </article>
                          ))}
                        {!filteredAssignments.some(
                          (item) => item.status === status,
                        ) && <p className="kanban-empty">No assignments</p>}
                      </section>
                    ))}
                  </div>
                )}
                {assignmentView === "Calendar" && (
                  <div className="assignment-calendar-view">
                    <header>
                      <h3>Assignment deadlines</h3>
                      <p>
                        Only matching assignments with a recorded due date
                        appear here.
                      </p>
                    </header>
                    {filteredAssignments
                      .filter((item) => item.due_date)
                      .sort((a, b) =>
                        String(a.due_date).localeCompare(String(b.due_date)),
                      )
                      .map((item) => (
                        <button
                          key={item.id}
                          onClick={() => openAssignmentDetails(item)}
                        >
                          <time>
                            <strong>
                              {new Date(
                                String(item.due_date),
                              ).toLocaleDateString("en-KE", { day: "2-digit" })}
                            </strong>
                            <span>
                              {new Date(
                                String(item.due_date),
                              ).toLocaleDateString("en-KE", {
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </time>
                          <div>
                            <small>
                              {assignmentRef(item.id)} | {item.division}
                            </small>
                            <strong>{item.title}</strong>
                          </div>
                          <span
                            className={`assignment-health ${assignmentHealthFor(item).toLowerCase().replaceAll(" ", "-")}`}
                          >
                            {assignmentHealthFor(item)}
                          </span>
                          <strong className="assignment-open-workspace">Open workspace</strong>
                        </button>
                      ))}
                    {!filteredAssignments.some((item) => item.due_date) && (
                      <div className="assignment-empty">
                        <Icon name="calendar" />
                        <h3>No dated assignments</h3>
                        <p>No matching assignment has a due date.</p>
                      </div>
                    )}
                  </div>
                )}
                {assignmentView === "Workload" && (
                  <div className="assignment-workload-view">
                    <header>
                      <h3>Assignment participation workload</h3>
                      <p>
                        Counts show active assignment participation, not
                        estimated effort or availability.
                      </p>
                    </header>
                    {[
                      ...new Map(
                        filteredAssignments
                          .flatMap((item) => item.members)
                          .map((member) => [member.id, member]),
                      ).values(),
                    ].map((member) => {
                      const activeWork = filteredAssignments.filter(
                        (item) =>
                          item.status !== "Completed" &&
                          item.members.some(
                            (person) => person.id === member.id,
                          ),
                      );
                      return (
                        <article key={member.id}>
                          <div className="workload-person">
                            <b>{initialsFor(member.name)}</b>
                            <span>
                              <strong>{member.name}</strong>
                              <small>{member.role}</small>
                            </span>
                          </div>
                          <div>
                            <span>Active</span>
                            <strong>{activeWork.length}</strong>
                          </div>
                          <i>
                            <b
                              style={{
                                width: `${Math.min(100, activeWork.length * 16)}%`,
                              }}
                            />
                          </i>
                          <div className="workload-assignment-chips">
                            {activeWork.slice(0, 4).map((item) => (
                              <button
                                key={item.id}
                                onClick={() => openAssignmentDetails(item)}
                              >
                                {assignmentRef(item.id)}
                              </button>
                            ))}
                          </div>
                        </article>
                      );
                    })}
                    {!filteredAssignments.some(
                      (item) => item.members.length,
                    ) && (
                      <div className="assignment-empty">
                        <Icon name="team" />
                        <h3>No workload data</h3>
                        <p>
                          No matching assignment has allocated team members.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="assignment-page-head">
                <div>
                  <p>ASSIGNMENT MANAGEMENT</p>
                  <h2>Research work pipeline</h2>
                  <span>
                    Create, allocate, track, review and preserve every
                    assignment record.
                  </span>
                </div>
                {isManager && (
                  <button onClick={() => startAssignment()}>
                    + New assignment
                  </button>
                )}
              </div>
              <div className="assignment-toolbar">
                <label>
                  <Icon name="search" />
                  <input
                    value={assignmentSearch}
                    onChange={(event) =>
                      setAssignmentSearch(event.target.value)
                    }
                    placeholder="Search title, division or description"
                  />
                </label>
                <select
                  value={assignmentStatus}
                  onChange={(event) => setAssignmentStatus(event.target.value)}
                >
                  {[
                    "All",
                    "Not Started",
                    "In Progress",
                    "Ready for Review",
                    "Completed",
                    "Overdue",
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                <select
                  value={assignmentPriority}
                  onChange={(event) =>
                    setAssignmentPriority(event.target.value)
                  }
                >
                  {["All", "Low", "Normal", "High", "Critical"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                <span>{filteredAssignments.length} assignments</span>
              </div>
              {assignmentNotice && (
                <div className="session-message">{assignmentNotice}</div>
              )}
              <div className="assignment-board">
                {filteredAssignments.map((item) => (
                  <article className="assignment-card" key={item.id}>
                    <div className="assignment-card-top">
                      <span
                        className={`priority ${item.priority.toLowerCase()}`}
                      >
                        {item.priority}
                      </span>
                      <small>{assignmentRef(item.id)}</small>
                      <em>{item.status}</em>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.description || "No description provided."}</p>
                    <dl>
                      <div>
                        <dt>Division</dt>
                        <dd>{item.division}</dd>
                      </div>
                      <div>
                        <dt>Due date</dt>
                        <dd>
                          {item.due_date
                            ? new Date(item.due_date).toLocaleDateString(
                                "en-KE",
                              )
                            : "Not set"}
                        </dd>
                      </div>
                    </dl>
                    <div className="assignment-members">
                      {item.members.map((member) => (
                        <span
                          key={member.id}
                          title={`${member.name}  |  ${member.role}`}
                        >
                          {initialsFor(member.name)}
                        </span>
                      ))}
                      {!item.members.length && <small>Unassigned</small>}
                    </div>
                    <div className="assignment-card-actions">
                      <button onClick={() => openAssignmentDetails(item)}>
                        Open workspace
                      </button>
                      {isManager && (
                        <>
                          <button onClick={() => startAssignment(item)}>
                            Edit
                          </button>
                          <button
                            className="danger"
                            onClick={() => removeAssignment(item)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                    <select
                      value={item.status}
                      onChange={async (event) => {
                        try {
                          await api.updateStatus(
                            token,
                            item.id,
                            event.target.value,
                          );
                          await refreshAssignments();
                        } catch (error) {
                          setAssignmentNotice(
                            error instanceof Error
                              ? error.message
                              : "Status could not be updated.",
                          );
                        }
                      }}
                    >
                      <option>Not Started</option>
                      <option>In Progress</option>
                      <option>Ready for Review</option>
                      <option>Completed</option>
                      <option>Overdue</option>
                    </select>
                  </article>
                ))}
                {!filteredAssignments.length && (
                  <div className="assignment-empty">
                    <Icon name="assignments" />
                    <h3>No assignments match these filters</h3>
                    <p>Clear the filters or create a new assignment.</p>
                  </div>
                )}
              </div>
            </section>
            <section
              className="dashboard-command-centre"
              aria-label="Dashboard command centre"
            >
              <header className="command-header">
                <div>
                  <p>APP2 DASHBOARD</p>
                  <h2>
                    Good{" "}
                    {new Date().getHours() < 12
                      ? "morning"
                      : new Date().getHours() < 17
                        ? "afternoon"
                        : "evening"}
                    , {user.name.split(" ")[0]}
                  </h2>
                  <span>
                    {new Date().toLocaleDateString("en-KE", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}{" "}
                    Â· {user.role}
                  </span>
                </div>
                <div className="command-live">
                  <span
                    className={
                      dashboardRefreshState === "failed" ? "failed" : "live"
                    }
                  >
                    â—{" "}
                    {dashboardRefreshState === "failed"
                      ? "Refresh failed"
                      : "Live"}
                  </span>
                  <small>
                    {dashboardData
                      ? `Last updated: ${new Date(dashboardData.generatedAt).toLocaleTimeString("en-KE")}`
                      : "Loading live dataâ€¦"}
                  </small>
                  <button
                    onClick={refreshDashboard}
                    disabled={dashboardRefreshState === "refreshing"}
                  >
                    {dashboardRefreshState === "refreshing"
                      ? "Refreshingâ€¦"
                      : "Refresh"}
                  </button>
                </div>
              </header>
              {dashboardData ? (
                <>
                  {dashboardData.management && (() => {
                    const management = dashboardData.management;
                    const activeAssignments = management.assignments.active;
                    const overdueAssignments = management.assignments.overdue;
                    const deliveryHealth = activeAssignments ? Math.max(0, Math.round(((activeAssignments - overdueAssignments) / activeAssignments) * 100)) : 100;
                    const openGovernance = dashboardData.attention.reviews + management.repository.awaitingPublication;
                    const overallState = overdueAssignments > 0
                      ? { label: "Needs attention", tone: "risk", detail: `${overdueAssignments} overdue assignment${overdueAssignments === 1 ? "" : "s"} require intervention.` }
                      : openGovernance > 0
                        ? { label: "Action pending", tone: "watch", detail: `${openGovernance} review or publication action${openGovernance === 1 ? "" : "s"} remain open.` }
                        : { label: "On track", tone: "healthy", detail: "No overdue delivery or governance actions are currently open." };
                    return <section className="executive-overview" aria-label="Management executive overview">
                      <header><div><p>EXECUTIVE OVERVIEW</p><h2>Overall operational status</h2><span>A current organisation-wide view for management decisions.</span></div><div className={`executive-state ${overallState.tone}`}><i aria-hidden="true"/><span><strong>{overallState.label}</strong><small>{overallState.detail}</small></span></div></header>
                      <div className="executive-metrics">
                        <button onClick={() => navigateTo("Assignments")}><span>DELIVERY HEALTH</span><strong>{deliveryHealth}%</strong><small>{activeAssignments} active Â· {overdueAssignments} overdue</small><i style={{"--metric-progress":`${deliveryHealth}%`} as CSSProperties}/></button>
                        <button onClick={() => navigateTo("Team & Users")}><span>TEAM COVERAGE</span><strong>{management.team.total}</strong><small>{Object.keys(management.team.roles).length} active role groups</small><i style={{"--metric-progress":"100%"} as CSSProperties}/></button>
                        <button onClick={() => navigateTo("Research Repository")}><span>RESEARCH PIPELINE</span><strong>{management.research.active}</strong><small>Active research initiatives</small><i style={{"--metric-progress":management.research.active ? "72%" : "0%"} as CSSProperties}/></button>
                        <button onClick={() => navigateTo("Document Repository")}><span>KNOWLEDGE PIPELINE</span><strong>{management.repository.published}</strong><small>{management.repository.awaitingPublication} awaiting publication</small><i style={{"--metric-progress":`${management.repository.published + management.repository.awaitingPublication ? Math.round((management.repository.published / (management.repository.published + management.repository.awaitingPublication)) * 100) : 100}%`} as CSSProperties}/></button>
                      </div>
                      <footer><span><b>{dashboardData.attention.reviews}</b> reviews open</span><span><b>{dashboardData.attention.almostDue}</b> deadlines approaching</span><span><b>{dashboardData.attention.notifications}</b> unread notifications</span><button onClick={() => navigateTo("Reports & Analytics")}>Open detailed analytics â†’</button></footer>
                    </section>;
                  })()}
                  <section className="command-attention">
                    <header>
                      <div>
                        <p>ATTENTION REQUIRED</p>
                        <h2>What needs action now</h2>
                      </div>
                    </header>
                    <div>
                      {(
                        [
                          [
                            "Assignments",
                            dashboardData.attention.assignments,
                            "Assignments",
                          ],
                          [
                            "Reviews",
                            dashboardData.attention.reviews,
                            "Documents",
                          ],
                          [
                            "Overdue",
                            dashboardData.attention.overdue,
                            "Assignments",
                          ],
                          [
                            "Notifications",
                            dashboardData.attention.notifications,
                            "Notifications",
                          ],
                        ] as [string, number, string][]
                      ).map(([label, value, destination]) => (
                        <button
                          className={
                            label === "Overdue" && value ? "danger" : ""
                          }
                          key={label}
                          onClick={() => {
                            if (label === "Overdue") {
                              setAssignmentStatus("All");
                              setAssignmentDue("Overdue");
                            }
                            navigateTo(destination);
                          }}
                        >
                          <strong>{value}</strong>
                          <span>{navigationDisplayLabel(label)}</span>
                          <small>
                            {value ? "Open queue" : "No action needed"}
                          </small>
                        </button>
                      ))}
                    </div>
                  </section>
                  {noticeRows.some(item => item.status === "Published" && item.is_pinned) && (
                    <section className="dashboard-pinned-notices">
                      <header><div><p>PINNED NOTICE</p><h2>Important organisation updates</h2></div><button onClick={() => navigateTo("Notice Board")}>Open Notice Board</button></header>
                      <div>{noticeRows.filter(item => item.status === "Published" && item.is_pinned).sort((a,b)=>new Date(b.pinned_at||b.created_at).getTime()-new Date(a.pinned_at||a.created_at).getTime()).slice(0,3).map(item=><button key={item.id} onClick={() => navigateTo("Notice Board")}><span className={item.severity.toLowerCase()}>{item.severity}</span><div><strong>{item.title}</strong><small>{item.body}</small></div><time>Expires {new Date(String(item.expires_at)).toLocaleDateString("en-KE",{day:"2-digit",month:"short"})}</time></button>)}</div>
                    </section>
                  )}
                  <div className="command-grid">
                    <section className="command-panel active-work">
                      <header>
                        <div>
                          <p>MY ACTIVE WORK</p>
                          <h2>
                            {user.role === "Reviewer"
                              ? "My review queue"
                              : "Current work"}
                          </h2>
                        </div>
                      </header>
                      <div className="command-work-list">
                        {dashboardData.myWork.slice(0, 8).map((item) => (
                          <button
                            key={`${item.type}-${item.id}`}
                            onClick={() => navigateTo(item.destination)}
                          >
                            <span className="work-type">{item.type}</span>
                            <span>
                              <strong>{item.title}</strong>
                              <small>
                                {item.status}
                                {item.dueDate
                                  ? ` Â· Due ${new Date(item.dueDate).toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}`
                                  : ""}
                              </small>
                            </span>
                            <b>{item.nextAction} â†’</b>
                          </button>
                        ))}
                        {!dashboardData.myWork.length && (
                          <div className="dashboard-empty">
                            <strong>No active work</strong>
                            <span>You are all caught up.</span>
                          </div>
                        )}
                      </div>
                    </section>
                    <aside className="command-side">
                      <section className="command-panel deadlines">
                        <header>
                          <div>
                            <p>UPCOMING DEADLINES</p>
                            <h2>Nearest first</h2>
                          </div>
                          <button onClick={() => navigateTo("Calendar")}>
                            Calendar
                          </button>
                        </header>
                        {(
                          [
                            "Overdue",
                            "Today",
                            "Tomorrow",
                            "This Week",
                            "Later",
                          ] as const
                        ).map((group) => {
                          const rows = dashboardData.deadlines
                            .filter((item) => item.group === group)
                            .slice(0, 3);
                          return rows.length ? (
                            <div className="deadline-group" key={group}>
                              <h3>{group}</h3>
                              {rows.map((item) => (
                                <button
                                  key={`${item.type}-${item.id}`}
                                  onClick={() => navigateTo(item.destination)}
                                >
                                  <time>
                                    {new Date(
                                      String(item.dueDate),
                                    ).toLocaleDateString("en-KE", {
                                      day: "2-digit",
                                      month: "short",
                                    })}
                                  </time>
                                  <span>
                                    <strong>{item.title}</strong>
                                    <small>{item.type}</small>
                                  </span>
                                </button>
                              ))}
                            </div>
                          ) : null;
                        })}
                        {!dashboardData.deadlines.length && (
                          <div className="dashboard-empty">
                            <strong>No active deadlines</strong>
                          </div>
                        )}
                      </section>
                      <section className="command-panel quick-actions">
                        <header>
                          <div>
                            <p>QUICK ACTIONS</p>
                            <h2>Start work</h2>
                          </div>
                        </header>
                        <div>
                          {dashboardData.quickActions.map((action) => (
                            <button
                              key={action.label}
                              onClick={() => {
                                navigateTo(action.destination);
                                if (action.label === "New Assignment")
                                  startAssignment();
                                if (action.label === "New Research")
                                  setResearchOpen(true);
                                if (action.label === "Upload to Repository")
                                  openKnowledgeUpload();
                              }}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      </section>
                    </aside>
                  </div>
                  <section className="command-panel recent-activity">
                    <header>
                      <div>
                        <p>RECENT ACTIVITY</p>
                        <h2>Meaningful workflow updates</h2>
                      </div>
                      <button onClick={() => navigateTo("Notifications")}>
                        View all
                      </button>
                    </header>
                    <div>
                      {dashboardData.recentActivity.slice(0, 8).map((item) => (
                        <button
                          key={item.id}
                          onClick={() => navigateTo("Notifications")}
                        >
                          <span className="activity-dot" />
                          <span>
                            <strong>{item.title}</strong>
                            <small>{item.body}</small>
                          </span>
                          <time>
                            {new Date(item.created_at).toLocaleDateString(
                              "en-KE",
                              { day: "2-digit", month: "short" },
                            )}
                          </time>
                        </button>
                      ))}
                    </div>
                  </section>
                  {dashboardData.management && (
                    <section className="management-glance">
                      <p>MANAGEMENT SUMMARY</p>
                      <span>
                        <strong>{dashboardData.management.team.total}</strong>{" "}
                        active staff
                      </span>
                      <span>
                        <strong>
                          {dashboardData.management.assignments.active}
                        </strong>{" "}
                        active assignments
                      </span>
                      <span>
                        <strong>
                          {dashboardData.management.research.active}
                        </strong>{" "}
                        active research
                      </span>
                      <span>
                        <strong>
                          {
                            dashboardData.management.repository
                              .awaitingPublication
                          }
                        </strong>{" "}
                        awaiting publication
                      </span>
                      <button onClick={() => navigateTo("Reports & Analytics")}>
                        Open analytics â†’
                      </button>
                    </section>
                  )}
                </>
              ) : (
                <div className="command-loading">
                  Loading your operational dashboardâ€¦
                </div>
              )}
            </section>
            <section
              className={`operational-dashboard ${
                isResearcherDashboard
                  ? "researcher-dashboard-mode"
                  : isReviewerDashboard
                    ? "reviewer-dashboard-mode"
                    : "management-dashboard-mode"
              }`}
              aria-label={
                isResearcherDashboard
                  ? "Researcher Dashboard"
                  : isReviewerDashboard
                    ? "Review Dashboard"
                    : "Management Dashboard"
              }
            >
              {actionRequiredNotifications.length > 0 && (
                <section
                  className="dashboard-action-alerts"
                  aria-label="Notifications requiring action"
                >
                  <header>
                    <div>
                      <span>!</span>
                      <div>
                        <p>ACTION REQUIRED</p>
                        <h2>
                          {actionRequiredNotifications.length} item
                          {actionRequiredNotifications.length === 1 ? "" : "s"}{" "}
                          need your attention
                        </h2>
                      </div>
                    </div>
                    <button onClick={() => navigateTo("Notifications")}>
                      View notification centre
                    </button>
                  </header>
                  <div>
                    {actionRequiredNotifications.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => navigateNotification(item)}
                      >
                        <span className="action-alert-icon">!</span>
                        <span>
                          <strong>{item.title}</strong>
                          <small>{item.body}</small>
                        </span>
                        <time>
                          {new Date(item.created_at).toLocaleString("en-KE", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                        <b>Open action â†’</b>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {(isResearcherDashboard || isReviewerDashboard) && (
                <section className="role-dashboard-intro">
                  <div>
                    <p>{isResearcherDashboard ? "MY WORKSPACE" : "MY REVIEW QUEUE"}</p>
                    <h2>
                      {isResearcherDashboard
                        ? "Researcher dashboard"
                        : "Reviewer dashboard"}
                    </h2>
                    <span>
                      {isResearcherDashboard
                        ? "Only tasks assigned directly to you are shown. Review work appears only when it is specifically assigned to you."
                        : "Only review items specifically assigned to you are shown. Other teams and unrelated work remain outside your view."}
                    </span>
                  </div>
                  <b>{isResearcherDashboard ? "OWN WORK ONLY" : "ASSIGNED REVIEWS ONLY"}</b>
                </section>
              )}

              <div className="dashboard-kpis">
                {(
                  isResearcherDashboard
                    ? ([
                        ["Active Tasks", personalDashboardTasks.length, "Tasks assigned directly to you", "Assignments"],
                        ["Due Soon", researcherDueSoonCount, "Your tasks due within seven days", "Assignments"],
                        ["Overdue", researcherOverdueCount, "Your tasks past their deadline", "Assignments"],
                        ["Awaiting Review", researcherAwaitingReviewCount, "Your submitted work awaiting a decision", "Assignments"],
                        ["My Reviews", personalDashboardReviews.length, "Review decisions specifically assigned to you", personalDashboardReviews[0]?.destination || "Documents"],
                        ["Final Reports", personalDashboardFinalizations.length, "Approved Task Reports awaiting your final generation", "Assignments"],
                      ] as [string, number, string, string][])
                    : isReviewerDashboard
                      ? ([
                          ["Waiting for Review", personalDashboardReviews.length, "Items specifically awaiting your decision", personalDashboardReviews[0]?.destination || "Documents"],
                          ["Final Reports", personalDashboardFinalizations.length, "Approved Task Reports awaiting final generation", "Assignments"],
                          ["Due Soon", reviewerDueSoonCount, "Reviews due within seven days", "Calendar"],
                          ["Overdue", reviewerOverdueCount, "Assigned reviews past deadline", "Calendar"],
                          ["In Review", reviewerInProgressCount, "Reviews currently being assessed", personalDashboardReviews[0]?.destination || "Documents"],
                          ["Review Notices", dashboardReviewNotifications.filter((item) => !item.read_at).length, "Unread review and decision notices", "Notifications"],
                        ] as [string, number, string, string][])
                      : isManager && dashboardData?.management
                        ? ([
                            ["Active Assignments", activeDashboardAssignments.length, "Work currently open", "Assignments"],
                            ["Due Soon", dueSoonDashboardAssignments.length, "Due within seven days", "Assignments"],
                            ["Overdue", overdueDashboardAssignments.length, "Past the recorded deadline", "Assignments"],
                            ["My Reviews", personalDashboardReviews.length, "Work specifically assigned to you for review", personalDashboardReviews[0]?.destination || "Assignments"],
                            ["Document Reviews", reviewRows.length, "Documents awaiting a governance decision", "Document Repository"],
                            ["Active Research", dashboardData.management.research.active, "Current research initiatives", "Research Repository"],
                            ["Awaiting Publication", dashboardData.management.repository.awaitingPublication, "Approved knowledge awaiting publication", "Document Repository"],
                          ] as [string, number, string, string][])
                        : []
                ).map(([label, value, detail, destination]) => (
                  <button
                    className={`dashboard-kpi ${label === "Overdue" && value ? "danger" : ""}`}
                    key={label}
                    onClick={() => openDashboardMetric(label, destination)}
                  >
                    <span>{navigationDisplayLabel(label)}</span>
                    <strong>{value}</strong>
                    <small>{detail}</small>
                  </button>
                ))}
              </div>

              {dashboardActionQueue && (
                <div className="dashboard-action-queue-backdrop" role="presentation" onClick={() => setDashboardActionQueue(null)}>
                  <section className="dashboard-action-queue" role="dialog" aria-modal="true" aria-label={dashboardQueueTitle} onClick={(event) => event.stopPropagation()}>
                    <header>
                      <div><p>MY ACTIONS</p><h2>{dashboardQueueTitle}</h2><span>Only the records behind the selected total are shown.</span></div>
                      <button type="button" onClick={() => setDashboardActionQueue(null)} aria-label="Close action queue">Ã—</button>
                    </header>
                    <div className="dashboard-action-queue-list">
                      {dashboardQueueAssignments.map((item) => (
                        <button key={item.id} type="button" onClick={() => { setDashboardActionQueue(null); setActive("Assignments"); void openAssignmentDetails(item); }}>
                          <span><strong>{item.title}</strong><small>{item.status}</small></span>
                          <span><b>{dashboardDeadlineText(item.due_date)}</b><small>Open assignment</small></span>
                        </button>
                      ))}
                      {dashboardQueueWorkItems.map((item) => (
                        <button key={`${item.type}-${item.id}`} type="button" onClick={() => { setDashboardActionQueue(null); void openDashboardWork(item); }}>
                          <span><strong>{item.title}</strong><small>{item.type === "Review" ? `${item.ownerName ? `Submitted by ${item.ownerName}` : "Assigned review"}${item.contextTitle ? ` Â· ${item.contextTitle}` : ""}` : item.contextTitle || item.status}</small></span>
                          <span><b>{item.type === "Review" ? (item.status === "Integrated" ? "Final report" : "Review") : dashboardDeadlineText(item.dueDate)}</b><small>{item.status}</small></span>
                        </button>
                      ))}
                      {dashboardQueueDocumentReviews.map((item) => (
                        <button key={item.id} type="button" onClick={() => { setDashboardActionQueue(null); setActive("Document Repository"); setReviewDocument(item); }}>
                          <span><strong>{item.title}</strong><small>{item.created_by_name || "Document submission"}</small></span>
                          <span><b>Review</b><small>{item.status}</small></span>
                        </button>
                      ))}
                      {dashboardQueueResearch.map((item) => (
                        <button key={item.id} type="button" onClick={() => { setDashboardActionQueue(null); setActive("Research Repository"); setSelectedResearch(item); setResearchTab("Overview"); }}>
                          <span><strong>{item.title}</strong><small>{item.lead_name ? `Lead: ${item.lead_name}` : "Research project"}</small></span>
                          <span><b>Open</b><small>{item.status}</small></span>
                        </button>
                      ))}
                      {dashboardQueueNotifications.map((item) => (
                        <button key={item.id} type="button" onClick={() => { setDashboardActionQueue(null); void openNotification(item); void navigateNotification(item); }}>
                          <span><strong>{item.title}</strong><small>{item.body}</small></span>
                          <span><b>Open action</b><small>{new Date(item.created_at).toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}</small></span>
                        </button>
                      ))}
                      {!dashboardQueueAssignments.length && !dashboardQueueWorkItems.length && !dashboardQueueDocumentReviews.length && !dashboardQueueResearch.length && !dashboardQueueNotifications.length && (
                        <div className="dashboard-action-queue-empty"><strong>No records in this queue</strong><span>There is currently nothing requiring action under this total.</span></div>
                      )}
                    </div>
                  </section>
                </div>
              )}

              <div className="dashboard-operations-grid">
                <article className="dashboard-ops-card my-work-card">
                  <header>
                    <div>
                      <p>{isResearcherDashboard ? "MY TASKS" : isReviewerDashboard ? "MY REVIEWS" : "MANAGEMENT ATTENTION"}</p>
                      <h2>{isResearcherDashboard ? "Needs my attention" : isReviewerDashboard ? "Waiting for my review" : "Needs attention now"}</h2>
                    </div>
                    <button onClick={() => {
                      if (isResearcherDashboard) setDashboardActionQueue("active-tasks");
                      else if (isReviewerDashboard) setDashboardActionQueue("my-reviews");
                      else setDashboardActionQueue("management-attention");
                    }}>
                      {isResearcherDashboard ? "View my tasks" : isReviewerDashboard ? "Open review queue" : "Open action queue"}
                    </button>
                  </header>
                  <div className="dashboard-work-list">
                    {isResearcherDashboard && researcherAttentionTasks.slice(0, 6).map((item) => (
                      <button key={`${item.type}-${item.id}`} onClick={() => openDashboardWork(item)}>
                        <span className={`risk-dot ${(item.days ?? dashboardDaysUntilDue(item.dueDate) ?? 30) < 0 ? "overdue" : (item.days ?? dashboardDaysUntilDue(item.dueDate) ?? 30) <= 7 ? "almost-due" : "new"}`} />
                        <div><strong>{item.title}</strong><small>{item.contextTitle || "Assigned task"}</small></div>
                        <span><b>{dashboardDeadlineText(item.dueDate)}</b><small>{item.status}</small></span>
                      </button>
                    ))}
                    {isReviewerDashboard && reviewerAttentionItems.slice(0, 6).map((item) => (
                      <button key={`${item.type}-${item.id}`} onClick={() => openDashboardWork(item)}>
                        <span className={`risk-dot ${(item.days ?? dashboardDaysUntilDue(item.dueDate) ?? 30) < 0 ? "overdue" : (item.days ?? dashboardDaysUntilDue(item.dueDate) ?? 30) <= 7 ? "almost-due" : "new"}`} />
                        <div>
                          <strong>{item.title}</strong>
                          <small>{item.ownerName ? `Submitted by ${item.ownerName}` : "Assigned review"}{item.contextTitle ? ` Â· ${item.contextTitle}` : ""}</small>
                        </div>
                        <span><b>{dashboardDeadlineText(item.dueDate)}</b><small>{item.status}</small></span>
                      </button>
                    ))}
                    {!isResearcherDashboard && !isReviewerDashboard && dashboardAttentionAssignments.slice(0, 6).map((item) => {
                      return (
                        <button key={item.id} onClick={() => openAssignmentDetails(item)}>
                          <span className={`risk-dot ${deadlineState(item.due_date, item.status)}`} />
                          <div><strong>{item.title}</strong></div>
                          <span><b>{dashboardDeadlineText(item.due_date)}</b><small>{item.status}</small></span>
                        </button>
                      );
                    })}
                    {((isResearcherDashboard && !researcherAttentionTasks.length) || (isReviewerDashboard && !reviewerAttentionItems.length) || (!isResearcherDashboard && !isReviewerDashboard && !dashboardAttentionAssignments.length)) && (
                      <div className="dashboard-empty">
                        <strong>{isResearcherDashboard ? "No active tasks assigned to you" : isReviewerDashboard ? "Your review queue is clear" : "No assignments need intervention"}</strong>
                        <span>{isResearcherDashboard ? "Only tasks assigned directly to you appear on this dashboard." : isReviewerDashboard ? "A review appears here only when it is specifically assigned to you." : "No overdue, due-soon, blocked or high-priority assignments are currently visible."}</span>
                      </div>
                    )}
                  </div>
                </article>

                <article className="dashboard-ops-card risk-card">
                  <header>
                    <div>
                      <p>PRIORITY & RISK</p>
                      <h2>Work needing intervention</h2>
                    </div>
                    <span>{riskDashboardAssignments.length} flagged</span>
                  </header>
                  <div className="dashboard-risk-list">
                    {riskDashboardAssignments.slice(0, 6).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => openAssignmentDetails(item)}
                      >
                        <b
                          className={`priority-label ${item.priority.toLowerCase()}`}
                        >
                          {item.priority}
                        </b>
                        <span>
                          <strong>{item.title}</strong>
                          <small>
                            {deadlineLabel(item.due_date, item.status)} |{" "}
                            {item.status}
                          </small>
                        </span>
                      </button>
                    ))}
                    {!riskDashboardAssignments.length && (
                      <div className="dashboard-empty">
                        <strong>No high-risk work</strong>
                        <span>
                          No critical, high-priority, blocked or overdue
                          assignments are visible.
                        </span>
                      </div>
                    )}
                  </div>
                </article>

                <article className="dashboard-ops-card deadlines-card">
                  <header>
                    <div><p>UPCOMING DEADLINES</p><h2>{isResearcherDashboard ? "My task deadlines" : isReviewerDashboard ? "My review deadlines" : "Next 30 days"}</h2></div>
                    <button onClick={() => navigateTo("Calendar")}>Open calendar</button>
                  </header>
                  {(isResearcherDashboard || isReviewerDashboard) ? (
                    <>
                      <div className="deadline-window-legend">
                        <span>Overdue <b>{(isResearcherDashboard ? personalTaskDeadlines : personalReviewDeadlines).filter((item) => typeof item.days === "number" && item.days < 0).length}</b></span>
                        <span>7 days <b>{(isResearcherDashboard ? personalTaskDeadlines : personalReviewDeadlines).filter((item) => typeof item.days === "number" && item.days >= 0 && item.days <= 7).length}</b></span>
                        <span>Total <b>{(isResearcherDashboard ? personalTaskDeadlines : personalReviewDeadlines).length}</b></span>
                      </div>
                      {(isResearcherDashboard ? personalTaskDeadlines : personalReviewDeadlines).slice(0, 6).map((item) => (
                        <button className="deadline-item" key={`${item.type}-${item.id}`} onClick={() => openDashboardWork(item)}>
                          <time>{item.dueDate ? new Date(`${item.dueDate}T00:00:00`).toLocaleDateString("en-KE", { day: "2-digit", month: "short" }) : "â€”"}</time>
                          <span><strong>{item.title}</strong><small>{item.contextTitle || item.status}</small></span>
                        </button>
                      ))}
                      {!(isResearcherDashboard ? personalTaskDeadlines : personalReviewDeadlines).length && (
                        <div className="dashboard-empty"><strong>No upcoming deadlines</strong><span>{isResearcherDashboard ? "None of your assigned tasks currently has an active deadline." : "None of your assigned reviews currently has an active deadline."}</span></div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="deadline-window-legend">
                        <span>7 days <b>{upcomingDashboardAssignments.filter((item) => (new Date(`${item.due_date}T23:59:59`).getTime() - dashboardNow.getTime()) / 86400000 <= 7).length}</b></span>
                        <span>14 days <b>{upcomingDashboardAssignments.filter((item) => (new Date(`${item.due_date}T23:59:59`).getTime() - dashboardNow.getTime()) / 86400000 <= 14).length}</b></span>
                        <span>30 days <b>{upcomingDashboardAssignments.length}</b></span>
                      </div>
                      {upcomingDashboardAssignments.slice(0, 6).map((item) => (
                        <button className="deadline-item" key={item.id} onClick={() => openAssignmentDetails(item)}>
                          <time>{new Date(String(item.due_date)).toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}</time>
                          <span><strong>{item.title}</strong><small>{item.division}</small></span>
                        </button>
                      ))}
                      {!upcomingDashboardAssignments.length && <div className="dashboard-empty"><strong>No upcoming deadlines</strong><span>No visible assignment is due in the next 30 days.</span></div>}
                    </>
                  )}
                </article>

                {isManager && personalDashboardReviews.length > 0 && (
                  <article className="dashboard-ops-card manager-personal-reviews-card">
                    <header>
                      <div>
                        <p>MY REVIEWS</p>
                        <h2>Waiting for my decision</h2>
                      </div>
                      <button type="button" onClick={() => setDashboardActionQueue("my-reviews")}>Open review queue</button>
                    </header>
                    <div className="dashboard-work-list compact-review-list">
                      {reviewerAttentionItems.slice(0, 6).map((item) => (
                        <button
                          key={`${item.type}-${item.id}`}
                          onClick={() => openDashboardWork(item)}
                        >
                          <span
                            className={`risk-dot ${
                              (item.days ?? dashboardDaysUntilDue(item.dueDate) ?? 30) < 0
                                ? "overdue"
                                : "almost-due"
                            }`}
                          />
                          <div>
                            <strong>{item.title}</strong>
                            <small>
                              {item.ownerName ? `Submitted by ${item.ownerName}` : "Assigned review"}
                              {item.contextTitle ? ` Â· ${item.contextTitle}` : ""}
                            </small>
                          </div>
                          <span>
                            <b>{item.status === "Integrated" ? "Final report pending" : "Review now"}</b>
                            <small>{dashboardDeadlineText(item.dueDate)}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </article>
                )}

                <article className="dashboard-ops-card workload-card">
                  <header>
                    <div>
                      <p>{isResearcherDashboard ? "MY REVIEWS" : isReviewerDashboard ? "REVIEW ACTIVITY" : "TEAM WORKLOAD"}</p>
                      <h2>{isResearcherDashboard ? "Review work assigned to me" : isReviewerDashboard ? "Recent review updates" : "Responsibility and capacity"}</h2>
                    </div>
                    {isManager && <button onClick={() => navigateTo("Team & Users")}>Open team</button>}
                  </header>
                  {isResearcherDashboard ? (
                    <div className="dashboard-work-list compact-review-list">
                      {reviewerAttentionItems.slice(0, 5).map((item) => (
                        <button key={`${item.type}-${item.id}`} onClick={() => openDashboardWork(item)}>
                          <span className="risk-dot almost-due" />
                          <div><strong>{item.title}</strong><small>{item.ownerName ? `Submitted by ${item.ownerName}` : "Assigned review"}{item.contextTitle ? ` Â· ${item.contextTitle}` : ""}</small></div>
                          <span><b>{dashboardDeadlineText(item.dueDate)}</b><small>{item.status}</small></span>
                        </button>
                      ))}
                      {!reviewerAttentionItems.length && <div className="dashboard-empty"><strong>No reviews assigned</strong><span>If you are selected as a reviewer, that review appears here without exposing the other person's team or unrelated work.</span></div>}
                    </div>
                  ) : isReviewerDashboard ? (
                    <div className="dashboard-activity-list review-activity-list">
                      {dashboardReviewNotifications.slice(0, 6).map((item) => (
                        <button key={item.id} onClick={() => { openNotification(item); navigateNotification(item); }}>
                          <span className={item.read_at ? "read" : "unread"} />
                          <div><strong>{item.title}</strong><small>{item.body}</small></div>
                          <time>{new Date(item.created_at).toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}</time>
                        </button>
                      ))}
                      {!dashboardReviewNotifications.length && <div className="dashboard-empty"><strong>No recent review updates</strong><span>New submissions, changes and decisions will appear here.</span></div>}
                    </div>
                  ) : (
                    <div className="workload-list manager-workload-list">
                      {(Object.values(dashboardWorkload) as { name: string; division: string; active: number; overdue: number; dueSoon: number; }[]).sort((a, b) => b.overdue - a.overdue || b.dueSoon - a.dueSoon || b.active - a.active).slice(0, 8).map((member) => {
                        const health = member.overdue ? `${member.overdue} overdue` : member.dueSoon ? `${member.dueSoon} due soon` : member.active ? "On track" : "Available";
                        return (
                          <div key={member.name} className="manager-workload-row">
                            <span><strong>{member.name}</strong><small>{member.division || "Division not recorded"}</small></span>
                            <span className="manager-workload-count"><strong>{member.active}</strong><small>active</small></span>
                            <b className={`manager-workload-health ${member.overdue ? "risk" : member.dueSoon ? "watch" : member.active ? "healthy" : "available"}`}>{health}</b>
                          </div>
                        );
                      })}
                      {!Object.keys(dashboardWorkload).length && <div className="dashboard-empty"><strong>No workload data</strong><span>Workload appears after assignments have team members.</span></div>}
                    </div>
                  )}
                </article>

                <article className="dashboard-ops-card activity-card">
                  <header>
                    <div>
                      <p>RECENT ACTIVITY</p>
                      <h2>Workflow updates</h2>
                    </div>
                    <button onClick={() => navigateTo("Notifications")}>
                      Open inbox
                    </button>
                  </header>
                  <div className="dashboard-activity-list">
                    {notifications.slice(0, 5).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          openNotification(item);
                          navigateNotification(item);
                        }}
                      >
                        <span className={item.read_at ? "read" : "unread"} />
                        <div>
                          <strong>{item.title}</strong>
                          <small>{item.body}</small>
                        </div>
                        <time>
                          {new Date(item.created_at).toLocaleDateString(
                            "en-KE",
                            { day: "2-digit", month: "short" },
                          )}
                        </time>
                      </button>
                    ))}
                    {!notifications.length && (
                      <div className="dashboard-empty">
                        <strong>No recent activity</strong>
                        <span>
                          Assignment, review and approval events will appear
                          here.
                        </span>
                      </div>
                    )}
                  </div>
                </article>

                <article className="dashboard-ops-card quick-actions-card">
                  <header><div><p>QUICK ACTIONS</p><h2>{isResearcherDashboard ? "Open my workspaces" : isReviewerDashboard ? "Open review tools" : "Start common work"}</h2></div></header>
                  <div className="operational-quick-actions management-quick-actions">
                    {isManager ? (
                      <>
                        <button onClick={() => { navigateTo("Assignments"); startAssignment(); }}><Icon name="plus" /><span>New Assignment</span></button>
                        <button onClick={() => { navigateTo("Research Repository"); setResearchOpen(true); }}><Icon name="research" /><span>New Research</span></button>
                        <button onClick={() => { navigateTo("Document Repository"); openKnowledgeUpload(); }}><Icon name="upload" /><span>Upload Document</span></button>
                        <button onClick={() => navigateTo("Documents")}><Icon name="check" /><span>Review Queue</span></button>
                      </>
                    ) : (
                      (dashboardData?.quickActions || []).map((action) => (
                        <button key={action.label} onClick={() => navigateTo(action.destination)}>
                          <Icon name={/review/i.test(action.label) ? "check" : /research/i.test(action.label) ? "research" : /evidence|document/i.test(action.label) ? "documents" : /notification/i.test(action.label) ? "notifications" : /deadline|calendar/i.test(action.label) ? "calendar" : "assignments"} />
                          <span>{action.label}</span>
                        </button>
                      ))
                    )}
                  </div>
                </article>
              </div>
            </section>
            <section className="stats-grid deadline-summary-grid legacy-dashboard-section">
              {dashboardDeadlineStats.map(
                ([icon, label, value, tone, destination]) => (
                  <article
                    className={`stat-card deadline-summary-card ${tone}`}
                    key={label}
                  >
                    <Icon name={icon} />
                    <div>
                      <span>{navigationDisplayLabel(label)}</span>
                      <strong>{value}</strong>
                      <small>
                        {tone === "deadline-green"
                          ? "Still within schedule"
                          : tone === "deadline-orange"
                            ? "Due within 7 days"
                            : "Past deadline"}
                      </small>
                      <button
                        title={`Open ${destination} and view the records behind this total.`}
                        onClick={() => navigateTo(destination)}
                      >
                        View all <Icon name="arrow" />
                      </button>
                    </div>
                  </article>
                ),
              )}
            </section>
            {isManager && (
              <section className="management-area">
                <div className="management-heading">
                  <div>
                    <p>MANAGEMENT OVERVIEW</p>
                    <h2>Team control centre</h2>
                  </div>
                  <span>{user.role} access</span>
                </div>
                <div className="management-grid">
                  <article className="panel members-panel">
                    <div className="panel-title">
                      <h2>All Members</h2>
                      <button>{team.length} active profiles</button>
                    </div>
                    <div className="member-table">
                      <div className="member-table-head">
                        <span>Member</span>
                        <span>Division</span>
                        <span>Role</span>
                        <span>Workload</span>
                        <span>Status</span>
                      </div>
                      {team.map((member) => (
                        <div className="member-record" key={member.email}>
                          <div className="member-name">
                            <span>{member.initials}</span>
                            <div>
                              <strong>{member.name}</strong>
                              <small>{member.email}</small>
                            </div>
                          </div>
                          <span>{member.division}</span>
                          {user.role === "Administrator" ? (
                            <select
                              value={member.role}
                              onChange={(e) =>
                                updateMemberRole(
                                  member.email,
                                  e.target.value as Role,
                                )
                              }
                            >
                              <option>Administrator</option>
                              <option>Research Manager</option>
                              <option>Research Officer</option>
                              <option>Reviewer</option>
                            </select>
                          ) : (
                            <em>{member.role}</em>
                          )}
                          <span>{member.active} active</span>
                          <b
                            className={`presence ${member.status.toLowerCase()}`}
                          >
                            {member.status}
                          </b>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="panel alerts-panel">
                    <div className="panel-title">
                      <h2>Alerts & Updates</h2>
                    </div>
                    <div className="alert-composer">
                      <textarea
                        value={alertText}
                        onChange={(e) => setAlertText(e.target.value)}
                        placeholder="Write a notice for management approval..."
                      />
                      <button onClick={publishAlert}>
                        Submit for approval <Icon name="arrow" />
                      </button>
                    </div>
                    <div className="published-alerts">
                      {systemAlerts.map((alert, index) => (
                        <div key={`${alert}-${index}`}>
                          <Icon name="notifications" />
                          <p>
                            {alert}
                            <small>
                              {index === 0
                                ? "Just now  |  All members"
                                : "Management update  |  All members"}
                            </small>
                          </p>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>

                <div className="management-grid lower">
                  <article className="panel allocations-panel">
                    <div className="panel-title">
                      <h2>Assignment Allocation</h2>
                      {isManager && (
                        <button
                          onClick={() => {
                            setActive("Assignments");
                            startAssignment();
                          }}
                        >
                          + Create assignment
                        </button>
                      )}
                    </div>
                    {workAllocation.map((item, index) => (
                      <div className="allocation-row" key={item.title}>
                        <strong>{item.title}</strong>
                        <select
                          value={item.assignee}
                          onChange={(e) =>
                            updateAllocation(index, "assignee", e.target.value)
                          }
                        >
                          {team
                            .filter((member) => member.role !== "Administrator")
                            .map((member) => (
                              <option key={member.email}>{member.name}</option>
                            ))}
                        </select>
                        <select
                          value={item.status}
                          onChange={(e) =>
                            updateAllocation(index, "status", e.target.value)
                          }
                        >
                          <option>Not Started</option>
                          <option>In Progress</option>
                          <option>Ready for Review</option>
                          <option>Completed</option>
                          <option>Overdue</option>
                        </select>
                      </div>
                    ))}
                  </article>
                  <article className="panel analytics-panel">
                    <div className="panel-title">
                      <h2>Workload by Member</h2>
                      <button
                        title="Open Reports & Analytics where the workload report can be filtered and exported."
                        onClick={() => navigateTo("Reports & Analytics")}
                      >
                        Export report
                      </button>
                    </div>
                    <div className="bar-chart">
                      {team
                        .filter((member) => member.role !== "Administrator")
                        .map((member) => (
                          <div className="bar-column" key={member.email}>
                            <div className="bar-value">{member.active}</div>
                            <div className="bar-track">
                              <i
                                style={{
                                  height: `${Math.max(18, member.active * 20)}%`,
                                }}
                              />
                            </div>
                            <span>{member.initials}</span>
                          </div>
                        ))}
                    </div>
                    <div className="chart-legend">
                      <span>
                        <i className="yellow-dot" />
                        Active assignments
                      </span>
                      <strong>14 total</strong>
                    </div>
                  </article>
                  <article className="panel progress-panel">
                    <div className="panel-title">
                      <h2>Assignment Progress</h2>
                    </div>
                    <div className="donut-chart">
                      <div>
                        <strong>72%</strong>
                        <span>On track</span>
                      </div>
                    </div>
                    <div className="progress-legend">
                      <span>
                        <i className="green-dot" />
                        Completed <b>28</b>
                      </span>
                      <span>
                        <i className="yellow-dot" />
                        In progress <b>12</b>
                      </span>
                      <span>
                        <i className="orange-dot" />
                        Overdue <b>4</b>
                      </span>
                    </div>
                  </article>
                </div>
              </section>
            )}
            <section className="primary-grid">
              <article className="panel assignments-panel">
                <div className="panel-title">
                  <h2>My Assignments</h2>
                  <button onClick={() => setActive("Assignments")}>
                    View all assignments <Icon name="arrow" />
                  </button>
                </div>
                <div className="tabs deadline-tabs" role="tablist">
                  {[
                    "All",
                    "On Track",
                    "Almost Due",
                    "Overdue",
                    "Completed",
                  ].map((tab) => (
                    <button
                      role="tab"
                      title={`Show ${tab.toLowerCase()} assignments in this dashboard list.`}
                      aria-selected={dashboardAssignmentFilter === tab}
                      onClick={() => setDashboardAssignmentFilter(tab)}
                      className={`${dashboardAssignmentFilter === tab ? "active" : ""} ${tab.toLowerCase().replaceAll(" ", "-")}`}
                      key={tab}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                {workAllocation
                  .filter((item) =>
                    matchesDeadlineFilter(
                      dashboardAssignmentFilter,
                      item.dueDate,
                      item.status,
                    ),
                  )
                  .map((item) => {
                    const deadline = deadlineState(item.dueDate, item.status);
                    return (
                      <button
                        className={`assignment-row deadline-row ${deadline}`}
                        key={item.id}
                        onClick={() => openAssignment(item.title, item.id)}
                      >
                        <span className={`status-icon ${deadline}`}>
                          <Icon
                            name={
                              deadline === "completed"
                                ? "check"
                                : deadline === "overdue"
                                  ? "warning"
                                  : "clock"
                            }
                          />
                        </span>
                        <div className="grow">
                          <strong>{item.title}</strong>
                          <small>
                            {item.division} | {item.assignee}
                          </small>
                        </div>
                        <div className="due">
                          <span>
                            {item.dueDate
                              ? `Due: ${new Date(item.dueDate).toLocaleDateString("en-KE")}`
                              : "No due date"}
                          </span>
                          <em className={`deadline-badge ${deadline}`}>
                            {deadlineLabel(item.dueDate, item.status)}
                          </em>
                        </div>
                        <span className="more">â‹®</span>
                      </button>
                    );
                  })}
              </article>

              <div className="right-stack">
                <article className="panel">
                  <div className="panel-title">
                    <h2>Announcements</h2>
                    <button
                      title="Open Notifications to review published department alerts."
                      onClick={() => navigateTo("Notifications")}
                    >
                      View all <Icon name="arrow" />
                    </button>
                  </div>
                  {announcements.map(([icon, title, text, date]) => (
                    <div className="announcement" key={title}>
                      <span className="square-icon orange">
                        <Icon name={icon as IconName} />
                      </span>
                      <div className="grow">
                        <strong>{title}</strong>
                        <small>{text}</small>
                      </div>
                      <time>{date}</time>
                    </div>
                  ))}
                </article>
                <article className="panel calendar-panel">
                  <div className="panel-title">
                    <h2>Calendar</h2>
                    <button
                      title="Keep the dashboard calendar in view and review scheduled events."
                      onClick={() => navigateTo("Calendar")}
                    >
                      View calendar <Icon name="arrow" />
                    </button>
                  </div>
                  <div className="calendar-body">
                    <div className="date-card">
                      <span>AUG</span>
                      <strong>06</strong>
                      <small>WED</small>
                    </div>
                    <div className="events">
                      <p>
                        <b>Quarterly Research Review Meeting</b>
                        <span>10:00 AM - 12:00 PM</span>
                      </p>
                      <p>
                        <b>Due: Policy Review on PM</b>
                        <span>All day</span>
                      </p>
                    </div>
                  </div>
                </article>
              </div>
            </section>
            <section className="panel dashboard-research-status">
              <div className="panel-title">
                <div>
                  <h2>Research Deadline Status</h2>
                  <small>
                    Green = on track | Orange = almost due | Red = overdue
                  </small>
                </div>
                <button onClick={() => setActive("Research Repository")}>
                  View research <Icon name="arrow" />
                </button>
              </div>

              <div className="tabs deadline-tabs" role="tablist">
                {["All", "On Track", "Almost Due", "Overdue", "Completed"].map(
                  (tab) => (
                    <button
                      role="tab"
                      aria-selected={dashboardResearchFilter === tab}
                      onClick={() => setDashboardResearchFilter(tab)}
                      className={`${dashboardResearchFilter === tab ? "active" : ""} ${tab.toLowerCase().replaceAll(" ", "-")}`}
                      key={tab}
                    >
                      {tab}
                    </button>
                  ),
                )}
              </div>

              <div className="research-deadline-list">
                {researchRows
                  .filter((project) =>
                    matchesDeadlineFilter(
                      dashboardResearchFilter,
                      project.end_date,
                      project.status,
                    ),
                  )
                  .map((project) => {
                    const deadline = deadlineState(
                      project.end_date,
                      project.status,
                    );
                    return (
                      <button
                        type="button"
                        className={`research-deadline-row ${deadline}`}
                        key={project.id}
                        onClick={async () => {
                          setSelectedResearch(project);
                          setResearchPlanDraft({
                            summary: project.summary || "",
                            researchQuestion: project.research_question || "",
                            objectives: project.objectives || "",
                            methodology: project.methodology || "",
                            startDate: project.start_date || "",
                            endDate: project.end_date || "",
                          });
                          setResearchTeamDraft({
                            leadId: project.lead_id,
                            collaborators: project.collaborators.map(
                              (person) => ({
                                userId: person.id,
                                role: [
                                  "Researcher",
                                  "Analyst",
                                  "Reviewer",
                                  "Subject Matter Expert",
                                ].includes(person.role)
                                  ? person.role
                                  : "Researcher",
                              }),
                            ),
                          });
                          setResearchTab("Overview");
                          setSelectedReportSection(null);
                          setReportContent("");
                          try {
                            const [
                              comments,
                              report,
                              sources,
                              activityRows,
                              templates,
                              documents,
                            ] = await Promise.all([
                              api.researchComments(token, project.id),
                              api.researchReport(token, project.id),
                              api.researchSources(token, project.id),
                              api.researchActivity(token, project.id),
                              api.documentTemplates(token, "Research"),
                              api.generatedDocuments(
                                token,
                                "Research",
                                project.id,
                              ),
                            ]);
                            setResearchComments(comments);
                            setResearchReport(report);
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
                            }
                          } catch {
                            setResearchComments([]);
                            setResearchReport([]);
                          }
                        }}
                      >
                        <span className={`status-icon ${deadline}`}>
                          <Icon
                            name={
                              deadline === "completed"
                                ? "check"
                                : deadline === "overdue"
                                  ? "warning"
                                  : "research"
                            }
                          />
                        </span>
                        <div className="grow">
                          <strong>{project.title}</strong>
                          <small>
                            {project.lead_name || "Lead not assigned"} |{" "}
                            {project.status}
                          </small>
                        </div>
                        <div className="due">
                          <span>
                            {project.end_date
                              ? `Ends: ${new Date(project.end_date).toLocaleDateString("en-KE")}`
                              : "No end date"}
                          </span>
                          <em className={`deadline-badge ${deadline}`}>
                            {deadlineLabel(project.end_date, project.status)}
                          </em>
                        </div>
                      </button>
                    );
                  })}
                {!researchRows.filter((project) =>
                  matchesDeadlineFilter(
                    dashboardResearchFilter,
                    project.end_date,
                    project.status,
                  ),
                ).length && (
                  <div className="deadline-empty">
                    No research projects in this status.
                  </div>
                )}
              </div>
            </section>
            <section className="bottom-grid">
              <article className="panel knowledge-panel">
                <div className="panel-title">
                  <h2>Recent Documents</h2>
                  <button
                    title="Open the central Document Repository."
                    onClick={() => navigateTo("Document Repository")}
                  >
                    View all <Icon name="arrow" />
                  </button>
                </div>
                {knowledge.map(([title, meta, date]) => (
                  <div className="knowledge-row" key={title}>
                    <span className="square-icon">
                      <Icon name="documents" />
                    </span>
                    <div className="grow">
                      <strong>{title}</strong>
                      <small>{meta}</small>
                    </div>
                    <time>{date}</time>
                  </div>
                ))}
              </article>
              <article className="panel quick-links">
                <div className="panel-title">
                  <h2>Quick Links</h2>
                </div>
                <div>
                  {(
                    [
                      ["knowledge", "Document Repository"],
                      ["research", "Research Repository"],
                      ["reports", "Reports & Analytics"],
                      ["team", "Team & Users"],
                      ["audit", "Audit Logs"],
                      ["notifications", "Notifications"],
                      ["announce", "Notice Board"],
                      ["calendar", "Calendar"],
                      ["settings", "Settings"],
                    ] as [IconName, string][]
                  )
                    .filter(([, label]) =>
                      roleNavigation[user.role].includes(label),
                    )
                    .map(([icon, label]) => (
                      <button
                        key={label}
                        title={navigationDescriptions[label]}
                        data-tooltip={navigationDescriptions[label]}
                        onClick={() => navigateTo(label)}
                      >
                        <Icon name={icon} />
                        <span>{navigationDisplayLabel(label)}</span>
                        {label === "Notifications" && (
                          <b>
                            {
                              notifications.filter((item) => !item.read_at)
                                .length
                            }
                          </b>
                        )}
                      </button>
                    ))}
                </div>
              </article>
              <article className="panel activity-panel">
                <div className="panel-title">
                  <h2>Activity Feed</h2>
                  <button
                    title="Open Audit Logs to inspect the complete recorded activity history."
                    onClick={() =>
                      navigateTo(
                        user.role === "Administrator"
                          ? "Audit Logs"
                          : "Notifications",
                      )
                    }
                  >
                    View all <Icon name="arrow" />
                  </button>
                </div>
                {activity.map(([icon, title, text, time, tone]) => (
                  <div className="activity-row" key={title}>
                    <span className={`round-icon ${tone}`}>
                      <Icon name={icon as IconName} />
                    </span>
                    <div className="grow">
                      <strong>{title}</strong>
                      <small>{text}</small>
                    </div>
                    <time>{time}</time>
                  </div>
                ))}
              </article>
            </section>
            <footer>
              <span>
                Â© 2026 Public Service Commission, Kenya. All rights reserved.
              </span>
              <div>
                <a href="#">Privacy Policy</a>
                <i />
                <a href="#">Terms of Use</a>
              </div>
            </footer>
          </div>
        </main>
        {roleNavigation[user.role].includes("AI Researcher") && (
          <FelixAssistant
            online={Boolean(aiResearchEngine?.ollamaConnected)}
            onOpen={() => {
              setActive("AI Researcher");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
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
                Ã—
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
          <div className="modal-backdrop" onClick={() => setPasswordMode(null)}>
            <section
              className="profile-modal password-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <button className="close" onClick={() => setPasswordMode(null)}>
                Ã—
              </button>
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
            </section>
          </div>
        )}
        {assignmentSourceChoiceOpen && (
          <div className="research-source-choice-backdrop" onClick={() => setAssignmentSourceChoiceOpen(false)}>
            <section className="research-source-choice" onClick={(event) => event.stopPropagation()} aria-label="Choose assignment source">
              <header>
                <div>
                  <small>ASSIGNMENT SOURCE</small>
                  <h2>How will this assignment be completed?</h2>
                  <p>Choose this before App2 allocates staff or creates tasks. External completed work should go directly to controlled report import and review.</p>
                </div>
                <button type="button" aria-label="Close" onClick={() => setAssignmentSourceChoiceOpen(false)}>Ã—</button>
              </header>
              <div className="research-source-choice-options">
                <button type="button" className="research-source-option" onClick={() => beginAssignmentCreation("Internal")}>
                  <span className="research-source-option-icon">IN</span>
                  <span>
                    <strong>Internal assignment</strong>
                    <small>Work will be completed by App2 staff through the assignment workspace.</small>
                    <em>Assign members, create tasks, collect evidence, prepare the report and send it for review.</em>
                  </span>
                  <b>â†’</b>
                </button>
                <button type="button" className="research-source-option external" onClick={() => beginAssignmentCreation("External")}>
                  <span className="research-source-option-icon">EX</span>
                  <span>
                    <strong>External completed work</strong>
                    <small>A report or deliverable already exists outside App2.</small>
                    <em>Do not allocate members or tasks. Register the assignment, import the report and select a reviewer before a final report can be generated.</em>
                  </span>
                  <b>â†’</b>
                </button>
              </div>
              <footer>
                <span>You can still import an external report later from an internal assignment's Reports workspace.</span>
                <button type="button" onClick={() => setAssignmentSourceChoiceOpen(false)}>Cancel</button>
              </footer>
            </section>
          </div>
        )}
        {assignmentEditor && (
          <div
            className="modal-backdrop"
            onClick={() => setAssignmentEditor(null)}
          >
            <section
              className="assignment-editor"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="close"
                onClick={() => setAssignmentEditor(null)}
              >
                Ã—
              </button>
              <h2>
                {assignmentEditor === "new"
                  ? assignmentCreationMode === "External"
                    ? "Register external assignment"
                    : "Create assignment"
                  : "Edit assignment"}
              </h2>
              {assignmentEditor === "new" && assignmentCreationMode === "External" && (
                <div className="session-message" role="note">
                  <strong>External completed work:</strong> App2 will create only the governed assignment record. No members or tasks will be assigned. After saving, you will go directly to the Final Assignment Report import and reviewer handoff.
                </div>
              )}
              <form onSubmit={saveAssignment}>
                <label>
                  Title
                  <input
                    value={assignmentForm.title}
                    onChange={(event) =>
                      setAssignmentForm({
                        ...assignmentForm,
                        title: event.target.value,
                      })
                    }
                    required
                    minLength={4}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    value={assignmentForm.description}
                    onChange={(event) =>
                      setAssignmentForm({
                        ...assignmentForm,
                        description: event.target.value,
                      })
                    }
                  />
                </label>
                <div className="form-pair">
                  <label>
                    Division
                    <input
                      value={assignmentForm.division}
                      onChange={(event) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          division: event.target.value,
                        })
                      }
                      required
                    />
                  </label>
                  <label>
                    Due date
                    <input
                      type="date"
                      value={assignmentForm.dueDate || ""}
                      onChange={(event) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          dueDate: event.target.value || null,
                        })
                      }
                    />
                  </label>
                </div>
                <label>
                  Priority
                  <select
                    value={assignmentForm.priority}
                    onChange={(event) =>
                      setAssignmentForm({
                        ...assignmentForm,
                        priority: event.target.value,
                      })
                    }
                  >
                    <option>Low</option>
                    <option>Normal</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </label>
                {(assignmentEditor !== "new" || assignmentCreationMode === "Internal") && (
                  <fieldset>
                    <legend>Assign members</legend>
                    {team
                      .filter((member) => member.role !== "Administrator")
                      .map((member) => (
                        <label key={member.id}>
                          <input
                            type="checkbox"
                            checked={assignmentForm.memberIds.includes(member.id)}
                            onChange={(event) =>
                              setAssignmentForm({
                                ...assignmentForm,
                                memberIds: event.target.checked
                                  ? [...assignmentForm.memberIds, member.id]
                                  : assignmentForm.memberIds.filter(
                                      (id) => id !== member.id,
                                    ),
                              })
                            }
                          />
                          {member.name}
                          <small>{member.role}</small>
                        </label>
                      ))}
                  </fieldset>
                )}
                <button className="sign-in" disabled={savingAssignment}>
                  {savingAssignment
                    ? "Saving..."
                    : assignmentEditor === "new" && assignmentCreationMode === "External"
                      ? "Continue to external report"
                      : "Save assignment"}
                </button>
              </form>
            </section>
          </div>
        )}
        {selectedAudit && (
          <div
            className="modal-backdrop"
            onClick={() => setSelectedAudit(null)}
          >
            <section
              className="assignment-editor audit-detail"
              onClick={(event) => event.stopPropagation()}
            >
              <button className="close" onClick={() => setSelectedAudit(null)}>
                Ã—
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
              <div className="success-mark">âœ“</div>
              <p>ACCOUNT CREATED</p>
              <h2 id="account-success-title">
                User account created successfully
              </h2>
              <span>
                {createdAccount.name} can now sign in using{" "}
                <strong>{createdAccount.email}</strong>.
              </span>
              <div className="success-password">
                <small>Temporary password</small>
                <strong>{createdAccount.password}</strong>
                <button
                  onClick={() =>
                    navigator.clipboard.writeText(createdAccount.password)
                  }
                >
                  Copy password
                </button>
              </div>
              <small className="security-note">
                Share this password through an approved secure channel. The user
                will be asked to create a private password after signing in.
              </small>
              <h3>What would you like to do next?</h3>
              <div className="success-actions">
                <button
                  className="add-another"
                  onClick={() => {
                    setCreatedAccount(null);
                    openUserEditor();
                  }}
                >
                  + Add another user
                </button>
                <button
                  onClick={() => {
                    setCreatedAccount(null);
                    setTemporaryCredential("");
                  }}
                >
                  Exit
                </button>
              </div>
            </section>
          </div>
        )}
        {userEditor && (
          <div
            className="modal-backdrop"
            onClick={() => {
              if (!savingUser) setUserEditor(null);
            }}
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
                Ã—
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
                        setUserForm({ ...userForm, role: event.target.value })
                      }
                      disabled={savingUser}
                    >
                      {[
                        ...(user?.role === "Administrator" ? ["Administrator"] : []),
                        "Research Manager",
                        "Research Officer",
                        "Reviewer",
                      ].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                    <small>
                      System-wide role. Research Managers may assign approved
                      management, officer and reviewer roles; Administrator
                      access remains protected.
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
                {userEditor === "new" ? (
                  <label>
                    Temporary password{" "}
                    <small>
                      Leave blank to generate one, or use at least 10 characters
                      with uppercase, lowercase and a number.
                    </small>
                    <input
                      type="password"
                      value={userForm.temporaryPassword}
                      onChange={(event) =>
                        setUserForm({
                          ...userForm,
                          temporaryPassword: event.target.value,
                        })
                      }
                      minLength={10}
                      pattern={
                        userForm.temporaryPassword
                          ? "(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{10,128}"
                          : undefined
                      }
                      title="Use at least 10 characters including uppercase, lowercase and a number."
                      disabled={savingUser}
                    />
                  </label>
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
                        disabled={savingUser}
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
          <div
            className="modal-backdrop"
            onClick={() => {
              if (!knowledgeUploading) setKnowledgeUploadOpen(false);
            }}
          >
            <section
              className="assignment-editor repository-upload"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="close"
                disabled={knowledgeUploading}
                onClick={() => setKnowledgeUploadOpen(false)}
              >
                Ã—
              </button>
              <p>DOCUMENT PROVENANCE</p>
              <h2>Add repository document</h2>
              <form onSubmit={uploadKnowledge}>
                <label>
                  Document
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                    disabled={knowledgeUploading}
                    onChange={(event) =>
                      setKnowledgeFile(event.target.files?.[0] || null)
                    }
                    required
                  />
                </label>
                <label>
                  Title
                  <input
                    value={knowledgeForm.title}
                    disabled={knowledgeUploading}
                    onChange={(event) =>
                      setKnowledgeForm({
                        ...knowledgeForm,
                        title: event.target.value,
                      })
                    }
                    required
                  />
                </label>
                <label>
                  Description
                  <textarea
                    value={knowledgeForm.description}
                    disabled={knowledgeUploading}
                    onChange={(event) =>
                      setKnowledgeForm({
                        ...knowledgeForm,
                        description: event.target.value,
                      })
                    }
                  />
                </label>
                <div className="form-pair">
                  <label>
                    Category
                    <select
                      value={knowledgeForm.category}
                      disabled={knowledgeUploading}
                      onChange={(event) =>
                        setKnowledgeForm({
                          ...knowledgeForm,
                          category: event.target.value,
                        })
                      }
                    >
                      {[
                        "Policy",
                        "Report",
                        "Circular",
                        "Research Paper",
                        "Book",
                        "Template",
                      ].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Tags
                    <input
                      value={knowledgeForm.tags}
                      disabled={knowledgeUploading}
                      onChange={(event) =>
                        setKnowledgeForm({
                          ...knowledgeForm,
                          tags: event.target.value,
                        })
                      }
                      placeholder="governance, HR, digital"
                    />
                  </label>
                </div>
                <div className="repository-provenance-fields">
                  <label>
                    Document source
                    <select
                      value={knowledgeForm.sourceType}
                      disabled={knowledgeUploading}
                      onChange={(event) =>
                        setKnowledgeForm({
                          ...knowledgeForm,
                          sourceType: event.target.value,
                          sourceUrl: "",
                          originEntityId: "",
                        })
                      }
                    >
                      {[
                        "Internet",
                        "Research",
                        "Assignment",
                        "Task",
                        "App2 Report",
                        "External Upload",
                        "App2 Upload",
                      ].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  {knowledgeForm.sourceType === "Internet" && (
                    <label>
                      Original source URL
                      <input
                        type="url"
                        required
                        value={knowledgeForm.sourceUrl}
                        disabled={knowledgeUploading}
                        onChange={(event) =>
                          setKnowledgeForm({
                            ...knowledgeForm,
                            sourceUrl: event.target.value,
                          })
                        }
                        placeholder="https://..."
                      />
                    </label>
                  )}
                  {["Research", "Assignment", "Task", "App2 Report"].includes(
                    knowledgeForm.sourceType,
                  ) && (
                    <label>
                      Originating App2 record
                      <select
                        required
                        value={knowledgeForm.originEntityId}
                        disabled={knowledgeUploading}
                        onChange={(event) =>
                          setKnowledgeForm({
                            ...knowledgeForm,
                            originEntityId: event.target.value,
                          })
                        }
                      >
                        <option value="">
                          Select {knowledgeForm.sourceType.toLowerCase()}
                        </option>
                        {repositoryOrigins
                          .filter(
                            (item) => item.type === knowledgeForm.sourceType,
                          )
                          .map((item) => (
                            <option value={item.id} key={item.id}>
                              {item.title}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                </div>
                <div className="provenance-note">
                  <strong>Accountability recorded automatically</strong>
                  <span>
                    App2 records the uploader, originating team, assigned
                    reviewer and final approver.
                  </span>
                </div>
                <label className="setting-toggle repository-felix-toggle">
                  <input
                    type="checkbox"
                    checked={knowledgeForm.felixEnabled}
                    disabled={knowledgeUploading}
                    onChange={(event) =>
                      setKnowledgeForm({
                        ...knowledgeForm,
                        felixEnabled: event.target.checked,
                      })
                    }
                  />
                  <span>
                    <strong>Make available to Felix after approval</strong>
                    <small>
                      The approved current version will be indexed automatically.
                      Draft or rejected documents remain unavailable to Felix.
                    </small>
                  </span>
                </label>
                {knowledgeUploadProgress.progress > 0 && (
                  <div
                    className={`upload-link-progress ${knowledgeUploadProgress.state}`}
                    role="status"
                    aria-live="polite"
                  >
                    <div>
                      <i
                        style={{
                          width: `${knowledgeUploadProgress.progress}%`,
                        }}
                      />
                    </div>
                    <span>{knowledgeUploadProgress.label}</span>
                  </div>
                )}
                {knowledgeUploadProgress.state === "failed" && knowledgeNotice && (
                  <div className="user-form-error" role="alert">
                    {knowledgeNotice}
                  </div>
                )}
                <button className="sign-in" disabled={knowledgeUploading}>
                  {knowledgeUploading ? "Uploading..." : "Upload for review"}
                </button>
              </form>
            </section>
          </div>
        )}
        {selectedKnowledge && (
          <div
            className="modal-backdrop"
            onClick={() => setSelectedKnowledge(null)}
          >
            <section
              className="assignment-editor"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="close"
                onClick={() => setSelectedKnowledge(null)}
              >
                Ã—
              </button>
              <h2>{selectedKnowledge.title}</h2>
              <p>{selectedKnowledge.description}</p>
              <div className="version-list">
                {knowledgeVersions.map((version) => (
                  <div key={version.id}>
                    <span>
                      <strong>Version {version.version_number}</strong>
                      <small>
                        {version.original_name} | {version.created_by_name}
                      </small>
                    </span>
                    <button
                      onClick={() => {
                        setReaderVersionId(version.id);
                        setReaderDocument(selectedKnowledge as DocumentItem);
                        setSelectedKnowledge(null);
                      }}
                    >
                      Read
                    </button>
                    <button
                      onClick={() =>
                        api.downloadKnowledgeVersion(
                          token,
                          version.id,
                          version.original_name,
                        )
                      }
                    >
                      Download
                    </button>
                  </div>
                ))}
              </div>
              <label className="version-upload">
                Upload new version
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
        {researchSourceChoiceOpen && (
          <div className="research-source-choice-backdrop" role="presentation" onClick={() => setResearchSourceChoiceOpen(false)}>
            <section className="research-source-choice" role="dialog" aria-modal="true" aria-labelledby="research-source-choice-title" onClick={(event) => event.stopPropagation()}>
              <header>
                <div>
                  <small>NEW RESEARCH</small>
                  <h2 id="research-source-choice-title">How will this research be produced?</h2>
                  <p>Choose this before App2 creates a workspace so external research is not given unnecessary assignments.</p>
                </div>
                <button type="button" aria-label="Close" onClick={() => setResearchSourceChoiceOpen(false)}>Ã—</button>
              </header>
              <div className="research-source-choice-options">
                <button type="button" className="research-source-option" onClick={() => { setResearchSourceChoiceOpen(false); setResearchFormStep(1); setResearchOpen(true); }}>
                  <span className="research-source-option-icon" aria-hidden="true">I</span>
                  <span>
                    <strong>Internal research</strong>
                    <small>Research will be planned and carried out inside App2.</small>
                    <em>Creates a research workspace with linked assignments, resources, report drafting and review.</em>
                  </span>
                  <b aria-hidden="true">â†’</b>
                </button>
                <button type="button" className="research-source-option external" onClick={() => { setResearchSourceChoiceOpen(false); setSelectedResearch(null); setResearchRepositoryMode("Imported"); setExternalResearchOpen(true); }}>
                  <span className="research-source-option-icon" aria-hidden="true">E</span>
                  <span>
                    <strong>External research</strong>
                    <small>A completed or substantially completed report already exists outside App2.</small>
                    <em>Skips assignment creation. Import the report, select a reviewer and send it directly through controlled review.</em>
                  </span>
                  <b aria-hidden="true">â†’</b>
                </button>
              </div>
              <footer>
                <span>You can still import an external report later from an internal project's Work tab.</span>
                <button type="button" onClick={() => setResearchSourceChoiceOpen(false)}>Cancel</button>
              </footer>
            </section>
          </div>
        )}
        {researchOpen && (
          <div
            className="research-wizard-shell"
            role="dialog"
            aria-modal="true"
            aria-labelledby="research-wizard-title"
          >
            <header className="research-wizard-header">
              <button
                type="button"
                onClick={() => {
                  setResearchOpen(false);
                  setResearchFormStep(1);
                }}
              >
                Back
              </button>
              <div>
                <p>APP2 RESEARCH WORKSPACE</p>
                <h1 id="research-wizard-title">Create a research project</h1>
                <span>
                  Define the mandate, appoint the team and confirm the delivery
                  plan.
                </span>
              </div>
              <button
                type="button"
                aria-label="Close research wizard"
                onClick={() => {
                  setResearchOpen(false);
                  setResearchFormStep(1);
                }}
              >
                Ã—
              </button>
            </header>
            <div className="research-wizard-body">
              <aside className="research-wizard-steps">
                {(
                  [
                    {
                      step: 1,
                      title: "Research brief",
                      detail: "Purpose and decision question",
                    },
                    {
                      step: 2,
                      title: "Team & ownership",
                      detail: "Lead and collaborators",
                    },
                    {
                      step: 3,
                      title: "Timeline & review",
                      detail: "Dates and confirmation",
                    },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.step}
                    type="button"
                    className={
                      researchFormStep === item.step
                        ? "active"
                        : researchFormStep > item.step
                          ? "complete"
                          : ""
                    }
                    onClick={() => setResearchFormStep(item.step)}
                  >
                    <b>{researchFormStep > item.step ? "âœ“" : item.step}</b>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.detail}</small>
                    </span>
                  </button>
                ))}
                <div className="research-wizard-help">
                  <strong>What happens next?</strong>
                  <p>
                    The project begins in Planning. The team adds accountable
                    milestones and evidence before manager approval.
                  </p>
                </div>
              </aside>
              <form className="research-wizard-form" onSubmit={saveResearch}>
                {researchFormStep === 1 && (
                  <section>
                    <header>
                      <small>STEP 1 OF 3</small>
                      <h2>Research brief</h2>
                      <p>
                        State what the research must answer and how it will
                        support a Commission decision.
                      </p>
                    </header>
                    <label>
                      Project title
                      <input
                        autoFocus
                        value={researchForm.title}
                        onChange={(event) =>
                          setResearchForm({
                            ...researchForm,
                            title: event.target.value,
                          })
                        }
                        required
                        minLength={4}
                        placeholder="e.g. Public service digital capability assessment"
                      />
                    </label>
                    <label>
                      Executive summary
                      <textarea
                        value={researchForm.summary}
                        onChange={(event) =>
                          setResearchForm({
                            ...researchForm,
                            summary: event.target.value,
                          })
                        }
                        placeholder="Describe the policy need, scope and intended outcome."
                      />
                    </label>
                    <label>
                      Primary research question
                      <textarea
                        value={researchForm.researchQuestion}
                        onChange={(event) =>
                          setResearchForm({
                            ...researchForm,
                            researchQuestion: event.target.value,
                          })
                        }
                        placeholder="What decision or evidence gap must this project address?"
                      />
                    </label>
                    <div className="research-wizard-two">
                      <label>
                        Objectives
                        <textarea
                          value={researchForm.objectives}
                          onChange={(event) =>
                            setResearchForm({
                              ...researchForm,
                              objectives: event.target.value,
                            })
                          }
                          placeholder="List measurable objectives."
                        />
                      </label>
                      <label>
                        Methodology
                        <textarea
                          value={researchForm.methodology}
                          onChange={(event) =>
                            setResearchForm({
                              ...researchForm,
                              methodology: event.target.value,
                            })
                          }
                          placeholder="Describe evidence collection and analysis."
                        />
                      </label>
                    </div>
                  </section>
                )}
                {researchFormStep === 2 && (
                  <section>
                    <header>
                      <small>STEP 2 OF 3</small>
                      <h2>Team and accountability</h2>
                      <p>
                        Appoint one accountable lead and the colleagues who will
                        contribute or review.
                      </p>
                    </header>
                    <label>
                      Lead researcher
                      <select
                        autoFocus
                        value={researchForm.leadId}
                        onChange={(event) =>
                          setResearchForm({
                            ...researchForm,
                            leadId: event.target.value,
                            collaboratorIds:
                              researchForm.collaboratorIds.filter(
                                (id) => id !== event.target.value,
                              ),
                          })
                        }
                        required
                      >
                        <option value="">Select lead researcher</option>
                        {team
                          .filter(
                            (member) =>
                              member.role === "Research Officer" ||
                              member.role === "Research Manager",
                          )
                          .map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.name} â€” {member.role}
                            </option>
                          ))}
                      </select>
                    </label>
                    <fieldset className="research-team-picker">
                      <legend>
                        Research collaborators{" "}
                        <small>
                          {researchForm.collaboratorIds.length} selected
                        </small>
                      </legend>
                      {team
                        .filter(
                          (member) =>
                            [
                              "Research Officer",
                              "Research Manager",
                            ].includes(member.role) &&
                            member.id !== researchForm.leadId,
                        )
                        .map((member) => (
                          <label key={member.id}>
                            <input
                              type="checkbox"
                              checked={researchForm.collaboratorIds.includes(
                                member.id,
                              )}
                              onChange={(event) =>
                                setResearchForm({
                                  ...researchForm,
                                  collaboratorIds: event.target.checked
                                    ? [
                                        ...researchForm.collaboratorIds,
                                        member.id,
                                      ]
                                    : researchForm.collaboratorIds.filter(
                                        (id) => id !== member.id,
                                      ),
                                })
                              }
                            />
                            <b>
                              {member.name
                                .split(" ")
                                .map((name) => name[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()}
                            </b>
                            <span>
                              <strong>{member.name}</strong>
                              <small>
                                {member.role} Â· {member.division}
                              </small>
                            </span>
                          </label>
                        ))}
                    </fieldset>
                    <fieldset className="research-team-picker research-reviewer-picker-wizard">
                      <legend>
                        Formal reviewers <small>{researchForm.reviewerIds.length} selected</small>
                      </legend>
                      <p className="research-reviewer-help">Reviewer assignment is contextual to this research project. Reviewers are not added to the working team.</p>
                      {team
                        .filter((member) => member.active && ["Reviewer", "Research Manager", "Administrator"].includes(member.role) && member.id !== researchForm.leadId)
                        .map((member) => (
                          <label key={member.id}>
                            <input
                              type="checkbox"
                              checked={researchForm.reviewerIds.includes(member.id)}
                              onChange={(event) => setResearchForm({
                                ...researchForm,
                                reviewerIds: event.target.checked
                                  ? [...researchForm.reviewerIds, member.id]
                                  : researchForm.reviewerIds.filter((id) => id !== member.id),
                              })}
                            />
                            <b>{member.name.split(" ").map((name) => name[0]).slice(0, 2).join("").toUpperCase()}</b>
                            <span><strong>{member.name}</strong><small>{member.role} Â· {member.division}</small></span>
                          </label>
                        ))}
                    </fieldset>
                  </section>
                )}
                {researchFormStep === 3 && (
                  <section>
                    <header>
                      <small>STEP 3 OF 3</small>
                      <h2>Timeline and confirmation</h2>
                      <p>
                        Set the delivery window and confirm the project. Related assignments are created or linked from the Work tab after creation.
                      </p>
                    </header>
                    <div className="research-wizard-two">
                      <label>
                        Start date
                        <input
                          autoFocus
                          type="date"
                          value={researchForm.startDate}
                          onChange={(event) =>
                            setResearchForm({
                              ...researchForm,
                              startDate: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Target completion date
                        <input
                          type="date"
                          min={researchForm.startDate || undefined}
                          value={researchForm.endDate}
                          onChange={(event) =>
                            setResearchForm({
                              ...researchForm,
                              endDate: event.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                    <div className="research-wizard-summary">
                      <div>
                        <small>PROJECT</small>
                        <strong>
                          {researchForm.title || "Title not entered"}
                        </strong>
                        <span>
                          {researchForm.researchQuestion ||
                            "Research question not entered"}
                        </span>
                      </div>
                      <div>
                        <small>ACCOUNTABLE LEAD</small>
                        <strong>
                          {team.find(
                            (member) => member.id === researchForm.leadId,
                          )?.name || "Not selected"}
                        </strong>
                        <span>
                          {researchForm.collaboratorIds.length} collaborator{researchForm.collaboratorIds.length === 1 ? "" : "s"} Â· {researchForm.reviewerIds.length} reviewer{researchForm.reviewerIds.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div>
                        <small>DELIVERY WINDOW</small>
                        <strong>
                          {researchForm.startDate || "Open start"} â†’{" "}
                          {researchForm.endDate || "Open completion"}
                        </strong>
                        <span>Initial status: Planning</span>
                      </div>
                    </div>
                  </section>
                )}
                <footer>
                  <button
                    type="button"
                    disabled={researchFormStep === 1}
                    onClick={() =>
                      setResearchFormStep((value) => (value - 1) as 1 | 2 | 3)
                    }
                  >
                    Previous
                  </button>
                  <span>Step {researchFormStep} of 3</span>
                  {researchFormStep < 3 ? (
                    <button
                      className="primary"
                      type="button"
                      disabled={
                        researchFormStep === 1
                          ? !researchForm.title.trim() ||
                            !researchForm.researchQuestion.trim()
                          : !researchForm.leadId
                      }
                      onClick={() =>
                        setResearchFormStep((value) => (value + 1) as 1 | 2 | 3)
                      }
                    >
                      Continue
                    </button>
                  ) : (
                    <button
                      className="primary"
                      type="submit"
                      disabled={
                        !researchForm.title.trim() || !researchForm.leadId
                      }
                    >
                      Create project & open workspace
                    </button>
                  )}
                </footer>
              </form>
            </div>
          </div>
        )}
        {aiResearchOpen && (
          <div
            className="modal-backdrop"
            onClick={() => setAiResearchOpen(false)}
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
                      <option>App2 Documents</option>
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
            onClick={() => setDeletionRequestDocument(null)}
          >
            <section
              className="assignment-editor deletion-request-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="close"
                onClick={() => setDeletionRequestDocument(null)}
              >
                Ã—
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
            onClick={() => setDeletionDecision(null)}
          >
            <section
              className="assignment-editor deletion-request-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="close"
                onClick={() => setDeletionDecision(null)}
              >
                Ã—
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
            onClick={() => setRetentionDocument(null)}
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
            onClick={() => setReviewDocument(null)}
          >
            <section
              className="assignment-editor review-editor"
              onClick={(event) => event.stopPropagation()}
            >
              <button className="close" onClick={() => setReviewDocument(null)}>
                x
              </button>
              <h2>Review document</h2>
              <p>
                <strong>{reviewDocument.title}</strong>
              </p>
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
              <div className="review-actions">
                <button
                  className="approve"
                  data-tooltip="Publish the approved document and record you as its reviewer."
                  onClick={() => reviewDocumentAction(true)}
                >
                  Approve & publish
                </button>
                <button
                  className="reject"
                  data-tooltip="Return the document to its owner with your correction instructions."
                  disabled={!rejectionReason.trim()}
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
            onClick={() => setReviewingNotice(null)}
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
          <div className="research-workspace" data-tab={researchTab}>
            <div className="research-command-header">
              <div className="research-command-top">
                <button
                  className="research-command-back"
                  type="button"
                  title="Back to Research Workspace"
                  onClick={() => {
                    setSelectedResearch(null);
                    setResearchComments([]);
                    setResearchComment("");
                    setResearchReport([]);
                    setSelectedReportSection(null);
                    setReportContent("");
                    setActive("Research Repository");
                  }}
                >
                  <span aria-hidden="true">â†</span>
                  <span>Back</span>
                </button>

                <div className="research-command-title">
                  <p>RESEARCH WORKSPACE</p>
                  <h1>
                    {selectedResearch.title || "Untitled Research Project"}
                  </h1>
                  <div className="research-command-subtitle">
                    Manage the research brief, work, evidence, report and review from one clear workspace.
                  </div>

                  <div className="research-command-meta">
                    <span className="research-command-status">
                      {selectedResearch.status || "Planning"}
                    </span>

                    <span className="research-command-meta-item">
                      <small>Timeline</small>
                      <strong>
                        {selectedResearch.start_date || "Not set"}
                        {" â†’ "}
                        {selectedResearch.end_date || "Open"}
                      </strong>
                    </span>

                    <span className="research-command-meta-item">
                      <small>Lead researcher</small>
                      <strong>
                        {selectedResearch.lead_name || "Not assigned"}
                      </strong>
                    </span>
                  </div>
                </div>

                <button
                  className="research-command-close"
                  type="button"
                  title="Close workspace and return to the previous screen"
                  onClick={() => {
                    setSelectedResearch(null);
                    setResearchComments([]);
                    setResearchComment("");
                    setResearchReport([]);
                    setSelectedReportSection(null);
                    setReportContent("");
                  }}
                >
                  Ã—
                </button>
                {isManager && (
                  <div className="research-record-actions" aria-label="Research record controls">
                    {selectedResearch.status !== "Archived" ? (
                      <button type="button" className="task-archive-button" onClick={archiveSelectedResearch}>
                        Archive research
                      </button>
                    ) : (
                      <button type="button" className="task-delete-button" onClick={deleteSelectedResearch}>
                        Delete permanently
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="research-command-team">
                <div className="research-team-label">
                  <small>PROJECT TEAM</small>
                  <strong>
                    {(selectedResearch.collaborators?.length || 0) + 1}
                    {" members"}
                  </strong>
                </div>

                <div className="research-team-list">
                  <div className="research-team-person lead">
                    <span className="research-team-avatar">
                      {(selectedResearch.lead_name || "Lead")
                        .split(" ")
                        .map((name) => name[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </span>

                    <div>
                      <strong>
                        {selectedResearch.lead_name || "Lead researcher"}
                      </strong>
                      <small>Lead researcher</small>
                    </div>
                  </div>

                  {selectedResearch.collaborators?.map((person) => (
                    <div className="research-team-person" key={person.id}>
                      <span className="research-team-avatar">
                        {person.name
                          .split(" ")
                          .map((name) => name[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </span>

                      <div>
                        <strong>{person.name}</strong>
                        <small>{person.role || "Research team"}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <nav
              className="research-workspace-tabs"
              role="tablist"
              aria-label="Research workspace sections"
            >
              {(
                [
                  "Overview",
                  "Work",
                  "Resources",
                  "Report",
                  "Review",
                  "Activity",
                ] as const
              ).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={researchTab === tab}
                  className={researchTab === tab ? "active" : ""}
                  onPointerDown={() => setResearchTab(tab)}
                  onClick={() => setResearchTab(tab)}
                >
                  {tab === "Resources" ? "Evidence" : tab}
                </button>
              ))}
            </nav>

            {researchNextAction && (
              <div className="research-next-action">
                <div>
                  <small>NEXT STEP</small>
                  <strong>{researchNextAction.title}</strong>
                  <span>{researchNextAction.detail}</span>
                </div>
                <button type="button" onClick={() => {
                    if (researchNextAction.label === "Preview Research Brief") {
                      setResearchBriefOpen(true);
                      setResearchBriefEditing(false);
                      setResearchBriefRequestOpen(false);
                    } else {
                      setResearchTab(researchNextAction.tab);
                    }
                  }}>
                  {researchNextAction.label}
                </button>
              </div>
            )}

            {researchWorkspaceNotice && (
              <div className="research-workspace-notice" role="status">
                {researchWorkspaceNotice}
              </div>
            )}

            <section className="research-overview-panel">
              <header className="research-overview-simple-head">
                <div>
                  <small>OVERVIEW</small>
                  <h3>Project at a glance</h3>
                </div>
              </header>

              <div className="research-overview-metrics">
                <span>
                  <small>Reference</small>
                  <strong>{`RES-${selectedResearch.id.slice(0, 8).toUpperCase()}`}</strong>
                </span>
                <span>
                  <small>Milestones complete</small>
                  <strong>
                    {selectedResearch.milestones.length
                      ? `${selectedResearch.milestones.filter((item) => item.status === "Completed").length}/${selectedResearch.milestones.length}`
                      : "0/0"}
                  </strong>
                </span>
                <span>
                  <small>Related assignments</small>
                  <strong>{selectedResearch.assignments?.length || 0}</strong>
                </span>
              </div>

              <div className="workspace-document-overview">
                <header>
                  <div>
                    <small>DOCUMENTS</small>
                    <h4>Available documents</h4>
                  </div>
                  <div className="workspace-document-actions">
                    <strong>
                      {workspaceDocuments.length +
                        researchAttachedDocuments.length +
                        researchRepositoryDocuments.length}
                    </strong>
                    <label className="workspace-attach-report">
                      {knowledgeUploading ? "Attachingâ€¦" : "+ Attach document"}
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt,.md"
                        disabled={knowledgeUploading}
                        onChange={(event) => {
                          void attachWorkspaceReport(
                            event.target.files?.[0],
                            "Research",
                            selectedResearch.id,
                          );
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                </header>

                <div className="workspace-document-overview-list">
                  {workspaceDocuments.map((item) => (
                    <button
                      type="button"
                      key={`generated-${item.id}`}
                      onClick={() => void openGeneratedDocument(item.id, true)}
                      title={`Preview ${item.title}`}
                    >
                      <span>
                        <b>{item.title}</b>
                        <small>Generated research document Â· {item.status}</small>
                      </span>
                      <em>Preview</em>
                    </button>
                  ))}

                  {researchAttachedDocuments.map((item) => (
                    <button
                      type="button"
                      key={`research-attached-${item.id}`}
                      onClick={() => void openRepositoryDocumentReader(item)}
                      title={`Preview ${item.title} in Document Reader`}
                    >
                      <span>
                        <b>{item.title}</b>
                        <small>
                          Attached document Â· {item.status} Â· v{item.latest_version || item.current_version || 1}
                        </small>
                      </span>
                      <em>Preview</em>
                    </button>
                  ))}

                  {researchRepositoryDocuments.map((item) => (
                    <button
                      type="button"
                      key={`research-repository-${item.id}`}
                      onClick={() => void openRepositoryDocumentReader(item.id)}
                      title={`Preview ${item.title} in Document Reader`}
                    >
                      <span>
                        <b>{item.title}</b>
                        <small>
                          Repository evidence Â· {item.status} Â· v{item.latest_version || item.current_version || 1}
                        </small>
                      </span>
                      <em>Preview</em>
                    </button>
                  ))}

                  {!workspaceDocuments.length &&
                    !researchAttachedDocuments.length &&
                    !researchRepositoryDocuments.length && (
                      <p>No documents are attached to this research project yet.</p>
                    )}
                </div>
              </div>
            </section>

            <section className="research-team-panel">
              <header>
                <div><small>PROJECT TEAM</small><h3>Research team</h3><p>The lead and project members who can work in this Research Workspace.</p></div>
                {canManageResearchTeam && <button type="button" className="research-team-edit-button" onClick={() => setResearchTeamEditing((open) => !open)}>{researchTeamEditing ? "Close Team Editor" : "Add Team Members"}</button>}
              </header>
              <div className="research-team-summary">
                <div className="research-team-person"><b>{initialsFor(selectedResearch.lead_name)}</b><span><strong>{selectedResearch.lead_name}</strong><small>Lead researcher</small></span></div>
                {selectedResearch.collaborators.map((person) => <div className="research-team-person" key={person.id}><b>{initialsFor(person.name)}</b><span><strong>{person.name}</strong><small>{person.role}</small></span></div>)}
              </div>
              <div className="research-team-management-wrap" hidden={!researchTeamEditing}>
                <div className="research-team-lead-card"><div><span>LEAD RESEARCHER</span><h3>{team.find((member) => member.id === researchTeamDraft.leadId)?.name || selectedResearch.lead_name}</h3><p>Team leads may add or remove members. Only a manager may transfer the lead role.</p></div>
                  {isManager && <label>Change accountable lead<select value={researchTeamDraft.leadId} onChange={(event) => setResearchTeamDraft({leadId:event.target.value,collaborators:researchTeamDraft.collaborators.filter((item) => item.userId !== event.target.value)})}>{team.filter((member) => member.active && ["Research Officer","Research Manager"].includes(member.role)).map((member) => <option key={member.id} value={member.id}>{member.name} — {member.role}</option>)}</select></label>}
                </div>
                <div className="research-team-management"><header><div><h3>Team members</h3><p>Select the users who need access to this research project.</p></div><small>{researchTeamDraft.collaborators.length} selected</small></header>
                  <div className="research-team-selector">{team.filter((member) => member.active && ["Research Officer","Research Manager"].includes(member.role) && member.id !== researchTeamDraft.leadId).map((member) => {const selected=researchTeamDraft.collaborators.find((item) => item.userId === member.id);return <article key={member.id} className={selected ? "selected" : ""}><label><input type="checkbox" disabled={!canManageResearchTeam} checked={Boolean(selected)} onChange={(event) => setResearchTeamDraft({...researchTeamDraft,collaborators:event.target.checked?[...researchTeamDraft.collaborators,{userId:member.id,role:"Researcher"}]:researchTeamDraft.collaborators.filter((item) => item.userId !== member.id)})}/><b>{initialsFor(member.name)}</b><span><strong>{member.name}</strong><small>{member.role} · {member.division}</small></span></label>{selected && <select aria-label={`Project role for ${member.name}`} disabled={!canManageResearchTeam} value={selected.role} onChange={(event) => setResearchTeamDraft({...researchTeamDraft,collaborators:researchTeamDraft.collaborators.map((item) => item.userId === member.id ? {...item,role:event.target.value}:item)})}><option>Researcher</option><option>Analyst</option><option>Subject Matter Expert</option></select>}</article>;})}</div>
                </div>
                <footer><button type="button" disabled={!canManageResearchTeam || !researchTeamDraft.leadId || researchTeamSaving} onClick={async () => {try{setResearchTeamSaving(true);await api.updateResearchTeam(token,selectedResearch.id,researchTeamDraft);const projects=await api.research(token);const refreshed=projects.find((item)=>item.id===selectedResearch.id)||selectedResearch;setResearchRows(projects);setSelectedResearch(refreshed);setResearchTeamDraft({leadId:refreshed.lead_id,collaborators:refreshed.collaborators.map((person)=>({userId:person.id,role:person.role}))});setResearchActivity(await api.researchActivity(token,selectedResearch.id));setResearchTeamEditing(false);setResearchWorkspaceNotice("Research team updated and recorded.");}catch(error){setResearchWorkspaceNotice(error instanceof Error ? error.message : "Research team could not be updated.");}finally{setResearchTeamSaving(false);}}}>{researchTeamSaving ? "Saving Team..." : "Save Team"}</button></footer>
              </div>
            </section>

            <section className="research-brief-card"><header><div><small>RESEARCH BRIEF</small><h3>Research mandate</h3><p>The summary, research question, objectives and methodology were defined when this research was created.</p></div><button type="button" onClick={() => {setResearchBriefOpen(true);setResearchBriefEditing(false);setResearchBriefRequestOpen(false);}}>Preview Research Brief</button></header></section>
            {researchBriefOpen && <div className="research-brief-preview-backdrop" role="dialog" aria-modal="true" aria-label="Research Brief" onMouseDown={(event) => {if(event.target===event.currentTarget)setResearchBriefOpen(false);}}><div className="research-brief-preview"><header><div><small>RESEARCH BRIEF</small><h2>{selectedResearch.title}</h2></div><button type="button" className="brief-close" onClick={() => {setResearchBriefOpen(false);setResearchBriefEditing(false);setResearchBriefRequestOpen(false);}}>Close</button></header>
              <div className="research-brief-paper"><div className="brief-meta"><span><small>Reference</small><strong>{`RES-${selectedResearch.id.slice(0, 8).toUpperCase()}`}</strong></span><span><small>Lead</small><strong>{selectedResearch.lead_name}</strong></span><span><small>Status</small><strong>{selectedResearch.status}</strong></span><span><small>Target date</small><strong>{selectedResearch.end_date ? new Date(selectedResearch.end_date).toLocaleDateString("en-KE") : "Not set"}</strong></span></div>
              {researchBriefEditing ? <><label>Research summary<textarea value={researchPlanDraft.summary} onChange={(event) => setResearchPlanDraft({...researchPlanDraft,summary:event.target.value})}/></label><label>Primary research question<textarea value={researchPlanDraft.researchQuestion} onChange={(event) => setResearchPlanDraft({...researchPlanDraft,researchQuestion:event.target.value})}/></label><label>Objectives<textarea value={researchPlanDraft.objectives} onChange={(event) => setResearchPlanDraft({...researchPlanDraft,objectives:event.target.value})}/></label><label>Methodology<textarea value={researchPlanDraft.methodology} onChange={(event) => setResearchPlanDraft({...researchPlanDraft,methodology:event.target.value})}/></label><div className="research-plan-dates"><label>Start date<input type="date" value={researchPlanDraft.startDate} onChange={(event)=>setResearchPlanDraft({...researchPlanDraft,startDate:event.target.value})}/></label><label>Target completion<input type="date" min={researchPlanDraft.startDate||undefined} value={researchPlanDraft.endDate} onChange={(event)=>setResearchPlanDraft({...researchPlanDraft,endDate:event.target.value})}/></label></div></> : <><section><h3>Research summary</h3><p>{selectedResearch.summary || "No summary recorded."}</p></section><section><h3>Primary research question</h3><p>{selectedResearch.research_question || "No research question recorded."}</p></section><section><h3>Objectives</h3><p>{selectedResearch.objectives || "No objectives recorded."}</p></section><section><h3>Methodology</h3><p>{selectedResearch.methodology || "No methodology recorded."}</p></section></>}
              </div>
              {researchBriefRequestOpen && !isManager && <div className="research-brief-request-box"><strong>Request a brief change</strong><textarea value={researchBriefChangeReason} onChange={(event)=>setResearchBriefChangeReason(event.target.value)} placeholder="Explain what should change and why."/><button type="button" className="primary" disabled={researchBriefRequesting || !researchBriefChangeReason.trim()} onClick={async()=>{try{setResearchBriefRequesting(true);await api.requestResearchBriefChange(token,selectedResearch.id,researchBriefChangeReason.trim());setResearchActivity(await api.researchActivity(token,selectedResearch.id));setResearchBriefChangeReason("");setResearchBriefRequestOpen(false);setResearchWorkspaceNotice("Research Brief change request sent to the research managers.");}catch(error){setResearchWorkspaceNotice(error instanceof Error ? error.message : "Research Brief change request could not be sent.");}finally{setResearchBriefRequesting(false);}}}>{researchBriefRequesting ? "Sending Request..." : "Send Change Request"}</button></div>}
              <div className="research-brief-actions">{isManager && selectedResearch.status === "Planning" && !researchBriefEditing && <button type="button" className="primary" onClick={async()=>{try{await api.updateResearchStatus(token,selectedResearch.id,"Active");const projects=await api.research(token);setResearchRows(projects);setSelectedResearch(projects.find((item)=>item.id===selectedResearch.id)||selectedResearch);setResearchActivity(await api.researchActivity(token,selectedResearch.id));setResearchBriefOpen(false);setResearchWorkspaceNotice("Research started. The project is now active.");}catch(error){setResearchWorkspaceNotice(error instanceof Error ? error.message : "Research could not be started.");}}}>Start Research</button>}{isManager && !researchBriefEditing && <button type="button" onClick={()=>setResearchBriefEditing(true)}>Edit Research Brief</button>}{!isManager && selectedResearch.lead_id===user?.id && !researchBriefRequestOpen && <button type="button" onClick={()=>setResearchBriefRequestOpen(true)}>Request Brief Change</button>}{isManager && researchBriefEditing && <><button type="button" onClick={()=>setResearchBriefEditing(false)}>Cancel</button><button type="button" className="primary" disabled={researchPlanSaving} onClick={async()=>{try{setResearchPlanSaving(true);const updated=await api.updateResearchPlan(token,selectedResearch.id,{...researchPlanDraft,startDate:researchPlanDraft.startDate||null,endDate:researchPlanDraft.endDate||null});const projects=await api.research(token);const refreshed=projects.find((item)=>item.id===updated.id)||{...selectedResearch,...updated};setResearchRows(projects);setSelectedResearch(refreshed);setResearchActivity(await api.researchActivity(token,selectedResearch.id));setResearchBriefEditing(false);setResearchWorkspaceNotice("Research Brief updated and recorded in project activity.");}catch(error){setResearchWorkspaceNotice(error instanceof Error ? error.message : "Research Brief could not be updated.");}finally{setResearchPlanSaving(false);}}}>{researchPlanSaving ? "Saving..." : "Save Brief"}</button></>}</div>
            </div></div>}

            <section className="research-external-import-callout" aria-label="External research option">
              <div>
                <small>EXTERNAL REPORT AVAILABLE?</small>
                <h3>Do not create assignments for work already completed outside App2</h3>
                <p>If this project already has an external report, leave this workspace and import that report instead. App2 will require a reviewer before it can become a controlled final report.</p>
              </div>
              <button
                type="button"
                className="research-import-action"
                onClick={() => {
                  setSelectedResearch(null);
                  setResearchComments([]);
                  setResearchComment("");
                  setResearchReport([]);
                  setSelectedReportSection(null);
                  setReportContent("");
                  setResearchRepositoryMode("Imported");
                  setExternalResearchOpen(true);
                }}
              >
                Import external report â†’
              </button>
            </section>

            <section className="research-plan-panel research-milestones-panel">
              <header className="research-work-section-head">
                <div>
                  <small>WORK PLAN</small>
                  <h3>Milestones</h3>
                  <p>Track the key deliverables, owners and deadlines for this research project.</p>
                </div>
              </header>

              <div className="research-milestone-list">
                {selectedResearch.milestones.map((milestone) => (
                  <article
                    key={milestone.id}
                    className={
                      milestone.status !== "Completed" &&
                      new Date(`${milestone.due_date}T23:59:59`) < new Date()
                        ? "overdue"
                        : ""
                    }
                  >
                    <div>
                      <strong>{milestone.title}</strong>
                      <small>
                        {milestone.description || "No milestone description."}
                      </small>
                    </div>
                    <div>
                      <strong>{milestone.owner_name || "Unassigned"}</strong>
                      <small>{milestone.priority} priority</small>
                    </div>
                    <time>{milestone.due_date}</time>
                    <select
                      aria-label={`Status for ${milestone.title}`}
                      value={milestone.status}
                      onChange={async (event) => {
                        try {
                          await api.updateResearchMilestone(
                            token,
                            selectedResearch.id,
                            milestone.id,
                            event.target.value,
                          );
                          const projects = await api.research(token);
                          setResearchRows(projects);
                          setSelectedResearch(
                            projects.find(
                              (item) => item.id === selectedResearch.id,
                            ) || selectedResearch,
                          );
                          setResearchActivity(
                            await api.researchActivity(
                              token,
                              selectedResearch.id,
                            ),
                          );
                          setResearchWorkspaceNotice(
                            "Milestone status updated.",
                          );
                        } catch (error) {
                          setResearchWorkspaceNotice(
                            error instanceof Error
                              ? error.message
                              : "Milestone could not be updated.",
                          );
                        }
                      }}
                    >
                      <option>Pending</option>
                      <option>In Progress</option>
                      <option>Completed</option>
                    </select>
                  </article>
                ))}

                {!selectedResearch.milestones.length && (
                  <small>No milestones have been added yet.</small>
                )}
              </div>
              <div className="research-milestone-add">
                <input
                  value={researchMilestoneForm.title}
                  onChange={(event) =>
                    setResearchMilestoneForm({
                      ...researchMilestoneForm,
                      title: event.target.value,
                    })
                  }
                  placeholder="Milestone title"
                />
                <input
                  value={researchMilestoneForm.description}
                  onChange={(event) =>
                    setResearchMilestoneForm({
                      ...researchMilestoneForm,
                      description: event.target.value,
                    })
                  }
                  placeholder="Expected result or deliverable"
                />
                <select
                  aria-label="Milestone owner"
                  value={researchMilestoneForm.ownerId}
                  onChange={(event) =>
                    setResearchMilestoneForm({
                      ...researchMilestoneForm,
                      ownerId: event.target.value,
                    })
                  }
                >
                  <option value="">Select owner</option>
                  <option value={selectedResearch.lead_id}>
                    {selectedResearch.lead_name}
                  </option>
                  {selectedResearch.collaborators.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Milestone due date"
                  type="date"
                  value={researchMilestoneForm.dueDate}
                  onChange={(event) =>
                    setResearchMilestoneForm({
                      ...researchMilestoneForm,
                      dueDate: event.target.value,
                    })
                  }
                />
                <select
                  aria-label="Milestone priority"
                  value={researchMilestoneForm.priority}
                  onChange={(event) =>
                    setResearchMilestoneForm({
                      ...researchMilestoneForm,
                      priority: event.target.value,
                    })
                  }
                >
                  <option>Low</option>
                  <option>Normal</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
                <button
                  disabled={
                    !researchMilestoneForm.title.trim() ||
                    !researchMilestoneForm.ownerId ||
                    !researchMilestoneForm.dueDate
                  }
                  onClick={async () => {
                    try {
                      await api.addResearchMilestone(
                        token,
                        selectedResearch.id,
                        {
                          ...researchMilestoneForm,
                          title: researchMilestoneForm.title.trim(),
                        },
                      );
                      const projects = await api.research(token);
                      setResearchRows(projects);
                      setSelectedResearch(
                        projects.find(
                          (item) => item.id === selectedResearch.id,
                        ) || selectedResearch,
                      );
                      setResearchActivity(
                        await api.researchActivity(token, selectedResearch.id),
                      );
                      setResearchMilestoneForm({
                        title: "",
                        description: "",
                        ownerId: "",
                        dueDate: "",
                        priority: "Normal",
                      });
                      setResearchWorkspaceNotice(
                        "Milestone created with an accountable owner and deadline.",
                      );
                    } catch (error) {
                      setResearchWorkspaceNotice(
                        error instanceof Error
                          ? error.message
                          : "Milestone could not be created.",
                      );
                    }
                  }}
                >
                  Add milestone
                </button>
              </div>
            </section>

            <section className="research-work-panel">
              <header>
                <div>
                  <small>RESEARCH WORK</small>
                  <h3>Related assignments</h3>
                  <p>Open linked assignments when research work is being carried out through the Assignments module.</p>
                </div>
                <div className="research-work-head-actions">
                  <button
                    type="button"
                    className="research-import-action"
                    onClick={() => {
                      setSelectedResearch(null);
                      setResearchComments([]);
                      setResearchComment("");
                      setResearchReport([]);
                      setSelectedReportSection(null);
                      setReportContent("");
                      setResearchRepositoryMode("Imported");
                      setExternalResearchOpen(true);
                    }}
                    title="Leave this workspace and import completed external research for formal reviewer approval."
                  >
                    Import external research
                  </button>
                  <strong>{selectedResearch.assignments?.length || 0} linked assignment{(selectedResearch.assignments?.length || 0) === 1 ? "" : "s"}</strong>
                </div>
              </header>

              {isManager && (
                <div className="research-assignment-controls">
                  <div className="research-link-assignment">
                    <label>
                      Link existing assignment
                      <select value={researchAssignmentLinkId} onChange={(event) => setResearchAssignmentLinkId(event.target.value)}>
                        <option value="">Select assignment</option>
                        {assignmentRows
                          .filter((assignment) => !(selectedResearch.assignments || []).some((linked) => linked.id === assignment.id))
                          .map((assignment) => (
                            <option key={assignment.id} value={assignment.id}>
                              {assignmentRef(assignment.id)} â€” {assignment.title}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={!researchAssignmentLinkId}
                      onClick={async () => {
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
                    >
                      Link assignment
                    </button>
                  </div>

                  <details className="research-create-assignment">
                    <summary>+ Create related assignment</summary>
                    <div className="research-assignment-form">
                      <label>Assignment title<input value={researchAssignmentDraft.title} onChange={(event) => setResearchAssignmentDraft({...researchAssignmentDraft, title:event.target.value})} /></label>
                      <label>Division<input value={researchAssignmentDraft.division} onChange={(event) => setResearchAssignmentDraft({...researchAssignmentDraft, division:event.target.value})} /></label>
                      <label className="wide">Description<textarea value={researchAssignmentDraft.description} onChange={(event) => setResearchAssignmentDraft({...researchAssignmentDraft, description:event.target.value})} /></label>
                      <label>Due date<input type="date" value={researchAssignmentDraft.dueDate || ""} onChange={(event) => setResearchAssignmentDraft({...researchAssignmentDraft, dueDate:event.target.value || null})} /></label>
                      <label>Priority<select value={researchAssignmentDraft.priority} onChange={(event) => setResearchAssignmentDraft({...researchAssignmentDraft, priority:event.target.value})}><option>Low</option><option>Normal</option><option>High</option><option>Critical</option></select></label>
                      <fieldset className="wide">
                        <legend>Assignment members</legend>
                        {[{id:selectedResearch.lead_id,name:selectedResearch.lead_name,role:"Lead researcher"},...selectedResearch.collaborators.map((person) => ({id:person.id,name:person.name,role:person.role}))].map((person) => (
                          <label key={person.id}>
                            <input type="checkbox" checked={researchAssignmentDraft.memberIds.includes(person.id)} onChange={(event) => setResearchAssignmentDraft({...researchAssignmentDraft, memberIds:event.target.checked?[...researchAssignmentDraft.memberIds,person.id]:researchAssignmentDraft.memberIds.filter((id) => id!==person.id)})} />
                            <span>{person.name}<small>{person.role}</small></span>
                          </label>
                        ))}
                      </fieldset>
                      <button
                        className="research-primary-action wide"
                        type="button"
                        disabled={researchAssignmentCreating || !researchAssignmentDraft.title.trim() || !researchAssignmentDraft.division.trim()}
                        onClick={async () => {
                          try {
                            setResearchAssignmentCreating(true);
                            await api.createResearchAssignment(token, selectedResearch.id, researchAssignmentDraft);
                            const [projects, assignments] = await Promise.all([api.research(token), api.assignments(token)]);
                            setResearchRows(projects);
                            setAssignmentRows(assignments);
                            setSelectedResearch(projects.find((item) => item.id === selectedResearch.id) || selectedResearch);
                            setResearchAssignmentDraft({title:"",description:"",division:researchAssignmentDraft.division,dueDate:null,priority:"Normal",memberIds:[selectedResearch.lead_id]});
                            setResearchActivity(await api.researchActivity(token, selectedResearch.id));
                            setResearchWorkspaceNotice("Related assignment created and linked to this research project.");
                          } catch (error) {
                            setResearchWorkspaceNotice(error instanceof Error ? error.message : "Related assignment could not be created.");
                          } finally {
                            setResearchAssignmentCreating(false);
                          }
                        }}
                      >
                        {researchAssignmentCreating ? "Creating assignment..." : "Create & link assignment"}
                      </button>
                    </div>
                  </details>
                </div>
              )}

              <div className="research-assignment-list">
                {(selectedResearch.assignments || []).map((assignment) => (
                  <article key={assignment.id}>
                    <div>
                      <span>{assignmentRef(assignment.id)}</span>
                      <strong>{assignment.title}</strong>
                      <small>{assignment.division} Â· {assignment.relation_type || "Research Work"}</small>
                    </div>
                    <div>
                      <b>{assignment.status}</b>
                      <small>{assignment.due_date ? `Due ${new Date(assignment.due_date).toLocaleDateString("en-KE")}` : "No due date"}</small>
                    </div>
                    <ResearchAssignmentProgress token={token} assignmentId={assignment.id} />
                    <div className="research-assignment-actions">
                      <button type="button" onClick={async () => {
                        const assignments = await api.assignments(token);
                        setAssignmentRows(assignments);
                        const full = assignments.find((item) => item.id === assignment.id);
                        if (!full) { setResearchWorkspaceNotice("The linked assignment could not be opened."); return; }
                        setSelectedResearch(null);
                        setActive("Assignments");
                        await openAssignmentDetails(full);
                      }}>Open assignment</button>
                      {isManager && <button className="unlink" type="button" onClick={async () => {
                        if (!window.confirm(`Remove the link to â€œ${assignment.title}â€? The assignment itself will not be deleted.`)) return;
                        try {
                          await api.unlinkResearchAssignment(token, selectedResearch.id, assignment.id);
                          const projects = await api.research(token);
                          setResearchRows(projects);
                          setSelectedResearch(projects.find((item) => item.id === selectedResearch.id) || selectedResearch);
                          setResearchActivity(await api.researchActivity(token, selectedResearch.id));
                          setResearchWorkspaceNotice("Assignment link removed. The assignment remains in App2.");
                        } catch (error) {
                          setResearchWorkspaceNotice(error instanceof Error ? error.message : "Assignment link could not be removed.");
                        }
                      }}>Unlink</button>}
                    </div>
                  </article>
                ))}
                {!(selectedResearch.assignments || []).length && (
                  <div className="research-work-empty">
                    <strong>No related assignments yet</strong>
                    <p>Create the first assignment for literature review, data collection, analysis, drafting or another research workstream.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="research-documents-placeholder">
              <h3>Evidence</h3>
              <p>Use the Evidence tab to link Repository documents and record other research sources.</p>
            </section>

            <section className="research-discussion-panel">
              <header className="research-discussion-head">
                <div>
                  <small>PROJECT COLLABORATION</small>
                  <h3>Discussion</h3>
                  <p>
                    Record updates, questions, decisions and review notes in the
                    official project workspace.
                  </p>
                </div>
                <strong>
                  {researchComments.filter((item) => !item.resolved).length}{" "}
                  open items
                </strong>
              </header>
              <div className="research-discussion-kpis">
                <span>
                  <small>Updates</small>
                  <strong>
                    {
                      researchComments.filter(
                        (item) => item.category === "Update",
                      ).length
                    }
                  </strong>
                </span>
                <span>
                  <small>Open questions</small>
                  <strong>
                    {
                      researchComments.filter(
                        (item) =>
                          item.category === "Question" && !item.resolved,
                      ).length
                    }
                  </strong>
                </span>
                <span>
                  <small>Decisions</small>
                  <strong>
                    {
                      researchComments.filter(
                        (item) => item.category === "Decision",
                      ).length
                    }
                  </strong>
                </span>
                <span>
                  <small>Review notes</small>
                  <strong>
                    {
                      researchComments.filter(
                        (item) => item.category === "Review Note",
                      ).length
                    }
                  </strong>
                </span>
              </div>
              <div className="research-discussion-filter">
                {[
                  "Open",
                  "All",
                  "Update",
                  "Question",
                  "Decision",
                  "Review Note",
                  "Resolved",
                ].map((filter) => (
                  <button
                    type="button"
                    key={filter}
                    className={
                      researchDiscussionFilter === filter ? "active" : ""
                    }
                    onClick={() => setResearchDiscussionFilter(filter)}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              <div className="comments research-thread">
                {researchComments
                  .filter(
                    (item) =>
                      researchDiscussionFilter === "All" ||
                      (researchDiscussionFilter === "Open" && !item.resolved) ||
                      (researchDiscussionFilter === "Resolved" &&
                        item.resolved) ||
                      item.category === researchDiscussionFilter,
                  )
                  .map((item) => (
                    <div
                      className={`comment category-${item.category.toLowerCase().replaceAll(" ", "-")} ${item.resolved ? "resolved" : ""}`}
                      key={item.id}
                    >
                      <span>
                        {item.author_name
                          .split(" ")
                          .map((name) => name[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </span>

                      <div>
                        <strong>
                          {item.author_name}
                          <time>
                            {new Date(item.created_at).toLocaleString("en-KE")}
                          </time>
                        </strong>
                        <b>{item.category}</b>
                        <p>{item.body}</p>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await api.resolveResearchComment(
                                token,
                                selectedResearch.id,
                                item.id,
                                !item.resolved,
                              );
                              setResearchComments(
                                await api.researchComments(
                                  token,
                                  selectedResearch.id,
                                ),
                              );
                              setResearchActivity(
                                await api.researchActivity(
                                  token,
                                  selectedResearch.id,
                                ),
                              );
                              setResearchWorkspaceNotice(
                                item.resolved
                                  ? "Discussion item reopened."
                                  : "Discussion item resolved.",
                              );
                            } catch (error) {
                              setResearchWorkspaceNotice(
                                error instanceof Error
                                  ? error.message
                                  : "Discussion item could not be updated.",
                              );
                            }
                          }}
                        >
                          {item.resolved ? "Reopen item" : "Mark resolved"}
                        </button>
                      </div>
                    </div>
                  ))}

                {!researchComments.length && (
                  <small>
                    No discussion yet. Start the conversation below.
                  </small>
                )}
              </div>

              <div className="comment-box research-comment-composer">
                <header>
                  <div>
                    <strong>Add to the project discussion</strong>
                    <small>
                      Choose the type so the team can distinguish information
                      from actions and decisions.
                    </small>
                  </div>
                  <select
                    value={researchCommentCategory}
                    onChange={(event) =>
                      setResearchCommentCategory(
                        event.target.value as typeof researchCommentCategory,
                      )
                    }
                  >
                    <option>Update</option>
                    <option>Question</option>
                    <option>Decision</option>
                    <option>Review Note</option>
                  </select>
                </header>
                <textarea
                  value={researchComment}
                  onChange={(event) => setResearchComment(event.target.value)}
                  placeholder="Write an update for the research team..."
                />

                <button
                  type="button"
                  disabled={!researchComment.trim()}
                  onClick={async () => {
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
                      setResearchComments(
                        await api.researchComments(token, selectedResearch.id),
                      );
                    } catch (error) {
                      alert(
                        error instanceof Error
                          ? error.message
                          : "Research comment could not be saved.",
                      );
                    }
                  }}
                >
                  Post {researchCommentCategory.toLowerCase()}
                </button>
              </div>
            </section>

            <section className="research-report-review-gate research-submit-review-section">
              <div>
                <p>REVIEW HANDOFF</p>
                <h3>Submit the complete report for formal review</h3>
                <span>Preview the complete draft, select the assigned reviewer, then submit. App2 freezes that numbered version while the reviewer assesses it.</span>
              </div>
              <div className={`research-review-status-card ${
                researchReportVersions[0]?.status === "Approved"
                  ? "approved"
                  : researchReportVersions[0]?.status === "Submitted"
                    ? "submitted"
                    : ["Changes Requested", "Rejected"].includes(researchReportVersions[0]?.status || "")
                      ? "action"
                      : "draft"
              }`}>
                <div>
                  <small>CURRENT STEP</small>
                  <strong>
                    {researchReportVersions[0]?.status === "Approved"
                      ? "Review approved"
                      : researchReportVersions[0]?.status === "Submitted"
                        ? "Awaiting reviewer decision"
                        : researchReportVersions[0]?.status === "Changes Requested"
                          ? "Changes requested"
                          : researchReportVersions[0]?.status === "Rejected"
                            ? "Report rejected"
                            : "Prepare and submit the report"}
                  </strong>
                  <span>
                    {researchReportVersions[0]?.status === "Approved"
                      ? "The approved version is locked. Generate the controlled final report below."
                      : researchReportVersions[0]?.status === "Submitted"
                        ? "The submitted version is locked while the assigned reviewer assesses it."
                        : researchReportVersions[0]?.status === "Changes Requested"
                          ? "Return to Report, revise the draft, preview it, and submit a new version."
                          : researchReportVersions[0]?.status === "Rejected"
                            ? "Return to Report and address the reviewer decision before preparing a new submission."
                            : "Preview the complete draft, choose the formal reviewer and submit a locked version."}
                  </span>
                </div>
                {["Changes Requested", "Rejected"].includes(researchReportVersions[0]?.status || "") && (
                  <button type="button" onClick={() => setResearchTab("Report")}>Return to Report</button>
                )}
              </div>

              <div className="research-report-review-summary">
                <span><small>Latest version</small><strong>{researchReportVersions[0] ? `v${researchReportVersions[0].version_number}` : "Draft"}</strong></span>
                <span><small>Status</small><strong>{researchReportVersions[0]?.status || "Editing"}</strong></span>
                <span><small>Reviewer</small><strong>{researchReportVersions[0]?.reviewer_name || "Not submitted"}</strong></span>
              </div>
              {researchReportVersions[0]?.review_comments && (
                <div className="research-report-review-note"><strong>Reviewer comments</strong><p>{researchReportVersions[0].review_comments}</p></div>
              )}
              <div className="research-review-journey" aria-label="Research report review workflow">
                <span className={!researchReportVersions[0] ? "current" : "done"}><b>1</b><strong>Preview</strong></span>
                <span className={!researchReportVersions[0] ? "current" : "done"}><b>2</b><strong>Submit</strong></span>
                <span className={researchReportVersions[0]?.status === "Submitted" ? "current" : researchReportVersions[0]?.status === "Approved" ? "done" : ""}><b>3</b><strong>Reviewer decision</strong></span>
                <span className={researchReportVersions[0]?.status === "Approved" ? "current" : ""}><b>4</b><strong>Final report</strong></span>
              </div>
              <div className="research-report-review-actions">
                <button type="button" onClick={() => setResearchReportPreviewOpen(true)} disabled={!researchReport.some((section) => section.content.trim())}>Preview Report</button>
                {researchReportVersions[0]?.status !== "Submitted" && researchReportVersions[0]?.status !== "Approved" && (isManager || selectedResearch.lead_id === user?.id) && (
                  <>
                    <label className="research-formal-reviewer-select">
                      <span>Formal reviewer</span>
                      <select
                        value={researchDraftReviewerId}
                        disabled={eligibleResearchReviewersLoading}
                        onChange={(event) =>
                          setResearchDraftReviewerId(event.target.value)
                        }
                      >
                        <option value="">
                          {eligibleResearchReviewersLoading
                            ? "Loading eligible reviewers..."
                            : selectedResearch.reviewers?.length
                              ? "Select assigned or eligible reviewer"
                              : canChooseResearchReviewer
                                ? "Select reviewer"
                                : "No formal reviewer assigned"}
                        </option>

                        {(selectedResearch.reviewers || []).map((reviewer) => (
                          <option
                            key={`assigned-${reviewer.reviewer_id}`}
                            value={reviewer.reviewer_id}
                          >
                            {reviewer.name || "Reviewer"} — assigned
                          </option>
                        ))}

                        {canChooseResearchReviewer &&
                          eligibleResearchReviewers
                            .filter(
                              (reviewer) =>
                                !assignedResearchReviewerIds.has(reviewer.id),
                            )
                            .map((reviewer) => (
                              <option
                                key={`eligible-${reviewer.id}`}
                                value={reviewer.id}
                              >
                                {reviewer.name} — {reviewer.role}
                              </option>
                            ))}
                      </select>
                      {!selectedResearch.reviewers?.length &&
                        !canChooseResearchReviewer && (
                          <small>
                            No formal reviewer is assigned to this research project.
                            The Research Lead, report builder, or an authorised Research Manager must assign one before submission.
                          </small>
                        )}
                      {!selectedResearch.reviewers?.length &&
                        canChooseResearchReviewer &&
                        !eligibleResearchReviewersLoading &&
                        eligibleResearchReviewers.length > 0 && (
                          <small>
                            No reviewer is assigned yet. Select an eligible reviewer here;
                            App2 will formally assign that reviewer when the report is submitted.
                          </small>
                        )}
                      {!eligibleResearchReviewersLoading &&
                        canChooseResearchReviewer &&
                        eligibleResearchReviewers.length === 0 &&
                        !(selectedResearch.reviewers || []).length && (
                          <small>
                            No other active Research Officer, Reviewer, Research Manager, or Administrator
                            account is currently available. Check Users and Roles.
                          </small>
                        )}
                    </label>
                    <button
                      type="button"
                      className="approve"
                      disabled={
                        researchReportSubmitting ||
                        !researchDraftReviewerId ||
                        !researchReport.some((section) =>
                          section.content.trim(),
                        )
                      }
                      onClick={submitCompleteResearchReport}
                    >
                      {researchReportSubmitting
                        ? "Submitting..."
                        : "Submit for Review"}
                    </button>
                  </>
                )}
                {researchReportVersions[0]?.status === "Submitted" && (isManager || researchReportVersions[0].reviewer_id === user?.id) && (
                  <div className="research-report-decision-box">
                    <header>
                      <div>
                        <small>REVIEWER DECISION</small>
                        <strong>Assess submitted version v{researchReportVersions[0]?.version_number}</strong>
                        <span>Preview the locked report before recording a formal decision.</span>
                      </div>
                      <button type="button" onClick={() => setResearchReportPreviewOpen(true)}>Preview Submitted Report</button>
                    </header>
                    <label>
                      <span>Reviewer comments</span>
                      <textarea
                        value={researchReportReviewComments}
                        onChange={(event) => setResearchReportReviewComments(event.target.value)}
                        placeholder="Required when requesting changes or rejecting. Optional for approval."
                      />
                    </label>
                    <div>
                      <button type="button" className="approve" disabled={researchReportSubmitting} onClick={() => decideCompleteResearchReport("Approved")}>Approve Report</button>
                      <button type="button" disabled={researchReportSubmitting || !researchReportReviewComments.trim()} onClick={() => decideCompleteResearchReport("Changes Requested")}>Request Changes</button>
                      <button type="button" className="reject" disabled={researchReportSubmitting || !researchReportReviewComments.trim()} onClick={() => decideCompleteResearchReport("Rejected")}>Reject Report</button>
                    </div>
                  </div>
                )}
              </div>
              {researchReportVersions.length > 0 && <details className="research-report-version-history"><summary>Report version history ({researchReportVersions.length})</summary>{researchReportVersions.map((version) => <article key={version.id}><strong>v{version.version_number} Â· {version.status}</strong><span>{version.submitted_by_name || "Research team"} â†’ {version.reviewer_name || "Reviewer"}</span><small>{version.submitted_at ? new Date(version.submitted_at).toLocaleString("en-KE") : new Date(version.created_at as string).toLocaleString("en-KE")}</small></article>)}</details>}
            </section>

            <section className="research-final-report-card">
              <header>
                <div>
                  <small>FINAL REPORT</small>
                  <h3>Generate the approved final report</h3>
                  <p>
                    After approval, the assigned reviewer generates the final report. App2 publishes it directly to Documents and completes the research project.
                  </p>
                </div>
              </header>
              <div className="research-report-generate">
                  <strong>
                    {
                      researchReport.filter(
                        (section) => section.status === "Approved",
                      ).length
                    }{" "}
                    / {researchReport.length} approved
                  </strong>
                  <span className="research-report-final-hint">Available after formal approval of the complete submitted report.</span>
                  <button
                    type="button"
                    disabled={
                      researchReportGenerating ||
                      !researchReport.length ||
                      !(selectedResearch.reviewers || []).length ||
                      !(
                        isManager ||
                        (selectedResearch.reviewers || []).some(
                          (reviewer) => reviewer.reviewer_id === user?.id,
                        )
                      ) ||
                      researchReport.some(
                        (section) => section.status !== "Approved",
                      ) ||
                      researchReportVersions[0]?.status !== "Approved" ||
                      !(researchSources.length || researchRepositoryDocuments.length)
                    }
                    title={
                      !(selectedResearch.reviewers || []).length
                        ? "Assign at least one formal research reviewer before finalisation."
                        : !(
                            isManager ||
                            (selectedResearch.reviewers || []).some(
                              (reviewer) => reviewer.reviewer_id === user?.id,
                            )
                          )
                          ? "Only the assigned reviewer who approved the submitted version, or an authorised manager, can generate the final report."
                          : researchReport.some(
                              (section) => section.status !== "Approved",
                            )
                            ? "Approve every report section first."
                            : researchReportVersions[0]?.status !== "Approved"
                              ? "Submit the complete report and obtain reviewer approval first."
                              : !(researchSources.length || researchRepositoryDocuments.length)
                              ? "Add controlled evidence first."
                              : "Generate the final controlled document after reviewer approval."
                    }
                    onClick={async () => {
                      try {
                        setResearchReportGenerating(true);
                        const generated = await api.generateResearchReport(
                          token,
                          selectedResearch.id,
                          {
                            title: `${selectedResearch.title} â€” Final Research Report`,
                            classification: "Official",
                            templateId: builderCreate.templateId || null,
                            mode: "Final",
                            knowledgeIds: researchSupportingDocumentIds,
                          },
                        );
                        const [
                          generatedRows,
                          activityRows,
                          documentRowsRefreshed,
                          knowledgeRowsRefreshed,
                          projectRowsRefreshed,
                          notificationRowsRefreshed,
                        ] = await Promise.all([
                          api.generatedDocuments(
                            token,
                            "Research",
                            selectedResearch.id,
                          ),
                          api.researchActivity(
                            token,
                            selectedResearch.id,
                          ),
                          api.documents(token),
                          api.knowledge(token),
                          api.research(token),
                          api.notifications(token),
                        ]);
                        setWorkspaceDocuments(generatedRows);
                        setResearchActivity(activityRows);
                        setDocumentRows(documentRowsRefreshed);
                        setKnowledgeRows(knowledgeRowsRefreshed);
                        setResearchRows(projectRowsRefreshed);
                        setNotifications(notificationRowsRefreshed);
                        const completedProject =
                          projectRowsRefreshed.find(
                            (item) => item.id === selectedResearch.id,
                          ) || {
                            ...selectedResearch,
                            status: "Completed" as const,
                          };
                        setSelectedResearch(completedProject);
                        setResearchWorkspaceNotice(
                          generated.repository_document_id
                            ? `Final report ${generated.reference} published to Documents and research marked Completed.`
                            : `Final report ${generated.reference} generated successfully.`,
                        );
                        if (generated.repository_document_id) {
                          const repositoryDocument =
                            documentRowsRefreshed.find(
                              (item) =>
                                item.id === generated.repository_document_id,
                            ) || null;
                          if (repositoryDocument) {
                            setReaderDocument(repositoryDocument);
                            setReaderVersionId(undefined);
                          }
                        } else {
                          await openGeneratedDocument(generated.id);
                        }
                      } catch (error) {
                        setResearchWorkspaceNotice(
                          error instanceof Error
                            ? error.message
                            : "Controlled report could not be generated.",
                        );
                      } finally {
                        setResearchReportGenerating(false);
                      }
                    }}
                  >
                    Generate Final Report & Complete
                  </button>
                </div>
            </section>

            <section className="research-auto-completion-note">
              <div>
                <p>FINALISATION</p>
                <h3>Automatic completion after final report generation</h3>
                <span>
                  Once the approved reviewer generates the final report, App2 publishes the immutable report to Documents and marks this research project Completed automatically.
                </span>
              </div>
              <strong className={selectedResearch.status === "Completed" ? "complete" : "pending"}>
                {selectedResearch.status === "Completed" ? "COMPLETED" : "AWAITING FINAL REPORT"}
              </strong>
            </section>

            <section className="research-report-builder research-report-panel">
              <div className="report-builder-head">
                <div>
                  <p>REPORT</p>
                  <h3>Research Report</h3>
                  <span>
                    Draft and refine the report here. Choose the report template from this builder; formal review and finalisation happen in Review.
                  </span>
                </div>
                <label className="research-builder-template-control">
                  <span>Report template</span>
                  <select
                    value={researchTemplateDownloadId}
                    disabled={researchTemplateApplying}
                    onChange={async (event) => {
                      const templateKey = event.target.value;
                      setResearchTemplateDownloadId(templateKey);
                      if (!templateKey) return;

                      const template = researchTemplateLibrary.find(
                        (item) => item.template_key === templateKey,
                      );
                      if (!template) {
                        setResearchWorkspaceNotice("The selected research template could not be found.");
                        setResearchTemplateDownloadId("");
                        return;
                      }

                      const hasDraftContent = researchReport.some((section) =>
                        Boolean(section.content.trim()),
                      );
                      if (
                        hasDraftContent &&
                        !window.confirm(
                          `This report already contains drafted content. Applying "${template.name}" will replace the current Report Outline. Matching section content is preserved where possible. Continue?`,
                        )
                      ) {
                        setResearchTemplateDownloadId("");
                        return;
                      }

                      setResearchTemplateApplying(true);
                      setResearchWorkspaceNotice(`Applying ${template.name} to the Report Outline...`);

                      try {
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
                        const nextSections = refreshed.length ? refreshed : result.sections;

                        setResearchReport(nextSections);
                        setSelectedReportSection(nextSections[0] || null);
                        setReportContent(nextSections[0]?.content || "");
                        setResearchWorkspaceNotice(
                          `${result.template.name} applied. The Report Outline now has ${nextSections.length} section${nextSections.length === 1 ? "" : "s"}.`,
                        );
                      } catch (error) {
                        setResearchWorkspaceNotice(
                          error instanceof Error
                            ? error.message
                            : "The report template could not be applied.",
                        );
                      } finally {
                        setResearchTemplateApplying(false);
                        setResearchTemplateDownloadId("");
                      }
                    }}
                  >
                    <option value="">
                      {researchTemplateApplying ? "Applying template..." : "Choose template"}
                    </option>
                    {researchTemplateLibrary.map((template) => (
                      <option key={template.template_key} value={template.template_key}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  <small>{researchTemplateLibrary.length} built-in report structures</small>
                </label>

                <button
                  type="button"
                  className="research-report-preview-action"
                  disabled={!researchReport.some((section) => section.content.trim())}
                  onClick={() => setResearchReportPreviewOpen(true)}
                >
                  Preview Draft
                </button>
                <button
                  type="button"
                  className="research-report-review-action"
                  disabled={!researchReport.some((section) => section.content.trim())}
                  onClick={() => {
                    setResearchTab("Review");
                    setTimeout(() => {
                      document
                        .querySelector(".research-submit-review-section")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 80);
                  }}
                >
                  Submit for Review
                </button>

                <details className="research-supporting-documents">
                  <summary>
                    Supporting documents{" "}
                    <b>{researchSupportingDocumentIds.length}</b>
                  </summary>
                  <div>
                    {knowledgeRows.filter((item) => researchRepositoryDocuments.some((linked) => linked.id === item.id)).map((item) => (
                      <label key={item.id}>
                        <input
                          type="checkbox"
                          checked={researchSupportingDocumentIds.includes(
                            item.id,
                          )}
                          onChange={(event) =>
                            setResearchSupportingDocumentIds(
                              event.target.checked
                                ? [...researchSupportingDocumentIds, item.id]
                                : researchSupportingDocumentIds.filter(
                                    (id) => id !== item.id,
                                  ),
                            )
                          }
                        />
                        <span>
                          <strong>{item.title}</strong>
                          <small>
                            {item.category} Â· {item.status} Â· v
                            {item.latest_version}
                          </small>
                        </span>
                      </label>
                    ))}
                    {!researchRepositoryDocuments.length && (
                      <p>No linked Repository evidence is available. Add evidence from Evidence first.</p>
                    )}
                  </div>
                </details>

                
              </div>

              <div className="research-report-readiness">
                <span>
                  <small>Sections drafted</small>
                  <strong>
                    {
                      researchReport.filter((section) => section.content.trim())
                        .length
                    }
                    /{researchReport.length}
                  </strong>
                </span>
                <span>
                  <small>Ready for review</small>
                  <strong>
                    {
                      researchReport.filter(
                        (section) => section.status === "Ready for Review",
                      ).length
                    }
                  </strong>
                </span>
                <span>
                  <small>Approved sections</small>
                  <strong>
                    {
                      researchReport.filter(
                        (section) => section.status === "Approved",
                      ).length
                    }
                  </strong>
                </span>
                <span>
                  <small>Controlled evidence</small>
                  <strong>{researchSources.length + researchRepositoryDocuments.length}</strong>
                </span>
                <div>
                  <b
                    style={{
                      width: `${researchReport.length ? Math.round((100 * researchReport.filter((section) => section.status === "Approved").length) / researchReport.length) : 0}%`,
                    }}
                  />
                  <small>
                    {researchReport.length
                      ? Math.round(
                          (100 *
                            researchReport.filter(
                              (section) => section.status === "Approved",
                            ).length) /
                            researchReport.length,
                        )
                      : 0}
                    % report approval readiness
                  </small>
                </div>
              </div>

              <div className="report-builder-layout">
                <aside className="report-outline">
                  <header className="report-outline-head">
                    <small>REPORT OUTLINE</small>
                    <strong>{researchReport.length} sections</strong>
                  </header>

                  {researchReport.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      className={
                        selectedReportSection?.id === section.id ? "active" : ""
                      }
                      onClick={() => {
                        setSelectedReportSection(section);
                        setReportContent(section.content || "");
                      }}
                    >
                      <span>
                        {String(section.section_order).padStart(2, "0")}
                      </span>

                      <div>
                        <strong>{section.title}</strong>
                        <small>
                          {section.status}
                          {section.owner_name
                            ? ` Â· ${section.owner_name}`
                            : " Â· Unassigned"}
                        </small>
                      </div>
                    </button>
                  ))}
                </aside>

                <div className="report-editor">
                  {!selectedReportSection ? (
                    <div className="report-empty">
                      Select a report section to begin writing.
                    </div>
                  ) : (
                    <>
                      <header>
                        <div>
                          <small>
                            SECTION {selectedReportSection.section_order}
                          </small>
                          <h3>{selectedReportSection.title}</h3>
                        </div>

                        <select
                          value={selectedReportSection.status}
                          onChange={(event) => {
                            const status = event.target
                              .value as ResearchReportSection["status"];

                            setSelectedReportSection({
                              ...selectedReportSection,
                              status,
                            });
                          }}
                        >
                          <option>Not Started</option>
                          <option>Draft</option>
                          <option>In Progress</option>
                          <option>Ready for Review</option>
                          <option>Approved</option>
                        </select>
                        <select
                          aria-label="Report section owner"
                          value={selectedReportSection.owner_id || ""}
                          onChange={(event) =>
                            setSelectedReportSection({
                              ...selectedReportSection,
                              owner_id: event.target.value || null,
                              owner_name:
                                [
                                  {
                                    id: selectedResearch.lead_id,
                                    name: selectedResearch.lead_name,
                                  },
                                  ...selectedResearch.collaborators,
                                ].find(
                                  (person) => person.id === event.target.value,
                                )?.name || null,
                            })
                          }
                        >
                          <option value="">Unassigned section</option>
                          <option value={selectedResearch.lead_id}>
                            {selectedResearch.lead_name} â€” Lead
                          </option>
                          {selectedResearch.collaborators.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.name} â€” {person.role}
                            </option>
                          ))}
                        </select>
                      </header>

                      <div
                        className={`research-section-approval status-${selectedReportSection.status.toLowerCase().replaceAll(" ", "-")}`}
                      >
                        <div>
                          <small>SECTION APPROVAL WORKFLOW</small>
                          <strong>
                            {selectedReportSection.status === "Approved"
                              ? "This section is approved"
                              : selectedReportSection.status ===
                                  "Ready for Review"
                                ? `Awaiting ${selectedReportSection.reviewer_name || "reviewer"} approval`
                                : "Complete this section and request approval"}
                          </strong>
                          <span>
                            {selectedReportSection.status === "Approved"
                              ? "This section counts toward final-report generation."
                              : selectedReportSection.status ===
                                  "Ready for Review"
                                ? "The assigned reviewer received an action notification with this project and section."
                                : "Save as often as needed. Select a reviewer only when the section is ready for approval."}
                          </span>
                        </div>
                        <div className="research-section-approval-actions">
                          {selectedReportSection.status !== "Approved" && (
                            <label>
                              <span>ASSIGNED REVIEWER</span>
                              <select
                                value={selectedReportSection.reviewer_id || ""}
                                onChange={(event) => {
                                  const reviewer = team.find(
                                    (member) =>
                                      member.id === event.target.value,
                                  );
                                  setSelectedReportSection({
                                    ...selectedReportSection,
                                    reviewer_id: event.target.value || null,
                                    reviewer_name: reviewer?.name || null,
                                  });
                                }}
                              >
                                <option value="">
                                  Select reviewer when ready
                                </option>
                                {team
                                  .filter(
                                    (member) =>
                                      member.active &&
                                      [
                                        "Reviewer",
                                        "Research Manager",
                                        "Administrator",
                                      ].includes(member.role),
                                  )
                                  .map((member) => (
                                    <option key={member.id} value={member.id}>
                                      {member.name} â€” {member.role}
                                    </option>
                                  ))}
                              </select>
                            </label>
                          )}
                          {selectedReportSection.status !== "Approved" && (
                            <button
                              className="save-draft"
                              type="button"
                              disabled={reportSaving}
                              onClick={() => void saveResearchSectionDraft()}
                            >
                              {reportSaving ? "Saving..." : "Save draft"}
                            </button>
                          )}
                          {selectedReportSection.status !== "Approved" &&
                            selectedReportSection.status !==
                              "Ready for Review" && (
                              <button
                                type="button"
                                disabled={
                                  reportSaving ||
                                  !reportContent.trim() ||
                                  !selectedReportSection.reviewer_id
                                }
                                onClick={() =>
                                  saveResearchSectionStatus("Ready for Review")
                                }
                              >
                                Send to reviewer
                              </button>
                            )}
                          {canReview &&
                            selectedReportSection.status ===
                              "Ready for Review" && (
                              <button
                                className="approve"
                                type="button"
                                disabled={reportSaving}
                                onClick={() =>
                                  saveResearchSectionStatus("Approved")
                                }
                              >
                                âœ“ Approve section
                              </button>
                            )}
                          {canReview &&
                            selectedReportSection.status === "Approved" && (
                              <button
                                type="button"
                                disabled={reportSaving}
                                onClick={() =>
                                  saveResearchSectionStatus("In Progress")
                                }
                              >
                                Reopen section
                              </button>
                            )}
                        </div>
                      </div>

                      <div className="research-section-document-summary">
                        <p>
                          {reportContent.trim() ||
                            `No content has been written for ${selectedReportSection.title}.`}
                        </p>
                      </div>

                      <footer>
                        <small>
                          {selectedReportSection.updated_by_name
                            ? `Last edited by ${selectedReportSection.updated_by_name}`
                            : "No edits saved yet"}
                        </small>
                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              setResearchSectionWorkspaceMode("review")
                            }
                          >
                            Review
                          </button>
                          {selectedReportSection.status !== "Approved" && (
                            <button
                              type="button"
                              onClick={() =>
                                setResearchSectionWorkspaceMode("edit")
                              }
                            >
                              Edit section
                            </button>
                          )}
                        </div>
                      </footer>
                    </>
                  )}
                </div>

                <aside className="report-evidence">
                  <h4>Evidence & citations</h4>
                  <p>
                    Use only controlled project sources when drafting
                    conclusions and recommendations.
                  </p>
                  <div className="research-report-evidence-list">
                    {researchSources.slice(0, 8).map((source) => (
                      <button
                        key={source.id}
                        type="button"
                        onClick={() => {
                          setSelectedResearch(null);
                          setActive("Document Repository");
                          setKnowledgeNotice(
                            `Repository opened for evidence linked to ${selectedResearch.title}.`,
                          );
                        }}
                      >
                        <strong>{source.title}</strong>
                        <span>
                          {source.source_type} Â· {source.quality} quality
                        </span>
                        <small>{source.relevance}</small>
                      </button>
                    ))}
                    {!researchSources.length && (
                      <div>
                        <strong>No linked repository evidence</strong>
                        <span>
                          Open the Repository and link evidence to this research
                          project.
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    className="research-report-open-sources"
                    type="button"
                    onClick={() => {
                      setSelectedResearch(null);
                      setActive("Document Repository");
                      setKnowledgeNotice(
                        `Repository opened for evidence linked to ${selectedResearch.title}.`,
                      );
                    }}
                  >
                    Open Repository
                  </button>
                </aside>
              </div>
            </section>

                        {researchReportPreviewOpen && (
              <div className="modal-backdrop" onClick={() => setResearchReportPreviewOpen(false)}>
                <section className="research-report-preview-modal" onClick={(event) => event.stopPropagation()}>
                  <header><div><p>REPORT READER</p><h2>{selectedResearch.title}</h2><span>Read the complete saved report, then return to editing or proceed to formal review.</span></div><button type="button" className="close" onClick={() => setResearchReportPreviewOpen(false)}>Ã—</button></header>
                  <div className="research-report-preview-body research-report-reader-body">
                    {researchReport.filter((section) => section.content.trim()).map((section) => (
                      <section key={section.id} className="research-report-reader-section">
                        <h3>{section.title}</h3>
                        <div
                          className="research-report-reader-content"
                          dangerouslySetInnerHTML={{ __html: section.content }}
                        />
                      </section>
                    ))}
                  </div>
                  <footer className="research-report-preview-footer">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setResearchReportPreviewOpen(false);
                        setResearchSectionWorkspaceMode("edit");
                      }}
                    >
                      Back to Report
                    </button>
                    <button
                      type="button"
                      className="primary"
                      onClick={() => {
                        setResearchReportPreviewOpen(false);
                        setResearchSectionWorkspaceMode(null);
                        setResearchTab("Review");
                        setTimeout(() => {
                          document
                            .querySelector(".research-submit-review-section")
                            ?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }, 80);
                      }}
                    >
                      Proceed for Review
                    </button>
                  </footer>
                </section>
              </div>
            )}

            {researchSectionWorkspaceMode && selectedReportSection && (
              <TaskSectionWorkspace
                key={selectedReportSection.id}
                title={selectedReportSection.title}
                reportTitle={`${selectedResearch.title} â€” Research Report`}
                mode={researchSectionWorkspaceMode}
                status={
                  selectedReportSection.status === "Approved"
                    ? "Final"
                    : selectedReportSection.status === "Ready for Review"
                      ? "In Review"
                      : "Draft"
                }
                value={reportContent}
                busy={reportSaving}
                contextTitle={`${selectedResearch.title} â€” Research Report`}
                linkedWorkLabel="Attach assignment"
                linkedWorkPlaceholder="Choose assignment"
                linkedWorkActionLabel="Attach to"
                linkedWorkItems={(selectedResearch.assignments || []).map((assignment) => ({
                  id: assignment.id,
                  title: assignment.title,
                  status: assignment.status,
                }))}
                onInsertLinkedWorkItem={async (assignmentId) => {
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
                  const updatedContent = `${reportContent}${reportContent ? "<hr>" : ""}<section data-assignment-report-id="${source.id}" data-assignment-id="${assignmentId}"><h2>Assignment contribution: ${assignment?.title || source.title}</h2><p><strong>Source report:</strong> ${source.reference} Â· ${source.status}</p>${imported}</section>`;
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
                  const template = researchTemplateLibrary.find(
                    (item) => item.template_key === templateKey,
                  );
                  if (!template) {
                    throw new Error("The selected research template could not be found.");
                  }

                  const saved = await saveResearchSectionDraft();
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
                onChange={setReportContent}
                closeLabel="Return to Report"
                saveLabel="Save Draft & Return to Report"
                onPreviewReport={async (latestValue) => {
                  const contentToPreview =
                    typeof latestValue === "string" ? latestValue : reportContent;
                  setReportContent(contentToPreview);
                  const saved = await saveResearchSectionDraft(contentToPreview);
                  if (!saved) {
                    setResearchWorkspaceNotice(
                      "The current report section could not be saved for preview.",
                    );
                    return;
                  }
                  const refreshed = await api.researchReport(
                    token,
                    selectedResearch.id,
                  );
                  setResearchReport(refreshed);
                  setResearchSectionWorkspaceMode(null);
                  setResearchReportPreviewOpen(true);
                }}
                onProceedForReview={async (latestValue) => {
                  const contentToSubmit =
                    typeof latestValue === "string" ? latestValue : reportContent;
                  setReportContent(contentToSubmit);
                  const saved = await saveResearchSectionDraft(contentToSubmit);
                  if (!saved) {
                    setResearchWorkspaceNotice(
                      "Save the current report section before proceeding to review.",
                    );
                    return;
                  }
                  setResearchSectionWorkspaceMode(null);
                  setResearchTab("Review");
                  setTimeout(() => {
                    document
                      .querySelector(".research-submit-review-section")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 80);
                }}
                onClose={() => {
                  setResearchSectionWorkspaceMode(null);
                  setResearchTab("Report");
                }}
                onSave={async () => {
                  if (await saveResearchSectionDraft()) {
                    setResearchSectionWorkspaceMode(null);
                    setResearchTab("Report");
                    setTimeout(() => {
                      document
                        .querySelector(".research-report-builder")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 80);
                  }
                }}
                onPrevious={async () => {
                  const index = researchReport.findIndex(
                    (section) => section.id === selectedReportSection.id,
                  );
                  const previous = researchReport[index - 1];
                  if (
                    !previous ||
                    (researchSectionWorkspaceMode === "edit" &&
                      !(await saveResearchSectionDraft()))
                  )
                    return;
                  setSelectedReportSection(previous);
                  setReportContent(previous.content || "");
                }}
                onNext={async () => {
                  const index = researchReport.findIndex(
                    (section) => section.id === selectedReportSection.id,
                  );
                  const next = researchReport[index + 1];
                  if (
                    !next ||
                    (researchSectionWorkspaceMode === "edit" &&
                      !(await saveResearchSectionDraft()))
                  )
                    return;
                  setSelectedReportSection(next);
                  setReportContent(next.content || "");
                }}
                onSelectSection={async (sectionId) => {
                  const next = researchReport.find(
                    (section) => section.id === sectionId,
                  );
                  if (!next || next.id === selectedReportSection.id) return;
                  if (
                    researchSectionWorkspaceMode === "edit" &&
                    !(await saveResearchSectionDraft())
                  )
                    return;
                  setSelectedReportSection(next);
                  setReportContent(next.content || "");
                }}
              />
            )}

            <section className="research-sources-panel research-repository-evidence-panel">
              <header className="research-sources-head">
                <div>
                  <small>DOCUMENT EVIDENCE</small>
                  <h3>Repository documents</h3>
                  <p>Link published App2 documents that support this research. The original Repository file remains unchanged.</p>
                </div>
                <strong>{researchRepositoryDocuments.length} linked</strong>
              </header>
              <div className="research-source-form research-repository-link-form">
                <select value={researchRepositoryLinkId} onChange={(event) => setResearchRepositoryLinkId(event.target.value)} aria-label="Published Repository document to link">
                  <option value="">Choose a published document</option>
                  {knowledgeRows
                    .filter((item) => item.status === "Published" && !item.is_archived && !researchRepositoryDocuments.some((linked) => linked.id === item.id))
                    .sort((a,b) => a.title.localeCompare(b.title))
                    .map((item) => <option key={item.id} value={item.id}>{item.title} Â· {item.category}</option>)}
                </select>
                <button type="button" disabled={!researchRepositoryLinkId} onClick={async () => {
                  if (!researchRepositoryLinkId) return;
                  try {
                    await api.linkResearchRepositoryDocument(token, selectedResearch.id, researchRepositoryLinkId);
                    setResearchRepositoryLinkId("");
                    setResearchRepositoryDocuments(await api.researchRepositoryDocuments(token, selectedResearch.id));
                    setResearchActivity(await api.researchActivity(token, selectedResearch.id));
                    setResearchWorkspaceNotice("Published Repository evidence linked. The original document was not copied or moved.");
                  } catch (error) {
                    setResearchWorkspaceNotice(error instanceof Error ? error.message : "Repository evidence could not be linked.");
                  }
                }}>Link Document</button>
              </div>
              <div className="research-source-list research-repository-evidence-list">
                {researchRepositoryDocuments.map((item) => {
                  return <article key={item.id}>
                    <b>{item.category || "Document"}</b>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.document_type || "Repository document"} Â· {item.status} Â· v{item.latest_version || item.current_version || 1}</small>
                      <span className="research-source-badges"><em>Published Repository evidence</em><em>No duplicate file</em></span>
                    </div>
                    <div className="research-source-governance">
                      <button
                        type="button"
                        onClick={() => void openRepositoryDocumentReader(item.id)}
                        title={`Preview ${item.title} in Document Reader`}
                      >
                        Preview
                      </button>
                      <button type="button" onClick={async () => {
                        if (!window.confirm(`Unlink â€œ${item.title}â€ from this research project? The Repository document itself will not be deleted.`)) return;
                        try {
                          await api.unlinkResearchRepositoryDocument(token, selectedResearch.id, item.id);
                          setResearchRepositoryDocuments(await api.researchRepositoryDocuments(token, selectedResearch.id));
                          setResearchActivity(await api.researchActivity(token, selectedResearch.id));
                          setResearchWorkspaceNotice("Repository evidence unlinked. The original Repository document remains unchanged.");
                        } catch (error) {
                          setResearchWorkspaceNotice(error instanceof Error ? error.message : "Repository evidence could not be unlinked.");
                        }
                      }}>Unlink</button>
                    </div>
                  </article>;
                })}
                {!researchRepositoryDocuments.length && <p>No Repository evidence is linked yet. Choose a published document above to link it without creating another copy.</p>}
              </div>
            </section>

            <section className="research-sources-panel">
              <header className="research-sources-head">
                <div>
                  <small>SOURCE REGISTER</small>
                  <h3>Other research sources</h3>
                  <p>
                    Record citations, datasets, interviews, websites and field evidence that are not Repository documents.
                  </p>
                </div>
                <strong>{researchSources.length} sources</strong>
              </header>
              <div className="research-source-kpis">
                <span>
                  <small>Core evidence</small>
                  <strong>
                    {
                      researchSources.filter(
                        (source) => source.relevance === "Core",
                      ).length
                    }
                  </strong>
                </span>
                <span>
                  <small>High quality</small>
                  <strong>
                    {
                      researchSources.filter(
                        (source) => source.quality === "High",
                      ).length
                    }
                  </strong>
                </span>
                <span>
                  <small>Primary evidence</small>
                  <strong>
                    {
                      researchSources.filter(
                        (source) => source.provenance === "Primary Evidence",
                      ).length
                    }
                  </strong>
                </span>
                <span
                  className={
                    researchSources.some(
                      (source) => source.quality === "Unrated",
                    )
                      ? "attention"
                      : ""
                  }
                >
                  <small>Needs rating</small>
                  <strong>
                    {
                      researchSources.filter(
                        (source) => source.quality === "Unrated",
                      ).length
                    }
                  </strong>
                </span>
              </div>
              <details
                className="research-source-add"
                open={!researchSources.length}
              >
                <summary>+ Add Source</summary>
                <div className="research-source-form">
                  <select
                    value={researchSourceForm.sourceType}
                    onChange={(event) =>
                      setResearchSourceForm({
                        ...researchSourceForm,
                        sourceType: event.target.value,
                      })
                    }
                  >
                    {[
                      "Journal Article",
                      "Report",
                      "Policy Document",
                      "Legislation",
                      "Institutional Report",
                      "Dataset",
                      "Website",
                      "Book",
                      "Interview",
                      "Field Evidence",
                    ].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                  <input
                    value={researchSourceForm.title}
                    onChange={(event) =>
                      setResearchSourceForm({
                        ...researchSourceForm,
                        title: event.target.value,
                      })
                    }
                    placeholder="Source title"
                  />
                  <input
                    value={researchSourceForm.author}
                    onChange={(event) =>
                      setResearchSourceForm({
                        ...researchSourceForm,
                        author: event.target.value,
                      })
                    }
                    placeholder="Author or institution"
                  />
                  <input
                    value={researchSourceForm.identifier}
                    onChange={(event) =>
                      setResearchSourceForm({
                        ...researchSourceForm,
                        identifier: event.target.value,
                      })
                    }
                    placeholder="DOI, ISBN or reference"
                  />
                  <input
                    value={researchSourceForm.url}
                    onChange={(event) =>
                      setResearchSourceForm({
                        ...researchSourceForm,
                        url: event.target.value,
                      })
                    }
                    placeholder="Approved URL (optional)"
                  />
                  <select
                    aria-label="Source provenance"
                    value={researchSourceForm.provenance}
                    onChange={(event) =>
                      setResearchSourceForm({
                        ...researchSourceForm,
                        provenance: event.target.value,
                      })
                    }
                  >
                    <option>Internal</option>
                    <option>External</option>
                    <option>Primary Evidence</option>
                    <option>Secondary Evidence</option>
                  </select>
                  <select
                    aria-label="Source quality"
                    value={researchSourceForm.quality}
                    onChange={(event) =>
                      setResearchSourceForm({
                        ...researchSourceForm,
                        quality: event.target.value,
                      })
                    }
                  >
                    <option>Unrated</option>
                    <option>Low</option>
                    <option>Moderate</option>
                    <option>High</option>
                  </select>
                  <select
                    aria-label="Source relevance"
                    value={researchSourceForm.relevance}
                    onChange={(event) =>
                      setResearchSourceForm({
                        ...researchSourceForm,
                        relevance: event.target.value,
                      })
                    }
                  >
                    <option>Background</option>
                    <option>Supporting</option>
                    <option>Core</option>
                  </select>
                  <button
                    disabled={!researchSourceForm.title.trim()}
                    onClick={async () => {
                      try {
                        await api.addResearchSource(
                          token,
                          selectedResearch.id,
                          researchSourceForm,
                        );
                        setResearchSources(
                          await api.researchSources(token, selectedResearch.id),
                        );
                        setResearchActivity(
                          await api.researchActivity(
                            token,
                            selectedResearch.id,
                          ),
                        );
                        setResearchSourceForm({
                          sourceType: "Report",
                          title: "",
                          author: "",
                          publisher: "",
                          publicationDate: null,
                          url: "",
                          identifier: "",
                          notes: "",
                          provenance: "External",
                          quality: "Unrated",
                          relevance: "Supporting",
                        });
                        setResearchWorkspaceNotice(
                          "Controlled research source added.",
                        );
                      } catch (error) {
                        setResearchWorkspaceNotice(
                          error instanceof Error
                            ? error.message
                            : "Source could not be added.",
                        );
                      }
                    }}
                  >
                    Add source
                  </button>
                </div>
              </details>
              <div className="research-source-toolbar">
                <input
                  type="search"
                  value={researchSourceSearch}
                  onChange={(event) =>
                    setResearchSourceSearch(event.target.value)
                  }
                  placeholder="Search title, author or identifier"
                />
                <select
                  value={researchSourceQuality}
                  onChange={(event) =>
                    setResearchSourceQuality(event.target.value)
                  }
                >
                  <option>All</option>
                  <option>Unrated</option>
                  <option>Low</option>
                  <option>Moderate</option>
                  <option>High</option>
                </select>
                <select
                  value={researchSourceRelevance}
                  onChange={(event) =>
                    setResearchSourceRelevance(event.target.value)
                  }
                >
                  <option>All</option>
                  <option>Background</option>
                  <option>Supporting</option>
                  <option>Core</option>
                </select>
              </div>
              <div className="research-source-list">
                {researchSources
                  .filter(
                    (source) =>
                      `${source.title} ${source.author} ${source.publisher} ${source.identifier}`
                        .toLowerCase()
                        .includes(researchSourceSearch.toLowerCase()) &&
                      (researchSourceQuality === "All" ||
                        source.quality === researchSourceQuality) &&
                      (researchSourceRelevance === "All" ||
                        source.relevance === researchSourceRelevance),
                  )
                  .map((source) => (
                    <article key={source.id}>
                      <b>{source.source_type}</b>
                      <div>
                        <strong>{source.title}</strong>
                        <small>
                          {[
                            source.author,
                            source.publisher,
                            source.publication_date,
                            source.identifier,
                          ]
                            .filter(Boolean)
                            .join(" Â· ") || "Metadata not supplied"}
                        </small>
                        <span className="research-source-badges">
                          <em>{source.provenance}</em>
                          <em
                            className={`quality-${source.quality.toLowerCase()}`}
                          >
                            {source.quality} quality
                          </em>
                          <em>{source.relevance} relevance</em>
                        </span>
                      </div>
                      <div className="research-source-governance">
                        <select
                          aria-label={`Quality for ${source.title}`}
                          value={source.quality}
                          onChange={async (event) => {
                            try {
                              await api.updateResearchSource(
                                token,
                                selectedResearch.id,
                                source.id,
                                {
                                  provenance: source.provenance,
                                  quality: event.target.value,
                                  relevance: source.relevance,
                                },
                              );
                              setResearchSources(
                                await api.researchSources(
                                  token,
                                  selectedResearch.id,
                                ),
                              );
                              setResearchWorkspaceNotice(
                                "Evidence quality updated.",
                              );
                            } catch (error) {
                              setResearchWorkspaceNotice(
                                error instanceof Error
                                  ? error.message
                                  : "Source could not be updated.",
                              );
                            }
                          }}
                        >
                          <option>Unrated</option>
                          <option>Low</option>
                          <option>Moderate</option>
                          <option>High</option>
                        </select>
                        <select
                          aria-label={`Relevance for ${source.title}`}
                          value={source.relevance}
                          onChange={async (event) => {
                            try {
                              await api.updateResearchSource(
                                token,
                                selectedResearch.id,
                                source.id,
                                {
                                  provenance: source.provenance,
                                  quality: source.quality,
                                  relevance: event.target.value,
                                },
                              );
                              setResearchSources(
                                await api.researchSources(
                                  token,
                                  selectedResearch.id,
                                ),
                              );
                              setResearchWorkspaceNotice(
                                "Evidence relevance updated.",
                              );
                            } catch (error) {
                              setResearchWorkspaceNotice(
                                error instanceof Error
                                  ? error.message
                                  : "Source could not be updated.",
                              );
                            }
                          }}
                        >
                          <option>Background</option>
                          <option>Supporting</option>
                          <option>Core</option>
                        </select>
                        {source.url && (
                          <a href={source.url} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Remove â€œ${source.title}â€ from this research project?`,
                              )
                            )
                              return;
                            try {
                              await api.deleteResearchSource(
                                token,
                                selectedResearch.id,
                                source.id,
                              );
                              setResearchSources(
                                await api.researchSources(
                                  token,
                                  selectedResearch.id,
                                ),
                              );
                              setResearchActivity(
                                await api.researchActivity(
                                  token,
                                  selectedResearch.id,
                                ),
                              );
                              setResearchWorkspaceNotice(
                                "Research source removed.",
                              );
                            } catch (error) {
                              setResearchWorkspaceNotice(
                                error instanceof Error
                                  ? error.message
                                  : "Source could not be removed.",
                              );
                            }
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  ))}
                {!researchSources.length && (
                  <p>No controlled sources have been added.</p>
                )}
              </div>
            </section>

            

            <section className="research-activity-panel">
              <header className="research-activity-head">
                <div>
                  <small>READ-ONLY PROJECT RECORD</small>
                  <h3>Activity and audit trail</h3>
                  <p>
                    Review who changed the plan, team, evidence, report and
                    project workflow.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!researchActivity.length}
                  onClick={() => {
                    const rows = [
                      ["Date", "User", "Category", "Action", "Details"],
                      ...researchActivity.map((item) => [
                        new Date(item.created_at).toISOString(),
                        item.user_name || "System",
                        /REPORT|SECTION/.test(item.action)
                          ? "Report"
                          : /SOURCE|EVIDENCE/.test(item.action)
                            ? "Evidence"
                            : /MILESTONE|PLAN|TEAM/.test(item.action)
                              ? "Planning"
                              : /DISCUSSION|COMMENT/.test(item.action)
                                ? "Discussion"
                                : /STATUS|COMPLET|APPROV|REVIEW/.test(
                                      item.action,
                                    )
                                  ? "Workflow"
                                  : "General",
                        item.action.replaceAll("_", " "),
                        JSON.stringify(item.details),
                      ]),
                    ];
                    const csv = rows
                      .map((row) =>
                        row
                          .map(
                            (value) =>
                              `"${String(value).replaceAll('"', '""')}"`,
                          )
                          .join(","),
                      )
                      .join("\r\n");
                    const url = URL.createObjectURL(
                      new Blob([csv], { type: "text/csv;charset=utf-8" }),
                    );
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `research-activity-${selectedResearch.id.slice(0, 8)}.csv`;
                    link.click();
                    URL.revokeObjectURL(url);
                    setResearchWorkspaceNotice(
                      "Research activity exported to CSV.",
                    );
                  }}
                >
                  Export activity
                </button>
              </header>
              <div className="research-activity-kpis">
                <span>
                  <small>Total events</small>
                  <strong>{researchActivity.length}</strong>
                </span>
                <span>
                  <small>Report events</small>
                  <strong>
                    {
                      researchActivity.filter((item) =>
                        /REPORT|SECTION/.test(item.action),
                      ).length
                    }
                  </strong>
                </span>
                <span>
                  <small>Evidence events</small>
                  <strong>
                    {
                      researchActivity.filter((item) =>
                        /SOURCE|EVIDENCE/.test(item.action),
                      ).length
                    }
                  </strong>
                </span>
                <span>
                  <small>Workflow events</small>
                  <strong>
                    {
                      researchActivity.filter((item) =>
                        /STATUS|COMPLET|APPROV|REVIEW/.test(item.action),
                      ).length
                    }
                  </strong>
                </span>
              </div>
              <div className="research-activity-toolbar">
                <input
                  type="search"
                  value={researchActivitySearch}
                  onChange={(event) =>
                    setResearchActivitySearch(event.target.value)
                  }
                  placeholder="Search activity, user or details"
                />
                <select
                  value={researchActivityFilter}
                  onChange={(event) =>
                    setResearchActivityFilter(event.target.value)
                  }
                >
                  <option>All</option>
                  <option>Planning</option>
                  <option>Evidence</option>
                  <option>Report</option>
                  <option>Discussion</option>
                  <option>Workflow</option>
                  <option>General</option>
                </select>
              </div>
              <div className="research-activity-timeline">
                {researchActivity
                  .filter((item) => {
                    const category = /REPORT|SECTION/.test(item.action)
                      ? "Report"
                      : /SOURCE|EVIDENCE/.test(item.action)
                        ? "Evidence"
                        : /MILESTONE|PLAN|TEAM/.test(item.action)
                          ? "Planning"
                          : /DISCUSSION|COMMENT/.test(item.action)
                            ? "Discussion"
                            : /STATUS|COMPLET|APPROV|REVIEW/.test(item.action)
                              ? "Workflow"
                              : "General";
                    return (
                      (researchActivityFilter === "All" ||
                        category === researchActivityFilter) &&
                      `${item.action} ${item.user_name || ""} ${JSON.stringify(item.details)}`
                        .toLowerCase()
                        .includes(researchActivitySearch.toLowerCase())
                    );
                  })
                  .map((item) => {
                    const category = /REPORT|SECTION/.test(item.action)
                      ? "Report"
                      : /SOURCE|EVIDENCE/.test(item.action)
                        ? "Evidence"
                        : /MILESTONE|PLAN|TEAM/.test(item.action)
                          ? "Planning"
                          : /DISCUSSION|COMMENT/.test(item.action)
                            ? "Discussion"
                            : /STATUS|COMPLET|APPROV|REVIEW/.test(item.action)
                              ? "Workflow"
                              : "General";
                    return (
                      <article
                        key={item.id}
                        className={`category-${category.toLowerCase()}`}
                      >
                        <i />
                        <div>
                          <header>
                            <b>{category}</b>
                            <time>
                              {new Date(item.created_at).toLocaleString(
                                "en-KE",
                              )}
                            </time>
                          </header>
                          <strong>
                            {item.action
                              .replaceAll("_", " ")
                              .toLowerCase()
                              .replace(/\b\w/g, (letter) =>
                                letter.toUpperCase(),
                              )}
                          </strong>
                          <span>Recorded for {item.user_name || "System"}</span>
                          {Object.keys(item.details || {}).length > 0 && (
                            <details>
                              <summary>View recorded details</summary>
                              <dl>
                                {Object.entries(item.details).map(
                                  ([key, value]) => (
                                    <div key={key}>
                                      <dt>{key.replace(/([A-Z])/g, " $1")}</dt>
                                      <dd>
                                        {typeof value === "object"
                                          ? JSON.stringify(value)
                                          : String(value ?? "")}
                                      </dd>
                                    </div>
                                  ),
                                )}
                              </dl>
                            </details>
                          )}
                        </div>
                      </article>
                    );
                  })}
                {!researchActivity.length && (
                  <div className="research-activity-empty">
                    <strong>No project activity yet</strong>
                    <span>
                      Controlled actions will appear here automatically.
                    </span>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
        {builderDocument && builderDocument.context !== "Assignment" && (
          <div className="structured-document-builder">
            <header>
              <button onClick={() => setBuilderDocument(null)}>â† Back</button>
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
              <button onClick={() => setBuilderDocument(null)}>Ã—</button>
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
            <main>
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
            </main>
          </div>
        )}
        {builderDocument && builderDocument.context !== "Assignment" && (
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
        {builderDocument?.context === "Assignment" && (
          <AssignmentReportBuilder
            token={token}
            document={builderDocument}
            templates={builderTemplates.filter(
              (template) =>
                template.context === "Assignment" &&
                template.active &&
                ["Standard", "Approved"].includes(template.governance_status),
            )}
            members={selectedAssignmentRecord?.members || []}
            currentUserName={user.name}
            currentUserId={user.id}
            assignmentTitle={selectedAssignmentRecord?.title || selectedAssignment || undefined}
            linkedTasks={assignmentTasks
              .filter(
                (task) =>
                  task.contribution_status === "Accepted" &&
                  Boolean(task.repository_document_id),
              )
              .map((task) => ({
                id: task.id,
                title: task.contribution_title || task.title,
                status: "Final approved source",
              }))}
            reviewers={assignmentReportReviewerCandidates}
            canReview={canReview}
            onSubmitForReview={submitAssignmentReportForReview}
            canEditAssignmentReport={Boolean(isManager || isAssignmentLead)}
            initialPreview={assignmentReportPreviewMode}
            onClose={() => {
              setBuilderDocument(null);
              setAssignmentReportPreviewMode(false);
              setAssignmentWorkspaceTab("Reports");
              if (selectedAssignmentId)
                void api
                  .generatedDocuments(token, "Assignment", selectedAssignmentId)
                  .then(setWorkspaceDocuments)
                  .catch(() => {});
            }}
            onRefresh={openGeneratedDocument}
            onExternalImported={async () => {
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
            }}
          />
        )}
        {selectedAssignment && (
          <div className="collab-drawer assignment-workspace">
            <header className="assignment-workspace-head">
              <button
                className="assignment-workspace-back"
                type="button"
                title="Back to Assignments"
                onClick={() => {
                  setSelectedAssignment(null);
                  setSelectedAssignmentId(null);
                  setActive("Assignments");
                }}
              >
                <span aria-hidden="true">&larr;</span> Assignments
              </button>

              <div className="assignment-workspace-title">
                <div className="assignment-title-copy">
                  <p>
                    Assignment {selectedAssignmentId
                      ? assignmentRef(selectedAssignmentId)
                      : ""}
                    <span aria-hidden="true"> &middot; </span>
                    {selectedAssignmentRecord?.division ||
                      "Division not recorded"}
                  </p>

                  <h2>{selectedAssignmentRecord?.title || selectedAssignment}</h2>
                </div>

                <div className="assignment-title-meta">
                  <span className="assignment-status-badge">
                    {selectedAssignmentRecord?.status || "Loading"}
                  </span>

                  <span className="assignment-priority-badge">
                    {selectedAssignmentRecord?.priority || "Priority not set"}
                  </span>

                  {selectedAssignmentRecord?.research_id && (
                    <button
                      type="button"
                      className="assignment-research-link"
                      title="Open the parent research project"
                      onClick={async () => {
                        try {
                          const projects = await api.research(token);
                          const project = projects.find((item) => item.id === selectedAssignmentRecord.research_id);
                          if (!project) { setAssignmentNotice("The related research project is not available to your account."); return; }
                          setSelectedAssignment(null);
                          setSelectedAssignmentId(null);
                          setActive("Research Repository");
                          setSelectedResearch(project);
                          setResearchTab("Overview");
                          setSelectedReportSection(null);
                          setReportContent("");
                          const [comments, report, sources, activityRows, templates, documents] = await Promise.all([
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
                          setAssignmentNotice(error instanceof Error ? error.message : "Related research could not be opened.");
                        }
                      }}
                    >
                      Research: {selectedAssignmentRecord.research_title || "Open project"}
                    </button>
                  )}

                  <span>
                    {selectedAssignmentRecord?.due_date
                      ? `Due ${new Date(selectedAssignmentRecord.due_date).toLocaleDateString("en-KE")}`
                      : "No due date"}
                  </span>

                  <span>
                    {assignmentDays === null
                      ? "No deadline"
                      : assignmentDays < 0
                        ? `${Math.abs(assignmentDays)} days overdue`
                        : assignmentDays === 0
                          ? "Due today"
                          : `${assignmentDays} days remaining`}
                  </span>
                </div>
              </div>

              <button
                className="assignment-workspace-close"
                type="button"
                title="Close assignment workspace"
                onClick={() => {
                  setSelectedAssignment(null);
                  setSelectedAssignmentId(null);
                }}
              >
                X
              </button>
            </header>

            <div className="assignment-phase4">
              <nav
                className="assignment-workspace-tabs"
                aria-label="Assignment workspace sections"
              >
                {(
                  [
                    { tab: "Overview", label: "Overview" },
                    { tab: "Tasks", label: "Tasks" },
                    { tab: "Documents", label: "Evidence" },
                    { tab: "Reports", label: "Reports" },
                    { tab: "Activity", label: "Activity" },
                  ] as const
                ).map(({ tab, label }) => (
                  <button
                    type="button"
                    aria-current={
                      assignmentWorkspaceTab === tab ? "page" : undefined
                    }
                    className={assignmentWorkspaceTab === tab ? "active" : ""}
                    key={tab}
                    onClick={() => {
                      setAssignmentWorkspaceTab(tab);
                      setAssignmentNotice("");
                    }}
                  >
                    <span>{navigationDisplayLabel(label)}</span>

                    {tab === "Tasks" && assignmentTasks.length > 0 && (
                      <b>{assignmentTasks.length}</b>
                    )}
                    {tab === "Reports" && workspaceDocuments.length > 0 && (
                      <b>{workspaceDocuments.length}</b>
                    )}

                  </button>
                ))}
                <div className="assignment-quick-add">
                  <button type="button" className="primary" onClick={() => setAssignmentAddOpen((open) => !open)}>+ Add</button>
                  {assignmentAddOpen && <div role="menu">
                    <button type="button" onClick={() => { setAssignmentAddOpen(false); setAssignmentWorkspaceTab("Tasks"); void openAssignmentTaskDialog(); }}>Task</button>
                    <button type="button" onClick={() => { setAssignmentAddOpen(false); setAssignmentWorkspaceTab("Reports"); }}>Report</button>
                    <button type="button" onClick={() => { setAssignmentAddOpen(false); setAssignmentWorkspaceTab("Documents"); setComment("Research note: "); }}>Note</button>
                    <label>Document<input type="file" hidden onChange={(event) => { setAssignmentAddOpen(false); setAssignmentWorkspaceTab("Documents"); void uploadAssignmentFile(event.target.files?.[0]); }} /></label>
                    <button type="button" onClick={() => { setAssignmentAddOpen(false); setAssignmentWorkspaceTab("Activity"); window.setTimeout(() => document.querySelector<HTMLTextAreaElement>(".assignment-activity-comment textarea")?.focus(), 0); }}>Comment</button>
                  </div>}
                </div>
              </nav>

              {assignmentNotice && (
                <div className="session-message assignment-dismissible-message" role="status">
                  <span>{assignmentNotice}</span>
                  <button type="button" aria-label="Dismiss message" onClick={() => setAssignmentNotice("")}>Ã—</button>
                </div>
              )}
              <aside className="assignment-felix-context">
                <header>
                  <button type="button" onClick={() => setAssignmentFelixOpen((open) => !open)}>{assignmentFelixOpen ? "Felix assignment assistant" : "Ask Felix about this assignment"}</button>
                  {assignmentFelixOpen && <button type="button" className="assignment-felix-hide" onClick={() => setAssignmentFelixOpen(false)} aria-label="Hide Felix assignment assistant">Hide Ã—</button>}
                </header>
                {assignmentFelixOpen && <div><div className="assignment-felix-prompts">{["Summarize this assignment", "What is overdue?", "What should I do next?", "Give me a progress update"].map((question) => <button type="button" key={question} onClick={() => setAssignmentFelixQuestion(question)}>{question}</button>)}</div><label>Question<input value={assignmentFelixQuestion} onChange={(event) => setAssignmentFelixQuestion(event.target.value)} placeholder="Find documents aboutâ€¦" /></label><button type="button" disabled={!assignmentFelixQuestion.trim() || assignmentFelixBusy} onClick={async () => { if (!selectedAssignmentId) return; setAssignmentFelixBusy(true); setAssignmentFelixAnswer(""); try { const response = await api.askFelix(token, `Assignment context: ID ${selectedAssignmentId}; title: ${selectedAssignmentRecord?.title || selectedAssignment || "Assignment"}. ${assignmentFelixQuestion}`, [], "Auto"); setAssignmentFelixAnswer(response.answer); } catch (error) { setAssignmentFelixAnswer(error instanceof Error ? error.message : "Felix could not answer."); } finally { setAssignmentFelixBusy(false); } }}>{assignmentFelixBusy ? "Thinkingâ€¦" : "Ask Felix"}</button>{assignmentFelixAnswer && <p><span>{assignmentFelixAnswer}</span><button type="button" aria-label="Dismiss Felix response" onClick={() => setAssignmentFelixAnswer("")}>Ã—</button></p>}</div>}
              </aside>

              {assignmentWorkspaceTab === "Overview" && false && (
                <section className="assignment-overview-minimal">
                  <p className="overview-minimal-brief">
                    {selectedAssignmentRecord?.description ||
                      "No assignment description has been recorded."}
                  </p>

                  <dl>
                    <div>
                      <dt>Lead</dt>
                      <dd>{assignmentLead?.name || "â€”"}</dd>
                    </div>
                    <div>
                      <dt>Team</dt>
                      <dd>{selectedAssignmentRecord?.members.length || 0}</dd>
                    </div>
                    <div>
                      <dt>Tasks</dt>
                      <dd>
                        {assignmentTasks.length - assignmentOpenTasks.length}/
                        {assignmentTasks.length} complete
                      </dd>
                    </div>
                    <div>
                      <dt>Reports</dt>
                      <dd>
                        {
                          assignmentTasks.filter(
                            (task) => task.contribution_status === "Accepted",
                          ).length
                        }
                        /{assignmentTasks.length} accepted
                      </dd>
                    </div>
                    <div>
                      <dt>Progress</dt>
                      <dd>{assignmentProgressPercent}%</dd>
                    </div>
                  </dl>

                  <div className="workspace-document-overview">
                    <header>
                      <div><small>AVAILABLE DOCUMENTS</small><h4>Assignment documents</h4></div>
                      <div className="workspace-document-actions"><strong>{assignmentFiles.length + workspaceDocuments.length + knowledgeRows.filter((item) => item.assignments?.some((assignment) => assignment.id === selectedAssignmentId)).length}</strong><label className="workspace-attach-report">{knowledgeUploading ? "Attachingâ€¦" : "+ Attach report"}<input type="file" accept=".pdf,.doc,.docx,.txt,.md" disabled={knowledgeUploading} onChange={(event) => { void attachWorkspaceReport(event.target.files?.[0], "Assignment", selectedAssignmentId); event.currentTarget.value = ""; }} /></label></div>
                    </header>
                    <div className="workspace-document-overview-list">
                      {workspaceDocuments.map((item) => <button type="button" key={`generated-${item.id}`} onClick={() => void openGeneratedDocument(item.id)}><span><b>{item.title}</b><small>Generated report Â· {item.status}</small></span><em>Open</em></button>)}
                      {assignmentFiles.map((file) => <button type="button" key={`upload-${file.id}`} onClick={() => api.downloadAttachment(token, file.id, file.original_name)}><span><b>{file.original_name}</b><small>Uploaded document Â· {new Date(file.created_at).toLocaleDateString("en-KE")}</small></span><em>Download</em></button>)}
                      {knowledgeRows.filter((item) => item.assignments?.some((assignment) => assignment.id === selectedAssignmentId)).map((item) => <button type="button" key={`repository-${item.id}`} onClick={() => void openRepositoryDocumentReader(item)}><span><b>{item.title}</b><small>Repository document Â· {item.status}</small></span><em>Preview</em></button>)}
                      {!assignmentFiles.length && !workspaceDocuments.length && !knowledgeRows.some((item) => item.assignments?.some((assignment) => assignment.id === selectedAssignmentId)) && <p>No documents are available for this assignment yet.</p>}
                    </div>
                  </div>

                  <footer>
                    <div>
                      <small>Next</small>
                      <strong>{assignmentNextAction.title}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        selectAssignmentWorkspaceTab(assignmentNextAction.tab)
                      }
                    >
                      {assignmentNextAction.label}
                    </button>
                  </footer>
                </section>
              )}

              {assignmentWorkspaceTab === "Overview" && (
                <section className="assignment-overview-v4">
                  <header className="assignment-overview-v4-hero">
                    <div className="assignment-overview-v4-title">
                      <small>ASSIGNMENT OVERVIEW</small>
                      <h2>{selectedAssignmentRecord?.title || selectedAssignment}</h2>
                      <p>
                        {selectedAssignmentRecord?.description ||
                          "No assignment description has been recorded. Add a clear objective and expected output so the team can work from one brief."}
                      </p>
                    </div>

                    <dl className="assignment-overview-v4-details">
                      <div><dt>Lead</dt><dd>{assignmentLead?.name || "Unassigned"}</dd></div>
                      <div><dt>Directorate / Division</dt><dd>{selectedAssignmentRecord?.division || "Not set"}</dd></div>
                      <div>
                        <dt>Due date</dt>
                        <dd>{selectedAssignmentRecord?.due_date ? new Date(selectedAssignmentRecord.due_date).toLocaleDateString("en-KE") : "Not set"}</dd>
                      </div>
                      <div><dt>Priority</dt><dd>{selectedAssignmentRecord?.priority || "Normal"}</dd></div>
                    </dl>
                  </header>

                  <section className="assignment-overview-v4-next">
                    <div>
                      <small>NEXT STEP</small>
                      <strong>{assignmentNextAction.title}</strong>
                      <p>{assignmentNextAction.detail}</p>
                    </div>
                    <button type="button" onClick={() => selectAssignmentWorkspaceTab(assignmentNextAction.tab)}>
                      {assignmentNextAction.label}
                    </button>
                  </section>

                  <section className="assignment-overview-v4-metrics" aria-label="Assignment metrics">
                    <div><small>Status</small><strong>{assignmentOperationalStatus}</strong></div>
                    <div><small>Tasks</small><strong>{completedTaskCount}/{assignmentTasks.length}</strong><span>completed</span></div>
                    <div><small>Task reports</small><strong>{acceptedTaskReportCount}/{assignmentTasks.length}</strong><span>accepted</span></div>
                    <div><small>Final report</small><strong>{latestFinalAssignmentReport?.status || "Not created"}</strong></div>
                    <div className="assignment-overview-v4-progress">
                      <small>Overall</small>
                      <strong>{assignmentCompletion}%</strong>
                      <span>{finalAssignmentReportIsFinal ? "workflow complete" : "workflow progress"}</span>
                    </div>
                  </section>

                  <div className="assignment-overview-v4-grid">
                    <main>
                      <article className="assignment-overview-v4-card">
                        <header>
                          <div><small>WORK</small><h3>Current tasks</h3></div>
                          <button type="button" className="assignment-overview-v4-link" onClick={() => selectAssignmentWorkspaceTab("Tasks")}>View all tasks</button>
                        </header>
                        {assignmentTasks.length ? (
                          <div className="assignment-overview-v4-tasklist">
                            {assignmentTasks.slice(0,4).map((task) => (
                              <button type="button" key={task.id} onClick={() => void openAssignmentTaskWorkspace(task)}>
                                <span>
                                  <strong>{task.title}</strong>
                                  <small>{task.owner_name || "Unassigned"}{task.due_date ? ` · due ${new Date(task.due_date).toLocaleDateString("en-KE")}` : ""}</small>
                                </span>
                                <em>{task.contribution_status === "Accepted" ? "Report accepted" : assignmentReportStatusLabel(task.contribution_status)}</em>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="assignment-overview-v4-empty">
                            <strong>No tasks yet</strong>
                            <span>Create the first task to begin measurable work.</span>
                            <button type="button" onClick={() => selectAssignmentWorkspaceTab("Tasks")}>Open Tasks</button>
                          </div>
                        )}
                      </article>

                      <article className="assignment-overview-v4-card">
                        <header>
                          <div><small>FINAL OUTPUT</small><h3>Final Assignment Report</h3></div>
                          <button type="button" className="assignment-overview-v4-link" onClick={() => selectAssignmentWorkspaceTab("Reports")}>Open Reports</button>
                        </header>
                        {latestFinalAssignmentReport ? (
                          <div className="assignment-overview-v4-final-report">
                            <span>
                              <strong>{latestFinalAssignmentReport.title}</strong>
                              <small>Status: {latestFinalAssignmentReport.status}{latestFinalAssignmentReport.reviewer_name ? ` · Reviewer: ${latestFinalAssignmentReport.reviewer_name}` : ""}</small>
                            </span>
                            <button type="button" onClick={() => void openGeneratedDocument(latestFinalAssignmentReport.id, finalAssignmentReportIsFinal)}>
                              {finalAssignmentReportIsFinal ? "Read final report" : "Open report"}
                            </button>
                          </div>
                        ) : (
                          <div className="assignment-overview-v4-empty compact">
                            <strong>Not created yet</strong>
                            <span>{allTaskReportsAccepted ? "All task reports are accepted. The Final Assignment Report can now be created." : "The Final Assignment Report becomes the next output after required task reports are accepted."}</span>
                          </div>
                        )}
                      </article>
                    </main>

                    <aside>
                      <article className="assignment-overview-v4-card">
                        <header><div><small>TEAM</small><h3>{selectedAssignmentRecord?.members?.length || 0} members</h3></div></header>
                        <div className="assignment-overview-v4-team">
                          {(selectedAssignmentRecord?.members || []).slice(0,6).map((member) => (
                            <div key={member.id}>
                              <b>{initialsFor(member.name)}</b>
                              <span><strong>{member.name}</strong><small>{member.role}</small></span>
                            </div>
                          ))}
                        </div>
                      </article>

                      <article className="assignment-overview-v4-card">
                        <header>
                          <div><small>RECENT ACTIVITY</small><h3>Latest updates</h3></div>
                          <button type="button" className="assignment-overview-v4-link" onClick={() => selectAssignmentWorkspaceTab("Activity")}>View activity</button>
                        </header>
                        <div className="assignment-overview-v4-activity">
                          {assignmentHistory.slice(0,3).map((item) => (
                            <div key={item.id}>
                              <strong>{item.action.replaceAll("_"," ").toLowerCase().replace(/^./,(letter) => letter.toUpperCase())}</strong>
                              <small>{item.user_name || "System"} · {new Date(item.created_at).toLocaleString("en-KE")}</small>
                            </div>
                          ))}
                          {!assignmentHistory.length && <span>No activity recorded yet.</span>}
                        </div>
                      </article>
                    </aside>
                  </div>
                </section>
              )}
              {assignmentWorkspaceTab === "Structure & Plan" && (
                <section className="assignment-structure-plan">
                  <header className="assignment-structure-head">
                    <div>
                      <small>ASSIGNMENT STRUCTURE &amp; DELIVERY PLAN</small>
                      <h3>Define the assignment workstreams</h3>
                      <p>
                        Define the workstreams that make up this assignment and
                        assign responsibility before distributing tasks.
                      </p>
                    </div>
                    {isManager && (
                      <div>
                        {!assignmentSections.length && (
                          <button
                            className="secondary"
                            type="button"
                            onClick={async () => {
                              if (
                                !selectedAssignmentId ||
                                !window.confirm(
                                  "Create the eight standard assignment workstreams?",
                                )
                              )
                                return;
                              try {
                                setAssignmentSections(
                                  await api.createAssignmentStarterStructure(
                                    token,
                                    selectedAssignmentId,
                                  ),
                                );
                                setAssignmentHistory(
                                  await api.history(
                                    token,
                                    selectedAssignmentId,
                                  ),
                                );
                                setAssignmentNotice(
                                  "Starter Structure created. Review each section and assign its lead and dates.",
                                );
                              } catch (error) {
                                setAssignmentNotice(
                                  error instanceof Error
                                    ? error.message
                                    : "Starter Structure could not be created.",
                                );
                              }
                            }}
                          >
                            Use Starter Structure
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openAssignmentSectionEditor("new")}
                        >
                          + Add Section
                        </button>
                      </div>
                    )}
                  </header>
                  <div className="assignment-structure-kpis">
                    <span>
                      <small>Sections</small>
                      <strong>{assignmentSections.length}</strong>
                    </span>
                    <span className="complete">
                      <small>Completed</small>
                      <strong>
                        {
                          assignmentSections.filter(
                            (section) => section.status === "Completed",
                          ).length
                        }
                      </strong>
                    </span>
                    <span className="active">
                      <small>In Progress</small>
                      <strong>
                        {
                          assignmentSections.filter(
                            (section) =>
                              section.status === "In Progress" ||
                              section.status === "Ready for Integration",
                          ).length
                        }
                      </strong>
                    </span>
                    <span className="blocked">
                      <small>Blocked</small>
                      <strong>
                        {
                          assignmentSections.filter(
                            (section) => section.status === "Blocked",
                          ).length
                        }
                      </strong>
                    </span>
                    <span>
                      <small>Overall progress</small>
                      <strong>
                        {assignmentSections.length
                          ? Math.round(
                              assignmentSections.reduce(
                                (sum, section) =>
                                  sum + Number(section.progress),
                                0,
                              ) / assignmentSections.length,
                            )
                          : 0}
                        %
                      </strong>
                    </span>
                  </div>
                  <div className="assignment-section-list">
                    {assignmentSections.map((section, index) => (
                      <article
                        key={section.id}
                        className={`section-status-${section.status.toLowerCase().replaceAll(" ", "-")}`}
                      >
                        <div className="assignment-section-number">
                          {String(index + 1).padStart(2, "0")}
                        </div>
                        <div className="assignment-section-identity">
                          <div>
                            <small>
                              {section.is_mandatory ? "MANDATORY" : "OPTIONAL"}
                            </small>
                            <h4>{section.title}</h4>
                          </div>
                          <p>
                            {section.description ||
                              "No section description has been added."}
                          </p>
                        </div>
                        <div className="assignment-section-facts">
                          <span>
                            <small>Section Lead</small>
                            <strong>{section.lead_name || "Unassigned"}</strong>
                          </span>
                          <span>
                            <small>Timeline</small>
                            <strong>
                              {section.start_date
                                ? new Date(
                                    `${section.start_date}T00:00:00`,
                                  ).toLocaleDateString("en-KE")
                                : "Not set"}{" "}
                              <em>â†’</em>{" "}
                              {section.due_date
                                ? new Date(
                                    `${section.due_date}T00:00:00`,
                                  ).toLocaleDateString("en-KE")
                                : "Not set"}
                            </strong>
                          </span>
                          <span>
                            <small>Status</small>
                            <b>{section.status}</b>
                          </span>
                        </div>
                        <div className="assignment-section-progress">
                          <div>
                            <i style={{ width: `${section.progress}%` }} />
                          </div>
                          <strong>{section.progress}%</strong>
                          <small>
                            {
                              assignmentTasks.filter(
                                (task) =>
                                  task.assignment_section_id === section.id,
                              ).length
                            }{" "}
                            linked tasks Â·{" "}
                            {
                              assignmentTasks.filter(
                                (task) =>
                                  task.assignment_section_id === section.id &&
                                  task.status === "Blocked",
                              ).length
                            }{" "}
                            blocked Â· task roll-up{" "}
                            {assignmentTasks.some(
                              (task) =>
                                task.assignment_section_id === section.id,
                            )
                              ? Math.round(
                                  assignmentTasks
                                    .filter(
                                      (task) =>
                                        task.assignment_section_id ===
                                        section.id,
                                    )
                                    .reduce(
                                      (sum, task) =>
                                        sum + Number(task.progress || 0),
                                      0,
                                    ) /
                                    assignmentTasks.filter(
                                      (task) =>
                                        task.assignment_section_id ===
                                        section.id,
                                    ).length,
                                )
                              : 0}
                            %
                          </small>
                        </div>
                        {isManager && (
                          <div className="assignment-section-actions">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => moveAssignmentSection(index, -1)}
                              aria-label={`Move ${section.title} up`}
                            >
                              â†‘
                            </button>
                            <button
                              type="button"
                              disabled={index === assignmentSections.length - 1}
                              onClick={() => moveAssignmentSection(index, 1)}
                              aria-label={`Move ${section.title} down`}
                            >
                              â†“
                            </button>
                            <button
                              type="button"
                              disabled={
                                !assignmentTasks.some(
                                  (task) =>
                                    task.assignment_section_id === section.id,
                                )
                              }
                              onClick={() =>
                                syncAssignmentSectionFromTasks(section)
                              }
                            >
                              Sync tasks
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                openAssignmentSectionEditor(section)
                              }
                            >
                              Edit
                            </button>
                            <button
                              className="archive"
                              type="button"
                              onClick={async () => {
                                if (
                                  !selectedAssignmentId ||
                                  !window.confirm(
                                    `Archive â€œ${section.title}â€? Existing linked tasks will be retained.`,
                                  )
                                )
                                  return;
                                try {
                                  await api.archiveAssignmentSection(
                                    token,
                                    selectedAssignmentId,
                                    section.id,
                                  );
                                  await refreshAssignmentSections();
                                  setAssignmentHistory(
                                    await api.history(
                                      token,
                                      selectedAssignmentId,
                                    ),
                                  );
                                  setAssignmentNotice("Section archived.");
                                } catch (error) {
                                  setAssignmentNotice(
                                    error instanceof Error
                                      ? error.message
                                      : "Section could not be archived.",
                                  );
                                }
                              }}
                            >
                              Archive
                            </button>
                          </div>
                        )}
                      </article>
                    ))}
                    {!assignmentSections.length && (
                      <div className="assignment-structure-empty">
                        <strong>
                          No assignment structure has been defined
                        </strong>
                        <p>
                          {isManager
                            ? "Use the eight-section Starter Structure or add the first workstream manually."
                            : "A manager must define the assignment workstreams before tasks are distributed."}
                        </p>
                        {isManager && (
                          <button
                            type="button"
                            onClick={() => openAssignmentSectionEditor("new")}
                          >
                            Add first section
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {assignmentWorkspaceTab === "Contributions" && (
                <section className="assignment-integration-queue">
                  <header>
                    <div>
                      <small>TASK REPORTS</small>
                      <h3>Generated task reports</h3>
                      <p>
                        View reports produced from completed task work, send
                        them for review, and accept the final result.
                      </p>
                    </div>
                    <span>
                      {
                        assignmentGeneratedReports.filter(
                          (task) =>
                            task.contribution_status ===
                            "Ready for Integration",
                        ).length
                      }{" "}
                      awaiting review
                    </span>
                  </header>
                  <nav>
                    {(
                      [
                        "All",
                        "Draft",
                        "Ready for Integration",
                        "Integrated",
                        "Accepted",
                      ] as const
                    ).map((filter) => (
                      <button
                        type="button"
                        key={filter}
                        className={
                          assignmentContributionFilter === filter
                            ? "active"
                            : ""
                        }
                        onClick={() => setAssignmentContributionFilter(filter)}
                      >
                        {filter === "All"
                          ? "All reports"
                          : assignmentReportStatusLabel(filter)}
                        <b>
                          {filter === "All"
                            ? assignmentGeneratedReports.length
                            : assignmentGeneratedReports.filter(
                                (task) => task.contribution_status === filter,
                              ).length}
                        </b>
                      </button>
                    ))}
                  </nav>
                  <div>
                    {assignmentGeneratedReports
                      .filter(
                        (task) =>
                          assignmentContributionFilter === "All" ||
                          task.contribution_status ===
                            assignmentContributionFilter,
                      )
                      .sort((a, b) => {
                        const priority = {
                          "Ready for Integration": 0,
                          Integrated: 1,
                          Draft: 2,
                          Accepted: 3,
                        };
                        return (
                          priority[a.contribution_status] -
                          priority[b.contribution_status]
                        );
                      })
                      .map((task) => (
                        <article key={task.id}>
                          <div>
                            <span>{task.title}</span>
                            <strong>
                              {task.contribution_title ||
                                `${task.title} report`}
                            </strong>
                            <small>
                              {task.owner_name || "Unassigned"} Â· Report v
                              {task.contribution_report_version || 1} Â·{" "}
                              {task.contribution_updated_at
                                ? new Date(
                                    task.contribution_updated_at,
                                  ).toLocaleString("en-KE")
                                : "Draft saved"}
                            </small>
                          </div>
                          <em
                            className={`contribution-${task.contribution_status.toLowerCase().replaceAll(" ", "-")}`}
                          >
                            {assignmentReportStatusLabel(
                              task.contribution_status,
                            )}
                          </em>
                          <button
                            type="button"
                            disabled={assignmentTaskReportPreviewBusy}
                            onClick={() => openAssignmentTaskWorkspace(task)}
                          >
                            {task.contribution_status ===
                              "Ready for Integration" &&
                            (isManager ||
                              isAssignmentLead ||
                              task.reviewer_id === user?.id)
                              ? "Review in Task Workspace"
                              : task.contribution_status === "Integrated" &&
                                  (isManager ||
                                    isAssignmentLead ||
                                    task.reviewer_id === user?.id)
                                ? "Review in Task Workspace"
                                : task.contribution_status === "Draft"
                                  ? task.owner_id === user?.id
                                    ? "Open Task Workspace"
                                    : "View Task Workspace"
                                  : "Open Task Workspace"}
                          </button>
                        </article>
                      ))}
                    {!assignmentGeneratedReports.some(
                      (task) =>
                        assignmentContributionFilter === "All" ||
                        task.contribution_status ===
                          assignmentContributionFilter,
                    ) && (
                      <div className="assignment-reports-empty">
                        <strong>
                          {assignmentContributionFilter === "All"
                            ? "No task reports generated yet"
                            : "No reports match this status"}
                        </strong>
                        <p>
                          {assignmentContributionFilter === "All"
                            ? "Open the Task Workspace, save the draft, preview it, then submit it to the assigned reviewer."
                            : "Choose another report status to continue."}
                        </p>
                        {assignmentContributionFilter === "All" && (
                          <button
                            type="button"
                            onClick={() =>
                              selectAssignmentWorkspaceTab("Tasks")
                            }
                          >
                            Open Tasks
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {assignmentWorkspaceTab === "Tasks" && (
                <section className="phase4-tasks task-workspace-polished">
                  <section className="assignment-my-work" aria-label="My Work">
                    <header><div><span className="workspace-eyebrow">MY WORK</span><h3>Your work in this assignment</h3></div></header>
                    <div>{[
                      ["Due Today", assignmentTasks.filter((task) => task.owner_name === user?.name && task.status !== "Completed" && taskDateValue(task.due_date) === new Date().toISOString().slice(0,10))],
                      ["Upcoming", assignmentTasks.filter((task) => task.owner_name === user?.name && task.status !== "Completed" && Boolean(task.due_date) && new Date(String(task.due_date)).getTime() >= Date.now())],
                      ["Overdue", assignmentTasks.filter((task) => task.owner_name === user?.name && task.status !== "Completed" && Boolean(task.due_date) && new Date(String(task.due_date)).getTime() < Date.now())],
                      ["Recently Completed", assignmentTasks.filter((task) => task.owner_name === user?.name && task.status === "Completed").slice(0,5)],
                    ].map(([label, rows]) => <button type="button" key={label as string} onClick={() => setAssignmentTaskFilter(label === "Overdue" ? "Overdue" : label === "Recently Completed" ? "Completed" : "My Tasks")}><span>{label as string}</span><b>{(rows as ApiAssignmentTask[]).length}</b></button>)}</div>
                  </section>
                  <header className="tasks-minimal-toolbar">
                    <p>
                      <strong>{assignmentTasks.length}</strong> task
                      {assignmentTasks.length === 1 ? "" : "s"} <span>Â·</span>{" "}
                      {
                        assignmentTasks.filter(
                          (task) => task.status === "Completed",
                        ).length
                      }{" "}
                      complete
                    </p>
                    <div>
                      <select
                        aria-label="Filter tasks"
                        value={assignmentTaskFilter}
                        onChange={(event) =>
                          setAssignmentTaskFilter(
                            event.target.value as typeof assignmentTaskFilter,
                          )
                        }
                      >
                        {[
                          "All",
                          "My Tasks",
                          "In Progress",
                          "Completed",
                          "Overdue",
                        ].map((filter) => (
                          <option key={filter}>{filter}</option>
                        ))}
                      </select>
                      {isManager && (
                        <button
                          type="button"
                          onClick={openAssignmentTaskDialog}
                        >
                          + Assign Task
                        </button>
                      )}
                    </div>
                  </header>

                  {false &&
                    (isManager ||
                      isAssignmentLead ||
                      assignmentTaskRequests.length > 0) && (
                      <section className="task-request-panel">
                        <header>
                          <div>
                            <span className="workspace-eyebrow">
                              TASK REQUESTS
                            </span>
                            <h4>Requested work</h4>
                            <p>
                              Team Leads can propose additional work. Managers
                              approve, adjust or reject each request.
                            </p>
                          </div>
                          <b>{pendingAssignmentTaskRequests.length} pending</b>
                        </header>

                        {assignmentTaskRequests.length ? (
                          <div className="task-request-list">
                            {assignmentTaskRequests.map((request) => (
                              <article
                                key={request.id}
                                className={`task-request-row request-${request.status.toLowerCase()}`}
                              >
                                <div className="task-request-main">
                                  <strong>{request.title}</strong>
                                  <small>
                                    {request.description ||
                                      "No description added."}
                                  </small>
                                  <span>
                                    Requested by {request.requested_by_name}
                                    {" | "}
                                    Suggested owner:{" "}
                                    {request.suggested_owner_name ||
                                      "Unassigned"}
                                    {" | "}
                                    {request.priority}
                                  </span>
                                  <em>{request.reason}</em>
                                </div>
                                <time>
                                  {request.due_date
                                    ? new Date(
                                        request.due_date,
                                      ).toLocaleDateString("en-KE")
                                    : "No due date"}
                                </time>
                                <span
                                  className={`task-request-status status-${request.status.toLowerCase()}`}
                                >
                                  {request.status === "Approved" &&
                                  request.task_id
                                    ? "Converted to Task"
                                    : request.status}
                                </span>
                                {isManager && request.status === "Pending" ? (
                                  <button
                                    type="button"
                                    className="task-request-review-button"
                                    onClick={() =>
                                      openAssignmentTaskRequestReview(request)
                                    }
                                  >
                                    Review
                                  </button>
                                ) : (
                                  <span className="task-request-reviewer">
                                    {request.reviewed_by_name
                                      ? `By ${request.reviewed_by_name}`
                                      : ""}
                                  </span>
                                )}
                              </article>
                            ))}
                          </div>
                        ) : (
                          <div className="task-request-empty">
                            <strong>No task requests yet.</strong>
                            <span>
                              Team Lead requests will appear here for manager
                              action.
                            </span>
                          </div>
                        )}
                      </section>
                    )}

                  <div className="tasks-minimal-list">
                    {filteredAssignmentTasks.length > 0 ? (
                      <div>
                        {filteredAssignmentTasks.map((task) => {
                          const dueMeta = taskDueMeta(task);
                          const statusClass = String(
                            task.status || "not-started",
                          )
                            .toLowerCase()
                            .replace(/\s+/g, "-");
                          return (
                            <article
                              className={`task-minimal-row task-row-status-${statusClass}`}
                              key={task.id}
                            >
                              <span
                                className={`task-minimal-state state-${statusClass}`}
                                aria-hidden="true"
                              />
                              <div>
                                <strong>{task.title}</strong>
                                <small>
                                  {task.owner_name || "Unassigned"}{" "}
                                  <span>Â·</span> Due{" "}
                                  {taskDateText(task.due_date)}
                                </small>
                              </div>
                              <b
                                className={`task-minimal-status status-${statusClass}`}
                              >
                                {task.status}
                              </b>
                              <em
                                className={`task-minimal-due due-${dueMeta.state}`}
                              >
                                {dueMeta.label}
                              </em>
                              <div className="task-minimal-actions">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openAssignmentTaskWorkspace(task)
                                  }
                                >
                                  {task.reviewer_id === user?.id &&
                                  ["Ready for Integration", "Integrated"].includes(
                                    task.contribution_status,
                                  )
                                    ? "Review"
                                    : isManager || task.owner_id === user?.id
                                      ? taskOpenLabel(task)
                                      : "View"}
                                </button>
                                {task.owner_id === user?.id &&
                                  task.status !== "Blocked" && (
                                    <button
                                      type="button"
                                      className="task-report-owner-action"
                                      onClick={() =>
                                        void openAssignmentTaskReport(task)
                                      }
                                    >
                                      {taskReportOwnerActionLabel(task)}
                                    </button>
                                  )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="task-empty-card">
                        <div className="task-empty-icon" aria-hidden="true">
                          +
                        </div>
                        <strong>
                          {assignmentTasks.length
                            ? "No tasks match this filter"
                            : "No tasks have been created yet"}
                        </strong>
                        <p>
                          {assignmentTasks.length
                            ? "Choose another filter."
                            : "Assign the first piece of work."}
                        </p>

                        {isManager && !assignmentTasks.length && (
                          <button
                            type="button"
                            onClick={openAssignmentTaskDialog}
                          >
                            Assign first task
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedAssignmentTask && (
                    <div className="task-workspace-backdrop task-workspace-fullscreen">
                      <section
                        className={`task-workspace-modal task-workspace-screen task-status-${selectedAssignmentTask.status.toLowerCase().replaceAll(" ", "-")}`}
                        aria-label={`Task workspace for ${selectedAssignmentTask.title}`}
                      >
                        <header className="task-workspace-modal-header task-screen-header">
                          <button
                            type="button"
                            className="task-back-button"
                            disabled={
                              assignmentTaskWorkspaceSaving ||
                              assignmentTaskManagementBusy
                            }
                            onClick={() => setSelectedAssignmentTask(null)}
                          >
                            â† Tasks
                          </button>
                          <div className="task-screen-title">
                            <span className="workspace-eyebrow">TASK WORKSPACE</span>
                            <h2>{selectedAssignmentTask.title}</h2>
                            <p>
                              {selectedAssignmentTask.status} Â·{" "}
                              {selectedAssignmentTask.owner_name ||
                                "Unassigned"}{" "}
                              Â· Due{" "}
                              {taskDateText(selectedAssignmentTask.due_date)}
                            </p>
                          </div>
                          <div className="task-header-tools">
                            {isSelectedTaskOwner &&
                              selectedAssignmentTask.status !== "Blocked" && (
                                <button
                                  type="button"
                                  className="task-header-report-jump"
                                  onClick={focusTaskReportEditor}
                                >
                                  {taskReportOwnerActionLabel(selectedAssignmentTask)}
                                </button>
                              )}
                            <details className="task-header-work-update">
                              <summary>
                                Work
                                <b>{assignmentTaskWorkspaceForm.progress}%</b>
                              </summary>
                              <div className="task-header-popover task-header-work-popover">
                                <header>
                                  <div>
                                    <span className="workspace-eyebrow">WORK UPDATE</span>
                                    <strong>{assignmentTaskWorkspaceForm.status}</strong>
                                  </div>
                                </header>
                                <div className="task-header-work-form">
                                  <label>
                                    <span>Status</span>
                                    <select
                                      value={assignmentTaskWorkspaceForm.status}
                                      onChange={(event) =>
                                        setAssignmentTaskWorkspaceForm({
                                          ...assignmentTaskWorkspaceForm,
                                          status: event.target.value,
                                        })
                                      }
                                    >
                                      <option>Not Started</option>
                                      <option>In Progress</option>
                                      <option>Blocked</option>
                                      {selectedAssignmentTask.status === "Completed" && (
                                        <option>Completed</option>
                                      )}
                                    </select>
                                  </label>
                                  {!isManager && (
                                    <label>
                                      <span>Started on</span>
                                      <input
                                        type="date"
                                        value={assignmentTaskWorkspaceForm.startDate}
                                        onChange={(event) =>
                                          setAssignmentTaskWorkspaceForm({
                                            ...assignmentTaskWorkspaceForm,
                                            startDate: event.target.value,
                                          })
                                        }
                                      />
                                    </label>
                                  )}
                                  <label>
                                    <span>Progress</span>
                                    <div className="task-header-progress-editor">
                                      <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="5"
                                        value={assignmentTaskWorkspaceForm.progress}
                                        onChange={(event) =>
                                          setAssignmentTaskWorkspaceForm({
                                            ...assignmentTaskWorkspaceForm,
                                            progress: Number(event.target.value),
                                          })
                                        }
                                      />
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={assignmentTaskWorkspaceForm.progress}
                                        onChange={(event) =>
                                          setAssignmentTaskWorkspaceForm({
                                            ...assignmentTaskWorkspaceForm,
                                            progress: Math.max(
                                              0,
                                              Math.min(100, Number(event.target.value) || 0),
                                            ),
                                          })
                                        }
                                      />
                                      <span>%</span>
                                    </div>
                                  </label>
                                  <small>Changes are saved using the normal Save Task action.</small>
                                </div>
                              </div>
                            </details>
                            <details className="task-header-documents">
                              <summary>
                                Documents
                                <b>{assignmentFiles.length + workspaceDocuments.length + knowledgeRows.filter((item) => item.assignments?.some((assignment) => assignment.id === selectedAssignmentId) || item.origin_links?.some((link) => link.type === "task" && link.id === selectedAssignmentTask.id)).length}</b>
                              </summary>
                              <div className="task-header-popover task-header-documents-popover">
                                <header>
                                  <div>
                                    <span className="workspace-eyebrow">SUPPORTING DOCUMENTS</span>
                                    <strong>Task and assignment documents</strong>
                                  </div>
                                </header>
                                <div className="task-header-document-list">
                                  {workspaceDocuments.map((item) => <button type="button" key={`task-generated-${item.id}`} className={item.id === selectedAssignmentTask.target_document_id ? "is-linked" : ""} onClick={() => void openGeneratedDocument(item.id)}><span><b>{item.title}</b><small>{item.id === selectedAssignmentTask.target_document_id ? "Linked task output" : "Generated report"} Â· {item.status}</small></span><em>Open</em></button>)}
                                  {assignmentFiles.map((file) => <button type="button" key={`task-upload-${file.id}`} onClick={() => api.downloadAttachment(token, file.id, file.original_name)}><span><b>{file.original_name}</b><small>Uploaded assignment document</small></span><em>Download</em></button>)}
                                  {knowledgeRows.filter((item) => item.assignments?.some((assignment) => assignment.id === selectedAssignmentId) || item.origin_links?.some((link) => link.type === "task" && link.id === selectedAssignmentTask.id)).map((item) => <button type="button" key={`task-repository-${item.id}`} onClick={() => void openRepositoryDocumentReader(item)}><span><b>{item.title}</b><small>{item.origin_links?.some((link) => link.type === "task" && link.id === selectedAssignmentTask.id) ? "Attached task report" : "Repository document"} Â· {item.status}</small></span><em>Preview</em></button>)}
                                  {!assignmentFiles.length && !workspaceDocuments.length && !knowledgeRows.some((item) => item.assignments?.some((assignment) => assignment.id === selectedAssignmentId) || item.origin_links?.some((link) => link.type === "task" && link.id === selectedAssignmentTask.id)) && <p>No supporting documents are attached yet.</p>}
                                </div>
                              </div>
                            </details>
                            <label className="task-header-attach">
                              {knowledgeUploading ? "Attachingâ€¦" : "+ Attach report"}
                              <input type="file" accept=".pdf,.doc,.docx,.txt,.md" disabled={knowledgeUploading} onChange={(event) => { void attachWorkspaceReport(event.target.files?.[0], "Task", selectedAssignmentTask.id); event.currentTarget.value = ""; }} />
                            </label>
                            {isManager && (
                              <details className="task-header-admin">
                                <summary>Task Admin</summary>
                                <div className="task-header-popover task-header-admin-popover">
                                  <span className="workspace-eyebrow">TASK ADMINISTRATION</span>
                                  <strong>Archive or delete this task</strong>
                                  <small>Archive preserves the institutional record. Delete is only for tasks created in error before formal review.</small>
                                  <div className="task-header-admin-actions">
                                    <button
                                      type="button"
                                      className="task-archive-button"
                                      disabled={assignmentTaskManagementBusy || assignmentTaskWorkspaceSaving}
                                      onClick={archiveSelectedAssignmentTask}
                                    >
                                      Archive
                                    </button>
                                    <button
                                      type="button"
                                      className="task-delete-button"
                                      disabled={
                                        assignmentTaskManagementBusy ||
                                        assignmentTaskWorkspaceSaving ||
                                        selectedAssignmentTask.status === "Completed" ||
                                        selectedAssignmentTask.contribution_status !== "Draft"
                                      }
                                      onClick={() => {
                                        setAssignmentTaskDeleteReason("");
                                        setAssignmentTaskDeleteConfirmed(false);
                                        setAssignmentTaskDeleteDialogOpen(true);
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                  {(selectedAssignmentTask.status === "Completed" || selectedAssignmentTask.contribution_status !== "Draft") && (
                                    <small className="task-delete-locked">Delete is locked because this task has entered the formal reporting record. Archive preserves report provenance.</small>
                                  )}
                                </div>
                              </details>
                            )}
                          </div>
                        </header>

                        <div className="task-workspace-meta task-screen-meta">
                          <div>
                            <small>Output</small>
                            <strong>
                              {selectedAssignmentTask.expected_output ||
                                "Task Report"}
                            </strong>
                          </div>
                          <div>
                            <small>Task brief</small>
                            <strong>
                              {selectedAssignmentTask.description ||
                                "No description"}
                            </strong>
                          </div>
                          <div>
                            <small>Priority</small>
                            <strong
                              className={`task-priority-chip ${selectedAssignmentTask.priority.toLowerCase()}`}
                            >
                              {selectedAssignmentTask.priority}
                            </strong>
                          </div>
                          <div>
                            <small>Reviewer</small>
                            <strong>
                              {selectedAssignmentTask.reviewer_name ||
                                "Not assigned"}
                            </strong>
                          </div>
                        </div>

                        {isManager || isSelectedTaskOwner || isSelectedTaskReviewer ? (
                          <div className="task-workspace-body task-screen-body">
                            {isManager && (
                              <details className="task-management-card task-management-compact">
                                <summary>Edit task details</summary>
                                <div className="task-management-grid">
                                  <label className="wide">
                                    <span>Task title</span>
                                    <input
                                      value={assignmentTaskWorkspaceForm.title}
                                      onChange={(event) =>
                                        setAssignmentTaskWorkspaceForm({
                                          ...assignmentTaskWorkspaceForm,
                                          title: event.target.value,
                                        })
                                      }
                                    />
                                  </label>
                                  <label className="wide">
                                    <span>Description</span>
                                    <textarea
                                      rows={4}
                                      value={
                                        assignmentTaskWorkspaceForm.description
                                      }
                                      onChange={(event) =>
                                        setAssignmentTaskWorkspaceForm({
                                          ...assignmentTaskWorkspaceForm,
                                          description: event.target.value,
                                        })
                                      }
                                    />
                                  </label>
                                  <label className="wide">
                                    <span>Purpose</span>
                                    <textarea
                                      rows={2}
                                      value={
                                        assignmentTaskWorkspaceForm.taskPurpose
                                      }
                                      onChange={(event) =>
                                        setAssignmentTaskWorkspaceForm({
                                          ...assignmentTaskWorkspaceForm,
                                          taskPurpose: event.target.value,
                                        })
                                      }
                                    />
                                  </label>
                                  <label className="wide">
                                    <span>Specific instructions</span>
                                    <textarea
                                      rows={4}
                                      value={
                                        assignmentTaskWorkspaceForm.specificInstructions
                                      }
                                      onChange={(event) =>
                                        setAssignmentTaskWorkspaceForm({
                                          ...assignmentTaskWorkspaceForm,
                                          specificInstructions:
                                            event.target.value,
                                        })
                                      }
                                    />
                                  </label>
                                  <label className="wide">
                                    <span>Expected findings</span>
                                    <textarea
                                      rows={2}
                                      value={
                                        assignmentTaskWorkspaceForm.expectedFindings
                                      }
                                      onChange={(event) =>
                                        setAssignmentTaskWorkspaceForm({
                                          ...assignmentTaskWorkspaceForm,
                                          expectedFindings: event.target.value,
                                        })
                                      }
                                    />
                                  </label>
                                  <label>
                                    <span>Expected output</span>
                                    <select
                                      value={
                                        assignmentTaskWorkspaceForm.expectedOutput
                                      }
                                      onChange={(event) =>
                                        setAssignmentTaskWorkspaceForm({
                                          ...assignmentTaskWorkspaceForm,
                                          expectedOutput: event.target.value,
                                        })
                                      }
                                    >
                                      {[
                                        "Task Report",
                                        "Assessment",
                                        "Analysis",
                                        "Recommendations",
                                        "Data Summary",
                                        "Meeting Report",
                                        "Field Visit Report",
                                        "Policy Brief",
                                      ].map((output) => (
                                        <option key={output}>{output}</option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="wide">
                                    <span>Evidence required</span>
                                    <textarea
                                      rows={2}
                                      value={
                                        assignmentTaskWorkspaceForm.evidenceRequired
                                      }
                                      onChange={(event) =>
                                        setAssignmentTaskWorkspaceForm({
                                          ...assignmentTaskWorkspaceForm,
                                          evidenceRequired: event.target.value,
                                        })
                                      }
                                    />
                                  </label>
                                  <label>
                                    <span>Task report reviewer</span>
                                    <select
                                      value={
                                        assignmentTaskWorkspaceForm.reviewerId
                                      }
                                      onChange={(event) =>
                                        setAssignmentTaskWorkspaceForm({
                                          ...assignmentTaskWorkspaceForm,
                                          reviewerId: event.target.value,
                                        })
                                      }
                                    >
                                      <option value="">Select reviewer</option>
                                      {userRows
                                        .filter(
                                          (member) =>
                                            member.active &&
                                            [
                                              "Reviewer",
                                              "Research Manager",
                                              "Administrator",
                                            ].includes(member.role),
                                        )
                                        .map((member) => (
                                          <option
                                            key={member.id}
                                            value={member.id}
                                          >
                                            {member.name}
                                          </option>
                                        ))}
                                    </select>
                                  </label>
                                  <label>
                                    <span>Assigned to</span>
                                    <select
                                      value={
                                        assignmentTaskWorkspaceForm.ownerId
                                      }
                                      onChange={(event) =>
                                        setAssignmentTaskWorkspaceForm({
                                          ...assignmentTaskWorkspaceForm,
                                          ownerId: event.target.value,
                                        })
                                      }
                                    >
                                      <option value="">Unassigned</option>
                                      {selectedAssignmentRecord?.members?.map(
                                        (member) => (
                                          <option
                                            value={member.id}
                                            key={member.id}
                                          >
                                            {member.name} â€” {member.role}
                                          </option>
                                        ),
                                      )}
                                    </select>
                                  </label>
                                  <label>
                                    <span>Priority</span>
                                    <select
                                      value={
                                        assignmentTaskWorkspaceForm.priority
                                      }
                                      onChange={(event) =>
                                        setAssignmentTaskWorkspaceForm({
                                          ...assignmentTaskWorkspaceForm,
                                          priority: event.target.value,
                                        })
                                      }
                                    >
                                      <option>Low</option>
                                      <option>Normal</option>
                                      <option>High</option>
                                      <option>Critical</option>
                                    </select>
                                  </label>
                                  <label>
                                    <span>Start date</span>
                                    <input
                                      type="date"
                                      value={
                                        assignmentTaskWorkspaceForm.startDate
                                      }
                                      onChange={(event) =>
                                        setAssignmentTaskWorkspaceForm({
                                          ...assignmentTaskWorkspaceForm,
                                          startDate: event.target.value,
                                        })
                                      }
                                    />
                                  </label>
                                  <label>
                                    <span>Due date</span>
                                    <input
                                      type="date"
                                      value={
                                        assignmentTaskWorkspaceForm.dueDate
                                      }
                                      onChange={(event) =>
                                        setAssignmentTaskWorkspaceForm({
                                          ...assignmentTaskWorkspaceForm,
                                          dueDate: event.target.value,
                                        })
                                      }
                                    />
                                  </label>
                                </div>
                              </details>
                            )}

                            {false && (
                              <section className="task-contribution-map-card">
                                <header>
                                  <div>
                                    <span className="workspace-eyebrow">
                                      CONTRIBUTION TO ASSIGNMENT
                                    </span>
                                    <h3>Why this task matters</h3>
                                  </div>
                                  <span
                                    className={`task-contribution-status ${assignmentTaskWorkspaceForm.contributionStatus.toLowerCase().replaceAll(" ", "-")}`}
                                  >
                                    {
                                      assignmentTaskWorkspaceForm.contributionStatus
                                    }
                                  </span>
                                </header>
                                <div className="task-contribution-map-grid">
                                  <div>
                                    <small>Assignment</small>
                                    <strong>
                                      {selectedAssignmentRecord?.title ||
                                        "Current assignment"}
                                    </strong>
                                  </div>
                                  <div>
                                    <small>Expected contribution</small>
                                    <strong>
                                      {assignmentTaskWorkspaceForm.expectedContribution ||
                                        "Not defined yet"}
                                    </strong>
                                  </div>
                                  <div className="exact-assignment-part">
                                    <small>
                                      Exact assignment template section
                                    </small>
                                    <strong>
                                      {assignmentTaskWorkspaceForm.assignmentPart ||
                                        "Not yet mapped â€” manager should select a template section"}
                                    </strong>
                                  </div>
                                  <div>
                                    <small>Feeds into</small>
                                    <strong>
                                      {selectedAssignmentTask?.target_document_title ||
                                        "General Assignment Contribution"}
                                    </strong>
                                  </div>
                                  <div>
                                    <small>Target section</small>
                                    <strong>
                                      {selectedAssignmentTask?.target_section_title ||
                                        "Not yet mapped"}
                                    </strong>
                                  </div>
                                </div>
                                {isManager && (
                                  <div className="task-contribution-manager-map">
                                    <label>
                                      <span>Expected contribution</span>
                                      <textarea
                                        rows={2}
                                        value={
                                          assignmentTaskWorkspaceForm.expectedContribution
                                        }
                                        onChange={(event) =>
                                          setAssignmentTaskWorkspaceForm({
                                            ...assignmentTaskWorkspaceForm,
                                            expectedContribution:
                                              event.target.value,
                                          })
                                        }
                                      />
                                    </label>
                                    <label>
                                      <span>Exact assignment part</span>
                                      {assignmentTemplateParts.length > 0 ? (
                                        <select
                                          value={
                                            assignmentTaskWorkspaceForm.assignmentPart
                                          }
                                          onChange={(event) =>
                                            setAssignmentTaskWorkspaceForm({
                                              ...assignmentTaskWorkspaceForm,
                                              assignmentPart:
                                                event.target.value,
                                            })
                                          }
                                        >
                                          <option value="">
                                            Select assignment template section
                                          </option>
                                          {assignmentTaskWorkspaceForm.assignmentPart &&
                                            !assignmentTemplateParts.some(
                                              (part) =>
                                                part.value ===
                                                assignmentTaskWorkspaceForm.assignmentPart,
                                            ) && (
                                              <option
                                                value={
                                                  assignmentTaskWorkspaceForm.assignmentPart
                                                }
                                              >
                                                {
                                                  assignmentTaskWorkspaceForm.assignmentPart
                                                }
                                              </option>
                                            )}
                                          {assignmentTemplateParts.map(
                                            (part) => (
                                              <option
                                                key={`${part.templateId}-${part.sectionKey}`}
                                                value={part.value}
                                              >
                                                {part.label}
                                              </option>
                                            ),
                                          )}
                                        </select>
                                      ) : (
                                        <input
                                          value={
                                            assignmentTaskWorkspaceForm.assignmentPart
                                          }
                                          onChange={(event) =>
                                            setAssignmentTaskWorkspaceForm({
                                              ...assignmentTaskWorkspaceForm,
                                              assignmentPart:
                                                event.target.value,
                                            })
                                          }
                                          placeholder="Objective â†’ workstream â†’ section / activity"
                                        />
                                      )}
                                    </label>
                                    <label>
                                      <span>Output</span>
                                      <select
                                        value={
                                          assignmentTaskWorkspaceForm.targetDocumentId
                                        }
                                        onChange={async (event) => {
                                          const documentId = event.target.value;
                                          setAssignmentTaskWorkspaceForm({
                                            ...assignmentTaskWorkspaceForm,
                                            targetDocumentId: documentId,
                                            targetSectionId: "",
                                          });
                                          setAssignmentTaskTargetSections([]);
                                          if (documentId) {
                                            try {
                                              const document =
                                                await api.generatedDocument(
                                                  token,
                                                  documentId,
                                                );
                                              setAssignmentTaskTargetSections(
                                                document.sections || [],
                                              );
                                            } catch {}
                                          }
                                        }}
                                      >
                                        <option value="">
                                          General Assignment Contribution
                                        </option>
                                        {workspaceDocuments.map((document) => (
                                          <option
                                            key={document.id}
                                            value={document.id}
                                          >
                                            {document.title}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <label>
                                      <span>Section</span>
                                      <select
                                        value={
                                          assignmentTaskWorkspaceForm.targetSectionId
                                        }
                                        disabled={
                                          !assignmentTaskWorkspaceForm.targetDocumentId
                                        }
                                        onChange={(event) =>
                                          setAssignmentTaskWorkspaceForm({
                                            ...assignmentTaskWorkspaceForm,
                                            targetSectionId: event.target.value,
                                          })
                                        }
                                      >
                                        <option value="">
                                          Not yet mapped / whole output
                                        </option>
                                        {assignmentTaskTargetSections.map(
                                          (section) => (
                                            <option
                                              key={section.id}
                                              value={section.id}
                                            >
                                              {section.title}
                                            </option>
                                          ),
                                        )}
                                      </select>
                                    </label>
                                  </div>
                                )}
                                {isManager && (
                                  <div className="task-contribution-output-actions workspace">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAssignmentTaskQuickOutputOpen(
                                          (open) => !open,
                                        );
                                        setAssignmentTaskQuickOutputForm(
                                          (current) => ({
                                            ...current,
                                            templateId:
                                              current.templateId ||
                                              builderTemplates[0]?.id ||
                                              "",
                                          }),
                                        );
                                      }}
                                    >
                                      + Create Assignment Output
                                    </button>
                                    {!assignmentTaskWorkspaceForm.targetDocumentId && (
                                      <span>
                                        This task can remain a General
                                        Assignment Contribution until the final
                                        output is known.
                                      </span>
                                    )}
                                  </div>
                                )}
                                {isManager && assignmentTaskQuickOutputOpen && (
                                  <div className="task-quick-output-panel workspace">
                                    <label>
                                      <span>Output type</span>
                                      <select
                                        value={
                                          assignmentTaskQuickOutputForm.templateId
                                        }
                                        onChange={(event) =>
                                          setAssignmentTaskQuickOutputForm({
                                            ...assignmentTaskQuickOutputForm,
                                            templateId: event.target.value,
                                          })
                                        }
                                      >
                                        <option value="">
                                          Select output type
                                        </option>
                                        {builderTemplates.map((template) => (
                                          <option
                                            key={template.id}
                                            value={template.id}
                                          >
                                            {template.name}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <label className="wide">
                                      <span>Output title</span>
                                      <input
                                        value={
                                          assignmentTaskQuickOutputForm.title
                                        }
                                        onChange={(event) =>
                                          setAssignmentTaskQuickOutputForm({
                                            ...assignmentTaskQuickOutputForm,
                                            title: event.target.value,
                                          })
                                        }
                                        placeholder="e.g. Digital Records Assessment Report"
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      className="quick-output-create"
                                      disabled={
                                        assignmentTaskQuickOutputSaving ||
                                        !assignmentTaskQuickOutputForm.templateId ||
                                        !assignmentTaskQuickOutputForm.title.trim()
                                      }
                                      onClick={() =>
                                        createTaskContributionOutput(
                                          "workspace",
                                        )
                                      }
                                    >
                                      {assignmentTaskQuickOutputSaving
                                        ? "Creating..."
                                        : "Create & Link Output"}
                                    </button>
                                  </div>
                                )}
                              </section>
                            )}

                            {renderTaskReportOwnerFeedback()}
                            {renderTaskReviewDecision()}

                            <section id="task-report-editor" className="task-member-output-card">
                              <header>
                                <div>
                                  <h3>Task report</h3>
                                  <p className="task-workspace-single-source">One workspace: edit â†’ save draft â†’ preview â†’ submit to reviewer.</p>
                                </div>
                                <div className="task-report-header-controls">
                                  <span
                                    className={`task-contribution-status ${assignmentTaskWorkspaceForm.contributionStatus.toLowerCase().replaceAll(" ", "-")}`}
                                  >
                                    {assignmentReportStatusLabel(
                                      assignmentTaskWorkspaceForm.contributionStatus as ApiAssignmentTask["contribution_status"],
                                    )}
                                  </span>
                                  {isSelectedTaskOwner &&
                                    assignmentTaskWorkspaceForm.contributionStatus === "Draft" &&
                                    selectedAssignmentTask.status !== "Blocked" && (
                                      <div className="task-report-header-actions">
                                        <button
                                          type="button"
                                          className="task-contribution-save"
                                          disabled={assignmentTaskContributionSaving}
                                          onClick={() => saveAssignmentTaskContribution("Draft")}
                                        >
                                          {assignmentTaskContributionSaving ? "Saving..." : "Save Draft"}
                                        </button>
                                        <button
                                          type="button"
                                          className="task-contribution-next-button"
                                          disabled={assignmentTaskContributionSaving || assignmentTaskReportPreviewBusy}
                                          onClick={previewAssignmentTaskContribution}
                                        >
                                          {assignmentTaskReportPreviewBusy ? "Preparing..." : "Preview Report"}
                                        </button>
                                      </div>
                                    )}
                                  {["Ready for Integration", "Integrated", "Accepted"].includes(
                                    assignmentTaskWorkspaceForm.contributionStatus,
                                  ) && (
                                    <button
                                      type="button"
                                      className="task-contribution-view-report"
                                      disabled={assignmentTaskReportPreviewBusy}
                                      onClick={openSavedAssignmentTaskContributionReport}
                                    >
                                      Preview Submitted Report
                                    </button>
                                  )}
                                </div>
                              </header>
                              {renderTaskWorkflowAccessNotice()}
                              <div className="task-member-output-grid">
                                <label className="wide">
                                  <span>Output title</span>
                                  <input
                                    readOnly={
                                      !isSelectedTaskOwner ||
                                      assignmentTaskWorkspaceForm.contributionStatus !== "Draft" ||
                                      selectedAssignmentTask.status === "Blocked"
                                    }
                                    value={
                                      assignmentTaskWorkspaceForm.contributionTitle
                                    }
                                    onChange={(event) =>
                                      setAssignmentTaskWorkspaceForm({
                                        ...assignmentTaskWorkspaceForm,
                                        contributionTitle: event.target.value,
                                      })
                                    }
                                    placeholder="e.g. ID Scanning Process Analysis"
                                  />
                                  {taskReportSectionControls("title")}
                                </label>
                                <label className="wide">
                                  <span>Work completed</span>
                                  <textarea
                                    readOnly={
                                      !isSelectedTaskOwner ||
                                      assignmentTaskWorkspaceForm.contributionStatus !== "Draft" ||
                                      selectedAssignmentTask.status === "Blocked"
                                    }
                                    rows={4}
                                    value={
                                      assignmentTaskWorkspaceForm.contributionSummary
                                    }
                                    onChange={(event) =>
                                      setAssignmentTaskWorkspaceForm({
                                        ...assignmentTaskWorkspaceForm,
                                        contributionSummary: event.target.value,
                                      })
                                    }
                                    placeholder="Summarise what you completed and the result."
                                  />
                                  {taskReportSectionControls("workCompleted")}
                                </label>
                                <label className="wide">
                                  <span>Evidence reviewed</span>
                                  <textarea
                                    readOnly={
                                      !isSelectedTaskOwner ||
                                      assignmentTaskWorkspaceForm.contributionStatus !== "Draft" ||
                                      selectedAssignmentTask.status === "Blocked"
                                    }
                                    rows={4}
                                    value={
                                      assignmentTaskWorkspaceForm.evidenceReviewed
                                    }
                                    onChange={(event) =>
                                      setAssignmentTaskWorkspaceForm({
                                        ...assignmentTaskWorkspaceForm,
                                        evidenceReviewed: event.target.value,
                                      })
                                    }
                                    placeholder="List documents, interviews, datasets and observations used."
                                  />
                                  {taskReportSectionControls("evidence")}
                                </label>
                                <label>
                                  <span>Key findings</span>
                                  <textarea
                                    readOnly={
                                      !isSelectedTaskOwner ||
                                      assignmentTaskWorkspaceForm.contributionStatus !== "Draft" ||
                                      selectedAssignmentTask.status === "Blocked"
                                    }
                                    rows={6}
                                    value={
                                      assignmentTaskWorkspaceForm.contributionFindings
                                    }
                                    onChange={(event) =>
                                      setAssignmentTaskWorkspaceForm({
                                        ...assignmentTaskWorkspaceForm,
                                        contributionFindings:
                                          event.target.value,
                                      })
                                    }
                                    placeholder="Record the main findings, one per line."
                                  />
                                  {taskReportSectionControls("findings")}
                                </label>
                                <label>
                                  <span>Recommendations</span>
                                  <textarea
                                    readOnly={
                                      !isSelectedTaskOwner ||
                                      assignmentTaskWorkspaceForm.contributionStatus !== "Draft" ||
                                      selectedAssignmentTask.status === "Blocked"
                                    }
                                    rows={6}
                                    value={
                                      assignmentTaskWorkspaceForm.contributionRecommendations
                                    }
                                    onChange={(event) =>
                                      setAssignmentTaskWorkspaceForm({
                                        ...assignmentTaskWorkspaceForm,
                                        contributionRecommendations:
                                          event.target.value,
                                      })
                                    }
                                    placeholder="Record recommendations or actions arising from the work."
                                  />
                                  {taskReportSectionControls("recommendations")}
                                </label>
                                <label>
                                  <span>Challenges or limitations</span>
                                  <textarea
                                    readOnly={
                                      !isSelectedTaskOwner ||
                                      assignmentTaskWorkspaceForm.contributionStatus !== "Draft" ||
                                      selectedAssignmentTask.status === "Blocked"
                                    }
                                    rows={5}
                                    value={
                                      assignmentTaskWorkspaceForm.contributionChallenges
                                    }
                                    onChange={(event) =>
                                      setAssignmentTaskWorkspaceForm({
                                        ...assignmentTaskWorkspaceForm,
                                        contributionChallenges:
                                          event.target.value,
                                      })
                                    }
                                    placeholder="Record blockers, limitations and unresolved issues."
                                  />
                                  {taskReportSectionControls("challenges")}
                                </label>
                                <label>
                                  <span>Next actions</span>
                                  <textarea
                                    readOnly={
                                      !isSelectedTaskOwner ||
                                      assignmentTaskWorkspaceForm.contributionStatus !== "Draft" ||
                                      selectedAssignmentTask.status === "Blocked"
                                    }
                                    rows={5}
                                    value={
                                      assignmentTaskWorkspaceForm.contributionNextActions
                                    }
                                    onChange={(event) =>
                                      setAssignmentTaskWorkspaceForm({
                                        ...assignmentTaskWorkspaceForm,
                                        contributionNextActions:
                                          event.target.value,
                                      })
                                    }
                                    placeholder="State the recommended follow-up action, owner or deadline."
                                  />
                                  {taskReportSectionControls("nextActions")}
                                </label>
                              </div>
                              {assignmentNotice && (
                                <div
                                  className={`task-contribution-action-notice ${assignmentNotice.toLowerCase().includes("could not") || assignmentNotice.toLowerCase().includes("cannot") || assignmentNotice.toLowerCase().includes("error") ? "error" : "success"}`}
                                >
                                  {assignmentNotice}
                                </div>
                              )}

                              {false && (
                                <div className="task-contribution-next-step">
                                  <div
                                    className={`task-contribution-step ${assignmentTaskContributionSavedAt ? "done" : "current"}`}
                                  >
                                    <span>1</span>
                                    <div>
                                      <strong>Save Draft</strong>
                                      <small>
                                        {assignmentTaskContributionSavedAt
                                          ? `Saved ${assignmentTaskContributionSavedAt}`
                                          : "Save the task report before submitting it."}
                                      </small>
                                    </div>
                                  </div>
                                  <div
                                    className={`task-contribution-step ${assignmentTaskWorkspaceForm.contributionStatus === "Ready for Integration" || assignmentTaskWorkspaceForm.contributionStatus === "Integrated" || assignmentTaskWorkspaceForm.contributionStatus === "Accepted" ? "done" : assignmentTaskContributionSavedAt ? "current" : ""}`}
                                  >
                                    <span>2</span>
                                    <div>
                                      <strong>Generate Report</strong>
                                      <small>
                                        Create and check the formatted task
                                        report.
                                      </small>
                                    </div>
                                  </div>
                                  <div
                                    className={`task-contribution-step ${assignmentTaskWorkspaceForm.contributionStatus === "Integrated" || assignmentTaskWorkspaceForm.contributionStatus === "Accepted" ? "done" : assignmentTaskWorkspaceForm.contributionStatus === "Ready for Integration" ? "current" : ""}`}
                                  >
                                    <span>3</span>
                                    <div>
                                      <strong>Send to Reviewer</strong>
                                      <small>
                                        Submit the checked report to the
                                        assigned reviewer.
                                      </small>
                                    </div>
                                  </div>
                                  <div
                                    className={`task-contribution-step ${assignmentTaskWorkspaceForm.contributionStatus === "Accepted" ? "done" : assignmentTaskWorkspaceForm.contributionStatus === "Integrated" ? "current" : ""}`}
                                  >
                                    <span>4</span>
                                    <div>
                                      <strong>Review & Finalise</strong>
                                      <small>
                                        The reviewer checks the evidence and
                                        approves the report, then generates the final version.
                                      </small>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {(assignmentTaskContributionSavedAt ||
                                assignmentTaskWorkspaceForm.contributionStatus === "Accepted") && (
                                <footer className="task-report-status-footer">
                                  {isSelectedTaskOwner &&
                                    assignmentTaskWorkspaceForm.contributionStatus === "Draft" &&
                                    assignmentTaskContributionSavedAt && (
                                      <span className="task-contribution-saved-mark">
                                        Draft saved {assignmentTaskContributionSavedAt}
                                      </span>
                                    )}
                                  {assignmentTaskWorkspaceForm.contributionStatus === "Accepted" && (
                                    <strong className="task-report-accepted-mark">
                                      Final approved report Â· counts toward assignment progress
                                    </strong>
                                  )}
                                </footer>
                              )}
                            </section>
                          </div>
                        ) : (
                          <div className="task-workspace-readonly task-screen-body">
                            <strong>
                              {isSelectedTaskReviewer
                                ? "Review access"
                                : "View only"}
                            </strong>
                            <p>
                              {isSelectedTaskReviewer
                                ? `You are the assigned reviewer for ${selectedAssignmentTask.owner_name || "this researcher"}'s task report.`
                                : `This task is assigned to ${selectedAssignmentTask.owner_name || "another team member"}.`}
                            </p>
                            <section>
                              <span className="workspace-eyebrow">WORK NOTES</span>
                              <p>
                                {selectedAssignmentTask.notes ||
                                  "No work notes have been saved yet."}
                              </p>
                            </section>
                            {["Ready for Integration", "Integrated", "Accepted"].includes(
                              assignmentTaskWorkspaceForm.contributionStatus,
                            ) && (
                              <button
                                type="button"
                                className="task-review-open-report"
                                disabled={assignmentTaskReportPreviewBusy}
                                onClick={openSavedAssignmentTaskContributionReport}
                              >
                                Open submitted report
                              </button>
                            )}
                            {renderTaskReviewDecision()}
                          </div>
                        )}

                        {assignmentTaskReportPreviewOpen && (
                          <div
                            className="task-contribution-report-overlay"
                            role="dialog"
                            aria-modal="true"
                            aria-label="Contribution report preview"
                          >
                            <section className="task-contribution-report-modal">
                              <header>
                                <div>
                                  <span className="workspace-eyebrow">
                                    TASK REPORT PREVIEW
                                  </span>
                                  <h3>
                                    {assignmentTaskReportPreviewTitle ||
                                      "Task Report"}
                                  </h3>
                                  <p>
                                    Check the report exactly as the assigned
                                    reviewer will receive it.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAssignmentTaskReportPreviewOpen(false)
                                  }
                                >
                                  âœ• Close
                                </button>
                              </header>
                              <div className="task-contribution-report-frame">
                                <iframe
                                  title="Task contribution report preview"
                                  srcDoc={assignmentTaskReportPreviewHtml}
                                />
                              </div>
                              <footer>
                                <button
                                  type="button"
                                  className="task-modal-secondary"
                                  onClick={() =>
                                    setAssignmentTaskReportPreviewOpen(false)
                                  }
                                >
                                  {isSelectedTaskOwner &&
                                  assignmentTaskWorkspaceForm.contributionStatus ===
                                    "Draft"
                                    ? "Back to Edit"
                                    : "Close Preview"}
                                </button>
                                {isSelectedTaskOwner &&
                                  assignmentTaskWorkspaceForm.contributionStatus ===
                                  "Draft" && (
                                  <>
                                    <div className="task-authorized-reviewers">
                                      <small>AUTHORISED TO REVIEW</small>
                                      <strong>
                                        {authorizedTaskReviewers.length
                                          ? authorizedTaskReviewers
                                              .map((person) => person.name)
                                              .join(", ")
                                          : "No active reviewer is currently assigned"}
                                      </strong>
                                      <span>
                                        {authorizedTaskReviewers
                                          .map(
                                            (person) =>
                                              `${person.name} â€” ${person.role}`,
                                          )
                                          .join(" Â· ")}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      className="task-contribution-ready"
                                      disabled={
                                        assignmentTaskContributionSaving ||
                                        !authorizedTaskReviewers.length
                                      }
                                      onClick={
                                        approveAndSendAssignmentTaskContribution
                                      }
                                    >
                                      {assignmentTaskContributionSaving
                                        ? "Sending..."
                                        : "Submit to Reviewer"}
                                    </button>
                                  </>
                                )}

                                {isSelectedTaskReviewer &&
                                  selectedAssignmentTask?.contribution_status ===
                                    "Ready for Integration" && (
                                  <div className="task-preview-review-panel">
                                    <div className="task-preview-review-heading">
                                      <div>
                                        <small>REVIEW DECISION</small>
                                        <strong>Your review is required</strong>
                                      </div>
                                      <span>
                                        Read the complete report above, then record your
                                        formal decision here.
                                      </span>
                                    </div>

                                    <label className="task-preview-review-comments">
                                      <span>Reviewer comments</span>
                                      <textarea
                                        rows={3}
                                        value={assignmentTaskReviewComment}
                                        onChange={(event) =>
                                          setAssignmentTaskReviewComment(
                                            event.target.value,
                                          )
                                        }
                                        placeholder="Add an approval note, or describe corrections required."
                                      />
                                    </label>

                                    <div className="task-preview-review-actions">
                                      <button
                                        type="button"
                                        className="task-review-changes"
                                        disabled={
                                          assignmentTaskReviewSaving ||
                                          !assignmentTaskReviewComment.trim()
                                        }
                                        onClick={() =>
                                          void reviewAssignmentTaskContribution(
                                            "Changes Requested",
                                          )
                                        }
                                      >
                                        {assignmentTaskReviewSaving
                                          ? "Recording..."
                                          : "Request Changes"}
                                      </button>

                                      <button
                                        type="button"
                                        className="task-review-reject"
                                        disabled={
                                          assignmentTaskReviewSaving ||
                                          !assignmentTaskReviewComment.trim()
                                        }
                                        onClick={() =>
                                          void reviewAssignmentTaskContribution(
                                            "Rejected",
                                          )
                                        }
                                      >
                                        {assignmentTaskReviewSaving
                                          ? "Recording..."
                                          : "Reject"}
                                      </button>

                                      <button
                                        type="button"
                                        className="task-review-accept"
                                        disabled={assignmentTaskReviewSaving}
                                        onClick={() =>
                                          void reviewAssignmentTaskContribution(
                                            "Approved",
                                          )
                                        }
                                      >
                                        {assignmentTaskReviewSaving
                                          ? "Recording approval..."
                                          : "Approve Report"}
                                      </button>
                                    </div>

                                    {assignmentTaskReviewResult && (
                                      <div
                                        className={`task-review-result ${assignmentTaskReviewResult.tone}`}
                                        role="status"
                                      >
                                        {assignmentTaskReviewResult.message}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {isSelectedTaskReviewer &&
                                  selectedAssignmentTask?.contribution_status ===
                                    "Accepted" && (
                                  <div className="task-preview-final-state">
                                    <div>
                                      <small>FINAL TASK REPORT</small>
                                      <strong>Review already completed</strong>
                                    </div>
                                    <span>
                                      This version has already been approved and finalized.
                                      It is available as a supporting source for the Assignment Report.
                                    </span>
                                  </div>
                                )}
                              </footer>
                            </section>
                          </div>
                        )}

                        {isManager && assignmentTaskDeleteDialogOpen && (
                          <div className="task-delete-dialog-backdrop" role="presentation">
                            <section className="task-delete-dialog" role="dialog" aria-modal="true" aria-label="Delete task">
                              <header>
                                <div>
                                  <span className="workspace-eyebrow">DANGER ZONE</span>
                                  <h3>Delete task permanently?</h3>
                                  <p><strong>{selectedAssignmentTask.title}</strong> will be removed from active task records. The deletion event and reason remain in assignment history and audit logs.</p>
                                </div>
                                <button
                                  type="button"
                                  disabled={assignmentTaskManagementBusy}
                                  onClick={() => setAssignmentTaskDeleteDialogOpen(false)}
                                >
                                  âœ•
                                </button>
                              </header>
                              <label>
                                Reason for deletion *
                                <textarea
                                  value={assignmentTaskDeleteReason}
                                  onChange={(event) => setAssignmentTaskDeleteReason(event.target.value)}
                                  placeholder="Example: Duplicate task created in error."
                                  rows={4}
                                />
                              </label>
                              <label className="task-delete-confirm-row">
                                <input
                                  type="checkbox"
                                  checked={assignmentTaskDeleteConfirmed}
                                  onChange={(event) => setAssignmentTaskDeleteConfirmed(event.target.checked)}
                                />
                                <span>I understand that this removes the task from active task records and cannot be undone from this screen.</span>
                              </label>
                              <footer>
                                <button
                                  type="button"
                                  className="task-modal-secondary"
                                  disabled={assignmentTaskManagementBusy}
                                  onClick={() => setAssignmentTaskDeleteDialogOpen(false)}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="task-delete-button"
                                  disabled={
                                    assignmentTaskManagementBusy ||
                                    assignmentTaskDeleteReason.trim().length < 10 ||
                                    !assignmentTaskDeleteConfirmed
                                  }
                                  onClick={deleteSelectedAssignmentTask}
                                >
                                  {assignmentTaskManagementBusy ? "Deleting..." : "Delete Task"}
                                </button>
                              </footer>
                            </section>
                          </div>
                        )}

                        <footer className="task-workspace-footer task-screen-footer">
                          {(isManager ||
                            selectedAssignmentTask.owner_name ===
                              user?.name) && (
                            <div>
                              {selectedAssignmentTask.status ===
                                "Not Started" && (
                                <button
                                  type="button"
                                  className="task-start-button"
                                  disabled={
                                    assignmentTaskWorkspaceSaving ||
                                    assignmentTaskManagementBusy
                                  }
                                  onClick={() =>
                                    saveAssignmentTaskWorkspace("start")
                                  }
                                >
                                  {assignmentTaskWorkspaceSaving
                                    ? "Saving..."
                                    : "â–¶ Start Task"}
                                </button>
                              )}
                              <button
                                type="button"
                                className="task-save-button"
                                disabled={
                                  assignmentTaskWorkspaceSaving ||
                                  assignmentTaskManagementBusy ||
                                  !assignmentTaskWorkspaceForm.title.trim()
                                }
                                onClick={() =>
                                  saveAssignmentTaskWorkspace("save")
                                }
                              >
                                {assignmentTaskWorkspaceSaving
                                  ? "Saving..."
                                  : "Save Task"}
                              </button>
                              {selectedAssignmentTask.status !==
                                "Completed" && (
                                <span className="task-completion-rule">
                                  Task completion is recorded automatically when the submitted report is accepted.
                                </span>
                              )}
                            </div>
                          )}
                        </footer>
                      </section>
                    </div>
                  )}

                  {isAssignmentLead && assignmentTaskRequestDialogOpen && (
                    <div
                      className="task-assignment-backdrop"
                      role="presentation"
                      onMouseDown={(event) => {
                        if (
                          event.target === event.currentTarget &&
                          !assignmentTaskRequestSaving
                        )
                          setAssignmentTaskRequestDialogOpen(false);
                      }}
                    >
                      <form
                        className="task-assignment-modal task-request-modal"
                        onSubmit={submitAssignmentTaskRequest}
                      >
                        <header>
                          <div>
                            <span className="workspace-eyebrow">
                              TASK REQUEST
                            </span>
                            <h3>Request a task</h3>
                            <p>Propose additional work for manager approval.</p>
                          </div>
                          <button
                            type="button"
                            className="task-modal-close"
                            disabled={assignmentTaskRequestSaving}
                            onClick={() =>
                              setAssignmentTaskRequestDialogOpen(false)
                            }
                          >
                            X
                          </button>
                        </header>
                        <div className="task-assignment-grid">
                          <label className="task-field task-field-wide">
                            <span>Task title *</span>
                            <input
                              autoFocus
                              required
                              value={assignmentTaskRequestForm.title}
                              onChange={(event) =>
                                setAssignmentTaskRequestForm({
                                  ...assignmentTaskRequestForm,
                                  title: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="task-field task-field-wide">
                            <span>Description</span>
                            <textarea
                              rows={3}
                              value={assignmentTaskRequestForm.description}
                              onChange={(event) =>
                                setAssignmentTaskRequestForm({
                                  ...assignmentTaskRequestForm,
                                  description: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="task-field">
                            <span>Suggested assignee</span>
                            <select
                              value={assignmentTaskRequestForm.suggestedOwnerId}
                              onChange={(event) =>
                                setAssignmentTaskRequestForm({
                                  ...assignmentTaskRequestForm,
                                  suggestedOwnerId: event.target.value,
                                })
                              }
                            >
                              <option value="">Unassigned</option>
                              {selectedAssignmentRecord?.members?.map(
                                (member) => (
                                  <option key={member.id} value={member.id}>
                                    {member.name} - {member.role}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                          <label className="task-field">
                            <span>Suggested priority</span>
                            <select
                              value={assignmentTaskRequestForm.priority}
                              onChange={(event) =>
                                setAssignmentTaskRequestForm({
                                  ...assignmentTaskRequestForm,
                                  priority: event.target.value,
                                })
                              }
                            >
                              <option>Low</option>
                              <option>Normal</option>
                              <option>High</option>
                              <option>Critical</option>
                            </select>
                          </label>
                          <label className="task-field">
                            <span>Requested due date</span>
                            <input
                              type="date"
                              value={assignmentTaskRequestForm.dueDate}
                              onChange={(event) =>
                                setAssignmentTaskRequestForm({
                                  ...assignmentTaskRequestForm,
                                  dueDate: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="task-field task-field-wide">
                            <span>Why is this task needed? *</span>
                            <textarea
                              required
                              rows={3}
                              value={assignmentTaskRequestForm.reason}
                              onChange={(event) =>
                                setAssignmentTaskRequestForm({
                                  ...assignmentTaskRequestForm,
                                  reason: event.target.value,
                                })
                              }
                              placeholder="Explain why this work should be added to the assignment."
                            />
                          </label>
                        </div>
                        <footer>
                          <button
                            type="button"
                            className="task-modal-secondary"
                            disabled={assignmentTaskRequestSaving}
                            onClick={() =>
                              setAssignmentTaskRequestDialogOpen(false)
                            }
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="task-modal-primary"
                            disabled={
                              !assignmentTaskRequestForm.title.trim() ||
                              !assignmentTaskRequestForm.reason.trim() ||
                              assignmentTaskRequestSaving
                            }
                          >
                            {assignmentTaskRequestSaving
                              ? "Submitting..."
                              : "Submit Request"}
                          </button>
                        </footer>
                      </form>
                    </div>
                  )}

                  {isManager && assignmentTaskRequestReview && (
                    <div
                      className="task-assignment-backdrop"
                      role="presentation"
                    >
                      <form
                        className="task-assignment-modal task-request-review-modal"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void decideAssignmentTaskRequest("Approved");
                        }}
                      >
                        <header>
                          <div>
                            <span className="workspace-eyebrow">
                              MANAGER REVIEW
                            </span>
                            <h3>Review task request</h3>
                            <p>
                              Adjust the request before converting it into an
                              active task.
                            </p>
                          </div>
                          <button
                            type="button"
                            className="task-modal-close"
                            disabled={assignmentTaskRequestReviewSaving}
                            onClick={() => setAssignmentTaskRequestReview(null)}
                          >
                            X
                          </button>
                        </header>
                        <div className="task-request-origin">
                          <strong>
                            Requested by{" "}
                            {assignmentTaskRequestReview.requested_by_name}
                          </strong>
                          <span>{assignmentTaskRequestReview.reason}</span>
                        </div>
                        <div className="task-assignment-grid">
                          <label className="task-field task-field-wide">
                            <span>Task title *</span>
                            <input
                              required
                              value={assignmentTaskRequestReviewForm.title}
                              onChange={(event) =>
                                setAssignmentTaskRequestReviewForm({
                                  ...assignmentTaskRequestReviewForm,
                                  title: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="task-field task-field-wide">
                            <span>Description</span>
                            <textarea
                              rows={3}
                              value={
                                assignmentTaskRequestReviewForm.description
                              }
                              onChange={(event) =>
                                setAssignmentTaskRequestReviewForm({
                                  ...assignmentTaskRequestReviewForm,
                                  description: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="task-field">
                            <span>Assign to</span>
                            <select
                              value={assignmentTaskRequestReviewForm.ownerId}
                              onChange={(event) =>
                                setAssignmentTaskRequestReviewForm({
                                  ...assignmentTaskRequestReviewForm,
                                  ownerId: event.target.value,
                                })
                              }
                            >
                              <option value="">Unassigned</option>
                              {selectedAssignmentRecord?.members?.map(
                                (member) => (
                                  <option key={member.id} value={member.id}>
                                    {member.name} - {member.role}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                          <label className="task-field">
                            <span>Priority</span>
                            <select
                              value={assignmentTaskRequestReviewForm.priority}
                              onChange={(event) =>
                                setAssignmentTaskRequestReviewForm({
                                  ...assignmentTaskRequestReviewForm,
                                  priority: event.target.value,
                                })
                              }
                            >
                              <option>Low</option>
                              <option>Normal</option>
                              <option>High</option>
                              <option>Critical</option>
                            </select>
                          </label>
                          <label className="task-field">
                            <span>Start date</span>
                            <input
                              type="date"
                              value={assignmentTaskRequestReviewForm.startDate}
                              onChange={(event) =>
                                setAssignmentTaskRequestReviewForm({
                                  ...assignmentTaskRequestReviewForm,
                                  startDate: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="task-field">
                            <span>Due date</span>
                            <input
                              type="date"
                              min={
                                assignmentTaskRequestReviewForm.startDate ||
                                undefined
                              }
                              value={assignmentTaskRequestReviewForm.dueDate}
                              onChange={(event) =>
                                setAssignmentTaskRequestReviewForm({
                                  ...assignmentTaskRequestReviewForm,
                                  dueDate: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="task-field task-field-wide">
                            <span>Task notes</span>
                            <textarea
                              rows={2}
                              value={assignmentTaskRequestReviewForm.notes}
                              onChange={(event) =>
                                setAssignmentTaskRequestReviewForm({
                                  ...assignmentTaskRequestReviewForm,
                                  notes: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="task-field task-field-wide">
                            <span>Manager comments</span>
                            <textarea
                              rows={2}
                              value={assignmentTaskRequestReviewForm.comments}
                              onChange={(event) =>
                                setAssignmentTaskRequestReviewForm({
                                  ...assignmentTaskRequestReviewForm,
                                  comments: event.target.value,
                                })
                              }
                              placeholder="Required when rejecting; optional when approving."
                            />
                          </label>
                        </div>
                        <footer className="task-request-review-actions">
                          <button
                            type="button"
                            className="task-modal-danger"
                            disabled={assignmentTaskRequestReviewSaving}
                            onClick={() =>
                              void decideAssignmentTaskRequest("Rejected")
                            }
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            className="task-modal-secondary"
                            disabled={assignmentTaskRequestReviewSaving}
                            onClick={() => setAssignmentTaskRequestReview(null)}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="task-modal-primary"
                            disabled={
                              !assignmentTaskRequestReviewForm.title.trim() ||
                              assignmentTaskRequestReviewSaving
                            }
                          >
                            {assignmentTaskRequestReviewSaving
                              ? "Saving..."
                              : "Approve & Create Task"}
                          </button>
                        </footer>
                      </form>
                    </div>
                  )}

                  {isManager && assignmentTaskDialogOpen && (
                    <div
                      className="task-assignment-backdrop"
                      role="presentation"
                      onMouseDown={(event) => {
                        if (
                          event.target === event.currentTarget &&
                          !assignmentTaskSaving
                        ) {
                          setAssignmentTaskDialogOpen(false);
                        }
                      }}
                    >
                      <form
                        className="task-assignment-modal task-assignment-modal-simple"
                        onSubmit={createAssignmentTask}
                        aria-label="Create task"
                      >
                        <header>
                          <div>
                            <h3>Create task</h3>
                            <p>
                              {selectedAssignmentRecord?.title ||
                                "Assignment workspace"}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="task-modal-close"
                            disabled={assignmentTaskSaving}
                            onClick={() => setAssignmentTaskDialogOpen(false)}
                            aria-label="Close task form"
                          >
                            Ã—
                          </button>
                        </header>

                        <div className="task-assignment-grid task-assignment-grid-simple">
                          <label className="task-field task-field-wide">
                            <span>Task title *</span>
                            <input
                              autoFocus
                              required
                              value={assignmentTaskForm.title}
                              onChange={(event) =>
                                setAssignmentTaskForm({
                                  ...assignmentTaskForm,
                                  title: event.target.value,
                                })
                              }
                              placeholder="What needs to be done?"
                            />
                          </label>

                          <label className="task-field">
                            <span>Assign to *</span>
                            <select
                              required
                              value={assignmentTaskForm.ownerId}
                              onChange={(event) => {
                                const ownerId = event.target.value;
                                setAssignmentTaskForm({
                                  ...assignmentTaskForm,
                                  ownerId,
                                  reviewerId:
                                    assignmentTaskForm.reviewerId === ownerId
                                      ? ""
                                      : assignmentTaskForm.reviewerId,
                                });
                              }}
                            >
                              <option value="">Select team member</option>
                              {selectedAssignmentRecord?.members?.map(
                                (member) => {
                                  const activeCount = assignmentTasks.filter(
                                    (task) =>
                                      task.owner_id === member.id &&
                                      task.status !== "Completed",
                                  ).length;
                                  return (
                                    <option key={member.id} value={member.id}>
                                      {member.name} â€” {activeCount} active
                                    </option>
                                  );
                                },
                              )}
                            </select>
                            <small>
                              Only officers attached to this assignment are
                              available.
                            </small>
                          </label>

                          <label className="task-field">
                            <span>Due date *</span>
                            <input
                              required
                              type="date"
                              min={assignmentTaskForm.startDate || undefined}
                              value={assignmentTaskForm.dueDate}
                              onChange={(event) =>
                                setAssignmentTaskForm({
                                  ...assignmentTaskForm,
                                  dueDate: event.target.value,
                                })
                              }
                            />
                          </label>

                          <label className="task-field">
                            <span>Priority</span>
                            <select
                              value={assignmentTaskForm.priority}
                              onChange={(event) =>
                                setAssignmentTaskForm({
                                  ...assignmentTaskForm,
                                  priority: event.target.value,
                                })
                              }
                            >
                              <option>Low</option>
                              <option>Normal</option>
                              <option>High</option>
                              <option>Critical</option>
                            </select>
                          </label>

                          <label className="task-field">
                            <span>Expected output</span>
                            <select
                              value={assignmentTaskForm.expectedOutput}
                              onChange={(event) =>
                                setAssignmentTaskForm({
                                  ...assignmentTaskForm,
                                  expectedOutput: event.target.value,
                                })
                              }
                            >
                              {[
                                "Standard Task Report",
                                "Technical Task Report",
                                "Assessment",
                                "Analysis",
                                "Recommendations",
                                "Data Summary",
                                "Meeting Report",
                                "Field Visit Report",
                                "Policy Brief",
                              ].map((output) => (
                                <option key={output}>{output}</option>
                              ))}
                            </select>
                          </label>

                          <label className="task-field task-field-wide">
                            <span>Instructions / expected result *</span>
                            <textarea
                              rows={4}
                              required
                              value={assignmentTaskForm.specificInstructions}
                              onChange={(event) =>
                                setAssignmentTaskForm({
                                  ...assignmentTaskForm,
                                  specificInstructions: event.target.value,
                                })
                              }
                              placeholder="State clearly what the officer should do and what a satisfactory result should contain."
                            />
                          </label>

                          <label className="task-field task-field-wide">
                            <span>Reviewer *</span>
                            <select
                              required
                              value={assignmentTaskForm.reviewerId}
                              onChange={(event) =>
                                setAssignmentTaskForm({
                                  ...assignmentTaskForm,
                                  reviewerId: event.target.value,
                                })
                              }
                            >
                              <option value="">Select reviewer</option>
                              {(() => {
                                const assignmentMemberIds = new Set(
                                  (selectedAssignmentRecord?.members || []).map(
                                    (member) => member.id,
                                  ),
                                );
                                return userRows
                                  .filter(
                                    (candidate) =>
                                      candidate.active &&
                                      candidate.id !== assignmentTaskForm.ownerId &&
                                      candidate.role !== "Administrator" &&
                                      [
                                        "Research Officer",
                                        "Reviewer",
                                        "Research Manager",
                                      ].includes(candidate.role) &&
                                      (assignmentMemberIds.has(candidate.id) ||
                                        candidate.role === "Research Manager"),
                                  )
                                  .sort((left, right) =>
                                    left.name.localeCompare(right.name),
                                  )
                                  .map((candidate) => (
                                    <option key={candidate.id} value={candidate.id}>
                                      {candidate.name} â€” {candidate.role}
                                    </option>
                                  ));
                              })()}
                            </select>
                            <small>
                              Choose another assignment member or an active manager.
                              Researchers may review colleagues' work, but nobody may
                              review their own task.
                            </small>
                          </label>

                          <details className="task-advanced-details task-field-wide">
                            <summary>More details (optional)</summary>
                            <div className="task-advanced-grid">
                              <label className="task-field task-field-wide">
                                <span>Description / background</span>
                                <textarea
                                  rows={3}
                                  value={assignmentTaskForm.description}
                                  onChange={(event) =>
                                    setAssignmentTaskForm({
                                      ...assignmentTaskForm,
                                      description: event.target.value,
                                    })
                                  }
                                  placeholder="Add context that helps the assignee understand the task."
                                />
                              </label>

                              <label className="task-field">
                                <span>Workstream</span>
                                <select
                                  value={assignmentTaskForm.assignmentSectionId}
                                  onChange={(event) =>
                                    setAssignmentTaskForm({
                                      ...assignmentTaskForm,
                                      assignmentSectionId: event.target.value,
                                    })
                                  }
                                >
                                  <option value="">No workstream</option>
                                  {assignmentSections.map((section) => (
                                    <option key={section.id} value={section.id}>
                                      {section.title}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="task-field">
                                <span>Start date</span>
                                <input
                                  type="date"
                                  value={assignmentTaskForm.startDate}
                                  onChange={(event) =>
                                    setAssignmentTaskForm({
                                      ...assignmentTaskForm,
                                      startDate: event.target.value,
                                    })
                                  }
                                />
                              </label>

                              <label className="task-field task-field-wide">
                                <span>Evidence required</span>
                                <textarea
                                  rows={2}
                                  value={assignmentTaskForm.evidenceRequired}
                                  onChange={(event) =>
                                    setAssignmentTaskForm({
                                      ...assignmentTaskForm,
                                      evidenceRequired: event.target.value,
                                    })
                                  }
                                  placeholder="Documents, data, interviews or other evidence expected."
                                />
                              </label>

                              <label className="task-field task-field-wide">
                                <span>Manager notes</span>
                                <textarea
                                  rows={2}
                                  value={assignmentTaskForm.notes}
                                  onChange={(event) =>
                                    setAssignmentTaskForm({
                                      ...assignmentTaskForm,
                                      notes: event.target.value,
                                    })
                                  }
                                  placeholder="Optional internal delivery notes."
                                />
                              </label>
                            </div>
                          </details>
                        </div>

                        {assignmentTaskDialogNotice && (
                          <p
                            className="task-assignment-dialog-notice"
                            role="alert"
                          >
                            {assignmentTaskDialogNotice}
                          </p>
                        )}

                        <footer>
                          <button
                            type="button"
                            className="task-modal-secondary"
                            disabled={assignmentTaskSaving}
                            onClick={() => setAssignmentTaskDialogOpen(false)}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="task-modal-primary"
                            disabled={
                              !assignmentTaskForm.title.trim() ||
                              !assignmentTaskForm.ownerId ||
                              !assignmentTaskForm.dueDate ||
                              !assignmentTaskForm.specificInstructions.trim() ||
                              !assignmentTaskForm.reviewerId ||
                              assignmentTaskForm.ownerId ===
                                assignmentTaskForm.reviewerId ||
                              assignmentTaskSaving
                            }
                          >
                            {assignmentTaskSaving ? "Creating..." : "Create task"}
                          </button>
                        </footer>
                      </form>
                    </div>
                  )}
                </section>
              )}

              {assignmentWorkspaceTab === "Team" && (
                <section className="phase4-team">
                  <header>
                    <div>
                      <span className="workspace-eyebrow">COLLABORATION</span>
                      <h3>Assignment team</h3>
                      <p>
                        Team responsibility and current assignment workload.
                      </p>
                    </div>

                    {isManager && (
                      <div>
                        <select
                          value={assignmentMemberId}
                          onChange={(event) =>
                            setAssignmentMemberId(event.target.value)
                          }
                        >
                          <option value="">Select member</option>
                          {userRows
                            .filter(
                              (member) =>
                                !selectedAssignmentRecord?.members.some(
                                  (existing) => existing.id === member.id,
                                ),
                            )
                            .map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.name}
                              </option>
                            ))}
                        </select>

                        <select
                          value={assignmentMemberRole}
                          onChange={(event) =>
                            setAssignmentMemberRole(event.target.value)
                          }
                        >
                          <option value="Lead">Lead â€” coordinate this assignment</option>
                          <option value="Contributor">Contributor â€” complete assigned work</option>
                          <option value="Reviewer">Reviewer â€” review assignment outputs</option>
                        </select>

                        <button
                          disabled={!assignmentMemberId}
                          onClick={addAssignmentMember}
                        >
                          Add member
                        </button>
                      </div>
                    )}
                  </header>

                  <div className="team-workspace-grid">
                    {selectedAssignmentRecord?.members.map((member) => {
                      const owned = assignmentTasks.filter(
                        (task) => task.owner_id === member.id,
                      );
                      const activeTasks = owned.filter(
                        (task) => task.status !== "Completed",
                      );

                      return (
                        <article key={member.id}>
                          <header>
                            <b>{initialsFor(member.name)}</b>
                            <span>
                              <strong>{member.name}</strong>
                              <small>{member.role}</small>
                            </span>

                            <i
                              className={
                                activeTasks.length > 3
                                  ? "busy"
                                  : activeTasks.length
                                    ? "active"
                                    : "available"
                              }
                            >
                              {activeTasks.length > 3
                                ? "Busy"
                                : activeTasks.length
                                  ? "Active"
                                  : "Available"}
                            </i>
                          </header>

                          <dl>
                            <div>
                              <dt>Assigned tasks</dt>
                              <dd>{owned.length}</dd>
                            </div>
                            <div>
                              <dt>Open workload</dt>
                              <dd>{activeTasks.length}</dd>
                            </div>
                            <div>
                              <dt>Completed</dt>
                              <dd>
                                {
                                  owned.filter(
                                    (task) => task.status === "Completed",
                                  ).length
                                }
                              </dd>
                            </div>
                          </dl>
                        </article>
                      );
                    })}
                  </div>

                  {!selectedAssignmentRecord?.members.length && (
                    <p className="phase4-empty">
                      No team members are assigned.
                    </p>
                  )}
                </section>
              )}

              {assignmentWorkspaceTab === "Documents" && (
                <section className="assignment-resources-simple">
                  <header className="workspace-section-heading">
                    <div><span className="workspace-eyebrow">EVIDENCE</span><h3>Assignment evidence and research notes</h3><p>Keep supporting files, approved Repository evidence and research notes here. Assignment reports are managed separately in Reports.</p></div>
                  </header>
                  <div className="assignment-resource-tools">
                    <input value={assignmentDocumentSearch} onChange={(event) => setAssignmentDocumentSearch(event.target.value)} placeholder="Search this assignment" aria-label="Search assignment documents and notes" />
                    {(["All", "Documents", "Research Notes"] as const).map((filter) => <button type="button" className={assignmentDocumentFilter === filter ? "active" : ""} key={filter} onClick={() => setAssignmentDocumentFilter(filter)}>{filter}</button>)}
                  </div>
                  <div className="assignment-repository-link">
                    <select value={assignmentRepositoryLinkId} onChange={(event) => setAssignmentRepositoryLinkId(event.target.value)} aria-label="Existing repository document"><option value="">Attach existing repository document</option>{knowledgeRows.filter((item) => !assignmentDocumentSearch || item.title.toLowerCase().includes(assignmentDocumentSearch.toLowerCase())).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
                    <button type="button" disabled={!assignmentRepositoryLinkId || !selectedAssignmentId} onClick={async () => { if (!selectedAssignmentId || !assignmentRepositoryLinkId) return; await api.linkKnowledgeToAssignment(token, assignmentRepositoryLinkId, selectedAssignmentId); setAssignmentRepositoryLinkId(""); setKnowledgeRows(await api.knowledge(token)); setAssignmentHistory(await api.history(token, selectedAssignmentId)); setAssignmentNotice("Repository document attached."); }}>Attach</button>
                  </div>
                  {(assignmentDocumentFilter === "All" || assignmentDocumentFilter === "Documents") && <div className="assignment-resource-list">
                    {assignmentFiles.filter((item) => !assignmentDocumentSearch || item.original_name.toLowerCase().includes(assignmentDocumentSearch.toLowerCase())).map((file) => <article key={file.id}><span><strong>{file.original_name}</strong><small>Uploaded document Â· {new Date(file.created_at).toLocaleDateString("en-KE")}</small></span><button type="button" onClick={() => api.downloadAttachment(token, file.id, file.original_name)}>Download</button></article>)}
                    {knowledgeRows.filter((item) => item.assignments?.some((assignment) => assignment.id === selectedAssignmentId) && (!assignmentDocumentSearch || item.title.toLowerCase().includes(assignmentDocumentSearch.toLowerCase()))).map((item) => <article key={item.id}><span><strong>{item.title}</strong><small>Repository document Â· {item.status}</small></span><button type="button" onClick={() => void openRepositoryDocumentReader(item)}>Preview</button></article>)}
                    
                  </div>}
                  {(assignmentDocumentFilter === "All" || assignmentDocumentFilter === "Research Notes") && <div className="assignment-note-composer"><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Write a short research note" /><button type="button" disabled={!comment.trim() || !selectedAssignmentId} onClick={async () => { if (!selectedAssignmentId) return; const note = comment.trim().toLowerCase().startsWith("research note:") ? comment.trim() : `Research note: ${comment.trim()}`; await api.addComment(token, selectedAssignmentId, note); setComment(""); setComments((items) => [...items, { author: user?.name || "User", text: note, time: new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }) }]); setAssignmentHistory(await api.history(token, selectedAssignmentId)); }}>Add note</button></div>}
                </section>
              )}

              {assignmentWorkspaceTab === "Reports" && (
                <section className="phase4-documents assignment-reports-workspace">
                  <AssignmentReportsPanel
                    assignmentTitle={selectedAssignmentRecord?.title || selectedAssignment}
                    tasks={assignmentTasks}
                    documents={workspaceDocuments}
                    knowledge={knowledgeRows.filter((item) =>
                      item.assignments?.some((assignment) => assignment.id === selectedAssignmentId),
                    )}
                    reviewers={assignmentReportReviewerCandidates}
                    currentUserId={user?.id}
                    canManage={Boolean(isAssignmentLead || isManager)}
                    onCompile={compileAssignmentReport}
                    onOpen={(id) => void openGeneratedDocument(id, false)}
                    onPreview={(id) => void openGeneratedDocument(id, true)}
                    onOpenTask={(task) => void openAssignmentTaskWorkspace(task)}
                    onOpenRepository={(id) => {
                      void openRepositoryDocumentReader(id);
                    }}
                    onSubmit={submitAssignmentReportForReview}
                    onReview={reviewAssignmentReportDecision}
                    onFinalize={finalizeAssignmentReport}
                    onDiscardImport={async (id) => {
                      await api.discardImportedAssignmentReport(token, id);
                      if (selectedAssignmentId) {
                        setWorkspaceDocuments(
                          await api.generatedDocuments(token, "Assignment", selectedAssignmentId),
                        );
                      }
                      setAssignmentNotice("Imported report discarded. You can continue editing inside App2 or import a replacement.");
                    }}
                  />
                </section>
              )}

              {assignmentWorkspaceTab === "Discussion" && (
                <section className="phase4-discussion">
                  <header className="workspace-section-heading">
                    <div>
                      <span className="workspace-eyebrow">COLLABORATION</span>
                      <h3>Discussion</h3>
                      <p>
                        Share updates and coordinate work with the assignment
                        team.
                      </p>
                    </div>
                  </header>

                  <div className="comments">
                    {comments.map((item, index) => (
                      <div className="comment" key={`${item.author}-${index}`}>
                        <span>{initialsFor(item.author)}</span>
                        <div>
                          <strong>
                            {item.author}
                            <time>{item.time}</time>
                          </strong>
                          <p>{item.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="comment-box">
                    <textarea
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      placeholder="Write an update or mention a team member with @..."
                    />
                    <button onClick={addComment}>
                      Send update <Icon name="arrow" />
                    </button>
                  </div>
                </section>
              )}

              {assignmentWorkspaceTab === "Activity" && (
                <section className="phase4-activity">
                  <header className="workspace-section-heading">
                    <div>
                      <span className="workspace-eyebrow">HISTORY</span>
                      <h3>Assignment activity</h3>
                      <p>Chronological record of work and workflow changes.</p>
                    </div>
                  </header>

                  <div className="history-list assignment-human-activity">
                    {assignmentHistory.map((item) => (
                      <div key={item.id}>
                        <strong>{({ ASSIGNMENT_TASK_CREATED: "Task created", ASSIGNMENT_TASK_UPDATED: "Task updated", ASSIGNMENT_ATTACHMENT_UPLOADED: "Document uploaded", ASSIGNMENT_COMMENT_ADDED: "Comment added", ASSIGNMENT_UPDATED: "Assignment updated", KNOWLEDGE_ASSIGNMENT_LINKED: "Repository document attached", ASSIGNMENT_REVIEW_RECORDED: "Approval recorded" } as Record<string,string>)[item.action] || item.action.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase())}</strong>
                        <span>
                          {item.user_name || "System"} |{" "}
                          {new Date(item.created_at).toLocaleString("en-KE")}
                        </span>
                      </div>
                    ))}

                    {!assignmentHistory.length && (
                      <p className="phase4-empty">
                        No activity has been recorded.
                      </p>
                    )}
                  </div>
                  <div className="comment-box assignment-activity-comment"><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a short comment" /><button type="button" disabled={!comment.trim()} onClick={addComment}>Add comment</button></div>
                </section>
              )}

              {assignmentWorkspaceTab === "Review" && (
                <section className="assignment-review-v3">
                  {(() => {
                    const finalReports = workspaceDocuments
                      .filter(
                        (document) =>
                          document.template_key === "assignment-final-report" ||
                          /Final Assignment Report/i.test(document.title || ""),
                      )
                      .sort(
                        (a, b) =>
                          new Date(b.updated_at).getTime() -
                          new Date(a.updated_at).getTime(),
                      );
                    const report = finalReports[0] || null;
                    const reviewerCanDecide = Boolean(
                      report &&
                        (isManager || report.reviewer_id === user?.id),
                    );
                    const awaitingDecision = Boolean(
                      report &&
                        ["Submitted", "Under Review"].includes(report.status),
                    );
                    const acceptedTasks = assignmentTasks.filter(
                      (task) => task.contribution_status === "Accepted",
                    );
                    const pendingTaskReviews = assignmentTasks.filter(
                      (task) =>
                        task.reviewer_id === user?.id &&
                        ["Ready for Integration", "Integrated"].includes(task.contribution_status),
                    );

                    // A task reviewer must never be blocked by the absence of the
                    // assignment-level Final Assignment Report. Task review is an
                    // earlier, independent workflow. If this Review route was
                    // reached while task decisions are pending, present those
                    // task reports first and send the reviewer into the existing
                    // Task Report Review workspace.
                    if (!report && pendingTaskReviews.length > 0) {
                      return (
                        <section className="task-review-routing-card">
                          <header>
                            <div>
                              <small>TASK REPORT REVIEW</small>
                              <h2>{selectedAssignmentRecord?.title || selectedAssignment}</h2>
                              <p>
                                Review only the task report assigned to you. The Final Assignment Report is created later, after required task reports have been accepted.
                              </p>
                            </div>
                            <b>{pendingTaskReviews.length} REVIEW{pendingTaskReviews.length === 1 ? "" : "S"} WAITING</b>
                          </header>

                          <div className="task-review-routing-list">
                            {pendingTaskReviews.map((task) => (
                              <article key={task.id}>
                                <div>
                                  <span className="workspace-eyebrow">TASK REPORT</span>
                                  <h3>{task.contribution_title || `${task.title} â€” Contribution Report`}</h3>
                                  <p>
                                    Task: {task.title} Â· Submitted by {task.owner_name || "Task owner"}
                                  </p>
                                </div>
                                <span className="task-review-routing-status">
                                  {task.contribution_status === "Integrated" ? "Approved Â· finalisation pending" : "Submitted Â· decision required"}
                                </span>
                                <button
                                  type="button"
                                  className="app-action-primary"
                                  onClick={async () => {
                                    setAssignmentWorkspaceTab("Tasks");
                                    await openAssignmentTaskWorkspace(task, true);
                                  }}
                                >
                                  {task.contribution_status === "Integrated" ? "Open approved task report" : "Open task review"}
                                </button>
                              </article>
                            ))}
                          </div>

                          <aside className="task-review-routing-note">
                            <strong>Assignment review is separate</strong>
                            <span>
                              You do not need a Final Assignment Report to review these task submissions. The assignment-level review begins only after the Assignment Lead compiles and submits that final report.
                            </span>
                          </aside>
                        </section>
                      );
                    }

                    return (
                      <>
                        <header className="assignment-review-v3-head">
                          <div>
                            <small>FORMAL ASSIGNMENT REVIEW</small>
                            <h2>
                              {selectedAssignmentRecord?.title || selectedAssignment}
                            </h2>
                            <p>
                              Review the compiled Final Assignment Report. Final Task Reports below are supporting source records.
                            </p>
                          </div>
                          <b className={report?.status === "Approved" || report?.status === "Final" ? "ready" : "blocked"}>
                            {report?.status || "NO REPORT SUBMITTED"}
                          </b>
                        </header>

                        <section className="assignment-formal-report-review">
                          <header>
                            <div>
                              <small>DOCUMENT UNDER REVIEW</small>
                              <h3>{report?.title || "No Final Assignment Report submitted"}</h3>
                              {report && (
                                <p>
                                  {report.reference} Â· Version {report.version} Â· Reviewer: {report.reviewer_name || "Not assigned"}
                                </p>
                              )}
                            </div>
                            {report && <span className="assignment-review-status">{report.status}</span>}
                          </header>

                          {!report ? (
                            <div className="assignment-review-empty">
                              The Assignment Lead must complete the Final Assignment Report and submit it to a reviewer before a formal decision can be recorded.
                            </div>
                          ) : (
                            <>
                              <div className="assignment-review-primary-actions">
                                <button
                                  type="button"
                                  className="app-action-primary"
                                  onClick={() => void openGeneratedDocument(report.id, true)}
                                >
                                  View Report
                                </button>
                                {report.repository_document_id && report.status === "Final" && (
                                  <button
                                    type="button"
                                    className="app-action-secondary"
                                    onClick={() => void openGeneratedDocument(report.id, true)}
                                  >
                                    View Final Copy
                                  </button>
                                )}
                              </div>

                              {awaitingDecision && reviewerCanDecide && (
                                <div className="assignment-review-decision-panel">
                                  <label>
                                    <span>Reviewer comments</span>
                                    <textarea
                                      rows={4}
                                      value={assignmentReviewComment}
                                      onChange={(event) => setAssignmentReviewComment(event.target.value)}
                                      placeholder="Record evidence gaps, required corrections, rejection reasons, or an approval note."
                                    />
                                  </label>
                                  <div className="assignment-review-decision-actions">
                                    <button
                                      type="button"
                                      className="app-action-return"
                                      disabled={assignmentReviewSaving || !assignmentReviewComment.trim()}
                                      onClick={async () => {
                                        try {
                                          setAssignmentReviewSaving(true);
                                          await reviewAssignmentReportDecision(report.id, "Changes Requested", assignmentReviewComment.trim());
                                          setAssignmentReviewComment("");
                                        } catch (error) {
                                          setAssignmentNotice(error instanceof Error ? error.message : "The report could not be returned for changes.");
                                        } finally {
                                          setAssignmentReviewSaving(false);
                                        }
                                      }}
                                    >
                                      Return for Changes
                                    </button>
                                    <button
                                      type="button"
                                      className="app-action-danger"
                                      disabled={assignmentReviewSaving || !assignmentReviewComment.trim()}
                                      onClick={async () => {
                                        try {
                                          setAssignmentReviewSaving(true);
                                          await reviewAssignmentReportDecision(report.id, "Rejected", assignmentReviewComment.trim());
                                          setAssignmentReviewComment("");
                                        } catch (error) {
                                          setAssignmentNotice(error instanceof Error ? error.message : "The report could not be rejected.");
                                        } finally {
                                          setAssignmentReviewSaving(false);
                                        }
                                      }}
                                    >
                                      Reject Report
                                    </button>
                                    <button
                                      type="button"
                                      className="app-action-approve"
                                      disabled={assignmentReviewSaving}
                                      onClick={async () => {
                                        try {
                                          setAssignmentReviewSaving(true);
                                          await reviewAssignmentReportDecision(report.id, "Approved", assignmentReviewComment.trim());
                                          setAssignmentReviewComment("");
                                        } catch (error) {
                                          setAssignmentNotice(error instanceof Error ? error.message : "The report could not be approved.");
                                        } finally {
                                          setAssignmentReviewSaving(false);
                                        }
                                      }}
                                    >
                                      Approve Report
                                    </button>
                                  </div>
                                  <small className="assignment-review-help">
                                    Return for Changes reopens the report for revision. Reject preserves the rejected version as a terminal review decision. Approve unlocks final generation.
                                  </small>
                                </div>
                              )}

                              {awaitingDecision && !reviewerCanDecide && (
                                <div className="assignment-review-readonly-note">
                                  This report is awaiting a decision from {report.reviewer_name || "its assigned reviewer"}. You can view it but cannot record the formal decision.
                                </div>
                              )}

                              {report.status === "Changes Requested" && (
                                <div className="assignment-review-returned-note">
                                  Returned for changes. The Assignment Lead must revise and resubmit the report.
                                </div>
                              )}

                              {report.status === "Rejected" && (
                                <div className="assignment-review-rejected-note">
                                  Rejected. This version remains in the formal review record and cannot be finalized.
                                </div>
                              )}

                              {report.status === "Approved" && reviewerCanDecide && (
                                <div className="assignment-review-finalize-panel">
                                  <strong>Approved Â· Final generation pending</strong>
                                  <span>The approved report is locked. Generate the final Repository copy to complete the controlled workflow.</span>
                                  <button
                                    type="button"
                                    className="app-action-approve"
                                    disabled={assignmentReviewSaving}
                                    onClick={async () => {
                                      try {
                                        setAssignmentReviewSaving(true);
                                        await finalizeAssignmentReport(report.id);
                                      } catch (error) {
                                        setAssignmentNotice(error instanceof Error ? error.message : "The final Assignment Report could not be generated.");
                                      } finally {
                                        setAssignmentReviewSaving(false);
                                      }
                                    }}
                                  >
                                    Generate Final Report & Save to Repository
                                  </button>
                                </div>
                              )}

                              {report.status === "Final" && (
                                <div className="assignment-review-final-note">
                                  <strong>Final Assignment Report published</strong>
                                  <span>{report.repository_document_title || "The approved final report is stored in the Document Repository."}</span>
                                </div>
                              )}
                            </>
                          )}
                        </section>

                        <section className="review-v3-sources">
                          <header>
                            <div>
                              <small>SUPPORTING SOURCES</small>
                              <h3>Final Task Reports</h3>
                              <p>These reports support the Assignment Report review. They were individually reviewed before becoming final sources.</p>
                            </div>
                            <span>{acceptedTasks.length}/{assignmentTasks.length} final</span>
                          </header>
                          <div className="review-v3-source-list">
                            {assignmentTasks.map((task) => (
                              <article key={task.id}>
                                <span>
                                  <strong>{task.contribution_title || `${task.title} report`}</strong>
                                  <small>{task.owner_name || "Unassigned"} Â· Reviewer: {task.reviewer_name || "Not assigned"}</small>
                                </span>
                                <b>{assignmentReportStatusLabel(task.contribution_status)}</b>
                                {task.contribution_status === "Accepted" ? (
                                  <button
                                    type="button"
                                    className="app-action-secondary"
                                    onClick={() => void openTaskReportPreviewForTask(task, false)}
                                  >
                                    View Supporting Task Report
                                  </button>
                                ) : task.contribution_status === "Ready for Integration" &&
                                  task.reviewer_id === user?.id ? (
                                  <button
                                    type="button"
                                    className="app-action-primary"
                                    onClick={() => void openTaskReportPreviewForTask(task, true)}
                                  >
                                    Review Submitted Task Report
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="app-action-secondary"
                                    onClick={() => void openAssignmentTaskWorkspace(task, true)}
                                  >
                                    Open Task Report
                                  </button>
                                )}
                              </article>
                            ))}
                          </div>
                        </section>
                      </>
                    );
                  })()}
                </section>
              )}
              {assignmentSectionEditor && (
                <div
                  className="modal-backdrop assignment-section-modal"
                  onClick={() => setAssignmentSectionEditor(null)}
                >
                  <section onClick={(event) => event.stopPropagation()}>
                    <header>
                      <div>
                        <small>ASSIGNMENT STRUCTURE</small>
                        <h3>
                          {assignmentSectionEditor === "new"
                            ? "Add delivery section"
                            : "Edit delivery section"}
                        </h3>
                        <p>
                          Define responsibility, timing and readiness for this
                          workstream.
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Close section editor"
                        onClick={() => setAssignmentSectionEditor(null)}
                      >
                        Ã—
                      </button>
                    </header>
                    <div className="assignment-section-form">
                      <label>
                        Section Title
                        <input
                          autoFocus
                          maxLength={250}
                          value={assignmentSectionForm.title}
                          onChange={(event) =>
                            setAssignmentSectionForm({
                              ...assignmentSectionForm,
                              title: event.target.value,
                            })
                          }
                          placeholder="e.g. Current State Assessment"
                        />
                      </label>
                      <label>
                        Description
                        <textarea
                          rows={4}
                          value={assignmentSectionForm.description}
                          onChange={(event) =>
                            setAssignmentSectionForm({
                              ...assignmentSectionForm,
                              description: event.target.value,
                            })
                          }
                          placeholder="Describe the scope, expected work and outcome of this section."
                        />
                      </label>
                      <div>
                        <label>
                          Section Lead
                          <select
                            value={assignmentSectionForm.leadId || ""}
                            onChange={(event) =>
                              setAssignmentSectionForm({
                                ...assignmentSectionForm,
                                leadId: event.target.value || null,
                              })
                            }
                          >
                            <option value="">Unassigned</option>
                            {selectedAssignmentRecord?.members.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.name} â€” {member.role}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Status
                          <select
                            value={assignmentSectionForm.status}
                            onChange={(event) =>
                              setAssignmentSectionForm({
                                ...assignmentSectionForm,
                                status: event.target
                                  .value as ApiAssignmentSection["status"],
                              })
                            }
                          >
                            {[
                              "Not Started",
                              "In Progress",
                              "Blocked",
                              "Ready for Integration",
                              "Completed",
                            ].map((status) => (
                              <option key={status}>{status}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div>
                        <label>
                          Start Date
                          <input
                            type="date"
                            value={assignmentSectionForm.startDate || ""}
                            onChange={(event) =>
                              setAssignmentSectionForm({
                                ...assignmentSectionForm,
                                startDate: event.target.value || null,
                              })
                            }
                          />
                        </label>
                        <label>
                          Due Date
                          <input
                            type="date"
                            min={assignmentSectionForm.startDate || undefined}
                            value={assignmentSectionForm.dueDate || ""}
                            onChange={(event) =>
                              setAssignmentSectionForm({
                                ...assignmentSectionForm,
                                dueDate: event.target.value || null,
                              })
                            }
                          />
                        </label>
                      </div>
                      <label>
                        Progress{" "}
                        <strong>{assignmentSectionForm.progress}%</strong>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={assignmentSectionForm.progress}
                          onChange={(event) =>
                            setAssignmentSectionForm({
                              ...assignmentSectionForm,
                              progress: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="assignment-section-mandatory">
                        <input
                          type="checkbox"
                          checked={assignmentSectionForm.isMandatory}
                          onChange={(event) =>
                            setAssignmentSectionForm({
                              ...assignmentSectionForm,
                              isMandatory: event.target.checked,
                            })
                          }
                        />
                        <span>
                          <strong>Mandatory section</strong>
                          <small>
                            This workstream is required before the assignment
                            can be considered complete.
                          </small>
                        </span>
                      </label>
                    </div>
                    <footer>
                      <button
                        className="secondary"
                        type="button"
                        onClick={() => setAssignmentSectionEditor(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={
                          !assignmentSectionForm.title.trim() ||
                          assignmentSectionSaving
                        }
                        onClick={saveAssignmentSection}
                      >
                        {assignmentSectionSaving
                          ? "Saving..."
                          : assignmentSectionEditor === "new"
                            ? "Add section"
                            : "Save changes"}
                      </button>
                    </footer>
                  </section>
                </div>
              )}
            </div>
          </div>
        )}

        {showLogout && (
          <div className="modal-backdrop" onClick={() => setShowLogout(false)}>
            <section
              className="profile-modal logout-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button className="close" onClick={() => setShowLogout(false)}>
                  Ã—
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
          <small>Right-click actions are limited to App2.</small>
        </nav>}

        {externalResearchOpen && (
          <ExternalResearchImportModal token={token} users={team} onClose={() => setExternalResearchOpen(false)} onCreated={(created) => { setExternalResearchOpen(false); setSelectedResearch(null); setExternalResearchRows((current) => [created, ...current.filter((item) => item.id !== created.id)]); setResearchRepositoryMode("Imported"); setSelectedExternalResearch(created); }} />
        )}
        {selectedExternalResearch && (
          <ExternalResearchReader token={token} item={selectedExternalResearch} onClose={() => setSelectedExternalResearch(null)} onUpdated={(updated) => { setSelectedExternalResearch(updated); setExternalResearchRows((current) => current.map((item) => item.id === updated.id ? updated : item)); }} onOpenRepository={(knowledgeId) => { setSelectedExternalResearch(null); setActive("Document Repository"); const target = documentRows.find((item) => item.id === knowledgeId); if (target) setReaderDocument(target); }} />
        )}

        {readerDocument && (
          <Suspense
            fallback={
              <div className="document-reader-loading">
                Opening secure readerâ€¦
              </div>
            }
          >
            <DocumentReader
              token={token}
              document={readerDocument}
              versionId={readerVersionId}
              onClose={() => {
                setReaderDocument(null);
                setReaderVersionId(undefined);
              }}
            />
          </Suspense>
        )}
      </AppShell>
    </ThemeProvider>
  );
}





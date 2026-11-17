import { minutesContentToEditorHtml } from "./minutesContent";
import WorkflowNextActionDialog from "../../components/WorkflowNextActionDialog";
import "../../components/workflow-next-action.css";
import { sanitizeReportHtmlForEditor } from "../report-editor/reportHtml";
import App2LexicalReportEditor, { type App2LexicalReportEditorHandle } from "../report-editor/App2LexicalReportEditor";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { meetingsApi } from "./meetingsApi";
import type { AgendaItem, MeetingDetail, MeetingScheduleApprover, MeetingSummary, MeetingUser, TranscriptSegment } from "./types";
import MeetingScheduleApprovalAppointments from "./MeetingScheduleApprovalAppointments";
import "./meetings.css";
import './minutes-workspace.css';
import "./meetings-command-centre.css";
import "./meetings-schedule.css";
import LiveMeetingRoom from "./live/LiveMeetingRoom";

type Props = {
  token: string;
  currentUser: { id: string; name: string; role: string };
  onBack?: () => void;
  onDashboard?: () => void;
  onClose?: () => void;
  onNotifications?: () => void;
  onApprovals?: () => void;
  initialTarget?: { id: string; tab?: string; nonce: number } | null;
  onTargetHandled?: () => void;
};

type MinutesAttendanceParticipant = {
  user_name?: string | null;
  guest_name?: string | null;
  attendance_status?: string | null;
};

function escapeMinutesHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

function replaceMinutesAttendanceSection(content: string, participants: MinutesAttendanceParticipant[]): string {
  const rows = participants.map((person) => ({
    name: person.user_name || person.guest_name || "Guest",
    status: person.attendance_status || "Not marked",
  }));
  const htmlRows = rows.map((row) => `<li>${escapeMinutesHtml(row.name)} — ${escapeMinutesHtml(row.status)}</li>`).join("") || "<li>No participants recorded.</li>";
  const markdownRows = rows.map((row) => `- ${row.name} — ${row.status}`).join("\n") || "- No participants recorded.";

  if (/<h[1-6]\b/i.test(content)) {
    const heading = /<h([1-6])\b[^>]*>\s*Attendance\s*<\/h\1\s*>/i;
    const match = heading.exec(content);
    const section = `<ul>${htmlRows}</ul>`;
    if (!match || match.index === undefined) return `${content}${content.trim() ? "" : ""}<h2>Attendance</h2>${section}`;
    const start = match.index + match[0].length;
    const remaining = content.slice(start);
    const nextHeading = /<h[1-6]\b/i.exec(remaining);
    const end = nextHeading?.index ?? remaining.length;
    return `${content.slice(0, start)}${section}${remaining.slice(end)}`;
  }

  const headingPattern = /^[ \t]*#{1,6}[ \t]+Attendance[ \t]*$/im;
  const match = headingPattern.exec(content);
  if (!match || match.index === undefined) {
    return `${content}${content.trim() ? "\n\n" : ""}## Attendance\n${markdownRows}`;
  }
  const start = match.index + match[0].length;
  const remaining = content.slice(start);
  const nextHeading = /^[ \t]*#{1,6}[ \t]+\S.*$/m.exec(remaining);
  const end = nextHeading?.index ?? remaining.length;
  return `${content.slice(0, start)}\n${markdownRows}\n${remaining.slice(end)}`;
}

function buildMinutesPreviewDocument(
  content: string,
  options: { meetingTitle?: string; status?: string; standalone?: boolean } = {},
): string {
  const title = String(options.meetingTitle || "Meeting minutes");
  const safeTitle = escapeMinutesHtml(title);
  const status = String(options.status || "Draft");
  const approvalLabel = status === "Approved"
    ? "APPROVED OFFICIAL RECORD"
    : `WORKING DRAFT · ${status.toUpperCase()} · NOT YET AN APPROVED OFFICIAL RECORD`;
  // The popup is not sandboxed like the inline iframe, so sanitise saved/editor HTML first.
  const html = sanitizeReportHtmlForEditor(minutesContentToEditorHtml(content || ""));
  const bodyContent = html.trim() || `<h1>${safeTitle}</h1><p>Begin drafting the meeting minutes in the editor.</p>`;
  const chrome = options.standalone ? `
    <div class="preview-chrome" role="toolbar" aria-label="Preview actions">
      <div class="preview-chrome-brand"><strong>PSC · MEETING MINUTES</strong><span>A4 portrait · ${escapeMinutesHtml(approvalLabel)}</span></div>
      <div class="preview-chrome-actions"><button id="app2-minutes-preview-print" type="button">Print / Save PDF</button><button id="app2-minutes-preview-close" type="button">Close preview</button></div>
    </div>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle} — Meeting Minutes</title><style>
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#eef0f3;color:#202735;font-family:"Times New Roman",Georgia,serif;font-size:12pt;line-height:1.5}body{padding:0 0 24px}.preview-chrome{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 18px;background:#2e2c27;color:#fff;border-bottom:3px solid #b08a28;font-family:Arial,Helvetica,sans-serif}.preview-chrome-brand{display:flex;flex-direction:column;gap:4px;min-width:0}.preview-chrome-brand strong{font-size:12px;letter-spacing:.11em}.preview-chrome-brand span{font-size:11px;color:#ece2c5}.preview-chrome-actions{display:flex;gap:8px;flex:none}.preview-chrome-actions button{min-height:36px;padding:8px 13px;border:1px solid #d6c28c;border-radius:6px;background:#fff;color:#493a18;font-weight:700;cursor:pointer}.preview-chrome-actions button:first-child{background:#b08a28;color:#fff;border-color:#d5bb76}.minutes-page{position:relative;width:210mm;min-height:297mm;margin:18px auto;padding:18mm 17mm 21mm;background:#fff;box-shadow:0 4px 22px rgba(15,23,42,.14);overflow-wrap:anywhere}.psc-report-header{padding-bottom:11px;margin-bottom:17px;border-bottom:2px solid #b08a28;text-align:center;font-family:Arial,Helvetica,sans-serif}.psc-report-logo-lockup{display:grid;grid-template-columns:68px 1fr 68px;align-items:center;gap:14px;margin-bottom:10px}.psc-report-logo-lockup img{display:block;max-width:66px;max-height:66px;object-fit:contain;margin:auto}.psc-report-brand-copy{min-width:0}.psc-report-header .psc-brand{font-size:13px;font-weight:800;letter-spacing:.1em;color:#806117}.psc-report-header .psc-subtitle{margin-top:4px;font-size:9px;font-weight:700;letter-spacing:.18em;color:#555}.document-status{margin:0 0 16px;padding:7px 9px;border:1px solid #e5d7ae;background:#fcfaf4;color:#69531c;font-family:Arial,Helvetica,sans-serif;font-size:8pt;font-weight:700;letter-spacing:.045em}.minutes-document-content{font-family:"Times New Roman",Georgia,serif;font-size:12pt;line-height:1.5}.minutes-document-content h1{margin:0 0 17px;padding-bottom:9px;border-bottom:2px solid #b08a28;color:#262626;font-size:20pt;line-height:1.2}.minutes-document-content h2{margin:22px 0 9px;padding-bottom:5px;border-bottom:1px solid #ded2ad;color:#735610;font-size:13pt;line-height:1.25;break-after:avoid}.minutes-document-content h3{margin:16px 0 7px;color:#67501a;font-size:12pt;break-after:avoid}.minutes-document-content p{margin:0 0 9px}.minutes-document-content ul,.minutes-document-content ol{margin:6px 0 12px;padding-left:24px}.minutes-document-content li{margin:0 0 4px}.minutes-document-content table{width:100%;border-collapse:collapse;table-layout:fixed;margin:10px 0 15px;font-size:10pt}.minutes-document-content th{background:#f3ecd9;color:#594714;font-weight:700}.minutes-document-content th,.minutes-document-content td{padding:7px 8px;border:1px solid #c9cdd4;text-align:left;vertical-align:top;overflow-wrap:anywhere}.minutes-document-content blockquote{margin:10px 0;padding:8px 13px;border-left:3px solid #b08a28;background:#fbf8ef}.minutes-document-content hr{border:0;border-top:1px solid #d7dbe2;margin:16px 0}.minutes-document-content img{max-width:100%;height:auto}.minutes-document-footer{margin-top:24px;padding-top:8px;border-top:1px solid #d7dbe2;color:#737373;font-family:Arial,Helvetica,sans-serif;font-size:8pt;text-align:center}
@page{size:A4 portrait;margin:0}
@media print{html,body{width:210mm;min-height:297mm;background:#fff!important;padding:0}.preview-chrome{display:none!important}.minutes-page{width:210mm;min-height:297mm;margin:0;padding:18mm 17mm 21mm;box-shadow:none;overflow:visible}.minutes-document-content h1,.minutes-document-content h2,.minutes-document-content h3,.minutes-document-content table,.minutes-document-content blockquote{break-inside:avoid}.minutes-document-content a{color:inherit;text-decoration:none}.minutes-document-footer{font-size:8pt}}
@media(max-width:850px){.preview-chrome{position:static;align-items:flex-start;flex-direction:column}.preview-chrome-actions{width:100%}.preview-chrome-actions button{flex:1}.minutes-page{width:100%;min-height:100vh;margin:0;padding:26px 22px;box-shadow:none}.psc-report-logo-lockup{grid-template-columns:48px 1fr 48px;gap:8px}.psc-report-logo-lockup img{max-width:46px;max-height:50px}.psc-report-header .psc-brand{font-size:10px}}
</style></head><body>${chrome}<main class="minutes-page"><header class="psc-report-header"><div class="psc-report-logo-lockup"><img class="psc-report-coat" src="/kenya-coat-of-arms.png" alt="Coat of Arms of Kenya"><div class="psc-report-brand-copy"><div class="psc-brand">PUBLIC SERVICE COMMISSION</div><div class="psc-subtitle">MEETING MINUTES · OFFICIAL RECORD FORMAT</div></div><img class="psc-report-logo" src="/psc-logo.png" alt="Public Service Commission logo"></div></header><div class="document-status">${escapeMinutesHtml(approvalLabel)}</div><article class="minutes-document-content">${bodyContent}</article><footer class="minutes-document-footer">Generated from the App2 Meetings workspace · ${escapeMinutesHtml(title)} · ${escapeMinutesHtml(status === "Approved" ? "Approved record preview" : "Working draft preview")}</footer></main></body></html>`;
}

type MeetingTab = "Overview" | "Agenda" | "Participants" | "Transcript" | "Minutes" | "Decisions & Actions" | "Documents" | "Audit";
type MeetingFilter = "all" | "upcoming" | "mine" | "prep" | "actions" | "review" | "completed";

const meetingTabs: MeetingTab[] = ["Overview", "Agenda", "Participants", "Transcript", "Minutes", "Decisions & Actions", "Documents", "Audit"];

const fmtDate = (value: string | null | undefined) => value ? new Date(value).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }) : "Not set";
const parseNairobiDateTime = (value: string) => {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value);
  return match ? new Date(`${match[1]}:00+03:00`) : new Date(Number.NaN);
};
const toNairobiDateTimeValue = (value: string | null | undefined) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-KE", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(parsed);
  const part = (name: string) => parts.find(item => item.type === name)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
};

export default function MeetingsWorkspace({ token, currentUser, onBack, onDashboard, onClose, onNotifications, onApprovals, initialTarget, onTargetHandled }: Props) {
  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [users, setUsers] = useState<MeetingUser[]>([]);
  const [scheduleApprovers, setScheduleApprovers] = useState<MeetingScheduleApprover[]>([]);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<MeetingDetail | null>(null);
  const [tab, setTab] = useState<MeetingTab>("Overview");
  const [notice, setNotice] = useState("");
  const [minutesDecisionResult,setMinutesDecisionResult]=useState<{title:string;outcome:string;nextAction:string}|null>(null);
  const [scheduleApproverLoadError, setScheduleApproverLoadError] = useState("");
  const [createError, setCreateError] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const [supportingUploadBusy, setSupportingUploadBusy] = useState(false);
  const [supportingDocumentNotice, setSupportingDocumentNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const [filter, setFilter] = useState<MeetingFilter>("all");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<"soonest" | "latest" | "title">("soonest");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [form, setForm] = useState({
    title: "",
    meetingType: "Departmental",
    description: "",
    startAt: "",
    endAt: "",
    venue: "",
    meetingLink: "",
    resourceLinks: "",
    meetingMode: "In-person",
    scheduleApproverId: "",
    chairId: currentUser.id,
    secretaryId: "",
    reviewerId: "",
  });
  const [agendaForm, setAgendaForm] = useState({ title: "", background: "", ownerId: "", durationMinutes: "15" });
  const [participantPickerOpen, setParticipantPickerOpen] = useState(false);
  const [participantPickerMode, setParticipantPickerMode] = useState<"create" | "existing">("create");
  const [participantSearch, setParticipantSearch] = useState("");
  const [participantDivision, setParticipantDivision] = useState("all");
  const [participantSelection, setParticipantSelection] = useState<string[]>([]);
  const [participantRoles, setParticipantRoles] = useState<Record<string, string>>({});
  const [createParticipantIds, setCreateParticipantIds] = useState<string[]>([]);
  const [createParticipantRoles, setCreateParticipantRoles] = useState<Record<string, string>>({});
  const [participantBusy, setParticipantBusy] = useState(false);
  const [pendingScheduleApprovalsCount, setPendingScheduleApprovalsCount] = useState<number | null>(null);
  const [unreadMeetingNotifications, setUnreadMeetingNotifications] = useState<number | null>(null);
  const [decisionText, setDecisionText] = useState("");
  const [actionForm, setActionForm] = useState({ title: "", description: "", ownerId: "", dueDate: "" });
  const [minutesText, setMinutesText] = useState("");
  const minutesEditorRef = useRef<App2LexicalReportEditorHandle | null>(null);
  const minutesPreviewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const minutesEditRevisionRef = useRef(0);
  const [minutesSaveState, setMinutesSaveState] = useState<"saved" | "unsaved" | "saving" | "error">("saved");
  const minutesSaveStateRef = useRef(minutesSaveState);
  minutesSaveStateRef.current = minutesSaveState;
  const [minutesSavedAt, setMinutesSavedAt] = useState<string | null>(null);
  const [showMinutesPreview, setShowMinutesPreview] = useState(false);
  const [repositoryPublicationNotice, setRepositoryPublicationNotice] = useState("");
  const [repositoryPublishBusy, setRepositoryPublishBusy] = useState(false);
  const [repositoryDraftSyncBusy, setRepositoryDraftSyncBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [meetingResult, directoryResult, approverResult] = await Promise.allSettled([
        meetingsApi.list(token), meetingsApi.users(token), meetingsApi.eligibleScheduleApprovers(token),
      ]);
      if (meetingResult.status === "rejected") throw meetingResult.reason;
      const rows = meetingResult.value;
      const approvers = approverResult.status === "fulfilled" ? approverResult.value : [];
      setMeetings(rows);
      const directory = directoryResult.status === "fulfilled" ? directoryResult.value : [];
      setUsers(directory);
      setScheduleApprovers(approvers);
      const setupError = [directoryResult, approverResult]
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map(result => result.reason instanceof Error ? result.reason.message : "A meeting setup request failed.")
        .join(" ");
      setScheduleApproverLoadError(setupError);
      if (directoryResult.status === "rejected") setNotice(`Meeting form setup could not load the user directory: ${setupError}`);
      if (setupError) setNotice(`Meetings loaded, but scheduling setup is incomplete: ${setupError}`);
      try {
        const pendingScheduleApprovals = await meetingsApi.pendingScheduleApprovals(token);
        setPendingScheduleApprovalsCount(pendingScheduleApprovals.length);
      } catch {
        setPendingScheduleApprovalsCount(null);
      }
      try {
        const inbox = await meetingsApi.meetingNotifications(token);
        setUnreadMeetingNotifications(inbox.filter(item => {
          const meetingRelated = String(item.target_workspace || "").toLowerCase() === "meetings" || String(item.entity_type || "").toLowerCase().includes("meeting");
          return meetingRelated && !item.read_at && !item.archived_at;
        }).length);
      } catch {
        setUnreadMeetingNotifications(null);
      }
      setForm(current => ({ ...current, scheduleApproverId: current.scheduleApproverId || approvers[0]?.id || "" }));
      if (selected) {
        const fresh = await meetingsApi.detail(token, selected.id);
        setSelected(fresh);
        if (minutesSaveStateRef.current === "saved") setMinutesText(fresh.minutes?.content || "");
      }
    } catch (error) {
      setNotice(error instanceof Error ? `Meetings could not be loaded: ${error.message}` : "Meetings could not be loaded. Check your connection or sign in again.");
    } finally {
      setLoading(false);
    }
  }, [token, selected?.id]);

  const uploadSupportingDocuments = async (meetingId: string, files: File[]) => {
    setSupportingUploadBusy(true);
    setSupportingDocumentNotice("");
    try {
      for (const file of files) {
        await meetingsApi.uploadAttachment(token, meetingId, file);
        setSupportingFiles(current => current.filter(item => item !== file));
      }
      const fresh = await meetingsApi.detail(token, meetingId);
      setSelected(fresh);
      setMeetings(rows => rows.map(row => row.id === fresh.id ? { ...row, ...fresh } : row));
      setSupportingDocumentNotice(`${files.length} supporting document${files.length === 1 ? "" : "s"} attached. They will be included in meeting invitation and update emails.`);
      return fresh;
    } finally {
      setSupportingUploadBusy(false);
    }
  };

  useEffect(() => { void refresh(); }, [token]);

  useEffect(() => {
    setMinutesSaveState("saved");
    setMinutesSavedAt(selected?.minutes?.updated_at || null);
    setShowMinutesPreview(false);
    setRepositoryPublicationNotice("");
  }, [selected?.id]);

  // Notification-originated navigation opens the referenced, authorization-checked meeting record.
  useEffect(() => {
    if (!initialTarget?.id || !initialTarget.nonce) return;
    let current = true;
    const rawTab = String(initialTarget.tab || "Overview");
    const targetTab = meetingTabs.find((name) => name.toLowerCase() === rawTab.toLowerCase()) || "Overview";
    void meetingsApi.detail(token, initialTarget.id)
      .then((detail) => {
        if (!current) return;
        setSelected(detail);
        setMinutesText(detail.minutes?.content || "");
        setTab(targetTab);
        setNotice(`Opened from notification: ${detail.title}`);
      })
      .catch((error) => {
        if (!current) return;
        setNotice(error instanceof Error ? error.message : "The referenced meeting is unavailable or access is restricted.");
      })
      .finally(() => {
        if (current) onTargetHandled?.();
      });
    return () => { current = false; };
    // onTargetHandled only clears the consumed one-shot target; it does not affect record loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, initialTarget?.id, initialTarget?.nonce]);

  const openMeeting = async (row: MeetingSummary) => {
    if (selected?.id && selected.id !== row.id && ["unsaved", "saving", "error"].includes(minutesSaveState)) {
      const leave = window.confirm("The current minutes draft has unsaved changes. Leave this meeting without saving?");
      if (!leave) return;
    }
    try {
      const detail = await meetingsApi.detail(token, row.id);
      setSelected(detail);
      setMinutesText(detail.minutes?.content || "");
      setTab("Overview");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Meeting could not be opened.");
    }
  };

  const cards = useMemo(() => {
    const now = Date.now();
    const upcomingRows = meetings.filter(m => (m.schedule_approval_status || "Approved") === "Approved" && new Date(m.start_at).getTime() >= now && m.status !== "Completed");
    return {
      upcoming: upcomingRows.length,
      mine: meetings.filter(m => m.created_by === currentUser.id || m.chair_id === currentUser.id || m.secretary_id === currentUser.id).length,
      prep: upcomingRows.filter(m => Number(m.agenda_count || 0) === 0 || Number(m.participant_count || 0) === 0 || !m.reviewer_name).length,
      actions: meetings.reduce((sum, m) => sum + Number(m.open_action_count || 0), 0),
      review: meetings.filter(m => m.minutes_status === "Submitted").length,
      completed: meetings.filter(m => m.status === "Completed").length,
    };
  }, [meetings, currentUser.id]);

  const filteredMeetings = useMemo(() => {
    const now = Date.now();
    const q = search.trim().toLowerCase();
    const rows = meetings.filter(row => {
      if ((row.schedule_approval_status || "Approved") !== "Approved" && row.created_by !== currentUser.id) return false;
      if ((row.schedule_approval_status || "Approved") !== "Approved" && row.created_by !== currentUser.id) return false;
      const matchesSearch = !q || [row.title, row.meeting_type, row.venue, row.chair_name, row.created_by_name, row.reviewer_name]
        .filter(Boolean).some(value => String(value).toLowerCase().includes(q));
      if (!matchesSearch) return false;
      if (filter === "upcoming") return new Date(row.start_at).getTime() >= now && row.status !== "Completed";
      if (filter === "mine") return row.created_by === currentUser.id || row.chair_id === currentUser.id || row.secretary_id === currentUser.id;
      if (filter === "prep") return new Date(row.start_at).getTime() >= now && row.status !== "Completed" && (Number(row.agenda_count || 0) === 0 || Number(row.participant_count || 0) === 0 || !row.reviewer_name);
      if (filter === "actions") return Number(row.open_action_count || 0) > 0;
      if (filter === "review") return row.minutes_status === "Submitted";
      if (filter === "completed") return row.status === "Completed";
      return true;
    });
    return rows.sort((a,b) => {
      if (sortMode === "title") return a.title.localeCompare(b.title);
      const left = new Date(a.start_at).getTime();
      const right = new Date(b.start_at).getTime();
      return sortMode === "latest" ? right - left : left - right;
    });
  }, [meetings, filter, search, sortMode, currentUser.id]);

  const readiness = useMemo(() => {
    if (!selected) return null;
    const checks = [
      { label: "Participants invited", ok: selected.participants.length > 0, tab: "Participants" as MeetingTab },
      { label: "Agenda prepared", ok: selected.agenda.length > 0, tab: "Agenda" as MeetingTab },
      { label: "Secretary assigned", ok: Boolean(selected.secretary_id), tab: "Overview" as MeetingTab },
      { label: "Minutes reviewer assigned", ok: Boolean(selected.reviewer_id), tab: "Overview" as MeetingTab },
      { label: "Venue / conferencing route set", ok: Boolean(selected.venue || selected.meeting_link), tab: "Overview" as MeetingTab },
    ];
    const complete = checks.filter(item => item.ok).length;
    return { checks, complete, percent: Math.round((complete / checks.length) * 100) };
  }, [selected]);

  const nextStep = useMemo(() => {
    if (!selected) return null;
    if (selected.participants.length === 0) return { label: "Invite participants", tab: "Participants" as MeetingTab };
    if (selected.agenda.length === 0) return { label: "Prepare agenda", tab: "Agenda" as MeetingTab };
    if (!selected.transcript && new Date(selected.start_at).getTime() <= Date.now()) return { label: "Capture transcript", tab: "Transcript" as MeetingTab };
    if (selected.transcript?.status === "Completed" && !selected.minutes) return { label: "Generate minutes", tab: "Minutes" as MeetingTab };
    if (selected.minutes?.status === "Draft" || selected.minutes?.status === "Returned") return { label: "Finalise draft minutes", tab: "Minutes" as MeetingTab };
    if (selected.minutes?.status === "Submitted") return { label: "Minutes under review", tab: "Minutes" as MeetingTab };
    if (selected.actions.some(action => action.status !== "Completed")) return { label: "Track open actions", tab: "Decisions & Actions" as MeetingTab };
    return { label: "Review meeting record", tab: "Overview" as MeetingTab };
  }, [selected]);

  const participantStats = useMemo(() => {
    if (!selected) return { total: 0, accepted: 0, pending: 0, declined: 0, present: 0 };
    const total = selected.participants.length;
    const accepted = selected.participants.filter(p => /accepted/i.test(p.response_status || "")).length;
    const declined = selected.participants.filter(p => /declined/i.test(p.response_status || "")).length;
    const present = selected.participants.filter(p => /present|virtual/i.test(p.attendance_status || "")).length;
    const pending = Math.max(0, total - accepted - declined);
    return { total, accepted, pending, declined, present };
  }, [selected]);

  const createMeeting = async () => {
    setCreateError("");
    if (!form.title.trim() || !form.startAt || !form.endAt) {
      setCreateError("Meeting title, start date/time and end date/time are required.");
      return;
    }
    if (!form.scheduleApproverId || !scheduleApprovers.some(item => item.id === form.scheduleApproverId)) {
      setCreateError(currentUser.role === "System Admin"
        ? `No meeting approver is appointed for your admin account. Use “Set my meeting approver” at the top of Meetings, choose another active user and an expiry date, then return here. ${scheduleApproverLoadError}`.trim()
        : `No authorized meeting approver is available for your account. Ask your direct supervisor or a System Admin to assign an approver. ${scheduleApproverLoadError}`.trim());
      return;
    }
    const venue = form.venue.trim();
    const meetingLink = form.meetingMode === "In-person" ? "" : form.meetingLink.trim();
    if ((form.meetingMode === "In-person" || form.meetingMode === "Hybrid") && !venue) {
      setCreateError("Enter a physical venue for an in-person or hybrid meeting.");
      return;
    }
    if ((form.meetingMode === "Online" || form.meetingMode === "Hybrid") && !meetingLink) {
      setCreateError("Enter the online meeting join link.");
      return;
    }
    if (meetingLink) {
      try {
        const parsed = new URL(meetingLink);
        if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("invalid");
      } catch {
        setCreateError("Online meeting links must be valid HTTPS URLs without embedded credentials.");
        return;
      }
    }
    const startAt = parseNairobiDateTime(form.startAt);
    const endAt = parseNairobiDateTime(form.endAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      setCreateError("Enter valid meeting start and end date/times.");
      return;
    }
    if (startAt <= new Date()) {
      setCreateError("Meeting start date/time must be in the future.");
      return;
    }
    if (endAt <= startAt) {
      setCreateError("End date/time must be later than start date/time.");
      return;
    }
    const resourceLinks = form.resourceLinks.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    if (resourceLinks.length > 10) {
      setCreateError("Add no more than 10 supporting links.");
      return;
    }
    for (const value of resourceLinks) {
      try { const parsed = new URL(value); if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("invalid"); }
      catch { setCreateError(`Supporting link is not a valid HTTPS URL: ${value}`); return; }
    }
    setCreateBusy(true);
    let persistedMeeting: MeetingDetail | null = null;
    try {
      const filesToUpload = [...supportingFiles];
      // For an existing meeting, upload first so any update invitation includes the new files.
      if (editingMeetingId && filesToUpload.length) await uploadSupportingDocuments(editingMeetingId, filesToUpload);
      const payload = {
        ...form,
        venue: form.meetingMode === "Online" ? "" : venue,
        meetingLink,
        resourceLinks,
        scheduleApproverId: form.scheduleApproverId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        secretaryId: form.secretaryId || null,
        reviewerId: form.reviewerId || null,
        participantIds: createParticipantIds,
        participantRoles: createParticipantRoles,
      };
      persistedMeeting = editingMeetingId
        ? await meetingsApi.update(token, editingMeetingId, payload)
        : await meetingsApi.create(token, payload);
      if (!editingMeetingId && filesToUpload.length) {
        persistedMeeting = await uploadSupportingDocuments(persistedMeeting.id, filesToUpload);
      }
      setCreateOpen(false);
      setEditingMeetingId(null);
      setCreateParticipantIds([]);
      setCreateParticipantRoles({});
      setSupportingFiles([]);
      setForm({ title: "", meetingType: "Departmental", description: "", startAt: "", endAt: "", venue: "", meetingLink: "", resourceLinks: "", meetingMode: "In-person", scheduleApproverId: scheduleApprovers[0]?.id || "", chairId: currentUser.id, secretaryId: "", reviewerId: "" });
      setNotice(editingMeetingId
        ? "Meeting request resubmitted for approval. Calendar publication and attendee invitations remain on hold until approval."
        : "Meeting request submitted for approval. Calendar publication and attendee invitations will occur only after approval.");
      setSelected(persistedMeeting);
      setMinutesText(persistedMeeting.minutes?.content || "");
      await refresh();
    } catch (error) {
      if (persistedMeeting) {
        setEditingMeetingId(persistedMeeting.id);
        setSelected(persistedMeeting);
        setCreateError(`The meeting request was saved, but a supporting document could not be attached. ${error instanceof Error ? error.message : "Use the Documents tab to finish attaching files."}`);
      } else setCreateError(error instanceof Error ? error.message : "Meeting request could not be submitted.");
    } finally {
      setCreateBusy(false);
    }
  };

  const editReturnedRequest = (meeting: MeetingDetail) => {
    setCreateError("");
    setSupportingFiles([]);
    setEditingMeetingId(meeting.id);
    const link = meeting.meeting_link || "";
    const venue = meeting.venue || "";
    setForm({
      title: meeting.title,
      meetingType: meeting.meeting_type || "Departmental",
      description: meeting.description || "",
      startAt: toNairobiDateTimeValue(meeting.start_at),
      endAt: toNairobiDateTimeValue(meeting.end_at || ""),
      venue,
      meetingLink: link,
      resourceLinks: (meeting.resource_links || []).join("\n"),
      meetingMode: link && venue ? "Hybrid" : link ? "Online" : "In-person",
      scheduleApproverId: scheduleApprovers.some(item => item.id === meeting.schedule_approver_id) ? meeting.schedule_approver_id || "" : scheduleApprovers[0]?.id || "",
      chairId: meeting.chair_id || currentUser.id,
      secretaryId: meeting.secretary_id || "",
      reviewerId: meeting.reviewer_id || "",
    });
    const participants = meeting.participants.filter(item => item.user_id).map(item => item.user_id as string);
    setCreateParticipantIds(participants);
    setCreateParticipantRoles(Object.fromEntries(meeting.participants.filter(item => item.user_id).map(item => [item.user_id as string, item.participant_role || "Attendee"])));
    setCreateOpen(true);
  };
  const addAgenda = async () => {
    if (!selected || !agendaForm.title.trim()) return;
    try {
      await meetingsApi.addAgenda(token, selected.id, {
        title: agendaForm.title.trim(),
        background: agendaForm.background,
        ownerId: agendaForm.ownerId || null,
        durationMinutes: Number(agendaForm.durationMinutes || 0) || null,
      });
      setAgendaForm({ title: "", background: "", ownerId: "", durationMinutes: "15" });
      const fresh = await meetingsApi.detail(token, selected.id);
      setSelected(fresh);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Agenda item could not be added."); }
  };

  const openParticipantPicker = (mode: "create" | "existing") => {
    setParticipantPickerMode(mode);
    setParticipantSearch("");
    setParticipantDivision("all");
    if (mode === "create") {
      setParticipantSelection(createParticipantIds);
      setParticipantRoles({ ...createParticipantRoles });
    } else {
      setParticipantSelection([]);
      setParticipantRoles({});
    }
    setParticipantPickerOpen(true);
  };

  const applyParticipantPicker = async () => {
    if (participantPickerMode === "create") {
      setCreateParticipantIds(participantSelection);
      setCreateParticipantRoles({ ...participantRoles });
      setParticipantPickerOpen(false);
      return;
    }
    if (!selected || participantSelection.length === 0) return;
    setParticipantBusy(true);
    try {
      const fresh = await meetingsApi.addParticipants(
        token,
        selected.id,
        participantSelection.map(userId => ({
          userId,
          participantRole: participantRoles[userId] || "Attendee",
        })),
      );
      setSelected(fresh);
      const delivery = fresh.invitation_delivery;
      setNotice(delivery
        ? `${participantSelection.length} participant(s) added. ${delivery.inApp} REDESY notification(s); ${delivery.emailSent} email invitation(s) sent${delivery.emailFailed ? `, ${delivery.emailFailed} failed` : ""}${delivery.emailSkipped ? `, ${delivery.emailSkipped} skipped` : ""}.`
        : `${participantSelection.length} participant(s) added.`);
      setParticipantPickerOpen(false);
      setParticipantSelection([]);
      setParticipantRoles({});
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Participants could not be added.");
    } finally {
      setParticipantBusy(false);
    }
  };

  const sendInvitations = async () => {
    if (!selected) return;
    setParticipantBusy(true);
    try {
      const result = await meetingsApi.sendInvitations(token, selected.id);
      setNotice(`Invitations sent: ${result.inApp} REDESY notification(s), ${result.emailSent} email(s)${result.emailFailed ? `, ${result.emailFailed} failed` : ""}${result.emailSkipped ? `, ${result.emailSkipped} skipped` : ""}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Invitations could not be sent.");
    } finally {
      setParticipantBusy(false);
    }
  };

  const updateParticipant = async (participantId: string, input: Record<string, unknown>) => {
    if (!selected) return;
    setParticipantBusy(true);
    try {
      const updated = await meetingsApi.updateParticipant(token, selected.id, participantId, input);
      setSelected(updated);
      const minute = updated.minutes;
      if (!minute?.content) {
        setNotice("Attendance saved. You can create the minutes draft now using Save draft or generate it from the meeting record.");
        return;
      }
      if (!(["Draft", "Returned"] as string[]).includes(minute.status)) {
        setMinutesText(minute.content);
        setMinutesSaveState("saved");
        setMinutesSavedAt(minute.updated_at || null);
        setNotice(`Attendance saved. Minutes are ${minute.status.toLowerCase()} and were left unchanged to preserve the review/official record.`);
        return;
      }
      const currentContent = minutesText.trim() ? minutesText : minute.content;
      const syncedContent = replaceMinutesAttendanceSection(currentContent, updated.participants);
      setMinutesText(syncedContent);
      if (syncedContent !== minute.content) {
        setMinutesSaveState("saving");
        try {
          const saved = await meetingsApi.saveMinutes(token, selected.id, syncedContent);
          const fresh = await meetingsApi.detail(token, selected.id);
          setSelected(fresh);
          setMinutesText(fresh.minutes?.content || syncedContent);
          setMinutesSavedAt(saved.updated_at || new Date().toISOString());
          setMinutesSaveState("saved");
        } catch (syncError) {
          setMinutesSaveState("error");
          setNotice(`Attendance was saved, but minutes synchronisation failed: ${syncError instanceof Error ? syncError.message : "the updated minutes could not be saved"}. Your editor content remains available; save the minutes again before submission.`);
          return;
        }
      }
      setNotice("Attendance saved and synchronised to the minutes draft. Discussion notes and decisions were retained.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Participant could not be updated.");
    } finally {
      setParticipantBusy(false);
    }
  };

  const removeParticipant = async (participantId: string) => {
    if (!selected) return;
    if (!window.confirm("Remove this person from the meeting participant list?")) return;
    setParticipantBusy(true);
    try {
      setSelected(await meetingsApi.removeParticipant(token, selected.id, participantId));
      setNotice("Participant removed.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Participant could not be removed.");
    } finally {
      setParticipantBusy(false);
    }
  };

  const uploadAudio = async (blob: Blob, filename: string) => {
    if (!selected) return;
    try {
      await meetingsApi.uploadAudio(token, selected.id, blob, filename);
      setNotice("Audio uploaded. Local transcription has been queued.");
      setTab("Transcript");
      window.setTimeout(async () => {
        try { setSelected(await meetingsApi.detail(token, selected.id)); } catch { /* next refresh will recover */ }
      }, 1800);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Audio could not be uploaded."); }
  };

  const startRecording = async () => {
    if (!selected) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach(track => track.stop());
        void uploadAudio(blob, `meeting-${selected.id}-${Date.now()}.webm`);
      };
      recorder.start(1000);
      setRecording(true);
      setNotice("Recording started. Participants should be informed according to applicable policy.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Microphone recording could not start."); }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const editSegment = async (segment: TranscriptSegment) => {
    if (!selected) return;
    const speaker = window.prompt("Speaker label", segment.speaker_label || "Speaker");
    if (speaker === null) return;
    const text = window.prompt("Correct transcript text", segment.corrected_text || segment.text);
    if (text === null) return;
    try {
      await meetingsApi.editSegment(token, selected.id, segment.id, { speakerLabel: speaker, text });
      setSelected(await meetingsApi.detail(token, selected.id));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Transcript correction could not be saved."); }
  };

  const handleMinutesEditorImmediateChange = (html: string) => {
    minutesEditRevisionRef.current += 1;
    setMinutesText(html);
    setMinutesSaveState("unsaved");
  };

  const handleMinutesEditorChange = (html: string) => {
    // The shared editor's immediate callback records dirty state. This delayed callback
    // only synchronises the value and must not mark a successful save dirty afterward.
    setMinutesText(html);
  };

  const runMinutesEditorCommand = (name: string, argument?: string) => {
    const executed = minutesEditorRef.current?.executeCommand(name, argument);
    if (executed) {
      minutesEditRevisionRef.current += 1;
      setMinutesSaveState("unsaved");
    }
  };

  const appendMinutesSection = (sectionHtml: string) => {
    if (!canEditMinutes) return;
    const currentHtml = minutesEditorRef.current?.getHTML() || minutesContentToEditorHtml(minutesText || "");
    const nextHtml = `${currentHtml}${sectionHtml}`;
    const applied = minutesEditorRef.current?.setHTML(nextHtml) ?? false;
    if (!applied) {
      setNotice("This section could not be inserted. Check that the editor is ready and the draft is editable.");
      return;
    }
    minutesEditRevisionRef.current += 1;
    setMinutesText(nextHtml);
    setMinutesSaveState("unsaved");
    minutesEditorRef.current?.focus();
  };

  const downloadMinutesPdf = async () => {
    if (!selected) return;
    if (["unsaved", "saving", "error"].includes(minutesSaveState)) {
      setNotice("Save the latest minutes draft successfully before downloading its PDF.");
      return;
    }
    try {
      setNotice("Preparing the PSC-branded Meeting Minutes PDF…");
      await meetingsApi.downloadMinutesPdf(token, selected.id);
      setNotice(selected.minutes?.status === "Approved" ? "Approved Meeting Minutes PDF downloaded." : "Working-copy Meeting Minutes PDF downloaded. The PDF is marked NOT APPROVED.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Meeting Minutes PDF could not be downloaded.");
    }
  };
  const printMinutesPreview = () => {
    const frame = minutesPreviewFrameRef.current;
    if (!frame?.contentWindow) {
      setNotice("Preview is not ready to print yet.");
      return;
    }
    frame.contentWindow.focus();
    frame.contentWindow.print();
  };

  const openMinutesPreviewWindow = () => {
    if (!selected) return;
    const currentHtml = minutesEditorRef.current?.getHTML() || minutesText;
    // Open synchronously from the click handler so browser popup protection can identify the user gesture.
    const previewWindow = window.open("", "_blank", "popup=yes,width=1100,height=900,resizable=yes,scrollbars=yes");
    if (!previewWindow) {
      setNotice("The browser blocked the A4 preview window. Allow pop-ups for this REDESY address, then select Preview A4 again.");
      return;
    }
    try {
      previewWindow.document.open();
      previewWindow.document.write(buildMinutesPreviewDocument(currentHtml, {
        meetingTitle: selected.title,
        status: selected.minutes?.status || "Draft",
        standalone: true,
      }));
      previewWindow.document.close();
      previewWindow.document.title = `${selected.title} — Meeting Minutes Preview`;
      const popup = previewWindow;
      popup.document.getElementById("app2-minutes-preview-print")?.addEventListener("click", () => {
        popup.focus();
        popup.print();
      });
      popup.document.getElementById("app2-minutes-preview-close")?.addEventListener("click", () => popup.close());
      previewWindow.focus();
      setNotice("A4 report preview opened in a separate window using the current editor content. Use Print / Save PDF in that window.");
    } catch (error) {
      previewWindow.close();
      setNotice(error instanceof Error ? `A4 preview could not be opened: ${error.message}` : "A4 preview could not be opened.");
    }
  };

  const syncMinutesDraftToRepository = async () => {
    if (!selected) return;
    if (!selected.can_manage) {
      setNotice("Only an authorised meeting manager can sync the meeting's working draft to Repository.");
      return;
    }
    if (["unsaved", "saving", "error"].includes(minutesSaveState)) {
      setNotice("Save the latest minutes draft first. Repository will then mirror the saved meeting record.");
      return;
    }
    setRepositoryDraftSyncBusy(true);
    try {
      const receipt = await meetingsApi.syncMinutesDraftToRepository(token, selected.id);
      const fresh = await meetingsApi.detail(token, selected.id);
      setSelected(fresh);
      const title = receipt.repository_draft_document_title || fresh.minutes?.repository_draft_document_title || `[DRAFT] ${selected.title} — Meeting Minutes`;
      const version = receipt.repository_draft_version || fresh.minutes?.repository_draft_version;
      const message = `Working draft is visible in Repository: ${title}${version ? ` · Draft version ${version}` : ""} · Working Drafts · NOT APPROVED.`;
      setRepositoryPublicationNotice(message);
      setNotice(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Minutes draft could not be synced to Repository.";
      setRepositoryPublicationNotice(`Repository draft sync not confirmed: ${message}`);
      setNotice(message);
    } finally {
      setRepositoryDraftSyncBusy(false);
    }
  };

  const reconcileApprovedMinutesPublication = async () => {
    if (!selected) return;
    if (selected.minutes?.status !== "Approved") {
      setNotice("Only minutes with a recorded authorised approval can be published to Repository.");
      return;
    }
    setRepositoryPublishBusy(true);
    setRepositoryPublicationNotice("");
    try {
      const receipt = await meetingsApi.publishApprovedMinutesToRepository(token, selected.id);
      const fresh = await meetingsApi.detail(token, selected.id);
      setSelected(fresh);
      const repositoryTitle = receipt.repository_document_title || fresh.minutes?.repository_document_title || `${selected.title} — Approved Meeting Minutes`;
      const recordNumber = receipt.repository_record_number || fresh.minutes?.repository_record_number || receipt.repository_document_id || "Record number pending";
      const version = receipt.repository_version || fresh.minutes?.repository_version;
      const message = `Approved minutes published to Repository: ${repositoryTitle} · Record ${recordNumber}${version ? ` · Repository v${version}` : ""}. Search the title in All Records or Meeting & Workshop Reports.`;
      setRepositoryPublicationNotice(message);
      setNotice(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Approved minutes could not be published to Repository.";
      setRepositoryPublicationNotice(`Repository publication not confirmed: ${message}`);
      setNotice(message);
    } finally {
      setRepositoryPublishBusy(false);
    }
  };

  const copyRepositoryRecordId = async (documentId: string) => {
    try {
      await navigator.clipboard.writeText(documentId);
      setNotice("Repository document ID copied.");
    } catch {
      setNotice(`Repository document ID: ${documentId}`);
    }
  };

  const generateMinutes = async () => {
    if (!selected) return;
    if (["unsaved", "saving", "error"].includes(minutesSaveState)) {
      setNotice("Save the current draft first. Generating a draft while edits are unsaved could discard those edits.");
      return;
    }
    try {
      const minute = await meetingsApi.generateMinutes(token, selected.id);
      setMinutesText(minute.content);
      minutesEditRevisionRef.current += 1;
      setMinutesSaveState("saved");
      setMinutesSavedAt(minute.updated_at || new Date().toISOString());
      setSelected(await meetingsApi.detail(token, selected.id));
      setTab("Minutes");
      setNotice("Draft minutes generated and saved to this meeting record.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Draft minutes could not be generated.");
    }
  };

  const saveMinutes = async () => {
    if (!selected) return;
    const contentAtStart = minutesEditorRef.current?.getHTML() || minutesText;
    if (!contentAtStart.trim()) {
      setNotice("Enter or generate the minutes content before saving the draft.");
      return;
    }
    if (!canEditMinutes) {
      setNotice("These minutes are submitted or approved and are read-only. Generate a new draft version to make changes.");
      return;
    }
    if (contentAtStart !== minutesText) setMinutesText(contentAtStart);
    const revisionAtStart = minutesEditRevisionRef.current;
    setMinutesSaveState("saving");
    try {
      const saved = await meetingsApi.saveMinutes(token, selected.id, contentAtStart);
      const fresh = await meetingsApi.detail(token, selected.id);
      setSelected(fresh);
      setMinutesSavedAt(saved.updated_at || new Date().toISOString());
      if (minutesEditRevisionRef.current === revisionAtStart) {
        setMinutesSaveState("saved");
        setNotice(`Draft saved to this meeting record${saved.version_no ? ` (minutes v${saved.version_no})` : ""}.`);
      } else {
        setMinutesSaveState("unsaved");
        setNotice("The current draft was saved, but newer edits remain unsaved. Save again before submission.");
      }
    } catch (error) {
      setMinutesSaveState("error");
      setNotice(error instanceof Error ? error.message : "Minutes could not be saved. Your editor content is still present.");
    }
  };

  const submitMinutes = async () => {
    if (!selected?.reviewer_id) {
      setNotice("Assign a reviewer before submitting these minutes.");
      return;
    }
    if (minutesSaveState !== "saved") {
      setNotice("Save the latest draft before submitting it for review.");
      return;
    }
    try {
      await meetingsApi.submitMinutes(token, selected.id, selected.reviewer_id);
      setSelected(await meetingsApi.detail(token, selected.id));
      setNotice("Saved minutes submitted for review.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Minutes could not be submitted.");
    }
  };

  const decideMinutes = async (decision: "Approved" | "Returned") => {
    if (!selected) return;
    const comments = decision === "Returned"
      ? (window.prompt("Return comments", "Returned for correction.") || "Returned for correction.")
      : "";
    try {
      const outcome = await meetingsApi.reviewMinutes(token, selected.id, decision, comments);
      const fresh = await meetingsApi.detail(token, selected.id);
      setSelected(fresh);
      setMinutesText(fresh.minutes?.content || "");
      setMinutesSavedAt(fresh.minutes?.updated_at || null);
      setMinutesSaveState("saved");
      setRepositoryPublicationNotice("");
      if (decision === "Approved") {
        if (outcome.repository_document_id) {
          const repositoryLabel = outcome.repository_document_title || fresh.minutes?.repository_document_title || "Approved Meeting Minutes";
          const recordNumber = outcome.repository_record_number || fresh.minutes?.repository_record_number || outcome.repository_document_id;
          const versionNumber = outcome.repository_version || fresh.minutes?.repository_version;
          const message = `Approved and published to Repository: ${repositoryLabel} · Record ${recordNumber}${versionNumber ? ` · Repository v${versionNumber}` : ""}. Find it under Other / Uploaded Documents.`;
          setRepositoryPublicationNotice(message);
          setNotice(message);
        } else {
          const message = "Approval response contained no Repository receipt. Verify the Repository record before treating publication as confirmed.";
          setRepositoryPublicationNotice(message);
          setNotice(message);
        }
      } else {
        setNotice("Minutes returned for correction. The draft remains editable.");
      }
      const published = decision === "Approved" && Boolean(outcome.repository_document_id);
      setMinutesDecisionResult({title:decision==="Approved"?"Meeting minutes approved":"Meeting minutes returned for correction",outcome:decision==="Approved"?published?"The approved minutes were published to the Document Repository.":"Approval was recorded, but a Repository publication receipt was not returned.":"The minutes remain editable for correction.",nextAction:decision==="Approved"?published?"No further reviewer action is required. Approved minutes are available in the Document Repository.":"The recorded approver or an authorised meeting manager must verify or retry Repository publication.":"The meeting secretary or minutes author must revise the minutes, save the draft and resubmit them to the reviewer."});
      setTab("Overview");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : `Minutes could not be ${decision === "Approved" ? "approved and published" : "returned"}.`);
    }
  };

  const addDecision = async () => {
    if (!selected || !decisionText.trim()) return;
    try {
      await meetingsApi.addDecision(token, selected.id, decisionText.trim());
      setDecisionText("");
      setSelected(await meetingsApi.detail(token, selected.id));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Decision could not be recorded."); }
  };

  const addAction = async () => {
    if (!selected || !actionForm.title.trim()) return;
    try {
      await meetingsApi.addAction(token, selected.id, {
        ...actionForm,
        ownerId: actionForm.ownerId || null,
        dueDate: actionForm.dueDate || null,
      });
      setActionForm({ title: "", description: "", ownerId: "", dueDate: "" });
      setSelected(await meetingsApi.detail(token, selected.id));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Action could not be recorded."); }
  };

  const canEditMinutes = !selected?.minutes || ["Draft", "Returned"].includes(selected.minutes.status);
  const canReconcileApprovedMinutes = Boolean(selected && selected.minutes?.status === "Approved" && (selected.can_manage || selected.minutes.approved_by === currentUser.id));

  const confirmLeaveWithUnsavedMinutes = () => {
    if (!["unsaved", "saving", "error"].includes(minutesSaveState)) return true;
    return window.confirm("The current minutes draft is not confirmed as saved. Leave this workspace without saving?");
  };

  if (loading && meetings.length === 0) return <div className="meetings-loading">Loading Meetings...</div>;

  return (
    <div className="meetings-workspace">
      {minutesDecisionResult&&<WorkflowNextActionDialog {...minutesDecisionResult} onClose={()=>setMinutesDecisionResult(null)}/>}
      <header className="meetings-command-head module-command-centre-head">
        <div>
          <small>MEETINGS & INSTITUTIONAL ACTION</small>
          <h3>Meetings Command Centre</h3>
          <p>Schedule, record, transcribe and govern meetings from agenda to approved minutes and actions.</p>
        </div>
        <div className="meetings-command-actions">
          <button type="button" onClick={() => { if (confirmLeaveWithUnsavedMinutes()) onBack?.(); }}>Back</button>
          <button type="button" onClick={() => { if (confirmLeaveWithUnsavedMinutes()) onDashboard?.(); }}>Dashboard</button>
          <button type="button" onClick={() => { if (confirmLeaveWithUnsavedMinutes()) onClose?.(); }}>Close</button>
                 <MeetingScheduleApprovalAppointments
                   token={token}
                   currentUser={currentUser}
                   promptSelfAppointment={currentUser.role === "System Admin"}
                   onAppointmentSaved={refresh}
                 />
                 <button type="button" className="meetings-primary" onClick={() => { setCreateError(""); setSupportingFiles([]); setEditingMeetingId(null); setForm(current => ({...current, scheduleApproverId: current.scheduleApproverId || scheduleApprovers[0]?.id || ""})); setCreateOpen(true); }}>+ Schedule meeting</button>
        </div>
      </header>

      {notice && <div className="meetings-notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}

      {!selected ? (
        <section className="meetings-command-centre">
          <>
          <section className="module-kpi-strip meetings-command-kpis meetings-command-cards-r1" aria-label="Meeting command centre metrics">
  <button type="button" className={`kpi-blue ${filter === "upcoming" ? "active" : ""}`} onClick={() => setFilter(filter === "upcoming" ? "all" : "upcoming")}>
    <strong>{cards.upcoming}</strong><span>Upcoming meetings</span><small>Approved meetings scheduled ahead</small>
  </button>
  <button type="button" className="kpi-violet" onClick={() => onApprovals?.()}>
    <strong>{pendingScheduleApprovalsCount === null ? "—" : pendingScheduleApprovalsCount}</strong><span>Awaiting my approval</span><small>Requests in your authorised decision queue</small>
  </button>
  <button type="button" className={`kpi-amber ${filter === "prep" ? "active" : ""}`} onClick={() => setFilter(filter === "prep" ? "all" : "prep")}>
    <strong>{cards.prep}</strong><span>Needs Preparation</span><small>Agenda, participants or reviewer missing</small>
  </button>
  <button type="button" className="kpi-red" onClick={() => onNotifications?.()}>
    <strong>{unreadMeetingNotifications === null ? "—" : unreadMeetingNotifications}</strong><span>Meeting notifications</span><small>Unread meeting-related updates</small>
  </button>
  <button type="button" className={`kpi-teal ${filter === "mine" ? "active" : ""}`} onClick={() => setFilter(filter === "mine" ? "all" : "mine")}>
    <strong>{cards.mine}</strong><span>My Meetings</span><small>Meetings you own, chair or coordinate</small>
  </button>
  <button type="button" className={`kpi-violet ${filter === "review" ? "active" : ""}`} onClick={() => setFilter(filter === "review" ? "all" : "review")}>
    <strong>{cards.review}</strong><span>Minutes Review</span><small>Minutes awaiting reviewer decision</small>
  </button>
  <button type="button" className={`kpi-red ${filter === "actions" ? "active" : ""}`} onClick={() => setFilter(filter === "actions" ? "all" : "actions")}>
    <strong>{cards.actions}</strong><span>Open Actions</span><small>Follow-up actions across meetings</small>
  </button>
  <button type="button" className={`kpi-green ${filter === "completed" ? "active" : ""}`} onClick={() => setFilter(filter === "completed" ? "all" : "completed")}>
    <strong>{cards.completed}</strong><span>Completed meetings</span><small>Records with meeting status completed</small>
  </button>
</section>
          <section className="meetings-list-panel">
            <div className="meetings-section-head"><div><h3>Meeting register</h3><span>Cards filter the register. Access remains limited to your authorised meeting scope.</span></div><button onClick={() => void refresh()}>Refresh</button></div>
            <div className="meetings-register-tools">
              <div className="meetings-search"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search meeting, chair, reviewer or venue" /></div>
              <select className="meetings-sort" value={sortMode} onChange={e => setSortMode(e.target.value as "soonest" | "latest" | "title")}>
                <option value="soonest">Soonest first</option>
                <option value="latest">Latest first</option>
                <option value="title">Title A-Z</option>
              </select>
              <div className="meetings-filter-state">{filter === "all" ? "All meetings" : `Filtered: ${filter}`} {(filter !== "all" || search) && <button onClick={() => { setFilter("all"); setSearch(""); }}>Clear</button>}</div>
            </div>
            <div className="meetings-table">
              <div className="meetings-table-head"><span>Meeting</span><span>Schedule</span><span>Governance</span><span>Status</span><span>Action</span></div>
              {filteredMeetings.map(row => <article key={row.id}>
                <div><strong>{row.title}</strong><small>{row.meeting_type} · {row.participant_count} participants</small></div>
                <div><strong>{fmtDate(row.start_at)}</strong><small>{row.venue || row.meeting_link || "Venue not set"}</small></div>
                <div><strong>{row.chair_name || row.created_by_name}</strong><small>Reviewer: {row.reviewer_name || "Not assigned"}</small></div>
                <div><b className={`meeting-status ${row.status.toLowerCase().replaceAll(" ", "-")}`}>{row.status}</b><small>{row.transcript_status ? `Transcript: ${row.transcript_status}` : "No transcript"}</small></div>
                <button onClick={() => void openMeeting(row)}>Open</button>
              </article>)}
              {filteredMeetings.length === 0 && <div className="meetings-empty meetings-command-empty">
                <div className="meetings-empty-icon" aria-hidden="true">◇</div>
                <strong>{meetings.length === 0 ? "No meetings scheduled yet" : "No meetings match this view"}</strong>
                <span>{meetings.length === 0 ? "Create the first governed meeting to begin planning, attendance, minutes and actions." : "Clear the current filter or search to see other authorised meetings."}</span>
                {meetings.length === 0
                  ? <button className="meetings-primary" onClick={() => { setSupportingFiles([]); setEditingMeetingId(null); setCreateOpen(true); }}>+ Schedule first meeting</button>
                  : <button onClick={() => { setFilter("all"); setSearch(""); }}>Clear filters</button>}
              </div>}
            </div>
          </section>
          </>
        </section>
      ) : (
        <section className="meeting-detail-shell">
          <div className="meeting-detail-head meeting-detail-head-v23">
            <button className="meeting-back" onClick={() => setSelected(null)}>← All meetings</button>
            <div className="meeting-detail-title"><small>{selected.meeting_type.toUpperCase()} MEETING</small><h3>{selected.title}</h3><span>{fmtDate(selected.start_at)} · {selected.venue || selected.meeting_link || "Venue not set"}</span></div>
            <div className="meeting-detail-live-actions">{selected.schedule_approval_status === "Returned" && selected.created_by === currentUser.id && <button type="button" onClick={() => editReturnedRequest(selected)}>Edit & resubmit request</button>}<button className="meetings-live-button" disabled={selected.schedule_approval_status !== "Approved"} onClick={() => setLiveOpen(true)}>{selected.status === "In Progress" ? "Join live meeting" : selected.can_manage ? "Start live meeting" : "Join live meeting"}</button><b className={`meeting-status ${String(selected.schedule_approval_status && selected.schedule_approval_status !== "Approved" ? selected.schedule_approval_status : selected.status).toLowerCase().replaceAll(" ", "-")}`}>{selected.schedule_approval_status && selected.schedule_approval_status !== "Approved" ? selected.schedule_approval_status : selected.status}</b></div>
          </div>
          <div className="meeting-lifecycle-v25" aria-label="Meeting lifecycle">
            {[
              ["Prepare", selected.participants.length > 0 && selected.agenda.length > 0],
              ["Conduct", selected.status === "In Progress" || selected.status === "Completed"],
              ["Transcribe", Boolean(selected.transcript)],
              ["Minutes", Boolean(selected.minutes)],
              ["Review", selected.minutes?.status === "Submitted" || selected.minutes?.status === "Approved"],
              ["Actions", selected.actions.length > 0],
              ["Close", selected.status === "Completed"],
            ].map(([label,done],index)=><span key={String(label)} className={done ? "done" : ""}><b>{index+1}</b>{String(label)}</span>)}
          </div>
          <div className="meeting-detail-metrics" aria-label="Meeting summary">
            <button onClick={() => setTab("Participants")}><small>PARTICIPANTS</small><strong>{selected.participants.length}</strong><span>{selected.participants.length ? "Invited / recorded" : "Invite attendees"}</span></button>
            <button onClick={() => setTab("Agenda")}><small>AGENDA</small><strong>{selected.agenda.length}</strong><span>{selected.agenda.length ? "Items prepared" : "Prepare agenda"}</span></button>
            <button onClick={() => setTab("Decisions & Actions")}><small>OPEN ACTIONS</small><strong>{selected.actions.filter(a => a.status !== "Completed").length}</strong><span>{selected.decisions.length} decisions recorded</span></button>
            <button onClick={() => setTab("Minutes")}><small>MINUTES</small><strong>{selected.minutes?.status || "Pending"}</strong><span>{selected.reviewer_name ? `Reviewer: ${selected.reviewer_name}` : "Reviewer not assigned"}</span></button>
          </div>
          <nav className="meeting-tabs meeting-tabs-v23" aria-label="Meeting workspace tabs">{meetingTabs.map(name => {
            const count = name === "Agenda" ? selected.agenda.length : name === "Participants" ? selected.participants.length : name === "Decisions & Actions" ? selected.decisions.length + selected.actions.length : null;
            const state = name === "Transcript" ? selected.transcript?.status : name === "Minutes" ? selected.minutes?.status : null;
            return <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}><span>{name}</span>{count !== null && <b>{count}</b>}{state && <i>{state}</i>}</button>;
          })}</nav>

          {tab === "Overview" && <div className="meeting-panel meeting-overview-v22">
            <div className="meeting-lifecycle" aria-label="Meeting lifecycle">
              <div className="done"><b>1</b><span>Prepare</span><small>Agenda & participants</small></div>
              <div className={selected.status === "In Progress" || selected.status === "Completed" ? "done" : ""}><b>2</b><span>Meet</span><small>Live / attendance</small></div>
              <div className={selected.transcript || selected.minutes ? "done" : ""}><b>3</b><span>Close out</span><small>Transcript & minutes</small></div>
              <div className={selected.minutes?.status === "Approved" || selected.status === "Completed" ? "done" : ""}><b>4</b><span>Govern</span><small>Approval & actions</small></div>
            </div>
            <div className="meeting-command-grid">
              <article className="meeting-command-card meeting-readiness-card"><div className="meeting-card-heading"><div><small>MEETING READINESS</small><h4>{readiness?.percent || 0}% prepared</h4></div><div className="meeting-readiness-ring" style={{ "--meeting-readiness": `${readiness?.percent || 0}%` } as CSSProperties}><span>{readiness?.complete || 0}/5</span></div></div><div className="meeting-checklist">{readiness?.checks.map(item => <button key={item.label} onClick={() => setTab(item.tab)}><i className={item.ok ? "ok" : "pending"}>{item.ok ? "✓" : "!"}</i><span>{item.label}</span><b>{item.ok ? "Ready" : "Needs attention"}</b></button>)}</div></article>
              <article className="meeting-command-card"><small>NEXT BEST ACTION</small><h4>{nextStep?.label}</h4><p>REDESY uses the meeting record to surface the next logical governance step without hiding the full workspace.</p><button className="meetings-primary" onClick={() => nextStep && setTab(nextStep.tab)}>Continue</button></article>
              <article className="meeting-command-card"><small>GOVERNANCE</small><h4>{selected.chair_name || selected.created_by_name}</h4><dl><div><dt>Secretary</dt><dd>{selected.secretary_name || "Not assigned"}</dd></div><div><dt>Reviewer</dt><dd>{selected.reviewer_name || "Not assigned"}</dd></div><div><dt>Participants</dt><dd>{selected.participants.length}</dd></div><div><dt>Agenda</dt><dd>{selected.agenda.length} items</dd></div><div><dt>Schedule approval</dt><dd>{selected.schedule_approval_status || "Approved (legacy)"}</dd></div></dl></article>
              <article className="meeting-command-card"><small>MEETING OUTPUTS</small><h4>{selected.minutes?.status || "Minutes not generated"}</h4><dl><div><dt>Transcript</dt><dd>{selected.transcript?.status || "Not started"}</dd></div><div><dt>Decisions</dt><dd>{selected.decisions.length}</dd></div><div><dt>Open actions</dt><dd>{selected.actions.filter(a => a.status !== "Completed").length}</dd></div><div><dt>Status</dt><dd>{selected.status}</dd></div></dl></article>
<article className="meeting-command-card meeting-attendance-card">
  <small>INVITATIONS & ATTENDANCE</small>
  <h4>{participantStats.accepted}/{participantStats.total} accepted</h4>
  <dl>
    <div><dt>Awaiting response</dt><dd>{participantStats.pending}</dd></div>
    <div><dt>Declined</dt><dd>{participantStats.declined}</dd></div>
    <div><dt>Present / virtual</dt><dd>{participantStats.present}</dd></div>
    <div><dt>Total participants</dt><dd>{participantStats.total}</dd></div>
  </dl>
  <button type="button" className="meetings-primary" onClick={() => setTab("Participants")}>Manage participants</button>
</article>
            </div>
            <article className="meeting-purpose-card"><div><small>PURPOSE / CONTEXT</small><h4>{selected.meeting_type}</h4></div><p>{selected.description || "No meeting description has been recorded."}</p><div className="meeting-purpose-meta"><span>{fmtDate(selected.start_at)}</span><span>{selected.venue || selected.meeting_link || "Venue not set"}</span></div></article>
            {selected.meeting_link && selected.schedule_approval_status === "Approved" && <div className="meeting-detail-resource-links"><a href={selected.meeting_link} target="_blank" rel="noreferrer">Join online meeting ↗</a></div>}
            {Array.isArray(selected.resource_links) && selected.resource_links.length > 0 && <section className="meeting-detail-resource-links" aria-label="Meeting supporting links"><strong>Supporting links</strong>{selected.resource_links.map((link,index)=><a key={`${selected.id}-resource-${index}`} href={link} target="_blank" rel="noreferrer">Resource {index+1} ↗</a>)}</section>}
            {selected.meeting_link && selected.schedule_approval_status === "Approved" && <div className="meeting-detail-resource-links"><a href={selected.meeting_link} target="_blank" rel="noreferrer">Join online meeting ↗</a></div>}
            {Array.isArray(selected.resource_links) && selected.resource_links.length > 0 && <section className="meeting-detail-resource-links" aria-label="Meeting supporting links"><strong>Supporting links</strong>{selected.resource_links.map((link,index)=><a key={`${selected.id}-resource-${index}`} href={link} target="_blank" rel="noreferrer">Resource {index+1} ↗</a>)}</section>}
            {selected.can_manage && selected.minutes?.status === "Approved" && selected.status !== "Completed" && <div className="meeting-closeout"><div><b>Meeting governance is complete</b><span>Approved minutes are available. Close the meeting when outstanding actions are appropriately recorded.</span></div><button onClick={async()=>{try{const fresh=await meetingsApi.complete(token,selected.id);setSelected(fresh);setNotice("Meeting marked completed.");await refresh();}catch(error){setNotice(error instanceof Error?error.message:"Meeting could not be completed.")}}}>Complete meeting</button></div>}
          </div>}

          {tab === "Agenda" && <div className="meeting-panel">
            <div className="meeting-form-row"><input value={agendaForm.title} onChange={e => setAgendaForm({...agendaForm,title:e.target.value})} placeholder="Agenda item"/><input value={agendaForm.background} onChange={e => setAgendaForm({...agendaForm,background:e.target.value})} placeholder="Background / purpose"/><select value={agendaForm.ownerId} onChange={e => setAgendaForm({...agendaForm,ownerId:e.target.value})}><option value="">No owner</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select><button onClick={() => void addAgenda()}>Add item</button></div>
            <div className="meeting-stack">{selected.agenda.map((item: AgendaItem) => <article key={item.id}><b>{item.item_no}. {item.title}</b><span>{item.background || "No background note"}</span><small>Owner: {item.owner_name || "Not assigned"} · {item.duration_minutes || 0} min</small></article>)}</div>
          </div>}

          {tab === "Participants" && <div className="meeting-panel meeting-participants-panel">
            <div className="meeting-participant-toolbar">
              <div>
                <small>PARTICIPANTS & INVITATIONS</small>
                <h4>{selected.participants.length} participant{selected.participants.length === 1 ? "" : "s"}</h4>
                <span>Select attendees, assign meeting roles, track responses and mark attendance.</span>
              </div>
              <div>
                {selected.can_manage && <button onClick={() => openParticipantPicker("existing")}>+ Manage participants</button>}
                {selected.can_manage && <button className="meetings-primary" disabled={participantBusy || selected.participants.length === 0} title={selected.participants.length === 0 ? "Add at least one participant before sending invitations." : undefined} onClick={() => void sendInvitations()}>
                  {participantBusy ? "Sending..." : "Send invitations / resend"}
                </button>}
              </div>
            </div>

            <div className="meeting-invitation-channel">
              <b>Dual-channel invitation</b>
              <span>Invited REDESY members receive an in-system Meetings notification and a normal email when email delivery is configured.</span>
            </div>

            <div className="meeting-participant-stats-v25">
              <button type="button"><strong>{participantStats.total}</strong><span>Invited</span></button>
              <button type="button"><strong>{participantStats.accepted}</strong><span>Accepted</span></button>
              <button type="button"><strong>{participantStats.pending}</strong><span>Pending</span></button>
              <button type="button"><strong>{participantStats.declined}</strong><span>Declined</span></button>
              <button type="button"><strong>{participantStats.present}</strong><span>Present / Virtual</span></button>
            </div>

            <div className="meeting-participant-grid meeting-participant-grid-v24">
              {selected.participants.map(p => {
                const canSelfRespond = p.user_id === currentUser.id;
                return <article key={p.id}>
                  <div className="meeting-participant-card-head">
                    <div>
                      <strong>{p.user_name || p.guest_name || "Guest"}</strong>
                      <small>{p.user_email || p.guest_email || "No email recorded"}</small>
                    </div>
                    <b className={`meeting-response-status ${p.response_status.toLowerCase()}`}>{p.response_status}</b>
                  </div>

                  <div className="meeting-participant-fields">
                    <label>
                      Role
                      <select
                        value={p.participant_role}
                        disabled={!selected.can_manage || participantBusy}
                        onChange={e => void updateParticipant(p.id, { participantRole: e.target.value })}
                      >
                        {["Attendee","Member","Chair","Secretary","Presenter","Minutes Reviewer","Observer"].map(role => <option key={role}>{role}</option>)}
                      </select>
                    </label>

                    <label>
                      Response
                      <select
                        value={p.response_status}
                        disabled={(!selected.can_manage && !canSelfRespond) || participantBusy}
                        onChange={e => void updateParticipant(p.id, { responseStatus: e.target.value })}
                      >
                        {["Invited","Accepted","Tentative","Declined"].map(status => <option key={status}>{status}</option>)}
                      </select>
                    </label>

                    <label>
                      Attendance
                      <select
                        value={p.attendance_status}
                        disabled={!selected.can_manage || participantBusy}
                        onChange={e => void updateParticipant(p.id, { attendanceStatus: e.target.value })}
                      >
                        {["Not marked","Present","Virtual","Absent","Apology"].map(status => <option key={status}>{status}</option>)}
                      </select>
                    </label>
                  </div>

                  {selected.can_manage && <div className="meeting-participant-card-actions">
                    <button className="meeting-danger-link" disabled={participantBusy} onClick={() => void removeParticipant(p.id)}>Remove</button>
                  </div>}
                </article>;
              })}
              {selected.participants.length === 0 && <div className="meetings-empty participant-empty">
                <strong>No participants selected</strong>
                <span>Use Manage participants to select REDESY members and send invitations.</span>
              </div>}
            </div>
          </div>}

          {tab === "Transcript" && <div className="meeting-panel transcript-panel">
            <div className="transcript-toolbar">
              {!recording ? <button className="meetings-primary" onClick={() => void startRecording()}>● Start recording</button> : <button className="meeting-danger" onClick={stopRecording}>■ Stop & transcribe</button>}
              <label className="meeting-upload">Upload audio/video<input type="file" accept="audio/*,video/mp4,video/webm" onChange={e => { const f=e.target.files?.[0]; if(f) void uploadAudio(f,f.name); e.currentTarget.value=""; }}/></label>
              <button onClick={() => void refresh()}>Refresh transcript</button>
              {selected.transcript?.status === "Completed" && <button onClick={() => void generateMinutes()}>Generate draft minutes</button>}
            </div>
            <div className="transcript-status"><b>{selected.transcript?.status || "No transcription"}</b><span>{selected.transcript?.original_filename || "Record or upload meeting audio to begin."}</span>{selected.transcript?.error_message && <small>{selected.transcript.error_message}</small>}</div>
            <div className="transcript-list">{selected.transcript?.segments.map(segment => <article key={segment.id} onDoubleClick={() => void editSegment(segment)}><time>{Math.floor(segment.start_seconds/60)}:{String(Math.floor(segment.start_seconds%60)).padStart(2,"0")}</time><b>{segment.speaker_label || "Speaker"}</b><p>{segment.corrected_text || segment.text}</p><button onClick={() => void editSegment(segment)}>Correct</button></article>)}{selected.transcript?.status === "Completed" && selected.transcript.segments.length === 0 && <div className="meetings-empty">Transcription completed without speech segments.</div>}</div>
          </div>}

          {tab === "Minutes" && <div className="meeting-panel minutes-panel">
            <div className="minutes-toolbar minutes-workflow-toolbar" aria-label="Minutes workflow actions">
              <button type="button" onClick={() => void generateMinutes()}>Generate / regenerate draft</button>
              <button type="button" className="meetings-primary" disabled={!canEditMinutes || minutesSaveState === "saving"} onClick={() => void saveMinutes()}>
                {minutesSaveState === "saving" ? "Saving…" : "Save draft"}
              </button>
              <button type="button" className="meetings-primary" onClick={openMinutesPreviewWindow} title="Open a formatted A4 report in a separate window">Preview A4 ↗</button>
              <button type="button" onClick={() => setShowMinutesPreview(open => !open)} aria-expanded={showMinutesPreview} aria-controls="meeting-minutes-a4-preview">
                {showMinutesPreview ? "Hide inline preview" : "Inline preview"}
              </button>
              {selected.minutes?.status === "Draft" && selected.reviewer_id && <button type="button" onClick={() => void submitMinutes()}>Submit for review</button>}
              {selected.minutes?.status === "Submitted" && selected.reviewer_id === currentUser.id && <>
                <button type="button" className="meetings-primary" onClick={() => void decideMinutes("Approved")}>Approve & publish</button>
                <button type="button" onClick={() => void decideMinutes("Returned")}>Return with comments</button>
              </>}
            </div>

            <div className="minutes-state minutes-workflow-state" aria-live="polite">
              <span>Status: <b>{selected.minutes?.status || "Not generated"}</b></span>
              <span>Reviewer: <b>{selected.minutes?.reviewer_name || selected.reviewer_name || "Not assigned"}</b></span>
              <span className={`meeting-minutes-save-state is-${minutesSaveState}`}>
                {minutesSaveState === "saving" ? "Saving to meeting record…" :
                  minutesSaveState === "unsaved" ? "Unsaved changes" :
                  minutesSaveState === "error" ? "Save failed" :
                  minutesSavedAt ? "Draft saved" : "No saved draft yet"}
              </span>
              <small>{minutesSavedAt ? `Last saved ${new Date(minutesSavedAt).toLocaleString("en-KE")}` : "No saved draft yet"}</small>
            </div>

            {selected.minutes && ["Draft", "Returned", "Submitted"].includes(selected.minutes.status) && (
              <section className="meeting-minutes-working-draft-receipt" aria-live="polite">
                <div className="meeting-minutes-working-draft-copy">
                  <span className="meeting-minutes-repository-kicker">WORKING DRAFT · NOT APPROVED</span>
                  <strong>{selected.minutes.repository_draft_document_id ? "Draft is linked to Repository" : "Draft has not yet been linked to Repository"}</strong>
                  <span>{selected.minutes.repository_draft_document_title || `[DRAFT] ${selected.title} — Meeting Minutes`}</span>
                  <small>{selected.minutes.status} · Repository category: Working Drafts · Not an official record.</small>
                  {selected.minutes.repository_draft_document_id && <small>Draft record ID: {selected.minutes.repository_draft_document_id}{selected.minutes.repository_draft_version ? ` · Repository v${selected.minutes.repository_draft_version}` : ""}</small>}
                </div>
                {selected.can_manage && <button type="button" disabled={repositoryDraftSyncBusy || ["unsaved", "saving", "error"].includes(minutesSaveState)} onClick={() => void syncMinutesDraftToRepository()}>{repositoryDraftSyncBusy ? "Syncing draft…" : selected.minutes.repository_draft_document_id ? "Refresh Repository draft" : "Make draft visible in Repository"}</button>}
              </section>
            )}
            {selected.minutes?.repository_document_id && selected.minutes.repository_document_status === "Published" && (
              <section className="meeting-minutes-repository-receipt" aria-live="polite">
                <div className="meeting-minutes-repository-receipt-copy">
                  <span className="meeting-minutes-repository-kicker">OFFICIAL REPOSITORY RECORD</span>
                  <strong>{selected.minutes.repository_minutes_version === selected.minutes.version_no
                    ? "This minutes version is published"
                    : "The latest approved version remains published"}</strong>
                  <span>{selected.minutes.repository_document_title || "Approved Meeting Minutes"}</span>
                  <small>
                    {selected.minutes.repository_record_number || selected.minutes.repository_document_id}
                    {selected.minutes.repository_version ? ` · Repository v${selected.minutes.repository_version}` : ""}
                    {selected.minutes.repository_minutes_version ? ` · Minutes v${selected.minutes.repository_minutes_version}` : ""}
                  </small>
                  <small>Repository category: Meeting & Workshop Reports · source: Other / Uploaded Documents. Draft and returned versions are not published.</small>
                </div>
                <div className="meeting-minutes-repository-receipt-actions">
                  <button type="button" onClick={() => void copyRepositoryRecordId(selected.minutes!.repository_document_id!)}>Copy record ID</button>
                  {canReconcileApprovedMinutes && <button type="button" disabled={repositoryPublishBusy} onClick={() => void reconcileApprovedMinutesPublication()}>{repositoryPublishBusy ? "Verifying…" : "Verify Repository listing"}</button>}
                </div>
              </section>
            )}
            {repositoryPublicationNotice && <div className="meeting-minutes-publication-notice" role="status">{repositoryPublicationNotice}</div>}
            {selected.minutes?.status === "Approved" && !selected.minutes.repository_document_id && canReconcileApprovedMinutes && (
              <section className="meeting-minutes-repository-repair" aria-live="polite">
                <div><strong>Approval is recorded, but Repository publication is not linked.</strong><p>Retrying checks for an existing version first. It publishes only a version whose approval is already recorded and does not change the approval decision.</p></div>
                <button type="button" disabled={repositoryPublishBusy} onClick={() => void reconcileApprovedMinutesPublication()}>{repositoryPublishBusy ? "Checking Repository…" : "Retry approved publication"}</button>
              </section>
            )}

            <div className="meeting-minutes-authoring-layout">
              <section className="meeting-minutes-editor-column" aria-label="Meeting minutes authoring">
                <div className="meeting-minutes-pane-heading">
                  <div className="meeting-minutes-heading-copy">
                    <span className="meeting-minutes-eyebrow">PSC · MEETING RECORD</span>
                    <h4>{selected.title} — Minutes</h4>
                    <p>Write, format and save the official record here. Save the draft before sending it to the assigned reviewer.</p>
                  </div>
                  <span className="meeting-minutes-paper-label">PSC · Official record</span>
<div className="meeting-minutes-preview-actions">
                    <button
                      type="button"
                      disabled={!selected.minutes || ["unsaved", "saving", "error"].includes(minutesSaveState)}
                      title={!selected.minutes ? "Save or generate minutes first." : ["unsaved", "saving", "error"].includes(minutesSaveState) ? "Save the latest minutes before PDF export." : "Download the current saved minutes version as a PSC-branded PDF."}
                      onClick={() => void downloadMinutesPdf()}
                    >Download PDF</button>
                  </div>
                </div>

                <div className="meeting-minutes-formatting-toolbar" role="toolbar" aria-label="Minutes document formatting">
                  <div className="meeting-minutes-tool-group" role="group" aria-label="History">
                    <button type="button" title="Undo" aria-label="Undo" disabled={!canEditMinutes} onClick={() => runMinutesEditorCommand("undo")}>↶</button>
                    <button type="button" title="Redo" aria-label="Redo" disabled={!canEditMinutes} onClick={() => runMinutesEditorCommand("redo")}>↷</button>
                  </div>
                  <span className="meeting-minutes-tool-divider" aria-hidden="true" />
                  <div className="meeting-minutes-tool-group" role="group" aria-label="Text emphasis">
                    <button type="button" title="Bold" aria-label="Bold" disabled={!canEditMinutes} onClick={() => runMinutesEditorCommand("bold")}><b>B</b></button>
                    <button type="button" title="Italic" aria-label="Italic" disabled={!canEditMinutes} onClick={() => runMinutesEditorCommand("italic")}><i>I</i></button>
                    <button type="button" title="Underline" aria-label="Underline" disabled={!canEditMinutes} onClick={() => runMinutesEditorCommand("underline")}><u>U</u></button>
                    <button type="button" title="Strikethrough" aria-label="Strikethrough" disabled={!canEditMinutes} onClick={() => runMinutesEditorCommand("strikeThrough")}><s>S</s></button>
                    <button type="button" title="Clear formatting" aria-label="Clear formatting" disabled={!canEditMinutes} onClick={() => runMinutesEditorCommand("removeFormat")}>Tx</button>
                  </div>
                  <span className="meeting-minutes-tool-divider" aria-hidden="true" />
                  <label className="meeting-minutes-tool-select">Style
                    <select aria-label="Paragraph style" disabled={!canEditMinutes} defaultValue="p" onChange={event => { runMinutesEditorCommand("formatBlock", event.currentTarget.value); event.currentTarget.value = "p"; }}>
                      <option value="p">Paragraph</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="blockquote">Quote</option>
                    </select>
                  </label>
                  <label className="meeting-minutes-tool-select">Size
                    <select aria-label="Font size" disabled={!canEditMinutes} defaultValue="12" onChange={event => { runMinutesEditorCommand("fontSize", event.currentTarget.value); event.currentTarget.value = "12"; }}>
                      <option value="10">10</option><option value="11">11</option><option value="12">12</option><option value="14">14</option><option value="16">16</option><option value="18">18</option><option value="24">24</option>
                    </select>
                  </label>
                  <label className="meeting-minutes-tool-select">Font
                    <select aria-label="Font family" disabled={!canEditMinutes} defaultValue="Arial" onChange={event => { runMinutesEditorCommand("fontName", event.currentTarget.value); event.currentTarget.value = "Arial"; }}>
                      <option value="Arial">Arial</option><option value="Calibri">Calibri</option><option value="Georgia">Georgia</option><option value="Times New Roman">Times New Roman</option>
                    </select>
                  </label>
                  <span className="meeting-minutes-tool-divider" aria-hidden="true" />
                  <div className="meeting-minutes-tool-group" role="group" aria-label="Lists and layout">
                    <button type="button" title="Bulleted list" aria-label="Bulleted list" disabled={!canEditMinutes} onClick={() => runMinutesEditorCommand("insertUnorderedList")}>• List</button>
                    <button type="button" title="Numbered list" aria-label="Numbered list" disabled={!canEditMinutes} onClick={() => runMinutesEditorCommand("insertOrderedList")}>1. List</button>
                    <button type="button" title="Align left" aria-label="Align left" disabled={!canEditMinutes} onClick={() => runMinutesEditorCommand("justifyLeft")}>⇤</button>
                    <button type="button" title="Centre" aria-label="Centre" disabled={!canEditMinutes} onClick={() => runMinutesEditorCommand("justifyCenter")}>≡</button>
                    <button type="button" title="Align right" aria-label="Align right" disabled={!canEditMinutes} onClick={() => runMinutesEditorCommand("justifyRight")}>⇥</button>
                    <button type="button" title="Indent" aria-label="Indent" disabled={!canEditMinutes} onClick={() => runMinutesEditorCommand("indent")}>→</button>
                    <button type="button" title="Outdent" aria-label="Outdent" disabled={!canEditMinutes} onClick={() => runMinutesEditorCommand("outdent")}>←</button>
                    <button type="button" title="Insert table" aria-label="Insert table" disabled={!canEditMinutes} onClick={() => runMinutesEditorCommand("insertTable")}>▦ Table</button>
                    <button type="button" title="Insert link" aria-label="Insert link" disabled={!canEditMinutes} onClick={() => { const href = window.prompt("Enter a web address or email link"); if (href) runMinutesEditorCommand("createLink", href); }}>Link</button>
                    <button type="button" title="Remove link" aria-label="Remove link" disabled={!canEditMinutes} onClick={() => runMinutesEditorCommand("unlink")}>Unlink</button>
                  </div>
                </div>

                <div className="meeting-minutes-quick-tools" role="toolbar" aria-label="Insert minutes sections">
                  <span className="meeting-minutes-tools-label">Insert section</span>
                  <button type="button" disabled={!canEditMinutes} onClick={() => appendMinutesSection("<h2>Discussion record</h2><p><br></p>")}>Discussion</button>
                  <button type="button" disabled={!canEditMinutes} onClick={() => appendMinutesSection("<h2>Decisions</h2><p><br></p>")}>Decisions</button>
                  <button type="button" disabled={!canEditMinutes} onClick={() => appendMinutesSection("<h2>Actions and follow-up</h2><table><thead><tr><th>Action</th><th>Owner</th><th>Due date</th><th>Status</th></tr></thead><tbody><tr><td><br></td><td><br></td><td><br></td><td>Open</td></tr></tbody></table>")}>Action table</button>
                  <button type="button" disabled={!canEditMinutes} onClick={() => appendMinutesSection("<h2>Next meeting</h2><p>Date, time and venue to be confirmed.</p>")}>Next meeting</button>
                </div>

                <div className="meeting-minutes-editor-canvas">
                  <App2LexicalReportEditor
                    ref={minutesEditorRef}
                    value={minutesContentToEditorHtml(minutesText)}
                    onChange={handleMinutesEditorChange}
                    onImmediateChange={handleMinutesEditorImmediateChange}
                    ariaLabel="Meeting minutes rich text editor"
                    className="meeting-minutes-report-editor"
                    editable={canEditMinutes}
                  />
                </div>

                {showMinutesPreview && <section id="meeting-minutes-a4-preview" className="meeting-minutes-live-preview" aria-label="A4 document preview">
                  <header className="meeting-minutes-preview-heading">
                    <div><strong>A4 document preview</strong><span>Print-ready layout · preview does not change the saved draft</span></div>
                    <div className="meeting-minutes-preview-actions">
                      <button type="button" onClick={printMinutesPreview}>Print</button>
                      <button type="button" onClick={() => setShowMinutesPreview(false)}>Close preview</button>
                    </div>
                  </header>
                  <div className="meeting-minutes-preview-panel">
                    <iframe ref={minutesPreviewFrameRef} className="meeting-minutes-preview-frame" title="Live meeting minutes A4 preview" sandbox="allow-same-origin allow-modals" referrerPolicy="no-referrer" srcDoc={buildMinutesPreviewDocument(minutesText)} />
                  </div>
                </section>}
              </section>
            </div>
          </div>}

          {tab === "Decisions & Actions" && <div className="meeting-panel decision-grid">
            <section><h4>Decisions</h4><div className="meeting-form-row compact"><input value={decisionText} onChange={e=>setDecisionText(e.target.value)} placeholder="Record decision / resolution"/><button onClick={()=>void addDecision()}>Add</button></div><div className="meeting-stack">{selected.decisions.map(d=><article key={d.id}><b>Decision {d.decision_no}</b><span>{d.text}</span></article>)}</div></section>
            <section><h4>Action items</h4><div className="meeting-action-form"><input value={actionForm.title} onChange={e=>setActionForm({...actionForm,title:e.target.value})} placeholder="Action"/><input value={actionForm.description} onChange={e=>setActionForm({...actionForm,description:e.target.value})} placeholder="Description"/><select value={actionForm.ownerId} onChange={e=>setActionForm({...actionForm,ownerId:e.target.value})}><option value="">Owner</option>{users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select><input type="date" value={actionForm.dueDate} onChange={e=>setActionForm({...actionForm,dueDate:e.target.value})}/><button onClick={()=>void addAction()}>Add action</button></div><div className="meeting-stack">{selected.actions.map(a=><article key={a.id}><b>{a.title}</b><span>{a.description}</span><small>{a.owner_name || "No owner"} · {a.due_date || "No due date"} · {a.status}</small>{a.status!=="Completed"&&<button onClick={async()=>{await meetingsApi.updateAction(token,selected.id,a.id,"Completed");setSelected(await meetingsApi.detail(token,selected.id));}}>Complete</button>}</article>)}</div></section>
          </div>}

          {tab === "Documents" && <div className="meeting-panel meeting-minutes-documents-panel">
            <header className="meeting-minutes-documents-header">
              <div><span className="meeting-minutes-eyebrow">MEETING DOCUMENTS</span><h4>Official records and publication</h4><p>Drafts remain in the meeting record. The official PDF is published to Repository only after authorised approval.</p></div>
              <button type="button" onClick={() => setTab("Minutes")}>Open minutes workspace</button>
            </header>
            <section className="meeting-supporting-documents" aria-label="Supporting documents">
              <header><div><span>SUPPORTING PAPERS</span><h4>Memos, briefs and agenda documents</h4><p>Files listed here are included as attachments when meeting invitations and updates are emailed. Participants can also download them from this tab.</p></div></header>
              {supportingDocumentNotice&&<div className="meeting-supporting-document-notice" role="status">{supportingDocumentNotice}</div>}
              {selected.can_manage&&<div className="meeting-supporting-document-upload">
                <label>Add supporting documents<input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.rtf,.txt" disabled={supportingUploadBusy} onChange={event=>{const picked=Array.from(event.target.files||[]);if(selected.supporting_documents.length+picked.length>10){setSupportingDocumentNotice("A meeting can have up to 10 supporting documents.");event.currentTarget.value="";return;}if([...supportingFiles,...picked].reduce((sum,file)=>sum+file.size,selected.supporting_documents.reduce((sum,item)=>sum+Number(item.size_bytes||0),0))>18*1024*1024){setSupportingDocumentNotice("Supporting documents for a meeting are limited to 18 MB in total.");event.currentTarget.value="";return;}setSupportingFiles(current=>[...current,...picked]);setSupportingDocumentNotice("");event.currentTarget.value="";}}/><small>PDF, Word, Excel, PowerPoint, RTF or TXT · 10 files · 18 MB total</small></label>
                {supportingFiles.length>0&&<button type="button" className="meetings-primary" disabled={supportingUploadBusy} onClick={()=>void uploadSupportingDocuments(selected.id,supportingFiles).then(()=>setSupportingFiles([])).catch(error=>setSupportingDocumentNotice(error instanceof Error?error.message:"Supporting documents could not be uploaded."))}>{supportingUploadBusy?"Uploading…":`Upload ${supportingFiles.length} document${supportingFiles.length===1?"":"s"}`}</button>}
              </div>}
              {selected.supporting_documents.length>0?<div className="meeting-supporting-document-list">{selected.supporting_documents.map(attachment=><article key={attachment.id}><div><strong>{attachment.original_filename}</strong><small>{(Number(attachment.size_bytes)/1024/1024).toFixed(2)} MB · Added by {attachment.uploaded_by_name||"Meeting manager"} · {new Date(attachment.created_at).toLocaleDateString("en-KE")}</small></div><div><button type="button" onClick={()=>void meetingsApi.downloadAttachment(token,selected.id,attachment).catch(error=>setSupportingDocumentNotice(error instanceof Error?error.message:"Document download failed."))}>Download</button>{selected.can_manage&&<button type="button" disabled={supportingUploadBusy} onClick={async()=>{try{await meetingsApi.deleteAttachment(token,selected.id,attachment.id);setSelected(await meetingsApi.detail(token,selected.id));setSupportingDocumentNotice("Supporting document removed.");}catch(error){setSupportingDocumentNotice(error instanceof Error?error.message:"Supporting document could not be removed.");}}}>Remove</button>}</div></article>)}</div>:<div className="meeting-supporting-document-empty">No supporting documents attached yet. Add the memo or briefing papers before sending invitations.</div>}
            </section>
            {selected.minutes && ["Draft", "Returned", "Submitted"].includes(selected.minutes.status) && (
              <article className="meeting-minutes-repository-draft-document">
                <span className="meeting-minutes-repository-kicker">WORKING COPY · NOT APPROVED</span>
                <strong>{selected.minutes.repository_draft_document_title || `[DRAFT] ${selected.title} — Meeting Minutes`}</strong>
                <span>Workflow status: {selected.minutes.status}</span>
                <span>{selected.minutes.repository_draft_document_id ? `Repository draft version: ${selected.minutes.repository_draft_version || "Not available"}` : "Not yet visible in Repository. Save the draft or use Sync to Repository below."}</span>
                <p>This document is explicitly marked as a working draft. It is not the official record and cannot be treated as approved minutes.</p>
                {selected.can_manage && <button type="button" disabled={repositoryDraftSyncBusy || ["unsaved", "saving", "error"].includes(minutesSaveState)} onClick={() => void syncMinutesDraftToRepository()}>{repositoryDraftSyncBusy ? "Syncing draft…" : selected.minutes.repository_draft_document_id ? "Refresh Repository draft" : "Sync draft to Repository"}</button>}
              </article>
            )}
            {selected.minutes?.repository_document_id && selected.minutes.repository_document_status === "Published" ? (
              <article className="meeting-minutes-repository-document">
                <span className="meeting-minutes-repository-kicker">PUBLISHED · OFFICIAL RECORD</span>
                <strong>{selected.minutes.repository_document_title || `${selected.title} — Approved Meeting Minutes`}</strong>
                <span>Record number: {selected.minutes.repository_record_number || "Not assigned"}</span>
                <span>Repository version: {selected.minutes.repository_version || "Not available"} · Approved minutes version: {selected.minutes.repository_minutes_version || "Not available"}</span>
                <span>Category: Meeting & Workshop Reports · Source: Other / Uploaded Documents</span>
                <div><button type="button" onClick={() => void copyRepositoryRecordId(selected.minutes!.repository_document_id!)}>Copy Repository document ID</button><button type="button" onClick={() => setTab("Minutes")}>View publication receipt</button></div>
              </article>
            ) : (
              <div className="meeting-minutes-no-publication">
                <strong>No approved minutes document in Repository yet</strong>
                <p>{selected.minutes?.status === "Submitted"
                  ? "Minutes are awaiting reviewer decision. Approval will publish the official version."
                  : selected.minutes?.status === "Returned"
                    ? "The minutes were returned for correction. Save the corrected draft and resubmit it for approval."
                    : selected.minutes?.status === "Approved"
                      ? "The approval is recorded, but the Repository receipt is missing. The recorded approver or an authorised meeting manager can reconcile publication from this screen."
                      : "Save the draft here to persist it in the meeting record. It will not appear in Repository as an official document until the authorised reviewer approves it."}</p>
                {canReconcileApprovedMinutes && <button type="button" disabled={repositoryPublishBusy} onClick={() => void reconcileApprovedMinutesPublication()}>{repositoryPublishBusy ? "Checking Repository…" : "Retry approved publication"}</button>}
              </div>
            )}
          </div>}
          {tab === "Audit" && <div className="meeting-panel meetings-empty">Meeting audit events are already recorded server-side. A dedicated institutional timeline will be surfaced in the next integration stage.</div>}
        </section>
      )}

      {liveOpen && selected && <LiveMeetingRoom token={token} meeting={selected} currentUser={currentUser} users={users} onClose={() => setLiveOpen(false)} onChanged={(fresh) => { setSelected(fresh); setMeetings(rows => rows.map(row => row.id === fresh.id ? { ...row, ...fresh } : row)); }} />}

      {participantPickerOpen && <div className="meeting-participant-picker-backdrop" role="presentation" onMouseDown={() => setParticipantPickerOpen(false)}>
        <section className="meeting-participant-picker" role="dialog" aria-modal="true" aria-label="Select meeting participants" onMouseDown={e => e.stopPropagation()}>
          <header>
            <div>
              <small>PARTICIPANTS & INVITATIONS</small>
              <h3>{participantPickerMode === "create" ? "Select invited members" : "Add meeting participants"}</h3>
              <span>Search the REDESY directory, select members and assign their meeting role.</span>
            </div>
            <button type="button" onClick={() => setParticipantPickerOpen(false)}>Close</button>
          </header>

          <div className="meeting-participant-picker-tools">
            <input value={participantSearch} onChange={e => setParticipantSearch(e.target.value)} placeholder="Search name, email, role or division" />
            <select value={participantDivision} onChange={e => setParticipantDivision(e.target.value)}>
              <option value="all">All divisions</option>
              {[...new Set(users.map(u => u.division).filter(Boolean) as string[])].sort().map(division => <option key={division}>{division}</option>)}
            </select>
            <b>{participantSelection.length} selected</b>
          </div>

          <div className="meeting-participant-picker-list">
            {users
              .filter(person => participantPickerMode === "create" || !selected?.participants.some(p => p.user_id === person.id))
              .filter(person => participantDivision === "all" || person.division === participantDivision)
              .filter(person => {
                const q = participantSearch.trim().toLowerCase();
                return !q || [person.name, person.email, person.role, person.division].filter(Boolean).some(value => String(value).toLowerCase().includes(q));
              })
              .map(person => {
                const checked = participantSelection.includes(person.id);
                return <article key={person.id} className={checked ? "selected" : ""}>
                  <label className="meeting-participant-picker-person">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setParticipantSelection(current => current.includes(person.id) ? current.filter(id => id !== person.id) : [...current, person.id])}
                    />
                    <span>
                      <strong>{person.name}</strong>
                      <small>{person.email || "No email"} · {person.division || person.role}</small>
                    </span>
                  </label>
                  <select
                    value={participantRoles[person.id] || "Attendee"}
                    disabled={!checked}
                    onChange={e => setParticipantRoles(current => ({ ...current, [person.id]: e.target.value }))}
                  >
                    {["Attendee","Presenter","Observer","Minutes Reviewer"].map(role => <option key={role}>{role}</option>)}
                  </select>
                </article>;
              })}
          </div>

          <footer>
            <span>{participantSelection.length ? `${participantSelection.length} participant(s) selected` : "No participants selected"}</span>
            <div>
              <button type="button" onClick={() => setParticipantPickerOpen(false)}>Cancel</button>
              <button type="button" className="meetings-primary" disabled={participantBusy || participantSelection.length === 0} title={participantSelection.length === 0 ? "Select at least one participant to continue." : undefined} onClick={() => void applyParticipantPicker()}>
                {participantBusy ? "Applying..." : participantPickerMode === "create" ? "Use selected members" : "Add & send invitations"}
              </button>
            </div>
          </footer>
        </section>
      </div>}

      {createOpen && <div className="meeting-schedule-backdrop"><section className="meeting-schedule-workspace" role="dialog" aria-modal="true" aria-label="Schedule meeting">
        <header className="meeting-schedule-head">
          <div>
            <small>{editingMeetingId ? "RESUBMIT MEETING REQUEST" : "SCHEDULE MEETING"}</small>
            <h3>{editingMeetingId ? "Revise returned meeting request" : "New governed meeting"}</h3>
            <p>Set the schedule and attendees. Calendar publication and participant invitations happen only after an authorized approval.</p>
          </div>
          <button type="button" className="meeting-schedule-close" onClick={()=>setCreateOpen(false)} aria-label="Close">×</button>
        </header>

        <div className="meeting-schedule-body">
          {createError && <div className="meeting-schedule-error" role="alert">{createError}</div>}
          <section className="meeting-schedule-section">
            <div className="meeting-schedule-section-head">
              <div>
                <small>MEETING DETAILS</small>
                <strong>Core meeting information</strong>
                <span>Set the title, type, schedule, location and governance roles.</span>
              </div>
            </div>

            <div className="meeting-schedule-form-groups">
  <section className="meeting-schedule-field-group" aria-label="Meeting overview">
    <div className="meeting-schedule-field-group-head"><span>01</span><div><strong>Meeting overview</strong><small>Identify and classify the meeting.</small></div></div>
    <div className="meeting-schedule-grid">
      <label><span>Meeting title <b className="meeting-schedule-required">*</b></span><input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Enter a clear meeting title"/>{createError&& !form.title.trim()&&<small role="alert">A meeting title is required so invitees can identify the meeting.</small>}</label>
      <label><span>Meeting type <b className="meeting-schedule-required">*</b></span><select required value={form.meetingType} onChange={e=>setForm({...form,meetingType:e.target.value})}><option>Departmental</option><option>Management</option><option>Project</option><option>Research</option><option>Review</option><option>Committee</option></select></label>
      <label><span>Meeting format <b className="meeting-schedule-required">*</b></span><select required value={form.meetingMode} onChange={e=>setForm({...form,meetingMode:e.target.value as "In-person" | "Online" | "Hybrid"})}><option value="In-person">In-person</option><option value="Online">Online</option><option value="Hybrid">Hybrid</option></select></label>
    </div>
  </section>

  <section className="meeting-schedule-field-group" aria-label="Schedule and location">
    <div className="meeting-schedule-field-group-head"><span>02</span><div><strong>Schedule & location</strong><small>All times use East Africa Time (Africa/Nairobi).</small></div></div>
    <div className="meeting-schedule-grid">
      <label><span>Start date and time <b className="meeting-schedule-required">*</b></span><input name="startAt" aria-label="Meeting start date and time" type="datetime-local" required value={form.startAt} onChange={e=>setForm({...form,startAt:e.target.value})}/><small>Choose a future start date and time.</small>{createError&&!form.startAt&&<small role="alert">A start date and time is required so the meeting can be scheduled.</small>}</label>
      <label><span>End date and time <b className="meeting-schedule-required">*</b></span><input name="endAt" aria-label="Meeting end date and time" type="datetime-local" required min={form.startAt || undefined} value={form.endAt} onChange={e=>setForm({...form,endAt:e.target.value})}/><small>Must be later than the start.</small>{createError&&!form.endAt&&<small role="alert">An end date and time is required to reserve the meeting duration.</small>}</label>
      {(form.meetingMode === "In-person" || form.meetingMode === "Hybrid") && <label><span>Physical venue <b className="meeting-schedule-required">*</b></span><input required value={form.venue} onChange={e=>setForm({...form,venue:e.target.value})} placeholder="Building, room or venue"/></label>}
      {(form.meetingMode === "Online" || form.meetingMode === "Hybrid") && <label><span>Online meeting join link <b className="meeting-schedule-required">*</b></span><input type="url" inputMode="url" required value={form.meetingLink} onChange={e=>setForm({...form,meetingLink:e.target.value})} placeholder="https://..."/><small>Paste the real HTTPS join link; REDESY will not invent provider links.</small></label>}
      <label className="meeting-schedule-field-wide"><span>Supporting links <em>(optional)</em></span><textarea className="meeting-schedule-links" value={form.resourceLinks} onChange={e=>setForm({...form,resourceLinks:e.target.value})} placeholder="One HTTPS URL per line"/><small>Use for agenda documents, briefs or reference material. Maximum 10 links.</small></label>
      <div className="meeting-schedule-field-wide meeting-supporting-document-picker">
        <label><span>Supporting documents <em>(optional)</em></span><input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.rtf,.txt" disabled={createBusy||supportingUploadBusy} onChange={event=>{const picked=Array.from(event.target.files||[]);const combined=[...supportingFiles,...picked];if(combined.length+(editingMeetingId?selected?.supporting_documents?.length||0:0)>10){setCreateError("A meeting can have up to 10 supporting documents.");event.currentTarget.value="";return;}if(combined.reduce((sum,file)=>sum+file.size,0)>18*1024*1024){setCreateError("Supporting documents for a meeting are limited to 18 MB in total.");event.currentTarget.value="";return;}setCreateError("");setSupportingFiles(combined);event.currentTarget.value="";}}/><small>Attach memos, briefs and agenda papers. PDF, Word, Excel, PowerPoint, RTF and TXT files are supported; up to 10 files and 18 MB total. Documents will be attached to invitation emails.</small></label>
        {supportingFiles.length>0&&<ul>{supportingFiles.map((file,index)=><li key={`${file.name}-${file.lastModified}-${index}`}><span>{file.name} · {(file.size/1024/1024).toFixed(2)} MB</span><button type="button" disabled={createBusy||supportingUploadBusy} onClick={()=>setSupportingFiles(current=>current.filter((_,itemIndex)=>itemIndex!==index))}>Remove</button></li>)}</ul>}
      </div>
    </div>
  </section>

  <section className="meeting-schedule-field-group" aria-label="Governance and approval">
    <div className="meeting-schedule-field-group-head"><span>03</span><div><strong>Governance & approval</strong><small>Assign meeting roles and the authorized person who will decide this request.</small></div></div>
    <div className="meeting-schedule-grid">
      <label><span>Scheduling approver <b className="meeting-schedule-required">*</b></span><select required value={form.scheduleApproverId} onChange={e=>setForm({...form,scheduleApproverId:e.target.value})}><option value="">Choose supervisor / appointed approver</option>{scheduleApprovers.map(item=><option key={item.id} value={item.id}>{item.name} · {item.source}{item.expires_at ? ` (until ${new Date(item.expires_at).toLocaleDateString()})` : ""}</option>)}</select>{scheduleApprovers.length===0 && <small>{currentUser.role === "System Admin" ? "No approver is appointed for your account. Use “Set my meeting approver” above, choose a different active user and set an expiry date." : "No authorized approver is configured for your account. Ask your supervisor or a System Admin to appoint one."}{scheduleApproverLoadError&&` Setup error: ${scheduleApproverLoadError}`}</small>}{scheduleApproverLoadError&&<small role="alert">Approver setup could not fully load: {scheduleApproverLoadError}</small>}</label>
      <label><span>Meeting chair <b className="meeting-schedule-required">*</b></span><select required value={form.chairId} onChange={e=>setForm({...form,chairId:e.target.value})}><option value="">Choose a chair</option>{users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>{users.length===0&&<small role="alert">A chair cannot be selected because the active user directory is empty or failed to load. {scheduleApproverLoadError||"Refresh Meetings or ask an administrator to check directory access."}</small>}</label>
      <label><span>Secretary <em>(optional)</em></span><select value={form.secretaryId} onChange={e=>setForm({...form,secretaryId:e.target.value})}><option value="">Not assigned</option>{users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
      <label><span>Minutes reviewer <em>(optional)</em></span><select value={form.reviewerId} onChange={e=>setForm({...form,reviewerId:e.target.value})}><option value="">Assign later</option>{users.filter(u=>u.id!==currentUser.id).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
    </div>
  </section>
</div>
          </section>

          <section className="meeting-schedule-section meeting-schedule-participants">
            <div className="meeting-schedule-section-head">
              <div>
                <small>PARTICIPANTS & INVITATIONS</small>
                <strong>{createParticipantIds.length ? `${createParticipantIds.length} selected` : "Select members expected to attend"}</strong>
                <span>Selected members receive REDESY notifications and email invitations after the schedule is approved.</span>
              </div>
              <button type="button" onClick={() => openParticipantPicker("create")}>{createParticipantIds.length ? "Edit participants" : "Select participants"}</button>
            </div>

            {createParticipantIds.length > 0
              ? <div className="meeting-schedule-participant-chips">
                  {createParticipantIds.slice(0,8).map(id => {
                    const person = users.find(u => u.id === id);
                    return <span key={id}>{person?.name || "REDESY user"} · {createParticipantRoles[id] || "Attendee"}</span>;
                  })}
                  {createParticipantIds.length > 8 && <span>+{createParticipantIds.length - 8} more</span>}
                </div>
              : <div className="meeting-schedule-participant-empty">No participants selected yet.</div>}
          </section>

          <section className="meeting-schedule-section">
            <div className="meeting-schedule-section-head">
              <div>
                <small>PURPOSE & CONTEXT</small>
                <strong>Meeting purpose / description</strong>
                <span>Record the purpose, context or expected outcome for participants and minutes.</span>
              </div>
            </div>
            <textarea className="meeting-schedule-description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
          </section>
        </div>

        <footer className="meeting-schedule-footer">
          <span>{createParticipantIds.length ? `${createParticipantIds.length} participant(s) selected` : "Participants can be added before scheduling."}</span>
          <div>
            <button type="button" onClick={()=>setCreateOpen(false)} disabled={createBusy}>Cancel</button>
            <button type="button" className="meetings-primary" title="Schedule & send invitations after approval" onClick={()=>void createMeeting()} disabled={createBusy}>{createBusy ? "Submitting…" : editingMeetingId ? "Resubmit for approval" : "Submit for approval"}</button>
          </div>
        </footer>
      </section></div>}
    </div>
  );
}

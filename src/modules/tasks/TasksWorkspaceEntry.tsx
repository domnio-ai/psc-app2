import { useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  type ApiAssignment,
  type ApiAssignmentTask,
  type ApiAssignmentTaskRequest,
  type ApiTaskRequestAssignment,
  type ApiTaskRequestReviewer,
  type ApiUser,
} from "../../api";
import "./tasks-workspace.css";
import "./tasks-dashboard-standard.css";
import TasksCommandCentre, { taskMatchesCommandFocus, type TaskCommandFocus } from "./TasksCommandCentre";
import type { TaskDashboardShortcut } from "./taskDashboardShortcut";

import "./tasks-command-centre-v5.css";
type Props = {
  token: string;
  active: boolean;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  isManager: boolean;
  onOpenTask: (taskId: string) => void | Promise<void>;
  prefillRequestAssignmentId?: string | null;
  onPrefillRequestConsumed?: () => void;
  requestedTaskRequestView?: "Task Requests" | "Requests for Approval" | null;
  onRequestedTaskRequestViewConsumed?: () => void;
  requestedTaskRequestTarget?: { requestId: string; intent: "approval" | "focus" } | null;
  onRequestedTaskRequestTargetConsumed?: () => void;
  requestedDashboardTaskShortcut?: TaskDashboardShortcut | null;
  onRequestedDashboardTaskShortcutConsumed?: () => void;
};

type View =
  | "My Tasks"
  | "For Review"
  | "Task Requests"
  | "Requests for Approval"
  | "Team Scope"
  | "All Permitted";

type StatusFilter =
  | "Active"
  | "All"
  | "Not Started"
  | "In Progress"
  | "Blocked"
  | "Completed";

type RequestDraft = {
  assignmentId: string;
  title: string;
  description: string;
  suggestedOwnerId: string;
  priority: string;
  dueDate: string;
  reason: string;
};

type ApprovalDraft = {
  title: string;
  description: string;
  ownerId: string;
  reviewerId: string;
  priority: string;
  startDate: string;
  dueDate: string;
  notes: string;
  comments: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyRequest = (): RequestDraft => ({
  assignmentId: "",
  title: "",
  description: "",
  suggestedOwnerId: "",
  priority: "Normal",
  dueDate: "",
  reason: "",
});

const emptyApproval = (): ApprovalDraft => ({
  title: "",
  description: "",
  ownerId: "",
  reviewerId: "",
  priority: "Normal",
  startDate: today(),
  dueDate: "",
  notes: "",
  comments: "",
});

const emptyDirectAssignment = () => ({
  assignmentId: "",
  title: "",
  description: "",
  ownerId: "",
  priority: "Normal",
  startDate: today(),
  dueDate: "",
});

const dateOnly = (value?: string | null) => {
  if (!value) return "";
  const raw = String(value);
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || "";
};

const dueMeta = (task: ApiAssignmentTask) => {
  if (!task.due_date) return { label: "No due date", state: "none" };
  if (task.status === "Completed") return { label: "Completed", state: "completed" };
  const due = new Date(`${dateOnly(task.due_date)}T23:59:59`).getTime();
  const days = Math.ceil((due - Date.now()) / 86400000);
  if (days < 0) return { label: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`, state: "overdue" };
  if (days === 0) return { label: "Due today", state: "today" };
  if (days <= 3) return { label: `${days} day${days === 1 ? "" : "s"} left`, state: "soon" };
  return { label: new Date(task.due_date).toLocaleDateString("en-KE"), state: "normal" };
};

const reportLabel = (task: ApiAssignmentTask) => {
  switch (task.contribution_status) {
    case "Ready for Integration": return "Awaiting review";
    case "Integrated": return "Approved";
    case "Accepted": return "Final";
    default: return "Draft";
  }
};

type OfflineRtfLine = { text: string; bold?: boolean; size?: number };

const rtfEscape = (value: string) => Array.from(value).map((character) => {
  if (character === "\\") return "\\\\";
  if (character === "{") return "\\{";
  if (character === "}") return "\\}";
  if (character === "\r") return "";
  if (character === "\n") return "\\line ";
  const codePoint = character.codePointAt(0) || 32;
  if (codePoint >= 32 && codePoint <= 126) return character;
  const units = codePoint > 0xffff
    ? [0xd800 + ((codePoint - 0x10000) >> 10), 0xdc00 + ((codePoint - 0x10000) & 0x3ff)]
    : [codePoint];
  return units.map((unit) => `\\u${unit > 32767 ? unit - 65536 : unit}?`).join("");
}).join("");

const safeOfflineFilename = (value: string) =>
  value.normalize("NFKD").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/\s+/g, " ").trim().slice(0, 80) || "App2_Task";

const offlineDraftText = (value?: string | null) => {
  if (!value) return "";
  const parsed = new DOMParser().parseFromString(value, "text/html");
  parsed.querySelectorAll("br").forEach((node) => node.replaceWith(parsed.createTextNode("\n")));
  parsed.querySelectorAll("p,div,li,h1,h2,h3,h4,blockquote,tr").forEach((node) => node.append(parsed.createTextNode("\n")));
  return (parsed.body.textContent || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
};

const downloadOfflineWorkPack = (
  filename: string,
  heading: string,
  fields: Array<[string, string | null | undefined]>,
  authorizationNote: string,
  existingDraft: Array<[string, string | null | undefined]> = [],
) => {
  const lines: OfflineRtfLine[] = [
    { text: "APP2 OFFLINE TASK WORK PACK", bold: true, size: 30 },
    { text: heading, bold: true, size: 26 },
    { text: "Working copy generated from the task record in APP2. This file does not submit a report, approve work, or mark a task complete." },
    { text: authorizationNote, bold: true },
    { text: "TASK DETAILS", bold: true, size: 24 },
    ...fields.map(([label, value]) => ({ text: `${label}: ${String(value || "Not specified")}` })),
    { text: "EXISTING DRAFT CONTENT", bold: true, size: 24 },
    ...(existingDraft.length ? existingDraft.map(([label, value]) => ({ text: `${label}: ${String(value || "Not entered")}` })) : [{ text: "No existing report draft content was available on this record." }]),
    { text: "OFFLINE WORK / REPORT", bold: true, size: 24 },
    { text: "Work performed / methodology", bold: true },
    { text: "________________________________________________________________________________" },
    { text: "Findings and analysis", bold: true },
    { text: "________________________________________________________________________________" },
    { text: "Recommendations", bold: true },
    { text: "________________________________________________________________________________" },
    { text: "Evidence and sources reviewed", bold: true },
    { text: "________________________________________________________________________________" },
    { text: "Challenges and limitations", bold: true },
    { text: "________________________________________________________________________________" },
    { text: "Next actions", bold: true },
    { text: "________________________________________________________________________________" },
    { text: "Prepared by / date", bold: true },
    { text: "________________________________________________________________________________" },
    { text: "RETURN TO APP2", bold: true, size: 24 },
    { text: "When finished, return to APP2 and enter or paste the completed work into the Task Report, attach any required evidence, and submit it through the existing reviewer workflow. The offline file is not the official submitted version; review, approval, and Repository publication remain governed by APP2." },
  ];
  const rtf = String.raw`{\rtf1\ansi\deff0{\fonttbl{\f0 Aptos;}}\viewkind4\uc1\f0\fs22 ${lines.map((line) => `\pard\sa120\fs${line.size || 22}${line.bold ? "\b " : " "}${rtfEscape(line.text)}${line.bold ? "\b0" : ""}\par`).join(" ")}\pard\sa120\fs18\i Generated from APP2\i0\par}`;
  const blob = new Blob([rtf], { type: "application/rtf;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeOfflineFilename(filename)}.rtf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const downloadTaskRequestPack = (request: ApiAssignmentTaskRequest) => {
  const authorizationNote = request.status === "Pending"
    ? "AUTHORIZATION: This request is still pending supervisor approval. Do not commence the task until it is approved and an active Task is available in APP2."
    : request.status === "Approved"
      ? "AUTHORIZATION: This request has been approved. Use this file only as an external working copy and return the completed work to the active Task Report in APP2."
      : `REFERENCE ONLY: The request status is ${request.status}. Do not treat this document as authorization to begin work.`;
  downloadOfflineWorkPack(`App2_Task_Request_${request.title}`, `TASK REQUEST: ${request.title}`, [
    ["Request ID", request.id],
    ["Related assignment", request.assignment_title],
    ["Requested by", request.requested_by_name],
    ["Suggested owner", request.suggested_owner_name],
    ["Priority", request.priority],
    ["Requested due date", dateOnly(request.due_date)],
    ["Request status", request.status],
    ["Created", dateOnly(request.created_at)],
    ["Approved task", request.task_title],
    ["Task ID", request.task_id],
    ["Purpose / instructions", request.description],
    ["Reason for request", request.reason],
    ["Decision by", request.reviewed_by_name],
    ["Decision date", dateOnly(request.reviewed_at)],
    ["Decision comments", request.review_comments],
  ], authorizationNote);
};

const downloadTaskPack = (task: ApiAssignmentTask) => downloadOfflineWorkPack(
  `App2_Task_${task.title}`,
  `TASK: ${task.title}`,
  [
    ["Task ID", task.id],
    ["Related assignment", task.assignment_title],
    ["Owner", task.owner_name],
    ["Reviewer", task.reviewer_name],
    ["Priority", task.priority],
    ["Work status", task.status],
    ["Report status", reportLabel(task)],
    ["Start date", dateOnly(task.start_date)],
    ["Due date", dateOnly(task.due_date)],
    ["Task purpose", task.task_purpose],
    ["Description", task.description],
    ["Specific instructions", task.specific_instructions],
    ["Expected findings", task.expected_findings],
    ["Expected output", task.expected_output],
    ["Evidence required", task.evidence_required],
    ["Assignment section", task.assignment_section_title],
  ],
  "AUTHORIZATION: This is an active Task record visible to your current APP2 account. Complete work externally only in line with the task instructions and deadline.",
  [
    ["Full report body / blank-mode content", offlineDraftText(task.blank_content || task.contribution_report_html)],
    ["Contribution title", task.contribution_title],
    ["Contribution summary", task.contribution_summary],
    ["Findings", task.contribution_findings],
    ["Recommendations", task.contribution_recommendations],
    ["Evidence reviewed", task.evidence_reviewed],
    ["Challenges", task.contribution_challenges],
    ["Next actions", task.contribution_next_actions],
  ],
);

export default function TasksWorkspaceEntry({
  token,
  active,
  currentUserId,
  currentUserName,
  currentUserRole,
  isManager,
  onOpenTask,
  prefillRequestAssignmentId = null,
  onPrefillRequestConsumed,
  requestedTaskRequestView = null,
  onRequestedTaskRequestViewConsumed,
  requestedTaskRequestTarget = null,
  onRequestedTaskRequestTargetConsumed,
  requestedDashboardTaskShortcut = null,
  onRequestedDashboardTaskShortcutConsumed,
}: Props) {
  const [rows, setRows] = useState<ApiAssignmentTask[]>([]);
  const [directAssignableUsers, setDirectAssignableUsers] = useState<ApiUser[]>([]);
  const [approvalAssignableUsers, setApprovalAssignableUsers] = useState<ApiUser[]>([]);
  const [directAssignableUsersLoading, setDirectAssignableUsersLoading] = useState(false);
  const [approvalAssignableUsersLoading, setApprovalAssignableUsersLoading] = useState(false);
  const [requests, setRequests] = useState<ApiAssignmentTaskRequest[]>([]);
  const [requestAssignments, setRequestAssignments] = useState<ApiTaskRequestAssignment[]>([]);
  const [managerAssignments, setManagerAssignments] = useState<ApiAssignment[]>([]);
  const [reviewers, setReviewers] = useState<ApiTaskRequestReviewer[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestsReady, setRequestsReady] = useState(false);
  const handledRequestTargetRef = useRef<string | null>(null);
  const [requestBusy, setRequestBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<View>("My Tasks");
  const [dashboardShortcut, setDashboardShortcut] = useState<TaskDashboardShortcut | null>(null);
  const [status, setStatus] = useState<StatusFilter>("Active");
  const [search, setSearch] = useState("");
  const [taskCommandFocus, setTaskCommandFocus] = useState<TaskCommandFocus | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestDraft, setRequestDraft] = useState<RequestDraft>(emptyRequest);
  const [requestAssignmentLocked, setRequestAssignmentLocked] = useState(false);
  const [approvalRequest, setApprovalRequest] = useState<ApiAssignmentTaskRequest | null>(null);
  const [approvalDraft, setApprovalDraft] = useState<ApprovalDraft>(emptyApproval);
  const [directAssignOpen, setDirectAssignOpen] = useState(false);
  const [directAssignDraft, setDirectAssignDraft] = useState(emptyDirectAssignment);
  const [directAssignError, setDirectAssignError] = useState("");

  const refresh = async () => {
    const [taskRows, requestRows, assignmentRows] = await Promise.all([
      api.tasks(token),
      api.taskRequests(token),
      api.taskRequestAssignments(token),
    ]);
    setRows(taskRows);
    setRequests(requestRows);
    setRequestAssignments(assignmentRows);
  };

  useEffect(() => {
    if (!active) {
      setRequestsReady(false);
      return;
    }
    let live = true;
    setLoading(true);
    setRequestsReady(false);
    setError("");
    Promise.all([
      api.tasks(token),
      api.taskRequests(token),
      api.taskRequestAssignments(token),
      isManager ? api.assignments(token) : Promise.resolve([] as ApiAssignment[]),
    ])
      .then(([taskRows, requestRows, assignmentRows, permittedAssignments]) => {
        if (!live) return;
        setRows(taskRows);
        setRequests(requestRows);
        setRequestAssignments(assignmentRows);
        setManagerAssignments(permittedAssignments.filter((item) => !["Completed", "Archived"].includes(item.status)));
        setRequestsReady(true);
      })
      .catch((cause) => {
        if (!live) return;
        setError(cause instanceof Error ? cause.message : "Tasks could not be loaded.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => { live = false; };
  }, [active, token, isManager]);

  useEffect(() => {
    if (!active || !requestedTaskRequestView) return;
    setView(requestedTaskRequestView);
    setDashboardShortcut(null);
    setTaskCommandFocus(null);
    setSearch("");
    setStatus("Active");
    onRequestedTaskRequestViewConsumed?.();
  }, [active, requestedTaskRequestView, onRequestedTaskRequestViewConsumed]);

  useEffect(() => {
    if (!active || !requestedDashboardTaskShortcut) return;
    setView(isManager ? "All Permitted" : "My Tasks");
    setDashboardShortcut(requestedDashboardTaskShortcut);
    setTaskCommandFocus(null);
    setSearch("");
    setStatus("All");
    onRequestedDashboardTaskShortcutConsumed?.();
  }, [active, requestedDashboardTaskShortcut, isManager, onRequestedDashboardTaskShortcutConsumed]);

  useEffect(() => {
    if (!active || !isManager || !directAssignOpen || !directAssignDraft.assignmentId) {
      setDirectAssignableUsers([]);
      setDirectAssignableUsersLoading(false);
      return;
    }

    let live = true;
    setDirectAssignableUsersLoading(true);
    setDirectAssignError("");

    api.assignmentTaskAssignableUsers(token, directAssignDraft.assignmentId)
      .then((users) => {
        if (!live) return;
        setDirectAssignableUsers(
          users
            .filter((user) => user.active && user.role !== "System Admin")
            .sort((left, right) => left.name.localeCompare(right.name)),
        );
      })
      .catch((cause) => {
        if (!live) return;
        setDirectAssignableUsers([]);
        setDirectAssignError(
          cause instanceof Error
            ? cause.message
            : "Authorised task assignees could not be loaded.",
        );
      })
      .finally(() => {
        if (live) setDirectAssignableUsersLoading(false);
      });

    return () => {
      live = false;
    };
  }, [active, isManager, token, directAssignOpen, directAssignDraft.assignmentId]);

  useEffect(() => {
    if (!active || !prefillRequestAssignmentId || loading) return;

    if (isManager) {
      const assignment = managerAssignments.find((item) => item.id === prefillRequestAssignmentId);
      if (assignment) {
        setDirectAssignDraft({ ...emptyDirectAssignment(), assignmentId: assignment.id });
        setDirectAssignError("");
        setDirectAssignOpen(true);
        onPrefillRequestConsumed?.();
      }
      return;
    }

    const assignment = requestAssignments.find(
      (item) => item.id === prefillRequestAssignmentId,
    );

    if (!assignment) {
      if (requestAssignments.length > 0) {
        setNotice(
          "This assignment is not currently available for a Task Request in your authorised scope.",
        );
        onPrefillRequestConsumed?.();
      }
      return;
    }

    setTaskCommandFocus(null);
    setView("Task Requests");
    setStatus("All");
    setSearch("");
    setRequestDraft({
      ...emptyRequest(),
      assignmentId: assignment.id,
    });
    setRequestAssignmentLocked(true);
    setRequestOpen(true);
    onPrefillRequestConsumed?.();
  }, [
    active,
    loading,
    prefillRequestAssignmentId,
    requestAssignments,
    managerAssignments,
    isManager,
    onPrefillRequestConsumed,
  ]);

  const submitDirectAssignment = async () => {
    if (!directAssignDraft.assignmentId || !directAssignDraft.title.trim() || !directAssignDraft.ownerId) return;
    if (!directAssignDraft.startDate || !directAssignDraft.dueDate || directAssignDraft.dueDate < directAssignDraft.startDate) {
      setDirectAssignError("Choose a task start date and a due date on or after the start date.");
      return;
    }
    setRequestBusy(true);
    setNotice("");
    setDirectAssignError("");
    try {
      await api.createAssignmentTask(token, directAssignDraft.assignmentId, {
        title: directAssignDraft.title.trim(),
        description: directAssignDraft.description.trim(),
        ownerId: directAssignDraft.ownerId,
        priority: directAssignDraft.priority,
        status: "Not Started",
        progress: 0,
        startDate: directAssignDraft.startDate,
        dueDate: directAssignDraft.dueDate,
        reviewerId: null,
      });
      await refresh();
      setDirectAssignDraft(emptyDirectAssignment());
      setDirectAssignError("");
      setDirectAssignOpen(false);
      setView("Team Scope");
      setNotice("Task assigned successfully. The owner and automatically resolved reviewer have been notified.");
    } catch (cause) {
      setDirectAssignError(cause instanceof Error ? cause.message : "Task could not be assigned.");
    } finally {
      setRequestBusy(false);
    }
  };

  const counts = useMemo(() => {
    const mine = rows.filter((task) => task.owner_id === currentUserId);
    return {
      mine: mine.filter((task) => task.status !== "Completed").length,
      review: rows.filter((task) => task.reviewer_id === currentUserId && task.contribution_status === "Ready for Integration").length,
      overdue: mine.filter((task) => dueMeta(task).state === "overdue").length,
      dueSoon: mine.filter((task) => ["today", "soon"].includes(dueMeta(task).state)).length,
      myRequests: requests.filter((request) => request.is_mine && request.status === "Pending").length,
      approvals: requests.filter((request) => request.can_decide && request.status === "Pending").length,
    };
  }, [rows, requests, currentUserId]);

  const availableViews: View[] = ["My Tasks", "For Review"];
  if (requestAssignments.length || requests.some((request) => request.is_mine)) {
    availableViews.push("Task Requests");
  }
  if (requests.some((request) => request.can_decide)) {
    availableViews.push("Requests for Approval");
  }
  if (isManager) availableViews.push("Team Scope");
  if (isManager || rows.some((task) => task.owner_id !== currentUserId && task.reviewer_id !== currentUserId)) {
    availableViews.push("All Permitted");
  }

  const filtered = rows.filter((task) => {
    const relationship =
      view === "My Tasks"
        ? task.owner_id === currentUserId
        : view === "For Review"
          ? task.reviewer_id === currentUserId
          : view === "Team Scope"
            ? task.owner_id !== currentUserId
            : view === "All Permitted";

    const statusMatch =
      status === "All" ||
      (status === "Active" ? task.status !== "Completed" : task.status === status);

    const haystack = [
      task.title,
      task.description,
      task.assignment_title,
      task.owner_name,
      task.reviewer_name,
      task.expected_output,
    ].join(" ").toLowerCase();

    const commandMatch = !taskCommandFocus || taskMatchesCommandFocus(task, currentUserId, taskCommandFocus, isManager);
    const dashboardShortcutMatch = !dashboardShortcut || dashboardShortcut.taskIds.includes(task.id);
    return Boolean(relationship) && statusMatch && commandMatch && dashboardShortcutMatch && haystack.includes(search.toLowerCase());
  });

  const selectedRequestAssignment = requestAssignments.find(
    (assignment) => assignment.id === requestDraft.assignmentId,
  );
  const selectedDirectAssignment = managerAssignments.find(
    (assignment) => assignment.id === directAssignDraft.assignmentId,
  );
  const directAssignmentOwners = directAssignableUsers;

  const openApproval = async (request: ApiAssignmentTaskRequest) => {
    setNotice("");
    setApprovalRequest(request);
    const ownerId = request.suggested_owner_id || "";
    setApprovalDraft({
      title: request.title,
      description: request.description || "",
      ownerId,
      reviewerId: "",
      priority: request.priority || "Normal",
      startDate: today(),
      dueDate: dateOnly(request.due_date),
      notes: "",
      comments: "",
    });
    setReviewers([]);
    setApprovalAssignableUsers([]);
    setApprovalAssignableUsersLoading(true);
    try {
      const users = await api.assignmentTaskAssignableUsers(token, request.assignment_id);
      setApprovalAssignableUsers(
        users
          .filter((user) => user.active && user.role !== "System Admin")
          .sort((left, right) => left.name.localeCompare(right.name)),
      );
      if (ownerId) {
        setReviewers(await api.taskRequestReviewerCandidates(token, request.id, ownerId));
      }
    } catch (cause) {
      setNotice(
        cause instanceof Error
          ? cause.message
          : "Authorised task assignees could not be loaded.",
      );
    } finally {
      setApprovalAssignableUsersLoading(false);
    }
  };

  useEffect(() => {
    const target = requestedTaskRequestTarget;
    if (!target) {
      handledRequestTargetRef.current = null;
      return;
    }
    const targetKey = `${target.intent}:${target.requestId}`;
    if (!active || !requestsReady || handledRequestTargetRef.current === targetKey) return;
    handledRequestTargetRef.current = targetKey;

    const request = requests.find((item) => item.id === target.requestId);
    setTaskCommandFocus(null);
    setSearch("");
    setStatus("All");

    if (target.intent === "approval") {
      setView("Requests for Approval");
      if (request && request.can_decide && request.status === "Pending") {
        void openApproval(request);
      } else {
        setNotice("This Task Request is no longer pending or is outside your authorised approval scope.");
      }
    } else {
      setView("Task Requests");
      if (request && request.is_mine) {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
          const entry = document.getElementById(`task-request-${request.id}`);
          if (entry) {
            entry.scrollIntoView({ behavior: "smooth", block: "center" });
            entry.focus({ preventScroll: true });
          }
        }));
      } else {
        setNotice("This Task Request is not available in your own requests list.");
      }
    }

    onRequestedTaskRequestTargetConsumed?.();
  // openApproval is intentionally omitted: the target is consumed in this effect, and
  // depending on its per-render function identity could reopen the modal on rerenders.
  }, [active, requestsReady, requestedTaskRequestTarget, requests, onRequestedTaskRequestTargetConsumed]);

  const submitRequest = async () => {
    if (!requestDraft.assignmentId || !requestDraft.title.trim() || !requestDraft.reason.trim()) return;
    setRequestBusy(true);
    setNotice("");
    try {
      await api.createTaskRequest(token, {
        assignmentId: requestDraft.assignmentId,
        title: requestDraft.title.trim(),
        description: requestDraft.description.trim(),
        suggestedOwnerId: requestDraft.suggestedOwnerId || null,
        priority: requestDraft.priority,
        dueDate: requestDraft.dueDate || null,
        reason: requestDraft.reason.trim(),
      });
      await refresh();
      setRequestDraft(emptyRequest());
      setRequestAssignmentLocked(false);
      setRequestOpen(false);
      setView("Task Requests");
      setNotice("Task request submitted for supervisor approval.");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Task request could not be submitted.");
    } finally {
      setRequestBusy(false);
    }
  };

  const decide = async (decision: "Approved" | "Rejected") => {
    if (!approvalRequest) return;
    if (decision === "Approved" && !approvalDraft.ownerId) {
      setNotice("Choose the task owner before approval.");
      return;
    }
    if (decision === "Approved" && (!approvalDraft.startDate || !approvalDraft.dueDate || approvalDraft.dueDate < approvalDraft.startDate)) {
      setNotice("Choose a task start date and a due date on or after the start date.");
      return;
    }
    setRequestBusy(true);
    setNotice("");
    try {
      await api.decideTaskRequest(token, approvalRequest.id, {
        decision,
        title: approvalDraft.title.trim() || approvalRequest.title,
        description: approvalDraft.description.trim(),
        ownerId: approvalDraft.ownerId || null,
        reviewerId: approvalDraft.reviewerId || null,
        priority: approvalDraft.priority,
        startDate: approvalDraft.startDate || null,
        dueDate: approvalDraft.dueDate || null,
        notes: approvalDraft.notes.trim(),
        comments: approvalDraft.comments.trim(),
      });
      await refresh();
      setApprovalRequest(null);
      setApprovalAssignableUsers([]);
      setReviewers([]);
      setApprovalDraft(emptyApproval());
      setView("Requests for Approval");
      setNotice(
        decision === "Approved"
          ? "Task request approved. The active task is now available in Tasks."
          : "Task request rejected.",
      );
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "The task request decision could not be saved.");
    } finally {
      setRequestBusy(false);
    }
  };

  if (!active) return null;

  const requestView = view === "Task Requests";
  const approvalView = view === "Requests for Approval";

  const viewGuidance: Record<
    View,
    { eyebrow: string; title: string; explanation: string; next: string }
  > = {
    "My Tasks": {
      eyebrow: "YOUR WORK",
      title: "Tasks assigned to you",
      explanation:
        "These are TASKS where you are the owner. Open a TASK to do the work, add evidence and prepare its TASK Report.",
      next:
        "Next: continue the TASK, save your report draft, preview it, then submit the locked version to the assigned reviewer.",
    },
    "For Review": {
      eyebrow: "YOUR REVIEW QUEUE",
      title: "Task Reports waiting for your decision",
      explanation:
        "These TASKS have been submitted to you as the assigned reviewer. The submitted report version is locked while you review it.",
      next:
        "Next: open the TASK, read the submitted report and evidence, then approve it, request changes or reject it with clear comments.",
    },
    "Task Requests": {
      eyebrow: "ASSIGNMENT LEAD",
      title: "Request delegated work",
      explanation:
        "A TASK REQUEST proposes new delegated work under an ASSIGNMENT without giving the future TASK owner access to the Assignment Workspace.",
      next:
        "Next: submit the TASK REQUEST to your authorised supervisor. A real standalone TASK is created only after approval.",
    },
    "Requests for Approval": {
      eyebrow: "SUPERVISOR ACTION",
      title: "Approve or reject Task Requests",
      explanation:
        "These requests were submitted by staff within your authorised supervision. Approval creates the standalone TASK and records its owner and reviewer.",
      next:
        "Next: confirm the TASK owner, reviewer, dates and priority, then approve or reject the request.",
    },
    "Team Scope": {
      eyebrow: "MANAGER VIEW",
      title: "Tasks in your authorised team scope",
      explanation:
        "This view shows TASK delivery within the team you are authorised to manage. It does not widen access outside your hierarchy.",
      next:
        "Next: open a TASK that needs attention, check delivery progress and use the existing governed controls available to your role.",
    },
    "All Permitted": {
      eyebrow: "AUTHORISED VIEW",
      title: "All TASKS you are permitted to see",
      explanation:
        "This is a consolidated list of TASKS allowed by backend scope and your current role. It is not organisation-wide access unless your role authorises that scope.",
      next:
        "Next: use search and status filters to narrow the list, then open the TASK that requires work, review or management action.",
    },
  };

  const guidance = viewGuidance[view];

  return (
    <section className="tasks-control-centre" aria-label="Tasks workspace">
      <div className="tasks-context-strip">
        <div>
          <small>AUTHORISED TASK WORKSPACE</small>
          <span>
            Assignment governance remains authoritative; Task access does not widen Assignment Workspace access.
          </span>
        </div>
        <div className="tasks-user-context">
          <strong>{currentUserName}</strong>
          <span>{currentUserRole}</span>
        </div>
      </div>

      <section className="tasks-primary-actions" aria-label="Task actions">
        <div>
          <small>QUICK ACTIONS</small>
          <strong>Create and govern task work</strong>
          <span>Start a Task Request or open the request queues directly.</span>
        </div>
        <nav>
          <button
            type="button"
            className="primary"
            disabled={!requestAssignments.length}
            title={requestAssignments.length ? "Request a task under an authorised assignment" : "No assignment is currently available for a Task Request"}
            onClick={() => {
              setTaskCommandFocus(null);
              setView("Task Requests");
              setRequestAssignmentLocked(false);
              setRequestDraft(emptyRequest());
              setRequestOpen(true);
            }}
          >
            + Request Task
          </button>
          <button
            type="button"
            onClick={() => {
              setTaskCommandFocus(null);
              setView("Task Requests");
            }}
          >
            Task Requests{counts.myRequests ? ` (${counts.myRequests})` : ""}
          </button>
          {isManager && (
            <button
              type="button"
              onClick={() => {
                setTaskCommandFocus(null);
                setDirectAssignDraft(emptyDirectAssignment());
                setDirectAssignError("");
                setDirectAssignOpen(true);
              }}
            >
              + Assign Task
            </button>
          )}
          {isManager && (
            <button type="button" onClick={() => setView("Requests for Approval")}>
              Approval Requests{counts.approvals ? ` (${counts.approvals})` : ""}
            </button>
          )}
        </nav>
      </section>

      <TasksCommandCentre
        rows={rows}
        requests={requests}
        currentUserId={currentUserId}
        isManager={isManager}
        onOpenTask={onOpenTask}
        onFocus={(focus) => {
          const matches = rows.filter((task) =>
            taskMatchesCommandFocus(task, currentUserId, focus, isManager),
          );
      
          if (matches.length === 1) {
            void onOpenTask(matches[0].id);
            return;
          }
      
          setDashboardShortcut(null);
          setTaskCommandFocus(focus);
          setSearch("");
          setStatus("All");
          setView(
            focus === "For Review"
              ? "For Review"
              : isManager
                ? "Team Scope"
                : "My Tasks",
          );
      
          window.requestAnimationFrame(() => {
            document
              .querySelector(".tasks-list, .task-request-surface")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        }}
        onShowApprovals={() => {
          setDashboardShortcut(null);
          setTaskCommandFocus(null);
          if (availableViews.includes("Requests for Approval")) {
            setView("Requests for Approval");
          }
        }}
        approvalsAvailable={availableViews.includes("Requests for Approval")}
      />
      <nav className="tasks-view-tabs" aria-label="Task views">
        {availableViews.map((label) => (
          <button
            type="button"
            key={label}
            className={view === label ? "active" : ""}
            aria-current={view === label ? "page" : undefined}
            onClick={() => {
              setTaskCommandFocus(null);
              setDashboardShortcut(null);
              if (label === "All Permitted") {
                setSearch("");
                setStatus("All");
              }
              setView(label);
            }}
          >
            {label === "All Permitted" ? `All Permitted (${rows.length})` : label}
            {label === "Task Requests" && counts.myRequests > 0 ? ` (${counts.myRequests})` : ""}
            {label === "Requests for Approval" && counts.approvals > 0 ? ` (${counts.approvals})` : ""}
          </button>
        ))}
      </nav>

      <section className="tasks-view-guide tasks-view-guide-compact" aria-live="polite">
        <div className="tasks-view-guide-copy">
          <small>{guidance.eyebrow}</small>
          <strong>{guidance.title}</strong>
          <p>{guidance.explanation}</p>
        </div>
        <span className="tasks-view-next">{guidance.next}</span>
      </section>

      {dashboardShortcut && !requestView && !approvalView && (
        <div className="tasks-message tasks-dashboard-shortcut" role="status">
          <strong>Showing {dashboardShortcut.label} tasks</strong>
          <span>This list matches the Dashboard card you selected, within your authorised scope.</span>
          <button type="button" className="secondary" onClick={() => setDashboardShortcut(null)}>Clear filter</button>
        </div>
      )}
      {notice && <div className="tasks-message">{notice}</div>}
      {error && <div className="tasks-message error">{error}</div>}
      {loading && <div className="tasks-message">Loading permitted task work...</div>}

      {directAssignOpen && isManager && (
        <div className="task-direct-assign-backdrop" role="presentation">
          <form className="task-direct-assign-modal" onSubmit={(event) => { event.preventDefault(); void submitDirectAssignment(); }}>
            <header>
              <div><small>MANAGEMENT ACTION</small><h3>Assign Task</h3><p>Create a task under an authorised active assignment.</p></div>
              <button type="button" aria-label="Close Assign Task" onClick={() => { setDirectAssignError(""); setDirectAssignOpen(false); }}>×</button>
            </header>
            {directAssignError && <div className="task-direct-assign-error" role="alert">{directAssignError}</div>}
            <label>Assignment<select required value={directAssignDraft.assignmentId} onChange={(event) => { setDirectAssignError(""); setDirectAssignableUsers([]); setDirectAssignDraft((current) => ({ ...current, assignmentId: event.target.value, ownerId: "" })); }}><option value="">Choose assignment</option>{managerAssignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.title}</option>)}</select></label>
            <label>Task title<input required minLength={2} value={directAssignDraft.title} onChange={(event) => setDirectAssignDraft((current) => ({ ...current, title: event.target.value }))} /></label>
            <label>Description<textarea value={directAssignDraft.description} onChange={(event) => setDirectAssignDraft((current) => ({ ...current, description: event.target.value }))} /></label>
            <div className="task-direct-assign-grid">
              <label>Task owner<select required disabled={!directAssignDraft.assignmentId || directAssignableUsersLoading || !directAssignmentOwners.length} value={directAssignDraft.ownerId} onChange={(event) => { setDirectAssignError(""); setDirectAssignDraft((current) => ({ ...current, ownerId: event.target.value })); }}><option value="">{directAssignableUsersLoading ? "Loading authorised users..." : directAssignDraft.assignmentId && !directAssignmentOwners.length ? "No authorised active users available" : "Choose owner"}</option>{directAssignmentOwners.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role}{member.division ? ` · ${member.division}` : ""}{member.availability_status && member.availability_status !== "Available" ? ` · ${member.availability_status}` : ""}</option>)}</select><small>Shows active users inside your authorised management scope. A non-member is enrolled as an Assignment Contributor when the task is created.</small></label>
              <label>Priority<select value={directAssignDraft.priority} onChange={(event) => setDirectAssignDraft((current) => ({ ...current, priority: event.target.value }))}>{["Low", "Normal", "High", "Critical"].map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Start date<input type="date" required min={today()} value={directAssignDraft.startDate} onChange={(event) => setDirectAssignDraft((current) => ({ ...current, startDate: event.target.value, dueDate: event.target.value && current.dueDate && current.dueDate < event.target.value ? "" : current.dueDate }))} /></label>
              <label>Due date<input type="date" required min={directAssignDraft.startDate || today()} value={directAssignDraft.dueDate} onChange={(event) => setDirectAssignDraft((current) => ({ ...current, dueDate: event.target.value }))} /></label>
            </div>
            <footer><button type="button" onClick={() => { setDirectAssignError(""); setDirectAssignOpen(false); }}>Cancel</button><button type="submit" className="primary" disabled={requestBusy || !directAssignDraft.assignmentId || !directAssignDraft.title.trim() || !directAssignDraft.ownerId}>{requestBusy ? "Assigning..." : "Assign Task"}</button></footer>
          </form>
        </div>
      )}

      {!loading && requestView && (
        <section className="task-request-surface">
          <header>
            <div>
              <small>ASSIGNMENT LEAD</small>
              <h3>Task requests</h3>
              <p>Create a governed TASK REQUEST under an ASSIGNMENT. Your supervisor must approve it before a standalone TASK is created.</p>
            </div>
            {requestAssignments.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setRequestAssignmentLocked(false);
                  setRequestDraft(emptyRequest());
                  setRequestOpen(true);
                }}
              >
                Request Task
              </button>
            )}
          </header>

          <div className="task-request-list">
            {requests.filter((request) => request.is_mine).map((request) => (
              <article id={`task-request-${request.id}`} tabIndex={-1} key={request.id} className="task-request-card">
                <div>
                  <small>ASSIGNMENT REFERENCE: {request.assignment_title || "Assignment"}</small>
                  <h4>TASK REQUEST: {request.title}</h4>
                  <p>{request.reason}</p>
                </div>
                <dl>
                  <div><dt>Suggested owner</dt><dd>{request.suggested_owner_name || "Supervisor to assign"}</dd></div>
                  <div><dt>Due</dt><dd>{request.due_date ? new Date(request.due_date).toLocaleDateString("en-KE") : "Not set"}</dd></div>
                  <div><dt>Status</dt><dd>{request.status}</dd></div>
                </dl>
                <div className="task-request-actions">
                  <button type="button" onClick={() => downloadTaskRequestPack(request)}>Download request brief</button>
                  {request.task_id && <button type="button" onClick={() => void onOpenTask(request.task_id!)}>Open approved Task</button>}
                </div>
              </article>
            ))}
            {!requests.some((request) => request.is_mine) && (
              <div className="tasks-empty">
                <strong>No task requests yet</strong>
                <p>When work under an assignment needs delegation, request it here for supervisor approval.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {!loading && approvalView && (
        <section className="task-request-surface">
          <header>
            <div>
              <small>SUPERVISOR</small>
              <h3>Requests for approval</h3>
              <p>Check the proposed owner, reviewer, dates and priority. Approval creates the standalone TASK; rejection keeps the request as an auditable decision.</p>
            </div>
          </header>

          <div className="task-request-list">
            {requests.filter((request) => request.can_decide).map((request) => (
              <article id={`task-request-${request.id}`} tabIndex={-1} key={request.id} className="task-request-card approval">
                <div>
                  <small>ASSIGNMENT REFERENCE: {request.assignment_title || "Assignment"}</small>
                  <h4>TASK REQUEST FOR APPROVAL: {request.title}</h4>
                  <p>{request.reason}</p>
                  <span>Requested by {request.requested_by_name}</span>
                </div>
                <dl>
                  <div><dt>Suggested owner</dt><dd>{request.suggested_owner_name || "Not selected"}</dd></div>
                  <div><dt>Priority</dt><dd>{request.priority}</dd></div>
                  <div><dt>Due</dt><dd>{request.due_date ? new Date(request.due_date).toLocaleDateString("en-KE") : "Not set"}</dd></div>
                </dl>
                <div className="task-request-actions">
                  <button type="button" onClick={() => downloadTaskRequestPack(request)}>Download request brief</button>
                  <button type="button" onClick={() => void openApproval(request)}>
                    Review Request
                  </button>
                </div>
              </article>
            ))}
            {!requests.some((request) => request.can_decide) && (
              <div className="tasks-empty">
                <strong>No task requests require your decision</strong>
                <p>Pending requests from staff under your direct supervision will appear here.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {!loading && !requestView && !approvalView && (
        <>
          <div className="tasks-filters">
            <label>
              <span>Search tasks</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Task, assignment, owner or output"
              />
            </label>
            <label>
              <span>Status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
                {["Active", "All", "Not Started", "In Progress", "Blocked", "Completed"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <strong>{filtered.length} shown</strong>
          </div>

          <div className="tasks-list">
            {filtered.map((task) => {
              const due = dueMeta(task);
              const reviewMode =
                task.reviewer_id === currentUserId &&
                ["Ready for Integration", "Integrated"].includes(task.contribution_status);
              const own = task.owner_id === currentUserId;
              return (
                <article key={task.id} className={`standalone-task-row due-${due.state}`}>
                  <div className="standalone-task-main">
                    <small>
                      ASSIGNMENT REFERENCE: {task.assignment_title || "Related assignment"}
                    </small>
                    <h3>TASK: {task.title}</h3>
                    <p>{task.task_purpose || task.description || task.expected_contribution || "No additional task purpose recorded."}</p>
                  </div>
                  <dl>
                    <div><dt>Owner</dt><dd>{task.owner_name || "Unassigned"}</dd></div>
                    <div><dt>Reviewer</dt><dd>{task.reviewer_name || "Not assigned"}</dd></div>
                    <div><dt>Work status</dt><dd>{task.status}</dd></div>
                    <div><dt>Report status</dt><dd>{reportLabel(task)}</dd></div>
                    <div><dt>Due</dt><dd className={`due-${due.state}`}>{due.label}</dd></div>
                  </dl>
                  <div className="standalone-task-actions">
                    <button type="button" className="secondary" onClick={() => downloadTaskPack(task)}>Download offline work pack</button>
                    <button type="button" onClick={() => void onOpenTask(task.id)}>
                      {reviewMode ? "Review Task" : own ? (task.status === "Not Started" ? "Start Task" : "Continue Work") : "Open Task"}
                    </button>
                  </div>
                </article>
              );
            })}

            {!filtered.length && (
              <div className="tasks-empty">
                <strong>
                  {view === "My Tasks"
                    ? "No tasks currently require your work"
                    : view === "For Review"
                      ? "No tasks are currently assigned to you for review"
                      : "No tasks match this view"}
                </strong>
                <p>
                  {view === "My Tasks"
                    ? "New work will appear here when an approved task is assigned to you."
                    : "Adjust the view or filters to see other permitted task records."}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {requestOpen && (
        <div className="task-request-backdrop" role="presentation">
          <form
            className="task-request-modal"
            onSubmit={(event) => {
              event.preventDefault();
              void submitRequest();
            }}
          >
            <header>
              <div>
                <small>REQUEST TASK</small>
                <h3>Request delegated work</h3>
                <p>
                  {requestAssignmentLocked
                    ? "This request is linked to the Assignment you opened. Your immediate supervisor must approve it before it becomes an active task."
                    : "Your immediate supervisor must approve this request before it becomes an active task."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRequestAssignmentLocked(false);
                  setRequestOpen(false);
                }}
              >
                Close
              </button>
            </header>

            <label>
              <span>Related assignment *</span>
              <select
                required
                value={requestDraft.assignmentId}
                disabled={requestAssignmentLocked}
                onChange={(event) =>
                  setRequestDraft({
                    ...requestDraft,
                    assignmentId: event.target.value,
                    suggestedOwnerId: "",
                    dueDate: "",
                  })
                }
              >
                <option value="">Select assignment</option>
                {requestAssignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>{assignment.title}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Task title *</span>
              <input
                required
                value={requestDraft.title}
                onChange={(event) => setRequestDraft({ ...requestDraft, title: event.target.value })}
              />
            </label>

            <label>
              <span>Purpose / instructions</span>
              <textarea
                value={requestDraft.description}
                onChange={(event) => setRequestDraft({ ...requestDraft, description: event.target.value })}
              />
            </label>

            <div className="task-request-grid">
              <label>
                <span>Suggested owner</span>
                <select
                  value={requestDraft.suggestedOwnerId}
                  onChange={(event) => setRequestDraft({ ...requestDraft, suggestedOwnerId: event.target.value })}
                  disabled={!selectedRequestAssignment}
                >
                  <option value="">Supervisor may assign</option>
                  {(selectedRequestAssignment?.members || []).map((member) => (
                    <option key={member.id} value={member.id}>{member.name} - {member.role}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Priority</span>
                <select
                  value={requestDraft.priority}
                  onChange={(event) => setRequestDraft({ ...requestDraft, priority: event.target.value })}
                >
                  {["Low", "Normal", "High", "Urgent"].map((priority) => (
                    <option key={priority}>{priority}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Requested due date</span>
                <input
                  type="date"
                  value={requestDraft.dueDate}
                  max={dateOnly(selectedRequestAssignment?.due_date)}
                  onChange={(event) => setRequestDraft({ ...requestDraft, dueDate: event.target.value })}
                />
              </label>
            </div>

            <label>
              <span>Why is this task needed? *</span>
              <textarea
                required
                value={requestDraft.reason}
                onChange={(event) => setRequestDraft({ ...requestDraft, reason: event.target.value })}
              />
            </label>

            <footer>
              <button
                type="button"
                onClick={() => {
                  setRequestAssignmentLocked(false);
                  setRequestOpen(false);
                }}
              >
                Cancel
              </button>
              <button type="submit" disabled={requestBusy || !requestDraft.assignmentId || !requestDraft.title.trim() || !requestDraft.reason.trim()}>
                {requestBusy ? "Submitting..." : "Submit for Approval"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {approvalRequest && (
        <div className="task-request-backdrop" role="presentation">
          <form
            className="task-request-modal"
            onSubmit={(event) => {
              event.preventDefault();
              void decide("Approved");
            }}
          >
            <header>
              <div>
                <small>SUPERVISOR APPROVAL</small>
                <h3>{approvalRequest.title}</h3>
                <p>{approvalRequest.assignment_title}</p>
              </div>
              <button type="button" onClick={() => { setApprovalRequest(null); setApprovalAssignableUsers([]); setReviewers([]); }}>Close</button>
            </header>

            <label>
              <span>Task title *</span>
              <input
                autoFocus
                required
                value={approvalDraft.title}
                onChange={(event) => setApprovalDraft({ ...approvalDraft, title: event.target.value })}
              />
            </label>

            <label>
              <span>Task description</span>
              <textarea
                value={approvalDraft.description}
                onChange={(event) => setApprovalDraft({ ...approvalDraft, description: event.target.value })}
              />
            </label>

            <div className="task-request-grid">
              <label>
                <span>Task owner *</span>
                <select
                  required
                  value={approvalDraft.ownerId}
                  onChange={(event) => {
                    const ownerId = event.target.value;
                    setApprovalDraft({ ...approvalDraft, ownerId, reviewerId: "" });
                    if (ownerId) {
                      void api
                        .taskRequestReviewerCandidates(token, approvalRequest.id, ownerId)
                        .then(setReviewers)
                        .catch((cause) =>
                          setNotice(cause instanceof Error ? cause.message : "Reviewer candidates could not be loaded."),
                        );
                    } else {
                      setReviewers([]);
                    }
                  }}
                >
                  <option value="">{approvalAssignableUsersLoading ? "Loading authorised users..." : "Select owner"}</option>
                  {approvalAssignableUsers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} - {member.role}{member.division ? ` - ${member.division}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Reviewer</span>
                <select
                  value={approvalDraft.reviewerId}
                  onChange={(event) => setApprovalDraft({ ...approvalDraft, reviewerId: event.target.value })}
                >
                  <option value="">Automatic reviewer</option>
                  {reviewers.map((reviewer) => (
                    <option key={reviewer.id} value={reviewer.id}>
                      {reviewer.name} - {reviewer.relation}
                    </option>
                  ))}
                </select>
                <small>
                  Automatic uses the Assignment Lead unless the lead owns the task; then APP2 uses the immediate authorised supervisor.
                </small>
              </label>

              <label>
                <span>Priority</span>
                <select
                  value={approvalDraft.priority}
                  onChange={(event) => setApprovalDraft({ ...approvalDraft, priority: event.target.value })}
                >
                  {["Low", "Normal", "High", "Urgent"].map((priority) => (
                    <option key={priority}>{priority}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Start date</span>
                <input
                  type="date"
                  required
                  min={today()}
                  value={approvalDraft.startDate}
                  onChange={(event) => setApprovalDraft({ ...approvalDraft, startDate: event.target.value, dueDate: event.target.value && approvalDraft.dueDate && approvalDraft.dueDate < event.target.value ? "" : approvalDraft.dueDate })}
                />
              </label>

              <label>
                <span>Due date</span>
                <input
                  type="date"
                  required
                  min={approvalDraft.startDate || today()}
                  value={approvalDraft.dueDate}
                  onChange={(event) => setApprovalDraft({ ...approvalDraft, dueDate: event.target.value })}
                />
              </label>
            </div>

            <label>
              <span>Supervisor comments</span>
              <textarea
                value={approvalDraft.comments}
                onChange={(event) => setApprovalDraft({ ...approvalDraft, comments: event.target.value })}
              />
            </label>

            <footer>
              <button type="button" disabled={requestBusy} onClick={() => void decide("Rejected")}>
                Reject
              </button>
              <button type="submit" disabled={requestBusy || !approvalDraft.ownerId}>
                {requestBusy ? "Saving..." : "Approve and Create Task"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}


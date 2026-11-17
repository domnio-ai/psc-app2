import { useEffect, useState } from "react";
import type {
  ApiAssignmentTask,
  ApiAssignmentTaskRequest,
} from "../../api";

export type TaskCommandFocus =
  | "Active"
  | "Due Soon"
  | "Overdue"
  | "Blocked"
  | "For Review";

type Props = {
  rows: ApiAssignmentTask[];
  requests: ApiAssignmentTaskRequest[];
  currentUserId: string;
  isManager: boolean;
  onOpenTask: (taskId: string) => void | Promise<void>;
  onFocus: (focus: TaskCommandFocus) => void;
  onShowApprovals: () => void;
  approvalsAvailable: boolean;
};

const dateOnly = (value?: string | null) => {
  if (!value) return "";
  return String(value).match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || "";
};

const dueState = (task: ApiAssignmentTask) => {
  if (!task.due_date || task.status === "Completed") return "normal";
  const raw = dateOnly(task.due_date);
  if (!raw) return "normal";
  const due = new Date(`${raw}T23:59:59`).getTime();
  const days = Math.ceil((due - Date.now()) / 86400000);
  if (days < 0) return "overdue";
  if (days <= 3) return "soon";
  return "normal";
};

export const taskMatchesCommandFocus = (
  task: ApiAssignmentTask,
  currentUserId: string,
  focus: TaskCommandFocus,
  isManager = false,
) => {
  const inScope =
    isManager ||
    task.owner_id === currentUserId ||
    task.reviewer_id === currentUserId;

  if (!inScope) return false;

  switch (focus) {
    case "Active":
      return task.status !== "Completed";
    case "Due Soon":
      return task.status !== "Completed" && dueState(task) === "soon";
    case "Overdue":
      return task.status !== "Completed" && dueState(task) === "overdue";
    case "Blocked":
      return task.status !== "Completed" && task.status === "Blocked";
    case "For Review":
      return (
        task.contribution_status === "Ready for Integration" &&
        (isManager || task.reviewer_id === currentUserId)
      );
  }
};

const pressureWeight = (task: ApiAssignmentTask) => {
  const due = dueState(task);
  if (due === "overdue") return 0;
  if (task.status === "Blocked") return 1;
  if (task.contribution_status === "Ready for Integration") return 2;
  if (due === "soon") return 3;
  return 99;
};

const pressureReason = (task: ApiAssignmentTask) => {
  const due = dueState(task);
  if (due === "overdue") return "Overdue";
  if (task.status === "Blocked") return "Blocked";
  if (task.contribution_status === "Ready for Integration") return "Review required";
  if (due === "soon") return "Due soon";
  return "Active";
};

export default function TasksCommandCentre({
  rows,
  requests,
  currentUserId,
  isManager,
  onOpenTask,
  onFocus,
  onShowApprovals,
  approvalsAvailable,
}: Props) {
  const [popup, setPopup] = useState<{
    focus: TaskCommandFocus | "Permitted";
    rows: ApiAssignmentTask[];
  } | null>(null);

  useEffect(() => {
    if (!popup) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPopup(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [popup]);

  const openFocusPopup = (focus: TaskCommandFocus) => {
    const matches = rows.filter((task) =>
      taskMatchesCommandFocus(task, currentUserId, focus, isManager),
    );
    setPopup({ focus, rows: matches });
  };

  const openPermittedPopup = () => {
    setPopup({ focus: "Permitted", rows: scopedRows });
  };

  const scopedRows = isManager
    ? rows
    : rows.filter(
        (task) =>
          task.owner_id === currentUserId || task.reviewer_id === currentUserId,
      );

  const active = scopedRows.filter((task) => task.status !== "Completed");
  const dueSoon = active.filter((task) => dueState(task) === "soon");
  const overdue = active.filter((task) => dueState(task) === "overdue");
  const blocked = active.filter((task) => task.status === "Blocked");
  const review = scopedRows.filter(
    (task) =>
      task.contribution_status === "Ready for Integration" &&
      (isManager || task.reviewer_id === currentUserId),
  );
  const approvals = requests.filter(
    (request) => request.can_decide && request.status === "Pending",
  );

  const onTrack = active.filter(
    (task) => dueState(task) === "normal" && task.status !== "Blocked",
  ).length;
  const pressure = active.filter(
    (task) => dueState(task) === "soon" || task.status === "Blocked",
  ).length;
  const healthTotal = Math.max(active.length, 1);
  const onTrackPct = Math.round((onTrack / healthTotal) * 100);
  const pressurePct = Math.round((pressure / healthTotal) * 100);
  const overduePct = Math.max(0, 100 - onTrackPct - pressurePct);

  const attention = scopedRows
    .filter((task) => pressureWeight(task) < 99)
    .sort((a, b) => pressureWeight(a) - pressureWeight(b))
    .slice(0, 5);

  return (
    <section className="tasks-command-centre" aria-label="Tasks command centre">
      <header className="module-command-centre-head">
        <div>
          <small>REDESY TASKS COMMAND CENTRE</small>
          <h3>Task delivery command centre</h3>
          <p>Execution · deadlines · reviews · approvals</p>
        </div>
        <button
          type="button"
          className="command-scope-summary"
          onClick={openPermittedPopup}
          aria-label={isManager ? "Open permitted team tasks" : "Open permitted tasks"}
        >
          <small>{isManager ? "PERMITTED TEAM TASKS" : "PERMITTED TASKS"}</small>
          <strong>{scopedRows.length}</strong>
          <span>View authorised scope</span>
        </button>
      </header>

      <nav className="module-command-nav" aria-label="Task command centre shortcuts">
        <button type="button" onClick={() => openFocusPopup("Active")}>
          <b>T</b>
          <span>
            <strong>{isManager ? "Active Tasks" : "My Tasks"}</strong>
            <small>{isManager ? "Authorised team execution" : "Execution"}</small>
          </span>
        </button>
        <button type="button" onClick={() => openFocusPopup("For Review")}>
          <b>✓</b><span><strong>Reviews</strong><small>Submitted reports</small></span>
        </button>
        <button type="button" onClick={onShowApprovals} disabled={!approvalsAvailable}>
          <b>!</b><span><strong>Approvals</strong><small>Task Requests</small></span>
        </button>
      </nav>

      <section className="module-kpi-strip" aria-label="Task metrics">
        <button type="button" className="kpi-blue" onClick={() => openFocusPopup("Active")}>
          <small>Active Tasks</small><strong>{active.length}</strong><span>{isManager ? "In authorised team scope" : "Assigned to you"}</span>
        </button>
        <button type="button" className="kpi-amber" onClick={() => openFocusPopup("Due Soon")}>
          <small>Due Soon</small><strong>{dueSoon.length}</strong><span>Due today or within 3 days</span>
        </button>
        <button type="button" className="kpi-red" onClick={() => openFocusPopup("Overdue")}>
          <small>Overdue</small><strong>{overdue.length}</strong><span>Past deadline</span>
        </button>
        <button type="button" className="kpi-orange" onClick={() => openFocusPopup("Blocked")}>
          <small>Blocked</small><strong>{blocked.length}</strong><span>Needs intervention</span>
        </button>
        <button type="button" className="kpi-violet" onClick={() => openFocusPopup("For Review")}>
          <small>For My Review</small><strong>{review.length}</strong><span>Awaiting decision</span>
        </button>
        <button
          type="button"
          className="kpi-green"
          onClick={onShowApprovals}
          disabled={!approvalsAvailable}
        >
          <small>Approvals</small><strong>{approvals.length}</strong><span>Supervisor action</span>
        </button>
      </section>

      <div className="module-command-grid">
        <section className="module-action-centre">
          <header>
            <div>
              <small>ACTION CENTRE</small>
              <h4>What needs your next action</h4>
              <div className="command-pressure-chips">
                <span className="chip-red">{overdue.length} overdue</span>
                <span className="chip-amber">{dueSoon.length} due soon</span>
                <span className="chip-violet">{review.length} reviews</span>
              </div>
            </div>
            <button type="button" onClick={() => openFocusPopup("Active")}>View all actions</button>
          </header>

          <div className="command-action-list">
            {attention.map((task) => (
              <article
                key={task.id}
                role="button"
                tabIndex={0}
                onClick={() => void onOpenTask(task.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void onOpenTask(task.id);
                  }
                }}
              >
                <span className="command-record-type">Task</span>
                <div className="command-action-copy">
                  <strong>{task.title}</strong>
                  <small>
                    Responsible: {task.owner_name || "Unassigned"} · Reviewer: {task.reviewer_name || "Not assigned"}
                  </small>
                  <span>Why flagged: {pressureReason(task)}</span>
                  <em>
                    Recommended action: {task.contribution_status === "Ready for Integration"
                      ? "Open submitted report"
                      : task.status === "Blocked"
                        ? "Resolve blocker"
                        : "Continue task"}
                  </em>
                </div>
                <div className="command-action-status">
                  <b>{pressureReason(task)}</b>
                  <small>{task.status}</small>
                </div>
                <button type="button" onClick={(event) => { event.stopPropagation(); void onOpenTask(task.id); }}>
                  Open exact record
                </button>
              </article>
            ))}

            {!attention.length && (
              <div className="command-clear-state">
                {isManager
                  ? "No authorised team tasks currently require intervention."
                  : "No owned or review tasks currently require intervention."}
              </div>
            )}
          </div>
        </section>

        <section className="module-delivery-health">
          <header>
            <small>DELIVERY HEALTH</small>
            <h4>Current task pressure</h4>
          </header>

          <div className="health-donut-wrap">
            <div
              className="health-donut"
              style={{
                background: `conic-gradient(
                  var(--command-green) 0 ${onTrackPct}%,
                  var(--command-amber) ${onTrackPct}% ${onTrackPct + pressurePct}%,
                  var(--command-red) ${onTrackPct + pressurePct}% 100%
                )`,
              }}
              aria-label={`${active.length} current tasks`}
            >
              <div><strong>{active.length}</strong><span>{isManager ? "Team work" : "Current work"}</span></div>
            </div>

            <dl className="health-legend">
              <div><dt><i className="dot-green" />On track</dt><dd>{onTrackPct}% <b>{onTrack}</b></dd></div>
              <div><dt><i className="dot-amber" />Due / blocked</dt><dd>{pressurePct}% <b>{pressure}</b></dd></div>
              <div><dt><i className="dot-red" />Overdue</dt><dd>{overduePct}% <b>{overdue.length}</b></dd></div>
            </dl>
          </div>
        </section>
      </div>

      {popup && (
        <div
          className="command-popup-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPopup(null);
          }}
        >
          <section
            className="command-popup"
            role="dialog"
            aria-modal="true"
            aria-label={`${popup.focus} tasks`}
          >
            <header className="command-popup-head">
              <div>
                <small>TASKS</small>
                <h4>{popup.focus}</h4>
                <p>
                  {popup.rows.length} {popup.focus === "Permitted" ? "authorised task" : "matching authorised record"}
                  {popup.rows.length === 1 ? "" : "s"}
                </p>
              </div>
              <button type="button" aria-label="Close popup" onClick={() => setPopup(null)}>×</button>
            </header>

            <div className="command-popup-list">
              {popup.rows.map((task) => (
                <article key={task.id}>
                  <div className="command-popup-record">
                    <small>{task.assignment_title || "Related assignment"}</small>
                    <strong>{task.title}</strong>
                    <span>
                      Responsible: {task.owner_name || "Unassigned"} · Reviewer: {task.reviewer_name || "Not assigned"}
                    </span>
                    <span>
                      Status: {task.status} · Due: {task.due_date ? new Date(task.due_date).toLocaleDateString("en-KE") : "Not set"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPopup(null);
                      void onOpenTask(task.id);
                    }}
                  >
                    Open exact record
                  </button>
                </article>
              ))}

              {!popup.rows.length && (
                <div className="command-popup-empty">
                  No authorised tasks match this dashboard category.
                </div>
              )}
            </div>

            <footer className="command-popup-footer">
              {popup.focus !== "Permitted" && (
                <button
                  type="button"
                  onClick={() => {
                    setPopup(null);
                    onFocus(popup.focus as TaskCommandFocus);
                  }}
                >
                  Show in task list
                </button>
              )}
              <button type="button" onClick={() => setPopup(null)}>Close</button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}

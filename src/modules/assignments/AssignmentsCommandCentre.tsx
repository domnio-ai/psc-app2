import { useEffect, useState } from "react";
import type { ApiAssignment } from "../../api";
import { deadlineState } from "../../utils/deadlines";
import {
  assignmentDisplayStatus,
  assignmentHealthFor,
  assignmentRef,
} from "./utils/assignmentFormatting";

export type AssignmentCommandFocus =
  | "Active"
  | "Active Tasks"
  | "Due Soon"
  | "Overdue"
  | "Awaiting Review"
  | "Final Report Pending";

type Props = {
  rows: ApiAssignment[];
  currentUserName: string;
  onOpen: (assignment: ApiAssignment) => void | Promise<void>;
  onFocus: (focus: AssignmentCommandFocus) => void;
};

export const assignmentMatchesCommandFocus = (
  item: ApiAssignment,
  focus: AssignmentCommandFocus,
) => {
  const active = item.status !== "Completed";
  const dueState = deadlineState(item.due_date, item.status);

  switch (focus) {
    case "Active":
      return active;
    case "Active Tasks":
      return (
        active &&
        Math.max(
          0,
          Number(item.task_count || 0) - Number(item.completed_task_count || 0),
        ) > 0
      );
    case "Due Soon":
      return active && dueState === "almost-due";
    case "Overdue":
      return active && dueState === "overdue";
    case "Awaiting Review":
      return active && item.status === "Ready for Review";
    case "Final Report Pending":
      return active && item.workflow_status === "Ready for Final Report";
  }
};


export default function AssignmentsCommandCentre({
  rows,
  currentUserName,
  onOpen,
  onFocus,
}: Props) {
  const [popup, setPopup] = useState<{
    focus: AssignmentCommandFocus;
    rows: ApiAssignment[];
  } | null>(null);

  useEffect(() => {
    if (!popup) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPopup(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [popup]);

  const openFocusPopup = (focus: AssignmentCommandFocus) => {
    const matches = rows.filter((item) =>
      assignmentMatchesCommandFocus(item, focus),
    );
    setPopup({ focus, rows: matches });
  };

  const active = rows.filter((item) =>
    assignmentMatchesCommandFocus(item, "Active"),
  );
  const activeTaskAssignments = rows.filter((item) =>
    assignmentMatchesCommandFocus(item, "Active Tasks"),
  );
  const activeTasks = active.reduce(
    (sum, item) =>
      sum +
      Math.max(
        0,
        Number(item.task_count || 0) - Number(item.completed_task_count || 0),
      ),
    0,
  );
  const dueSoon = rows.filter((item) =>
    assignmentMatchesCommandFocus(item, "Due Soon"),
  );
  const overdue = rows.filter((item) =>
    assignmentMatchesCommandFocus(item, "Overdue"),
  );
  const review = rows.filter((item) =>
    assignmentMatchesCommandFocus(item, "Awaiting Review"),
  );
  const finalPending = rows.filter((item) =>
    assignmentMatchesCommandFocus(item, "Final Report Pending"),
  );

  const mine = active.filter((item) =>
    item.members.some((member) => member.name === currentUserName),
  ).length;

  return (
    <section className="assignments-command-centre assignments-command-centre-compact" aria-label="Assignments command centre">
      <header className="module-command-centre-head module-command-centre-head-compact">
        <div>
          <small>ASSIGNMENTS</small>
          <h3>Assignment workspace</h3>
          <p>Open work, deadlines, reviews and finalisation in one place.</p>
        </div>
        <span>{mine} active in your work context</span>
      </header>

      <section className="module-kpi-strip module-kpi-strip-compact" aria-label="Assignment operational filters">
        <button type="button" className="kpi-blue" onClick={() => openFocusPopup("Active")}>
          <small>Active Assignments</small>
          <strong>{active.length}</strong>
          <span>Open authorised work</span>
        </button>
        <button type="button" className="kpi-teal" onClick={() => openFocusPopup("Active Tasks")}>
          <small>Active Tasks</small>
          <strong>{activeTasks}</strong>
          <span>{activeTaskAssignments.length} assignment{activeTaskAssignments.length === 1 ? "" : "s"}</span>
        </button>
        <button type="button" className="kpi-amber" onClick={() => openFocusPopup("Due Soon")}>
          <small>Due Soon</small>
          <strong>{dueSoon.length}</strong>
          <span>Approaching deadline</span>
        </button>
        <button type="button" className="kpi-red" onClick={() => openFocusPopup("Overdue")}>
          <small>Overdue</small>
          <strong>{overdue.length}</strong>
          <span>Past deadline</span>
        </button>
        <button type="button" className="kpi-violet" onClick={() => openFocusPopup("Awaiting Review")}>
          <small>Awaiting Review</small>
          <strong>{review.length}</strong>
          <span>Reviewer action</span>
        </button>
        <button type="button" className="kpi-green" onClick={() => openFocusPopup("Final Report Pending")}>
          <small>Final Report Pending</small>
          <strong>{finalPending.length}</strong>
          <span>Ready to finalise</span>
        </button>
      </section>

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
            aria-label={`${popup.focus} assignments`}
          >
            <header className="command-popup-head">
              <div>
                <small>ASSIGNMENTS</small>
                <h4>{popup.focus}</h4>
                <p>{popup.rows.length} matching authorised record{popup.rows.length === 1 ? "" : "s"}</p>
              </div>
              <button type="button" aria-label="Close popup" onClick={() => setPopup(null)}>×</button>
            </header>

            <div className="command-popup-list">
              {popup.rows.map((item) => {
                const lead =
                  item.members.find((member) => member.role === "Lead") || item.members[0];
                return (
                  <article key={item.id}>
                    <div className="command-popup-record">
                      <small>{assignmentRef(item.id)} · {item.division}</small>
                      <strong>{item.title}</strong>
                      <span>
                        Responsible: {lead?.name || "Unassigned"} · Status: {assignmentDisplayStatus(item)}
                      </span>
                      <span>
                        Priority: {item.priority} · Due: {item.due_date ? new Date(item.due_date).toLocaleDateString("en-KE") : "Not set"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPopup(null);
                        void onOpen(item);
                      }}
                    >
                      Open exact record
                    </button>
                  </article>
                );
              })}

              {!popup.rows.length && (
                <div className="command-popup-empty">
                  No authorised assignments match this dashboard category.
                </div>
              )}
            </div>

            <footer className="command-popup-footer">
              <button
                type="button"
                onClick={() => {
                  const focus = popup.focus;
                  setPopup(null);
                  onFocus(focus);
                }}
              >
                Show in portfolio
              </button>
              <button type="button" onClick={() => setPopup(null)}>Close</button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}

import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import type { ApiAssignment } from "../../../api";
import { navigateWorkspaceTab } from "../../../utils/workspaceNavigation";

import "../assignment-workspace-v6.css";
export type AssignmentWorkspaceTab =
  | "Overview"
  | "Documents"
  | "Reports"
  | "Activity";

type Props = {
  assignment: ApiAssignment | null;
  fallbackTitle: string;
  assignmentId: string | null;
  assignmentReference: string;
  daysRemaining: number | null;
  activeTab: AssignmentWorkspaceTab;
  reportCount: number;
  quickAddOpen: boolean;
  displayLabel: (label: string) => string;
  onBack: () => void;
  onClose: () => void;
  onOpenResearch: () => void | Promise<void>;
  onTabChange: (tab: AssignmentWorkspaceTab) => void;
  onToggleQuickAdd: () => void;
  onQuickAddReport: () => void;
  onQuickAddNote: () => void;
  onQuickAddDocument: (file: File | null) => void | Promise<void>;
  onQuickAddComment: () => void;
  children: ReactNode;
};

const tabs: ReadonlyArray<{ tab: AssignmentWorkspaceTab; label: string }> = [
  { tab: "Overview", label: "Overview" },
  { tab: "Documents", label: "Evidence" },
  { tab: "Reports", label: "Reports" },
  { tab: "Activity", label: "Activity" },
];

const deadlineTone = (daysRemaining: number | null) => {
  if (daysRemaining === null) return "neutral";
  if (daysRemaining < 0) return "danger";
  if (daysRemaining <= 7) return "warning";
  return "healthy";
};

const deadlineText = (daysRemaining: number | null) => {
  if (daysRemaining === null) return "No deadline";
  if (daysRemaining < 0) return `${Math.abs(daysRemaining)} days overdue`;
  if (daysRemaining === 0) return "Due today";
  if (daysRemaining === 1) return "1 day remaining";
  return `${daysRemaining} days remaining`;
};

const workspaceAttention = (
  assignment: ApiAssignment | null,
  daysRemaining: number | null,
  reportCount: number,
): {
  tone: "danger" | "warning" | "info" | "success";
  title: string;
  detail: string;
  tab: AssignmentWorkspaceTab;
  action: string;
} | null => {
  if (!assignment) return null;

  const status = String(assignment.workflow_status || assignment.status || "").toLowerCase();

  if (daysRemaining !== null && daysRemaining < 0) {
    const overdueDays = Math.abs(daysRemaining);
    return {
      tone: "danger",
      title: "Deadline attention",
      detail: `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue. Check outstanding work and reporting before closing this assignment.`,
      tab: "Overview",
      action: "Check outstanding work",
    };
  }

  if (/submitted|review|approval|awaiting/.test(status)) {
    return {
      tone: "info",
      title: "Report decision pending",
      detail: "This assignment is in review or approval. Open Reports to see the submitted report and its decision status.",
      tab: "Reports",
      action: "Open reports",
    };
  }

  if (daysRemaining !== null && daysRemaining <= 3) {
    return {
      tone: "warning",
      title: daysRemaining === 0 ? "Due today" : "Deadline approaching",
      detail:
        reportCount > 0
          ? "Confirm the latest report and evidence are ready before the deadline."
          : "No report is recorded yet. Start or review reporting before the deadline.",
      tab: "Reports",
      action: reportCount > 0 ? "Check reports" : "Start report",
    };
  }

  if (reportCount === 0 && !/completed|closed|cancelled/.test(status)) {
    return {
      tone: "info",
      title: "Reporting not started",
      detail: "No assignment report is recorded yet. Begin reporting early so evidence and contributions are captured as work progresses.",
      tab: "Reports",
      action: "Open reports",
    };
  }

  if (/completed|closed/.test(status)) {
    return {
      tone: "success",
      title: "Assignment completed",
      detail: "The assignment is marked complete. Use Reports for the final record or Activity for the audit trail.",
      tab: "Activity",
      action: "View activity",
    };
  }

  return null;
};

export default function AssignmentWorkspaceShell({
  assignment,
  fallbackTitle,
  assignmentId,
  assignmentReference,
  daysRemaining,
  activeTab,
  reportCount,
  quickAddOpen,
  displayLabel,
  onBack,
  onClose,
  onOpenResearch,
  onTabChange,
  onToggleQuickAdd,
  onQuickAddReport,
  onQuickAddNote,
  onQuickAddDocument,
  onQuickAddComment,
  children,
}: Props) {
  const attention = workspaceAttention(assignment, daysRemaining, reportCount);
  const statusLabel = assignment?.workflow_status || assignment?.status || "Loading";

  const moveTabFocus = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentTab: AssignmentWorkspaceTab,
  ) => {
    const currentIndex = tabs.findIndex(({ tab }) => tab === currentTab);
    if (currentIndex < 0) return;

    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextTab = tabs[nextIndex].tab;
    onTabChange(nextTab);

    window.requestAnimationFrame(() => {
      document
        .getElementById(`assignment-workspace-tab-${nextTab.toLowerCase()}`)
        ?.focus();
    });
  };

  return (
    <div
      className="collab-drawer governed-workspace assignment-workspace"
      data-tab={activeTab}
      data-assignment-status={statusLabel.toLowerCase()}
      data-assignment-priority={String(assignment?.priority || "unset").toLowerCase()}
    >
      <header className="workspace-command-header assignment-workspace-head">
        <button
          className="assignment-workspace-back"
          type="button"
          title="Back to Assignments"
          onClick={onBack}
        >
          <span aria-hidden="true">&larr;</span> Assignments
        </button>

        <div className="assignment-workspace-title">
          <div className="assignment-title-copy">
            <p>
              Assignment {assignmentId ? assignmentReference : ""}
              <span aria-hidden="true"> &middot; </span>
              {assignment?.division || "Division not recorded"}
            </p>
            <h2>{assignment?.title || fallbackTitle}</h2>
          </div>

          <div className="assignment-title-meta">
            <span className="assignment-status-badge">
              {statusLabel}
            </span>

            <span className="assignment-priority-badge">
              {assignment?.priority || "Priority not set"}
            </span>

            {assignment?.research_id && (
              <button
                type="button"
                className="assignment-research-link"
                title="Open the parent research project"
                onClick={() => void onOpenResearch()}
              >
                Research: {assignment.research_title || "Open project"}
              </button>
            )}

            <span>
              {assignment?.due_date
                ? `Due ${new Date(assignment.due_date).toLocaleDateString("en-KE")}`
                : "No due date"}
            </span>

            <span
              className={`assignment-deadline-badge assignment-deadline-${deadlineTone(daysRemaining)}`}
              aria-live="polite"
            >
              {deadlineText(daysRemaining)}
            </span>
          </div>
        </div>

        <button
          className="assignment-workspace-close"
          type="button"
          aria-label="Close assignment workspace"
          title="Close assignment workspace"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className="assignment-phase4">
        <nav
          className="workspace-primary-tabs assignment-workspace-tabs"
          role="tablist"
          aria-label="Assignment workspace sections"
        >
          {tabs.map(({ tab, label }) => (
            <button
              type="button"
              role="tab"
              id={`assignment-workspace-tab-${tab.toLowerCase()}`}
              aria-selected={activeTab === tab}
              aria-controls={`assignment-workspace-panel-${tab.toLowerCase()}`}
              tabIndex={activeTab === tab ? 0 : -1}
              className={activeTab === tab ? "active" : ""}
              key={tab}
              onKeyDown={(event) => moveTabFocus(event, tab)}
              onClick={(event) =>
                navigateWorkspaceTab(tab, onTabChange, event.currentTarget)
              }
            >
              <span>{displayLabel(label)}</span>
              {tab === "Reports" && reportCount > 0 && <b>{reportCount}</b>}
            </button>
          ))}

          <div className="assignment-quick-add">
            <button
              type="button"
              className="primary"
              aria-haspopup="menu"
              aria-expanded={quickAddOpen}
              onClick={onToggleQuickAdd}
            >
              + Add
            </button>

            {quickAddOpen && (
              <div role="menu">
                <button type="button" onClick={onQuickAddReport}>
                  Report
                </button>
                <button type="button" onClick={onQuickAddNote}>
                  Note
                </button>
                <label>
                  Document
                  <input
                    type="file"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      void onQuickAddDocument(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <button type="button" onClick={onQuickAddComment}>
                  Comment
                </button>
              </div>
            )}
          </div>
        </nav>

        {attention && (
          <section
            className={`assignment-workspace-attention assignment-workspace-attention-${attention.tone}`}
            aria-label="Assignment attention"
          >
            <div>
              <small>Needs attention</small>
              <strong>{attention.title}</strong>
              <p>{attention.detail}</p>
            </div>

            <button
              type="button"
              className={attention.tone === "danger" ? "primary" : ""}
              onClick={(event) =>
                navigateWorkspaceTab(attention.tab, onTabChange, event.currentTarget)
              }
            >
              {attention.action}
            </button>
          </section>
        )}

        <section
          id={`assignment-workspace-panel-${activeTab.toLowerCase()}`}
          role="tabpanel"
          aria-labelledby={`assignment-workspace-tab-${activeTab.toLowerCase()}`}
          className="assignment-workspace-tabpanel"
        >
          {children}
        </section>
      </div>
    </div>
  );
}

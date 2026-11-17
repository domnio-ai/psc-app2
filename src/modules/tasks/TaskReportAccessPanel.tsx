import type { ApiAssignmentTask } from "../../api";

import "./task-report-work-v5.css";
type Props = {
  task: ApiAssignmentTask;
  reportMode: "blank" | "structured";
  isOwner: boolean;
  isReviewer: boolean;
  responsibilityStage: string;
  responsibilityAction: string;
  previewBusy: boolean;
  readySectionCount: number;
  totalSectionCount: number;
  submissionReady: boolean;
  outlineSections: Array<{
    id: string;
    title: string;
    status: string;
  }>;
  onContinueReport: () => void;
  onPreviewLockedReport: () => void;
};

export default function TaskReportAccessPanel({
  task,
  reportMode,
  isOwner,
  isReviewer,
  previewBusy,
  readySectionCount,
  totalSectionCount,
  submissionReady,
  onContinueReport,
  onPreviewLockedReport,
}: Props) {
  if (isOwner) {
    if (task.contribution_status === "Draft" && task.status !== "Blocked") {
      if (reportMode === "blank") {
        const body = String(task.blank_content || "");
        const textOnly = body
          .replace(/<[^>]*>/g, " ")
          .replace(/&nbsp;|&#160;/gi, " ")
          .replace(/\s+/g, " ")
          .trim();
        const hasContent = Boolean(
          textOnly || /<(?:img|table)\b/i.test(body),
        );

        return (
          <section
            className="task-report-work-panel task-report-blank-work-panel"
            aria-label="Blank Task Report"
          >
            <header className="task-report-work-head">
              <div>
                <small>TASK REPORT · BLANK TEMPLATE</small>
                <h3>{task.contribution_title || `${task.title} — Task Report`}</h3>
                <p>
                  This report uses one continuous editable body. Save Draft or close the
                  report builder to preserve your changes. Preview before submission.
                </p>
              </div>
            </header>

            <div className="task-report-blank-status" role="status">
              <span className={`task-report-blank-indicator ${hasContent ? "has-content" : "empty"}`} />
              <div>
                <strong>{hasContent ? "Report body contains content" : "No report content yet"}</strong>
                <small>
                  {hasContent
                    ? "Continue editing your existing draft."
                    : "Start writing when ready, then save the draft or close the builder to preserve it."}
                </small>
              </div>
            </div>

            <div className="task-report-blank-actions">
              <button
                type="button"
                className="primary task-report-next-action-button"
                onClick={onContinueReport}
              >
                {hasContent ? "Continue Task Report" : "Start Task Report"}
              </button>
            </div>
          </section>
        );
      }

      const percentage =
        totalSectionCount > 0
          ? Math.round((readySectionCount / totalSectionCount) * 100)
          : 0;

      return (
        <section className="task-report-work-panel task-report-simple-progress" aria-label="Task Report work progress">
          <header className="task-report-work-head">
            <div>
              <small>TASK REPORT</small>
              <h3>{task.contribution_title || `${task.title} — Task Report`}</h3>
            </div>
            <span className="task-report-simple-count">{readySectionCount} of {totalSectionCount} sections drafted</span>
          </header>

          <div className="task-report-work-bar" aria-hidden="true">
            <span style={{ width: `${percentage}%` }} />
          </div>

          <div className="task-report-simple-footer">
            <span>{submissionReady ? "Ready to preview and submit." : "Preview is required before submission."}</span>
            <button type="button" className="primary task-report-next-action-button" onClick={onContinueReport}>
              {readySectionCount > 0 ? "Continue Task Report" : "Start Task Report"}
            </button>
          </div>
        </section>
      );
    }

    return (
      <section className="task-workspace-readonly task-report-locked-card task-workflow-action-only">
        <small>Report editing is locked at the current workflow stage.</small>
        <button
          type="button"
          className="task-review-open-report"
          disabled={previewBusy}
          onClick={onPreviewLockedReport}
        >
          {previewBusy ? "Opening report..." : "Preview locked report"}
        </button>
      </section>
    );
  }

  return (
    <section className="task-workspace-readonly task-report-builder-access task-workflow-access-compact">
      <strong>Report builder: {task.owner_name || "Designated task owner"}</strong>
      {isReviewer ? (
        <small>Review controls become available after the report is submitted.</small>
      ) : (
        <small>Only the designated task owner can edit and save this draft.</small>
      )}
    </section>
  );
}

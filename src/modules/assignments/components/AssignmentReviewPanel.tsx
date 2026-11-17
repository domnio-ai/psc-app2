import { useState } from "react";
import type { ApiAssignmentTask, GeneratedDocumentSummary } from "../../../api";
import WorkflowNextActionDialog from "../../../components/WorkflowNextActionDialog";
import "../../../components/workflow-next-action.css";

import "../assignment-review-v5.css";
type ReviewDecision = "Changes Requested" | "Rejected" | "Approved";

type Props = {
  assignmentTitle: string;
  documents: GeneratedDocumentSummary[];
  tasks: ApiAssignmentTask[];
  currentUserId?: string;
  reviewComment: string;
  reviewSaving: boolean;
  onReviewCommentChange: (value: string) => void;
  onReviewSavingChange: (value: boolean) => void;
  onNotice: (message: string) => void;
  onOpenGeneratedDocument: (id: string, preview: boolean) => void;
  onReviewDecision: (id: string, decision: ReviewDecision, comments: string) => Promise<void>;
  onOpenTaskWorkspace: (task: ApiAssignmentTask, reviewMode?: boolean) => void;
  onOpenTaskReportPreview: (task: ApiAssignmentTask, reviewMode: boolean) => void;
  onOpenTasksTab: () => void;
  statusLabel: (status: ApiAssignmentTask["contribution_status"]) => string;
};

export default function AssignmentReviewPanel({
  assignmentTitle,
  documents,
  tasks,
  currentUserId,
  reviewComment,
  reviewSaving,
  onReviewCommentChange,
  onReviewSavingChange,
  onNotice,
  onOpenGeneratedDocument,
  onReviewDecision,
  onOpenTaskWorkspace,
  onOpenTaskReportPreview,
  onOpenTasksTab,
  statusLabel,
}: Props) {
  const finalReports = documents
    .filter(
      (document) =>
        document.template_key === "assignment-final-report" ||
        /Final Assignment Report/i.test(document.title || ""),
    )
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  const [decisionResult,setDecisionResult]=useState<{title:string;outcome:string;nextAction:string}|null>(null);
  const report = finalReports[0] || null;
  const reviewerCanDecide = Boolean(
    report && report.reviewer_id === currentUserId,
  );

  const awaitingDecision = Boolean(
    report && ["Submitted", "Under Review"].includes(report.status),
  );
  const acceptedTasks = tasks.filter(
    (task) => task.contribution_status === "Accepted",
  );
  const pendingTaskReviews = tasks.filter(
    (task) =>
      task.reviewer_id === currentUserId &&
      ["Ready for Integration", "Integrated"].includes(task.contribution_status),
  );

  const decide = async (decision: ReviewDecision, requireComment: boolean) => {
    if (!report) return;
    const comments = reviewComment.trim();
    if (requireComment && !comments) return;
    try {
      onReviewSavingChange(true);
      await onReviewDecision(report.id, decision, comments);
      onReviewCommentChange("");
      setDecisionResult({
        title: decision === "Approved" ? "Assignment report approved" : decision === "Rejected" ? "Assignment report rejected" : "Changes requested",
        outcome: decision === "Approved" ? "The report is approved and final publication is completed automatically." : decision === "Rejected" ? "The rejected report version is locked and preserved in the review history." : "The submitted report is returned for revision.",
        nextAction: decision === "Approved"
          ? "No further reviewer action is required. The approved report is available in the Document Repository."
          : decision === "Rejected"
            ? "The Assignment Lead must prepare and submit a new report version if the work is to continue. The report author has been notified."
            : "The Assignment Lead must revise the report and resubmit it for review.",
      });
    } catch (error) {
      const fallback =
        decision === "Changes Requested"
          ? "The report could not be returned for changes."
          : decision === "Rejected"
            ? "The report could not be rejected."
            : "The report could not be approved.";
      onNotice(error instanceof Error ? error.message : fallback);
    } finally {
      onReviewSavingChange(false);
    }
  };

  if (!report && pendingTaskReviews.length > 0) {
    return (
      <section className="assignment-review-v3">
        <section className="task-review-routing-card">
          <header>
            <div>
              <small>TASK REPORT REVIEW</small>
              <h2>{assignmentTitle}</h2>
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
                  <h3>{task.contribution_title || `${task.title} — Contribution Report`}</h3>
                  <p>Task: {task.title} · Submitted by {task.owner_name || "Task owner"}</p>
                </div>
                <span className="task-review-routing-status">
                  {task.contribution_status === "Integrated"
                    ? "Approved · finalisation pending"
                    : "Submitted · decision required"}
                </span>
                <button
                  type="button"
                  className="app-action-primary"
                  onClick={() => {
                    onOpenTasksTab();
                    onOpenTaskWorkspace(task, true);
                  }}
                >
                  {task.contribution_status === "Integrated"
                    ? "Open approved task report"
                    : "Open task review"}
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
      </section>
    );
  }

  return (
    <section className="assignment-review-v3">
      {decisionResult && <WorkflowNextActionDialog {...decisionResult} onClose={() => setDecisionResult(null)} />}
      <header className="assignment-review-v3-head">
        <div>
          <small>FORMAL ASSIGNMENT REVIEW</small>
          <h2>{assignmentTitle}</h2>
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
                {report.reference} · Version {report.version} · Reviewer: {report.reviewer_name || "Not assigned"}
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
              <button type="button" className="app-action-primary" onClick={() => onOpenGeneratedDocument(report.id, true)}>
                View Report
              </button>
              {report.repository_document_id && report.status === "Final" && (
                <button type="button" className="app-action-secondary" onClick={() => onOpenGeneratedDocument(report.id, true)}>
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
                    value={reviewComment}
                    onChange={(event) => onReviewCommentChange(event.target.value)}
                    placeholder="Record evidence gaps, required corrections, rejection reasons, or an approval note."
                  />
                </label>
                <div className="assignment-review-decision-actions">
                  <button type="button" className="app-action-return" disabled={reviewSaving || !reviewComment.trim()} onClick={() => void decide("Changes Requested", true)}>
                    Return for Changes
                  </button>
                  <button type="button" className="app-action-danger" disabled={reviewSaving || !reviewComment.trim()} onClick={() => void decide("Rejected", true)}>
                    Reject Report
                  </button>
                  <button type="button" className="app-action-approve" disabled={reviewSaving} onClick={() => void decide("Approved", false)}>
                    Approve Report
                  </button>
                </div>
                <small className="assignment-review-help">
                  Return for Changes reopens the report for revision. Reject preserves the rejected version as a terminal review decision. Approve publishes the final controlled copy automatically.
                </small>
              </div>
            )}

            {awaitingDecision && !reviewerCanDecide && (
              <div className="assignment-review-readonly-note app-attention-notice" role="alert">
                <strong>Decision required:</strong> This report is awaiting a decision from {report.reviewer_name || "its assigned reviewer"}. You can view it but cannot record the formal decision.
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

            {report.status === "Approved" && (
              <div className="assignment-review-readonly-note app-attention-notice" role="status">
                <strong>Approval recorded:</strong> Final publication is completed automatically as part of the reviewer’s decision.
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
          <span>{acceptedTasks.length}/{tasks.length} final</span>
        </header>
        <div className="review-v3-source-list">
          {tasks.map((task) => (
            <article key={task.id}>
              <span>
                <strong>{task.contribution_title || `${task.title} report`}</strong>
                <small>{task.owner_name || "Unassigned"} · Reviewer: {task.reviewer_name || "Not assigned"}</small>
              </span>
              <b>{statusLabel(task.contribution_status)}</b>
              {task.contribution_status === "Accepted" ? (
                <button type="button" className="app-action-secondary" onClick={() => onOpenTaskReportPreview(task, false)}>
                  View Supporting Task Report
                </button>
              ) : task.contribution_status === "Ready for Integration" && task.reviewer_id === currentUserId ? (
                <button type="button" className="app-action-primary" onClick={() => onOpenTaskReportPreview(task, true)}>
                  Review Submitted Task Report
                </button>
              ) : (
                <button type="button" className="app-action-secondary" onClick={() => onOpenTaskWorkspace(task, true)}>
                  Open Task Report
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

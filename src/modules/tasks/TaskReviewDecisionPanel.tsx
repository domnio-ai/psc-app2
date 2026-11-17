import type { ApiAssignmentTask } from "../../api";

import "./task-review-decision-v5-1.css";
type ReviewDecision = "Changes Requested" | "Rejected" | "Approved";

type ReviewResult = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

type Props = {
  task: ApiAssignmentTask;
  canReview: boolean;
  contributionStatus: string;
  reviewComment: string;
  reviewSaving: boolean;
  finalizing: boolean;
  previewBusy: boolean;
  reviewResult: ReviewResult;
  rejectionReason: string;
  canReopenRejected: boolean;
  onReviewCommentChange: (value: string) => void;
  onPreviewReport: () => void;
  onDecision: (decision: ReviewDecision) => void;
  onFinalize: () => void;
  onReopenRejected: () => void;
};

export default function TaskReviewDecisionPanel({
  task,
  canReview,
  contributionStatus,
  reviewComment,
  reviewSaving,
  finalizing,
  previewBusy,
  reviewResult,
  rejectionReason,
  canReopenRejected,
  onReviewCommentChange,
  onPreviewReport,
  onDecision,
  onFinalize,
  onReopenRejected,
}: Props) {
  if (!canReview) return null;

  if (contributionStatus === "Integrated") {
    return (
      <section className="task-review-decision-card task-review-approved-card">
        <header>
          <div>
            <span className="workspace-eyebrow">REVIEW APPROVED</span>
            <h3>Generate the final task report</h3>
          </div>
          <b>{task.reviewer_name || "Assigned reviewer"}</b>
        </header>

        <button
          type="button"
          className="task-review-open-report"
          disabled={previewBusy}
          onClick={onPreviewReport}
        >
          {previewBusy ? "Opening approved report..." : "Preview approved submission"}
        </button>

        <footer>
          <button
            type="button"
            className="task-review-accept"
            disabled={finalizing}
            onClick={onFinalize}
          >
            {finalizing
              ? "Generating & Saving..."
              : "Generate Final Report & Save to Repository"}
          </button>
        </footer>

        {reviewResult && (
          <div className={`task-review-result ${reviewResult.tone}`} role="status">
            {reviewResult.message}
          </div>
        )}
      </section>
    );
  }

  if (task.status === "Blocked") {
    return (
      <section className="task-review-rejected-card">
        <header>
          <div>
            <span className="workspace-eyebrow">SUBMISSION REJECTED</span>
            <h3>Management action required</h3>
          </div>
          <b>Rejected</b>
        </header>

        {rejectionReason && (
          <div className="task-review-rejection-reason">
            <span>Reason</span>
            <p>{rejectionReason}</p>
          </div>
        )}

        {canReopenRejected ? (
          <footer>
            <button
              type="button"
              className="task-review-reopen"
              disabled={reviewSaving}
              onClick={onReopenRejected}
            >
              {reviewSaving ? "Reopening..." : "Reopen for Revision"}
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

  if (contributionStatus !== "Ready for Integration") return null;

  return (
    <section className="task-review-decision-card">
      <header>
        <div>
          <span className="workspace-eyebrow">REVIEW DECISION</span>
          <h3>Review submitted task report</h3>
        </div>
        <b>{task.reviewer_name || "Assigned reviewer"}</b>
      </header>

      <button
        type="button"
        className="task-review-open-report"
        disabled={previewBusy}
        onClick={onPreviewReport}
      >
        {previewBusy ? "Opening report..." : "Preview submitted report"}
      </button>

      <label>
        <span>Reviewer comments</span>
        <textarea
          rows={4}
          value={reviewComment}
          onChange={(event) => onReviewCommentChange(event.target.value)}
          placeholder="Record corrections, evidence gaps or an approval note."
        />
      </label>

      <footer>
        <button
          type="button"
          className="task-review-changes"
          disabled={reviewSaving || !reviewComment.trim()}
          onClick={() => onDecision("Changes Requested")}
        >
          {reviewSaving ? "Recording..." : "Request Changes"}
        </button>

        <button
          type="button"
          className="task-review-reject"
          disabled={reviewSaving || !reviewComment.trim()}
          onClick={() => onDecision("Rejected")}
        >
          {reviewSaving ? "Recording..." : "Reject Submission"}
        </button>

        <button
          type="button"
          className="task-review-accept"
          disabled={reviewSaving}
          onClick={() => onDecision("Approved")}
        >
          {reviewSaving ? "Recording approval..." : "Approve Report"}
        </button>
      </footer>

      {reviewResult && (
        <div className={`task-review-result ${reviewResult.tone}`} role="status">
          {reviewResult.message}
        </div>
      )}
    </section>
  );
}

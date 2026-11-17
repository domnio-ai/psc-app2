import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import TaskReportReviewerPicker, { type TaskReportReviewerOption } from "./TaskReportReviewerPicker";

type ReviewDecision = "Changes Requested" | "Rejected" | "Approved";

type ReviewResult = {
  tone: string;
  message?: string;
} | null;

type Props = {
  title: string;
  html: string;
  isOwner: boolean;
  isReviewer: boolean;
  contributionStatus: string;
  reviewerNames: string[];
  reviewerDetails: string[];
  reviewerName: string;
  reviewerOptions: TaskReportReviewerOption[];
  selectedReviewerId: string;
  reviewerSaving: boolean;
  onReviewerChange: (reviewerId: string) => void | Promise<void>;
  submissionReady: boolean;
  missingSectionNames: string[];
  contributionSaving: boolean;
  reviewComment: string;
  reviewSaving: boolean;
  reviewResult: ReviewResult;
  onClose: () => void;
  onCopy: (characters: number) => void;
  onSubmit: () => void;
  onReviewCommentChange: (value: string) => void;
  onReviewDecision: (decision: ReviewDecision) => void;
};

export default function TaskReportPreviewPanel({
  title,
  html,
  isOwner,
  isReviewer,
  contributionStatus,
  reviewerNames,
  reviewerDetails,
  reviewerName,
  reviewerOptions,
  selectedReviewerId,
  reviewerSaving,
  onReviewerChange,
  submissionReady,
  missingSectionNames,
  contributionSaving,
  reviewComment,
  reviewSaving,
  reviewResult,
  onClose,
  onCopy,
  onSubmit,
  onReviewCommentChange,
  onReviewDecision,
}: Props) {
  const copyBound = useRef(false);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const ownerDraft = isOwner && contributionStatus === "Draft";
  const reviewerReady =
    isReviewer && contributionStatus === "Ready for Integration";
  const applyReaderZoom = (frame: HTMLIFrameElement | null, percent = zoomPercent) => {
    // The iframe can briefly have no document root while srcDoc is mounting,
    // navigating, or being torn down. Guard each link in the DOM chain.
    const root = frame?.contentDocument?.documentElement;
    root?.style?.setProperty("--task-report-reader-zoom", String(percent / 100));
  };
  const fitReaderToWidth = () => {
    const frameWidth = previewFrameRef.current?.clientWidth || 0;
    if (!frameWidth) return setZoomPercent(100);
    const fittedPercent = Math.floor(((frameWidth - 48) / 1040) * 100 / 5) * 5;
    setZoomPercent(Math.max(50, Math.min(100, fittedPercent)));
  };

  useEffect(() => {
    applyReaderZoom(previewFrameRef.current);
  }, [zoomPercent]);

  return createPortal(
    <div
      className={`task-contribution-report-overlay${maximized ? " maximized" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Contribution report preview"
    >
      <section className={`task-contribution-report-modal${maximized ? " maximized" : ""}`}>
        <header>
          <div>
            <span className="workspace-eyebrow">TASK REPORT PREVIEW</span>
            <h3>{title}</h3>
            <p>Check the report exactly as the assigned reviewer will receive it.</p>
          </div>
          <div className="task-contribution-report-header-actions">
            <div className="task-report-reader-sizing" role="group" aria-label="Reader page sizing">
              <button
                type="button"
                aria-label="Zoom out"
                title="Zoom out"
                disabled={zoomPercent <= 50}
                onClick={() => setZoomPercent((current) => Math.max(50, current - 10))}
              >
                −
              </button>
              <button
                type="button"
                className="task-report-reader-zoom-value"
                aria-label={`Reader zoom ${zoomPercent} percent; reset to 100 percent`}
                title="Reset zoom to 100%"
                onClick={() => setZoomPercent(100)}
              >
                {zoomPercent}%
              </button>
              <button
                type="button"
                aria-label="Zoom in"
                title="Zoom in"
                disabled={zoomPercent >= 150}
                onClick={() => setZoomPercent((current) => Math.min(150, current + 10))}
              >
                +
              </button>
              <button type="button" className="task-report-reader-fit" onClick={fitReaderToWidth}>
                Fit page
              </button>
            </div>
            <button
              type="button"
              className="task-report-reader-maximize"
              aria-label={maximized ? "Restore reader" : "Maximise reader"}
              title={maximized ? "Restore reader" : "Maximise reader"}
              aria-pressed={maximized}
              onClick={() => setMaximized((value) => !value)}
            >
              {maximized ? "Restore reader" : "Maximise reader"}
            </button>
            <button type="button" onClick={onClose}>Close</button>
          </div>
        </header>

        <div className={`task-contribution-report-body ${reviewerReady ? "has-reviewer-panel" : ""}`}>
        <div className="task-contribution-report-frame">
          <iframe
            ref={previewFrameRef}
            title="Task contribution report preview"
            srcDoc={html}
            onLoad={(event) => {
              const frameDocument = event.currentTarget.contentDocument;
              if (!frameDocument) return;
              applyReaderZoom(event.currentTarget);
              if (copyBound.current) return;
              copyBound.current = true;
              frameDocument.addEventListener(
                "copy",
                () => {
                  const selected =
                    frameDocument.getSelection()?.toString().trim() || "";
                  if (selected) onCopy(selected.length);
                },
                true,
              );
            }}
          />
        </div>

          {reviewerReady && (
            <div className="task-preview-review-panel">
              <div className="task-preview-review-heading">
                <div>
                  <small>REVIEW DECISION</small>
                  <strong>Your review is required</strong>
                </div>
                <span>
                  Read the complete report above, then record your formal decision here.
                </span>
              </div>

              <label className="task-preview-review-comments">
                <span>Reviewer comments</span>
                <textarea
                  rows={3}
                  value={reviewComment}
                  onChange={(event) => onReviewCommentChange(event.target.value)}
                  placeholder="Add an approval note, or describe corrections required."
                />
              </label>

              <div className="task-preview-review-actions">
                <button
                  type="button"
                  className="task-review-changes"
                  disabled={reviewSaving || !reviewComment.trim()}
                  onClick={() => onReviewDecision("Changes Requested")}
                >
                  {reviewSaving ? "Recording..." : "Request Changes"}
                </button>

                <button
                  type="button"
                  className="task-review-reject"
                  disabled={reviewSaving || !reviewComment.trim()}
                  onClick={() => onReviewDecision("Rejected")}
                >
                  {reviewSaving ? "Recording..." : "Reject"}
                </button>

                <button
                  type="button"
                  className="task-review-accept"
                  disabled={reviewSaving}
                  onClick={() => onReviewDecision("Approved")}
                >
                  {reviewSaving ? "Recording approval..." : "Approve Report"}
                </button>
              </div>

              {reviewResult && (
                <div className={`task-review-result ${reviewResult.tone}`} role="status">
                  {reviewResult.message || "Review decision recorded."}
                </div>
              )}
            </div>
          )}
        </div>

        <footer>
          {ownerDraft && (
            <div className="task-preview-reviewer-selection">
              <TaskReportReviewerPicker
                options={reviewerOptions}
                value={selectedReviewerId}
                busy={reviewerSaving}
                variant="preview"
                label="Reviewer for this submission"
                helper="Choose the authorised reviewer who will receive this report."
                onChange={onReviewerChange}
              />
            </div>
          )}
          {!isReviewer && (
            <button type="button" className="task-modal-secondary" onClick={onClose}>
              {ownerDraft ? "Back to Edit" : "Close Preview"}
            </button>
          )}

          {ownerDraft && (
            <>
              <div className="task-authorized-reviewers">
                <small>AUTHORISED TO REVIEW</small>
                <strong>
                  {reviewerNames.length
                    ? reviewerNames.join(", ")
                    : "No active reviewer is currently assigned"}
                </strong>
                <span>{reviewerDetails.join(" Â· ")}</span>
              </div>

              <div
                className={`task-review-result ${
                  submissionReady ? "success" : "info"
                }`}
                role="status"
              >
                {submissionReady
                  ? `Ready to submit to ${reviewerName}.`
                  : !reviewerNames.length
                    ? "Reviewer required before submission."
                    : `Complete ${missingSectionNames.length} required section${
                        missingSectionNames.length === 1 ? "" : "s"
                      }: ${missingSectionNames.join(", ")}.`}
              </div>

              <button
                type="button"
                className="task-contribution-ready"
                disabled={contributionSaving || reviewerSaving}
                onClick={onSubmit}
              >
                {reviewerSaving ? "Saving reviewer..." : contributionSaving ? "Sending..." : "Submit to Reviewer"}
              </button>
            </>
          )}

          {isReviewer && contributionStatus === "Accepted" && (
            <div className="task-preview-final-state">
              <div>
                <small>FINAL TASK REPORT</small>
                <strong>Review already completed</strong>
              </div>
              <span>
                This version has already been approved and finalized. It is available
                as a supporting source for the Assignment Report.
              </span>
            </div>
          )}
        </footer>
      </section>
    </div>,
    document.body,
  );
}


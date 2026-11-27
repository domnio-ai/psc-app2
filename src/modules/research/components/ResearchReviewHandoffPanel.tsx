import type { ResearchReportVersion } from "../../../api";
import GovernedWorkflowStrip from "../../workflow/GovernedWorkflowStrip";
import { researchGovernedStageIndex } from "../../workflow/governedWorkflowModel";

type ReviewerOption = {
  id: string;
  name: string;
  role: string;
};

type AssignedReviewer = {
  reviewer_id: string;
  name?: string | null;
};

type Props = {
  reportVersions: ResearchReportVersion[];
  latestApprovedVersion: ResearchReportVersion | null | undefined;
  currentUserId?: string;
  researchTab: string;
  hasDraftContent: boolean;
  hasControlledEvidence: boolean;
  canSubmitForReview: boolean;
  assignedReviewers: AssignedReviewer[];
  eligibleReviewers: ReviewerOption[];
  assignedReviewerIds: Set<string>;
  canChooseReviewer: boolean;
  eligibleReviewersLoading: boolean;
  draftReviewerId: string;
  submitting: boolean;
  decisionSubmitting: boolean;
  reviewComments: string;
  reviewerCanDecide: boolean;
  onReturnToReport: () => void;
  onPreviewReport: () => void;
  onReviewerChange: (reviewerId: string) => void;
  onSubmitForReview: () => void;
  onOpenResources: () => void;
  onReviewCommentsChange: (comments: string) => void;
  onDecision: (decision: "Approved" | "Changes Requested" | "Rejected") => void;
};

export default function ResearchReviewHandoffPanel({
  reportVersions,
  latestApprovedVersion,
  currentUserId,
  researchTab,
  hasDraftContent,
  hasControlledEvidence,
  canSubmitForReview,
  assignedReviewers,
  eligibleReviewers,
  assignedReviewerIds,
  canChooseReviewer,
  eligibleReviewersLoading,
  draftReviewerId,
  submitting,
  decisionSubmitting,
  reviewComments,
  reviewerCanDecide,
  onReturnToReport,
  onPreviewReport,
  onReviewerChange,
  onSubmitForReview,
  onOpenResources,
  onReviewCommentsChange,
  onDecision,
}: Props) {
  const latest = reportVersions[0];
  const governedStageIndex = researchGovernedStageIndex(latest?.status, researchTab);

  return (
    <section className="research-report-review-gate research-submit-review-section">
      <div>
        <p>FORMAL REVIEW</p>
        <h3>Review, submit and record the decision</h3>
        <span>
          This stage controls the formal report handoff. Researchers submit a numbered version; reviewers assess that locked version and record an auditable decision.
        </span>
      </div>

      <div
        className={`research-review-status-card ${
          latest?.status === "Approved"
            ? "approved"
            : latest?.status === "Submitted"
              ? "submitted"
              : ["Changes Requested", "Rejected"].includes(latest?.status || "")
                ? "action"
                : "draft"
        }`}
      >
        <div>
          <small>CURRENT STEP</small>
          <strong>
            {latest?.status === "Approved"
              ? "Review approved"
              : latest?.status === "Submitted"
                ? `Awaiting decision from ${latest?.reviewer_name || "assigned reviewer"}`
                : latest?.status === "Changes Requested"
                  ? "Changes requested"
                  : latest?.status === "Rejected"
                    ? "Report rejected"
                    : "Prepare and submit the report"}
          </strong>
          <span>
            {latest?.status === "Approved"
              ? latestApprovedVersion?.submitted_by === currentUserId
                ? `Your submitted version is approved. ${
                    latestApprovedVersion?.reviewed_by_name ||
                    latestApprovedVersion?.reviewer_name ||
                    "The approver"
                  } must generate the controlled final report.`
                : "The approved version is locked. The approver can generate the controlled final report below."
              : latest?.status === "Submitted"
                ? `The submitted version is locked while ${latest?.reviewer_name || "the assigned reviewer"} assesses it.`
                : latest?.status === "Changes Requested"
                  ? "Return to Report, revise the draft, preview it, and submit a new version."
                  : latest?.status === "Rejected"
                    ? "Return to Report and address the reviewer decision before preparing a new submission."
                    : "Preview the complete draft, choose the formal reviewer and submit a locked version."}
          </span>
        </div>
        {["Changes Requested", "Rejected"].includes(latest?.status || "") && (
          <button type="button" onClick={onReturnToReport}>
            Return to Report
          </button>
        )}
      </div>

      <div className="research-review-guidance" aria-label="What happens in formal review">
        <article>
          <small>IF YOU ARE THE RESEARCHER</small>
          <strong>Preview first, then submit a locked version</strong>
          <span>
            Once submitted, that numbered version cannot be edited. If changes are requested, return to Report and prepare a new revision.
          </span>
        </article>
        <article>
          <small>IF YOU ARE THE REVIEWER</small>
          <strong>Assess the exact submitted version</strong>
          <span>
            Preview the locked report, record comments where needed, then choose Approve, Request Changes or Reject.
          </span>
        </article>
        <article>
          <small>AFTER APPROVAL</small>
          <strong>Generate the controlled final report</strong>
          <span>
            The authorised approver generates the final controlled copy. APP2 then publishes it to Documents and completes the research project.
          </span>
        </article>
      </div>

      <div className="research-report-review-summary">
        <span>
          <small>Submitted version</small>
          <strong>{latest ? `v${latest.version_number}` : "Draft"}</strong>
        </span>
        <span>
          <small>Review status</small>
          <strong>{latest?.status || (researchTab === "Review" ? "Not submitted" : "Editing")}</strong>
        </span>
        <span>
          <small>Formal reviewer</small>
          <strong>{latest?.reviewer_name || "Not submitted"}</strong>
        </span>
      </div>

      {latest?.review_comments && (
        <div className="research-report-review-note">
          <strong>Reviewer comments</strong>
          <p>{latest.review_comments}</p>
        </div>
      )}

      <GovernedWorkflowStrip
        currentIndex={governedStageIndex}
        returned={["Changes Requested", "Rejected"].includes(latest?.status || "")}
        compact
        label="Research governed workflow"
      />

      <div className="research-report-review-actions">
        <button type="button" onClick={onPreviewReport} disabled={!hasDraftContent}>
          Preview Report
        </button>

        {latest?.status !== "Submitted" && latest?.status !== "Approved" && canSubmitForReview && (
          <>
            {!hasControlledEvidence && (
              <div className="research-submission-readiness-blocker" role="status">
                <strong>One step before reviewer submission</strong>
                <span>Add at least one controlled source or link a published Repository document. Your report stays editable until you complete this step.</span>
                <button type="button" onClick={onOpenResources}>Open Resources</button>
              </div>
            )}
            <label className="research-formal-reviewer-select">
              <span>Formal reviewer</span>
              <select
                value={draftReviewerId}
                disabled={eligibleReviewersLoading}
                onChange={(event) => onReviewerChange(event.target.value)}
              >
                <option value="">
                  {eligibleReviewersLoading
                    ? "Loading eligible reviewers..."
                    : assignedReviewers.length
                      ? "Select assigned or eligible reviewer"
                      : canChooseReviewer
                        ? "Select reviewer"
                        : "No formal reviewer assigned"}
                </option>

                {assignedReviewers.map((reviewer) => (
                  <option key={`assigned-${reviewer.reviewer_id}`} value={reviewer.reviewer_id}>
                    {reviewer.name || "Reviewer"} — assigned
                  </option>
                ))}

                {canChooseReviewer &&
                  eligibleReviewers
                    .filter((reviewer) => !assignedReviewerIds.has(reviewer.id))
                    .map((reviewer) => (
                      <option key={`eligible-${reviewer.id}`} value={reviewer.id}>
                        {reviewer.name} — {reviewer.role}
                      </option>
                    ))}
              </select>

              {!assignedReviewers.length && !canChooseReviewer && (
                <small>
                  No formal reviewer is assigned. The Research Lead or their immediate supervisor must assign one before submission.
                </small>
              )}

              {!assignedReviewers.length &&
                canChooseReviewer &&
                !eligibleReviewersLoading &&
                eligibleReviewers.length > 0 && (
                  <small>
                    No reviewer is assigned yet. Select an eligible reviewer here; APP2 will formally assign that reviewer when the report is submitted.
                  </small>
                )}

              {!eligibleReviewersLoading &&
                canChooseReviewer &&
                eligibleReviewers.length === 0 &&
                !assignedReviewers.length && (
                  <small>
                    No eligible reviewer is available in the immediate supervisor&apos;s team. Confirm the Research Lead&apos;s reporting line in Users and Roles.
                  </small>
                )}
            </label>

            <button
              type="button"
              className="research-lock-submit-action"
              disabled={submitting || !draftReviewerId || !hasDraftContent || !hasControlledEvidence}
              onClick={onSubmitForReview}
            >
              {submitting ? "Submitting..." : "Lock Version & Submit"}
            </button>
          </>
        )}

        {latest?.status === "Submitted" && reviewerCanDecide && (
          <div className="research-report-decision-box">
            <header>
              <div>
                <small>REVIEWER DECISION</small>
                <strong>Assess locked version v{latest.version_number}</strong>
                <span>
                  Your decision is recorded against this exact version. Preview it before deciding.
                </span>
              </div>
              <button type="button" onClick={onPreviewReport}>
                Preview Submitted Report
              </button>
            </header>

            <div className="research-review-decision-guide">
              <article>
                <strong>Approve</strong>
                <span>The report is acceptable for finalisation.</span>
              </article>
              <article>
                <strong>Request Changes</strong>
                <span>The researcher must revise the Report and submit a new version. Comments are required.</span>
              </article>
              <article>
                <strong>Reject</strong>
                <span>The submitted version is not acceptable in its current form. Comments are required.</span>
              </article>
            </div>

            <label>
              <span>Reviewer comments</span>
              <textarea
                value={reviewComments}
                onChange={(event) => onReviewCommentsChange(event.target.value)}
                placeholder="Required when requesting changes or rejecting. Optional for approval."
              />
            </label>

            <div>
              <button type="button" className="approve" disabled={decisionSubmitting} onClick={() => onDecision("Approved")}>
                Approve Report
              </button>
              <button type="button" disabled={decisionSubmitting || !reviewComments.trim()} onClick={() => onDecision("Changes Requested")}>
                Request Changes
              </button>
              <button type="button" className="reject" disabled={decisionSubmitting || !reviewComments.trim()} onClick={() => onDecision("Rejected")}>
                Reject Report
              </button>
            </div>
          </div>
        )}
      </div>

      {reportVersions.length > 0 && (
        <details className="research-report-version-history">
          <summary>Report version history ({reportVersions.length})</summary>
          {reportVersions.map((version) => (
            <article key={version.id}>
              <strong>v{version.version_number} · {version.status}</strong>
              <span>{version.submitted_by_name || "Research team"} → {version.reviewer_name || "Reviewer"}</span>
              <small>
                {version.submitted_at
                  ? new Date(version.submitted_at).toLocaleString("en-KE")
                  : new Date(version.created_at).toLocaleString("en-KE")}
              </small>
            </article>
          ))}
        </details>
      )}
    </section>
  );
}

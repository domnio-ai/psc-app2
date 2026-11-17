import GovernedWorkflowStrip from "../workflow/GovernedWorkflowStrip";
import { taskGovernedStageIndex } from "../workflow/governedWorkflowModel";

type Props = {
  taskStatus: string;
  contributionStatus: string;
  isOwner: boolean;
  isReviewer: boolean;
  ownerName: string;
  reviewerName: string;
  latestReviewAction: string;
  latestReviewComment: string;
};

export default function TaskWorkflowStatusPanel({
  taskStatus,
  contributionStatus,
  isOwner,
  isReviewer,
  ownerName,
  reviewerName,
  latestReviewAction,
  latestReviewComment,
}: Props) {
  let title = "Task report status";
  let detail = "";
  let tone = "neutral";

  if (taskStatus === "Blocked") {
    title = "Rejected · management action required";
    detail = isOwner
      ? "This rejected version is locked. Wait for the assignment lead or manager to reopen it for revision."
      : "The rejected version is preserved. An authorised manager or assignment lead must reopen it before the owner can revise it.";
    tone = "danger";
  } else if (contributionStatus === "Draft") {
    if (isOwner) {
      title = "Draft · your report";
      detail = `Edit the report, save the draft and preview it before submitting it to ${reviewerName}.`;
      tone = "owner";
    } else if (isReviewer) {
      title = "Draft · waiting for submission";
      detail = `You are the assigned reviewer. ${ownerName} is still preparing the report; review controls will appear after submission.`;
      tone = "waiting";
    } else {
      title = "Draft · owner working";
      detail = `${ownerName} owns this draft. It will be reviewed by ${reviewerName} after submission.`;
      tone = "waiting";
    }
  } else if (contributionStatus === "Ready for Integration") {
    if (isReviewer) {
      title = "Submitted · locked for your review";
      detail = `The submitted version from ${ownerName} is frozen. Preview it, then Approve, Request Changes, or Reject.`;
      tone = "review";
    } else if (isOwner) {
      title = "Submitted · locked for reviewer";
      detail = `Your submitted report is frozen and cannot be edited while ${reviewerName} reviews it.`;
      tone = "waiting";
    } else {
      title = "Submitted · locked for review";
      detail = `The submitted version is frozen and awaiting a decision from ${reviewerName}.`;
      tone = "waiting";
    }
  } else if (contributionStatus === "Integrated") {
    title = "Approved · final report pending";
    detail = isReviewer
      ? "The submission is approved. Generate the final task report and save it to the repository to complete the task."
      : `The report is approved and locked. ${reviewerName} or an authorised finaliser must generate the final repository report.`;
    tone = "approved";
  } else if (contributionStatus === "Accepted") {
    title = "Final · repository record created";
    detail =
      "The approved final task report is complete, preserved in the repository and counts toward assignment progress.";
    tone = "final";
  }

  const workflowStageIndex = taskGovernedStageIndex(taskStatus, contributionStatus);
  const workflowReturned = isOwner && latestReviewAction === "TASK_REPORT_CHANGES_REQUESTED";
  const workflowBlocked = taskStatus === "Blocked";

  const showRevisionFeedback =
    isOwner && latestReviewAction === "TASK_REPORT_CHANGES_REQUESTED";

  return (
    <>
      <GovernedWorkflowStrip
        currentIndex={workflowStageIndex}
        blocked={workflowBlocked}
        returned={workflowReturned}
        compact
        label="Task governed workflow"
      />
      <div className={`task-report-access-notice ${tone}`} role="status">
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>

      {showRevisionFeedback && (
        <section className="task-review-feedback-card">
          <span className="workspace-eyebrow">REVIEW FEEDBACK</span>
          <h4>Changes requested</h4>
          <p>
            {latestReviewComment ||
              "The reviewer returned this report for revision."}
          </p>
          <small>Revise the draft and submit it again when ready.</small>
        </section>
      )}
    </>
  );
}

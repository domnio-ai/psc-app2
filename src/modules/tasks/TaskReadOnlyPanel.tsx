import type { ReactNode } from "react";
import type { ApiAssignmentTask } from "../../api";

type Props = {
  task: ApiAssignmentTask;
  isReviewer: boolean;
  contributionStatus: string;
  previewBusy: boolean;
  reviewControls: ReactNode;
  onOpenSubmittedReport: () => void;
};

export default function TaskReadOnlyPanel({
  task,
  isReviewer,
  contributionStatus,
  previewBusy,
  reviewControls,
  onOpenSubmittedReport,
}: Props) {
  const canOpenSubmittedReport = [
    "Ready for Integration",
    "Integrated",
    "Accepted",
  ].includes(contributionStatus);

  return (
    <div className="task-workspace-readonly task-screen-body">
      <strong>{isReviewer ? "Review access" : "View only"}</strong>

      <p>
        {isReviewer
          ? `You are the assigned reviewer for ${
              task.owner_name || "this researcher"
            }'s task report.`
          : `This task is assigned to ${
              task.owner_name || "another team member"
            }.`}
      </p>

      <section>
        <span className="workspace-eyebrow">WORK NOTES</span>
        <p>{task.notes || "No work notes have been saved yet."}</p>
      </section>

      {canOpenSubmittedReport && (
        <button
          type="button"
          className="task-review-open-report"
          disabled={previewBusy}
          onClick={onOpenSubmittedReport}
        >
          {previewBusy ? "Opening report..." : "Open submitted report"}
        </button>
      )}

      {reviewControls}
    </div>
  );
}

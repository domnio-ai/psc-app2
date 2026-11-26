import { useEffect, useState } from "react";
import { api } from "../../api";
import { isResearchTaskOverdue } from "./researchTaskDates.js";

type ResearchAssignmentProgressProps = {
  token: string;
  assignmentId: string;
};

type ProgressState = {
  total: number;
  completed: number;
  accepted: number;
  readyForReview: number;
  overdue: number;
  percent: number;
  loading: boolean;
  error: string;
};

const initialProgress: ProgressState = {
  total: 0,
  completed: 0,
  accepted: 0,
  readyForReview: 0,
  overdue: 0,
  percent: 0,
  loading: true,
  error: "",
};

export function ResearchAssignmentProgress({
  token,
  assignmentId,
}: ResearchAssignmentProgressProps) {
  const [progress, setProgress] = useState<ProgressState>(initialProgress);

  useEffect(() => {
    let cancelled = false;
    setProgress(initialProgress);

    void api
      .assignmentTasks(token, assignmentId)
      .then((tasks) => {
        if (cancelled) return;

        const completed = tasks.filter(
          (task) => task.status === "Completed",
        ).length;

        const accepted = tasks.filter(
          (task) => task.contribution_status === "Accepted",
        ).length;

        const readyForReview = tasks.filter((task) =>
          ["Ready for Integration", "Integrated"].includes(
            task.contribution_status,
          ),
        ).length;

        const overdue = tasks.filter(
          (task) =>
            task.status !== "Completed" &&
            isResearchTaskOverdue(task.due_date),
        ).length;

        setProgress({
          total: tasks.length,
          completed,
          accepted,
          readyForReview,
          overdue,
          percent: tasks.length
            ? Math.round((completed / tasks.length) * 100)
            : 0,
          loading: false,
          error: "",
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setProgress({
          ...initialProgress,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Task progress could not be loaded.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [assignmentId, token]);

  if (progress.loading) {
    return (
      <div className="research-assignment-progress research-assignment-progress-readable">
        <small>Loading task progress...</small>
      </div>
    );
  }

  if (progress.error) {
    return (
      <div className="research-assignment-progress research-assignment-progress-readable">
        <small className="error" title={progress.error}>
          Progress unavailable
        </small>
      </div>
    );
  }

  return (
    <div className="research-assignment-progress research-assignment-progress-readable">
      <div className="research-assignment-progress-head">
        <strong>{progress.percent}%</strong>
        <span>
          {progress.total
            ? `${progress.completed}/${progress.total} tasks completed`
            : "No tasks yet"}
        </span>
      </div>

      <div
        className="research-assignment-progress-bar"
        aria-label={`${progress.percent}% task completion`}
      >
        <i style={{ width: `${progress.percent}%` }} />
      </div>

      <div className="research-assignment-work-signals">
        <span>
          <b>{progress.accepted}</b> accepted output
          {progress.accepted === 1 ? "" : "s"}
        </span>

        {progress.readyForReview > 0 && (
          <span className="review">
            <b>{progress.readyForReview}</b> ready for review
          </span>
        )}

        {progress.overdue > 0 && (
          <span className="overdue">
            <b>{progress.overdue}</b> overdue
          </span>
        )}
      </div>
    </div>
  );
}

export default ResearchAssignmentProgress;

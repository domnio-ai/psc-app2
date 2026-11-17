import {
  api,
  type ApiAssignmentTask,
} from "../../api";
import { recoverTaskReportMarkup } from "./taskReportDraftWorkflow";

type NormaliseTaskText = (value: unknown) => string;

export type TaskContributionStatus =
  | "Draft"
  | "Ready for Integration"
  | "Integrated"
  | "Accepted";

export type TaskContributionSectionOverride = {
  key: string;
  value: string;
};

export type TaskReportFormLike = {
  notes: string;
  contributionStatus: string;
  contributionTitle: string;
  contributionSummary: string;
  contributionFindings: string;
  contributionRecommendations: string;
  evidenceReviewed: string;
  contributionChallenges: string;
  contributionNextActions: string;
};

export async function loadTaskContributionReport(
  token: string,
  assignmentId: string,
  taskId: string,
) {
  return api.assignmentTaskContributionReport(
    token,
    assignmentId,
    taskId,
  );
}

export function taskReportPreviewNotice(
  task: ApiAssignmentTask,
  reviewMode: boolean,
) {
  if (
    reviewMode &&
    task.contribution_status === "Ready for Integration"
  ) {
    return "Review the submitted Task Report in the preview and record your decision below it.";
  }

  if (task.contribution_status === "Accepted") {
    return "This is the final approved Task Report. Its review decision has already been recorded.";
  }

  return "";
}

export function buildTaskContributionPayload(
  task: ApiAssignmentTask,
  form: TaskReportFormLike,
  normaliseText: NormaliseTaskText,
  statusOverride?: TaskContributionStatus,
  sectionOverride?: TaskContributionSectionOverride,
) {
  const status =
    statusOverride ||
    (form.contributionStatus as TaskContributionStatus);

  const reportValue = (key: string, value: string) => {
    const raw = sectionOverride?.key === key ? sectionOverride.value : value;
    // The shared Lexical editor emits HTML. Preserve that markup for report body
    // sections so the server can sanitize it without flattening formatting.
    // Titles remain plain text because the title contract is textual.
    return key === "title" ? normaliseText(raw) : String(raw ?? "").trim();
  };

  const contributionTitle = reportValue("title", form.contributionTitle);

  return {
    status,
    payload: {
      contributionTitle,
      contributionSummary:
        reportValue("workCompleted", form.contributionSummary),
      contributionFindings:
        reportValue("findings", form.contributionFindings),
      contributionRecommendations:
        reportValue(
          "recommendations",
          form.contributionRecommendations,
        ),
      evidenceReviewed:
        reportValue("evidence", form.evidenceReviewed),
      contributionChallenges:
        reportValue("challenges", form.contributionChallenges),
      contributionNextActions:
        reportValue("nextActions", form.contributionNextActions),
      workNotes: form.notes.trim(),
      contributionStatus: status,
    },
  };
}

export function mapSavedTaskContribution(
  saved: ApiAssignmentTask,
  normaliseText: NormaliseTaskText,
) {
  return {
    contributionTitle: normaliseText(saved.contribution_title),
    // Preserve editor HTML on the save/reopen round-trip. Legacy plain text is
    // still supported by the editor's existing input normalization.
    contributionSummary: recoverTaskReportMarkup(saved.contribution_summary),
    contributionFindings: recoverTaskReportMarkup(saved.contribution_findings),
    contributionRecommendations: recoverTaskReportMarkup(saved.contribution_recommendations),
    evidenceReviewed: recoverTaskReportMarkup(saved.evidence_reviewed),
    contributionChallenges: recoverTaskReportMarkup(saved.contribution_challenges),
    contributionNextActions: recoverTaskReportMarkup(saved.contribution_next_actions),
    contributionStatus: saved.contribution_status || "Draft",
  };
}

export function taskContributionSaveNotice(
  status: TaskContributionStatus,
  saved: ApiAssignmentTask,
  currentReviewerName: string | null | undefined,
  savedAt: string,
  statusLabel: (status: ApiAssignmentTask["contribution_status"]) => string,
) {
  if (status === "Draft") {
    return `Draft saved successfully at ${savedAt}. Next step: Preview Report.`;
  }

  if (status === "Ready for Integration") {
    return `Task report submitted to ${
      saved.reviewer_name ||
      currentReviewerName ||
      "the assigned reviewer"
    }.`;
  }

  return `Contribution updated to ${statusLabel(status)}.`;
}

import type { ApiAssignmentTask } from "../../api";
import { recoverTaskReportMarkup } from "./taskReportDraftWorkflow";

type NormaliseTaskText = (value: unknown) => string;
type TaskDateValue = (value: string | null | undefined) => string;

export function taskHasReportDraft(
  task: ApiAssignmentTask,
  normaliseText: NormaliseTaskText,
) {
  return Boolean(
    Number(task.contribution_report_version || 0) > 0 ||
      normaliseText(task.blank_content) ||
      normaliseText(task.contribution_report_html) ||
      normaliseText(task.contribution_title) ||
      normaliseText(task.contribution_summary) ||
      normaliseText(task.evidence_reviewed) ||
      normaliseText(task.contribution_findings) ||
      normaliseText(task.contribution_recommendations) ||
      normaliseText(task.contribution_challenges) ||
      normaliseText(task.contribution_next_actions)
  );
}

export function taskReportOwnerActionLabel(
  task: ApiAssignmentTask,
  normaliseText: NormaliseTaskText,
) {
  return task.contribution_status === "Draft"
    ? taskHasReportDraft(task, normaliseText)
      ? "Continue Report"
      : "Start Report"
    : task.contribution_status === "Ready for Integration"
      ? "Preview Submitted Report"
      : task.contribution_status === "Integrated"
        ? "View Approved Report"
        : "View Final Report";
}

export function mapTaskToWorkspaceForm(
  task: ApiAssignmentTask,
  normaliseText: NormaliseTaskText,
  dateValue: TaskDateValue,
) {
  return {
    title: task.title,
    description: task.description || "",
    ownerId: task.owner_id || "",
    priority: task.priority,
    status: task.status,
    progress: Number(task.progress || 0),
    startDate: dateValue(task.start_date),
    dueDate: dateValue(task.due_date),
    notes: task.notes || "",
    expectedContribution: task.expected_contribution || "",
    assignmentPart: task.assignment_part || "",
    assignmentSectionId: task.assignment_section_id || "",
    targetDocumentId: task.target_document_id || "",
    targetSectionId: task.target_section_id || "",
    taskPurpose: task.task_purpose || "",
    specificInstructions: task.specific_instructions || "",
    expectedFindings: task.expected_findings || "",
    expectedOutput: task.expected_output || "Task Report",
    evidenceRequired: task.evidence_required || "",
    reviewerId: task.reviewer_id || "",
    contributionTitle: normaliseText(task.contribution_title),
    // Retain rich-text HTML for the Task Report editor. Read-only summaries
    // should create a plain-text projection without rewriting this working copy.
    contributionSummary: recoverTaskReportMarkup(task.contribution_summary),
    contributionFindings: recoverTaskReportMarkup(task.contribution_findings),
    contributionRecommendations: recoverTaskReportMarkup(task.contribution_recommendations),
    evidenceReviewed: recoverTaskReportMarkup(task.evidence_reviewed),
    contributionChallenges: recoverTaskReportMarkup(task.contribution_challenges),
    contributionNextActions: recoverTaskReportMarkup(task.contribution_next_actions),
    contributionStatus: task.contribution_status || "Draft",
  };
}

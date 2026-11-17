import type { ApiAssignmentTask } from "../../api";

export type TaskWorkspaceAction = "save" | "start";
export type TaskReportOpenRoute = "preview-final" | "open-workspace" | "owner-report";

export type TaskWorkspaceFormLike = {
  title: string;
  description: string;
  ownerId: string;
  priority: string;
  status: string;
  progress: number;
  startDate: string;
  dueDate: string;
  notes: string;
  expectedContribution: string;
  assignmentPart: string;
  assignmentSectionId: string;
  taskPurpose: string;
  specificInstructions: string;
  expectedFindings: string;
  expectedOutput: string;
  evidenceRequired: string;
  reviewerId: string;
  targetDocumentId: string;
  targetSectionId: string;
};

export function taskReportOpenRoute(
  task: ApiAssignmentTask,
  userId: string | undefined,
): TaskReportOpenRoute {
  // Final/approved report stages preview only when the user explicitly opens Report.
  // Generic TASK work navigation must never be redirected into report preview.
  if (
    task.contribution_status === "Accepted" ||
    task.contribution_status === "Integrated"
  ) {
    return "preview-final";
  }

  if (task.owner_id !== userId) return "open-workspace";
  return "owner-report";
}

export function resolveTaskReportAssignmentId(
  task: ApiAssignmentTask,
  selectedAssignmentId: string | null,
) {
  return task.assignment_id || selectedAssignmentId || null;
}

export function buildTaskStartPayload(
  task: ApiAssignmentTask,
  today: string,
) {
  return {
    // TASK owner start transition.
    // Do not resend historical governed dates that the owner is not authorised
    // to change. The backend preserves manager-controlled due_date for owners.
    title: task.title || "Task",
    description: task.description || "",
    ownerId: task.owner_id || null,
    priority: task.priority || "Normal",
    status: "In Progress",
    progress: Math.max(0, Math.min(100, Number(task.progress || 0))),
    startDate: today,
    dueDate: null,
    notes: task.notes || "",
    expectedContribution: task.expected_contribution || "",
    assignmentPart: task.assignment_part || "",
    assignmentSectionId: task.assignment_section_id || null,
    targetDocumentId: task.target_document_id || null,
    targetSectionId: task.target_section_id || null,
    taskPurpose: task.task_purpose || "",
    specificInstructions: task.specific_instructions || "",
    expectedFindings: task.expected_findings || "",
    expectedOutput: task.expected_output || "Task Report",
    evidenceRequired: task.evidence_required || "",
    reviewerId: task.reviewer_id || null,
  };
}

export function deriveTaskSaveState(
  action: TaskWorkspaceAction,
  form: TaskWorkspaceFormLike,
  today: string,
) {
  const status = action === "start" ? "In Progress" : form.status;

  const progress = Math.max(0, Math.min(100, Number(form.progress || 0)));

  const startDate =
    action === "start" && !form.startDate
      ? today
      : form.startDate;

  return { status, progress, startDate };
}

export function buildTaskWorkspaceUpdatePayload(
  task: ApiAssignmentTask,
  form: TaskWorkspaceFormLike,
  isManager: boolean,
  action: TaskWorkspaceAction,
  today: string,
) {
  const { status, progress, startDate } = deriveTaskSaveState(
    action,
    form,
    today,
  );

  return {
    payload: {
      title: isManager ? form.title.trim() : task.title,
      description: isManager ? form.description.trim() : task.description,
      ownerId: isManager ? form.ownerId || null : task.owner_id,
      priority: isManager ? form.priority : task.priority,
      status,
      progress,
      startDate: startDate || null,
      dueDate: isManager ? form.dueDate || null : task.due_date,
      notes: form.notes.trim(),
      expectedContribution: isManager
        ? form.expectedContribution.trim()
        : task.expected_contribution,
      assignmentPart: isManager
        ? form.assignmentPart.trim()
        : task.assignment_part,
      assignmentSectionId: isManager
        ? form.assignmentSectionId || null
        : task.assignment_section_id,
      taskPurpose: isManager ? form.taskPurpose.trim() : task.task_purpose,
      specificInstructions: isManager
        ? form.specificInstructions.trim()
        : task.specific_instructions,
      expectedFindings: isManager
        ? form.expectedFindings.trim()
        : task.expected_findings,
      expectedOutput: isManager ? form.expectedOutput : task.expected_output,
      evidenceRequired: isManager
        ? form.evidenceRequired.trim()
        : task.evidence_required,
      reviewerId: isManager ? form.reviewerId || null : task.reviewer_id,
      targetDocumentId: isManager
        ? form.targetDocumentId || null
        : task.target_document_id,
      targetSectionId: isManager
        ? form.targetSectionId || null
        : task.target_section_id,
    },
    status,
  };
}

export function taskWorkspaceSaveMessage(action: TaskWorkspaceAction) {
  return action === "start"
    ? "Task started successfully."
    : "Task saved successfully.";
}

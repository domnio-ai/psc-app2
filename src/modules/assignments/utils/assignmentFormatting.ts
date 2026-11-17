import type { ApiAssignment, ApiAssignmentTask } from "../../../api";
import { deadlineState } from "../../../utils/deadlines";

export const assignmentRef = (id: string) =>
  `ASG-${id
    .replace(/[^a-f0-9]/gi, "")
    .slice(0, 6)
    .toUpperCase()}`;

export const assignmentReportStatusLabel = (
  status: ApiAssignmentTask["contribution_status"],
) =>
  status === "Draft"
    ? "Draft"
    : status === "Ready for Integration"
      ? "Submitted for Review"
      : status === "Integrated"
        ? "Approved · Final Report Pending"
        : status === "Accepted"
          ? "Final"
          : status;

export const assignmentDisplayStatus = (item: ApiAssignment) =>
  item.workflow_status || item.status;

export const assignmentHealthFor = (
  item: ApiAssignment,
): "On Track" | "At Risk" | "Overdue" => {
  const dueState = deadlineState(item.due_date, item.status);
  if (item.status !== "Completed" && dueState === "overdue") return "Overdue";
  if (
    item.status !== "Completed" &&
    (item.priority === "Critical" ||
      item.status === "Ready for Review" ||
      dueState === "almost-due")
  ) {
    return "At Risk";
  }
  return "On Track";
};

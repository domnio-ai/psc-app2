export type TaskDashboardShortcutLabel =
  | "All"
  | "Assigned"
  | "In Progress"
  | "Almost Due"
  | "Overdue"
  | "Under Review"
  | "Returned"
  | "Completed";

export type TaskDashboardShortcut = {
  label: TaskDashboardShortcutLabel;
  /** Exact task IDs represented by the authorised Dashboard card snapshot. */
  taskIds: string[];
};

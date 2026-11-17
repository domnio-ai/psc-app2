export type DeadlineState = "completed" | "new" | "overdue" | "almost-due";

export const deadlineState = (
  dateValue: string | null | undefined,
  statusValue?: string,
): DeadlineState => {
  if (statusValue === "Completed") return "completed";
  if (!dateValue) return "new";
  const dateOnly =
    String(dateValue).match(/^\d{4}-\d{2}-\d{2}/)?.[0] || String(dateValue);
  const due = new Date(`${dateOnly}T23:59:59`);
  if (Number.isNaN(due.getTime())) return "new";
  const days = (due.getTime() - Date.now()) / 86400000;
  if (days < 0) return "overdue";
  if (days <= 7) return "almost-due";
  return "new";
};

export const deadlineLabel = (
  dateValue: string | null | undefined,
  statusValue?: string,
) => {
  const state = deadlineState(dateValue, statusValue);
  if (state === "completed") return "Completed";
  if (state === "overdue") return "Overdue";
  if (state === "almost-due") return "Almost due";
  return "On track";
};

export const matchesDeadlineFilter = (
  filter: string,
  dateValue: string | null | undefined,
  statusValue?: string,
) => {
  if (filter === "All") return true;
  const state = deadlineState(dateValue, statusValue);
  if (filter === "On Track") return state === "new";
  if (filter === "Almost Due") return state === "almost-due";
  if (filter === "Overdue") return state === "overdue";
  if (filter === "Completed") return state === "completed";
  return statusValue === filter;
};

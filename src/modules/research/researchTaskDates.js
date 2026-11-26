export function isResearchTaskOverdue(dueDate, now = new Date()) {
  if (dueDate == null || dueDate === "") return false;

  const value = String(dueDate);
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!dateOnly) {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) && timestamp < now.getTime();
  }

  const year = Number(dateOnly[1]);
  const month = Number(dateOnly[2]);
  const day = Number(dateOnly[3]);
  const due = new Date(year, month - 1, day);

  if (
    due.getFullYear() !== year ||
    due.getMonth() !== month - 1 ||
    due.getDate() !== day
  ) {
    return false;
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return due.getTime() < today.getTime();
}

export const taskDateValue = (
  value: string | null | undefined,
): string => {
  if (!value) return "";

  const raw = String(value).trim();
  const isoDate = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDate) return isoDate[1];

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(parsed.getDate()).padStart(2, "0")}`;
};

export const taskDateText = (
  value: string | null | undefined,
): string => {
  const normalized = taskDateValue(value);
  if (!normalized) return "Not set";

  const parsed = new Date(`${normalized}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? "Not set"
    : parsed.toLocaleDateString("en-KE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

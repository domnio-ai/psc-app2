export const dateValue = (date: Date) => date.toISOString().slice(0, 10);
export const periodDates = (period: string) => {
  const now = new Date(), start = new Date(now), end = new Date(now);
  if (period === "Today") return { from: dateValue(now), to: dateValue(now) };
  if (period === "This Week") { start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); return { from: dateValue(start), to: dateValue(end) }; }
  if (period === "This Month") { start.setDate(1); return { from: dateValue(start), to: dateValue(end) }; }
  if (period === "Last Month") { start.setMonth(now.getMonth() - 1, 1); end.setDate(0); return { from: dateValue(start), to: dateValue(end) }; }
  if (period === "This Quarter") { start.setMonth(Math.floor(now.getMonth() / 3) * 3, 1); return { from: dateValue(start), to: dateValue(end) }; }
  if (period === "Last Quarter") { const quarter = Math.floor(now.getMonth() / 3); start.setMonth((quarter - 1) * 3, 1); end.setMonth(quarter * 3, 0); return { from: dateValue(start), to: dateValue(end) }; }
  if (period === "This Year") { start.setMonth(0, 1); return { from: dateValue(start), to: dateValue(end) }; }
  if (period === "Last Year") { start.setFullYear(now.getFullYear() - 1, 0, 1); end.setFullYear(now.getFullYear() - 1, 11, 31); return { from: dateValue(start), to: dateValue(end) }; }
  return { from: "", to: "" };
};
export const label = (value: unknown) => String(value).replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
export const displayReportValue = (column: string, value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  const name = column.toLowerCase(), date = new Date(String(value));
  if (name.endsWith("_date") || ["due_date", "start_date", "end_date"].includes(name))
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("en-GB", {day:"2-digit",month:"short",year:"numeric",timeZone:"Africa/Nairobi"}).format(date);
  if (name.endsWith("_at") || ["created_at","updated_at","generated_at","signed_at","resolved_at"].includes(name))
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("en-GB", {day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Africa/Nairobi"}).format(date);
  return String(value);
};

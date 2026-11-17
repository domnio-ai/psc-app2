import type { ChangeEvent } from "react";

export type TaskReportReviewerOption = {
  id: string;
  name: string;
  role: string;
};

type Props = {
  options: TaskReportReviewerOption[];
  value: string;
  onChange: (reviewerId: string) => void | Promise<void>;
  busy?: boolean;
  label?: string;
  helper?: string;
  variant?: "editor" | "preview";
};

export default function TaskReportReviewerPicker({
  options,
  value,
  onChange,
  busy = false,
  label = "Reviewer",
  helper = "Choose an eligible reviewer. Self-review is not permitted.",
  variant = "editor",
}: Props) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const reviewerId = event.target.value;
    if (!reviewerId) return;
    void onChange(reviewerId);
  };

  return (
    <div className={`task-report-reviewer-picker task-report-reviewer-picker--${variant}`}>
      <label>
        <span>{label}</span>
        <select
          aria-label={label}
          value={value}
          disabled={busy || options.length === 0}
          onChange={handleChange}
        >
          <option value="">{options.length ? "Select eligible reviewer" : "No eligible reviewers available"}</option>
          {options.map((reviewer) => (
            <option key={reviewer.id} value={reviewer.id}>
              {reviewer.name} — {reviewer.role}
            </option>
          ))}
        </select>
      </label>
      <small>{options.length ? helper : "No eligible reviewer is configured for this assignment. Ask the Assignment Lead or an authorised manager to add a reviewer or correct the reporting line; self-review is not permitted."}</small>
    </div>
  );
}

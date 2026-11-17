type TaskManagementForm = {
  title: string;
  description: string;
  taskPurpose: string;
  specificInstructions: string;
  expectedFindings: string;
  expectedOutput: string;
  evidenceRequired: string;
  reviewerId: string;
  ownerId: string;
  priority: string;
  startDate: string;
  dueDate: string;
};

type ReviewerOption = {
  id: string;
  name: string;
};

type AssigneeOption = {
  id: string;
  name: string;
  role: string;
};

type Props = {
  form: TaskManagementForm;
  reviewerOptions: ReviewerOption[];
  assigneeOptions: AssigneeOption[];
  onChange: <K extends keyof TaskManagementForm>(
    field: K,
    value: TaskManagementForm[K],
  ) => void;
};

const outputOptions = [
  "Task Report",
  "Assessment",
  "Analysis",
  "Recommendations",
  "Data Summary",
  "Meeting Report",
  "Field Visit Report",
  "Policy Brief",
];

export default function TaskManagementPanel({
  form,
  reviewerOptions,
  assigneeOptions,
  onChange,
}: Props) {
  return (
    <details className="task-management-card task-management-compact">
      <summary>Edit task details</summary>

      <div className="task-management-grid">
        <label className="wide">
          <span>Task title</span>
          <input
            value={form.title}
            onChange={(event) => onChange("title", event.target.value)}
          />
        </label>

        <label className="wide">
          <span>Description</span>
          <textarea
            rows={4}
            value={form.description}
            onChange={(event) => onChange("description", event.target.value)}
          />
        </label>

        <label className="wide">
          <span>Purpose</span>
          <textarea
            rows={2}
            value={form.taskPurpose}
            onChange={(event) => onChange("taskPurpose", event.target.value)}
          />
        </label>

        <label className="wide">
          <span>Specific instructions</span>
          <textarea
            rows={4}
            value={form.specificInstructions}
            onChange={(event) =>
              onChange("specificInstructions", event.target.value)
            }
          />
        </label>

        <label className="wide">
          <span>Expected findings</span>
          <textarea
            rows={2}
            value={form.expectedFindings}
            onChange={(event) => onChange("expectedFindings", event.target.value)}
          />
        </label>

        <label>
          <span>Expected output</span>
          <select
            value={form.expectedOutput}
            onChange={(event) => onChange("expectedOutput", event.target.value)}
          >
            {outputOptions.map((output) => (
              <option key={output}>{output}</option>
            ))}
          </select>
        </label>

        <label className="wide">
          <span>Evidence required</span>
          <textarea
            rows={2}
            value={form.evidenceRequired}
            onChange={(event) => onChange("evidenceRequired", event.target.value)}
          />
        </label>

        <label>
          <span>Task report reviewer</span>
          <select
            value={form.reviewerId}
            onChange={(event) => onChange("reviewerId", event.target.value)}
          >
            <option value="">Select reviewer</option>
            {reviewerOptions.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Assigned to</span>
          <select
            value={form.ownerId}
            onChange={(event) => onChange("ownerId", event.target.value)}
          >
            <option value="">Unassigned</option>
            {assigneeOptions.map((member) => (
              <option value={member.id} key={member.id}>
                {member.name} — {member.role}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Priority</span>
          <select
            value={form.priority}
            onChange={(event) => onChange("priority", event.target.value)}
          >
            <option>Low</option>
            <option>Normal</option>
            <option>High</option>
            <option>Critical</option>
          </select>
        </label>

        <label>
          <span>Start date</span>
          <input
            type="date"
            value={form.startDate}
            onChange={(event) => onChange("startDate", event.target.value)}
          />
        </label>

        <label>
          <span>Due date</span>
          <input
            type="date"
            value={form.dueDate}
            onChange={(event) => onChange("dueDate", event.target.value)}
          />
        </label>
      </div>
    </details>
  );
}

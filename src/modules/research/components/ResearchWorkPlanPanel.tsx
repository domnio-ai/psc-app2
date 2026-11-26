import type { Dispatch, SetStateAction } from "react";
import type { ResearchProject } from "../../../api";
import ResearchWorkSummary from "../work/ResearchWorkSummary";
import "../work/research-work-execution.css";

type MilestoneForm = {
  title: string;
  description: string;
  ownerId: string;
  dueDate: string;
  priority: string;
};

type Props = {
  project: ResearchProject;
  form: MilestoneForm;
  setForm: Dispatch<SetStateAction<MilestoneForm>>;
  onImportExternal: () => void;
  onUpdateMilestone: (milestoneId: string, status: string) => Promise<void>;
  onAddMilestone: () => Promise<void>;
};

export default function ResearchWorkPlanPanel({
  project,
  form,
  setForm,
  onImportExternal,
  onUpdateMilestone,
  onAddMilestone,
}: Props) {
  return (
    <section className="research-work-plan-stack">
            <ResearchWorkSummary project={project} />
      <section className="research-plan-panel research-milestones-panel research-work-simple">
        <header className="research-work-section-head">
          <div>
            <small>DELIVERY PLAN</small>
            <h3>Milestones</h3>
            <p>Accountable deliverables, owners, priorities and deadlines.</p>
          </div>
          <strong className="research-work-record-count">
            {project.milestones.length} milestone{project.milestones.length === 1 ? "" : "s"}
          </strong>
        </header>

        <div className="research-milestone-list">
          {project.milestones.map((milestone) => {
            const isOverdue =
              milestone.status !== "Completed" &&
              new Date(`${milestone.due_date}T23:59:59`) < new Date();

            return (
              <article key={milestone.id} className={`research-work-milestone-row ${isOverdue ? "overdue" : ""} ${milestone.status === "Completed" ? "completed" : ""}`}>
                <div>
                  <strong>{milestone.title}</strong>
                  <small className="research-milestone-deliverable">
                    <b>Completion:</b> {milestone.description || "No completion criteria recorded."}
                  </small>
                  {milestone.linked_task && (
                    <small className="research-milestone-deliverable" role="status">
                      <b>Central task:</b> {milestone.linked_task.title} · {milestone.linked_task.status} · {milestone.linked_task.progress}% · {milestone.linked_task.assignment_title}
                    </small>
                  )}
                </div>
                <div>
                  <strong>{milestone.owner_name || "Unassigned"}</strong>
                  <small>{milestone.priority} priority · due {new Date(`${milestone.due_date}T00:00:00`).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })}</small>
                </div>
                <select
                  aria-label={`Status for ${milestone.title}`}
                  value={milestone.status}
                  disabled={Boolean(milestone.linked_task)}
                  title={milestone.linked_task ? "Status is controlled by the linked central task workflow." : undefined}
                  onChange={(event) => void onUpdateMilestone(milestone.id, event.target.value)}
                >
                  <option>Pending</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                </select>
              </article>
            );
          })}

          {!project.milestones.length && (
            <div className="research-empty-state">
              <strong>No milestones yet</strong>
              <span>Add the first meaningful research checkpoint with a deliverable, owner and deadline.</span>
            </div>
          )}
        </div>

        <details className="research-secondary-disclosure research-add-milestone" open={!project.milestones.length}>
          <summary>{project.milestones.length ? "Add another milestone" : "Add first milestone"}</summary>
          <div className="research-milestone-guidance">
            <strong>What makes a good milestone?</strong>
            <p>
              Define a meaningful research checkpoint with a clear deliverable, an accountable owner
              and a date by which it should be complete.
            </p>
            <small>
              Example: Complete literature review — review relevant studies, policy documents and PSC reports,
              then produce a synthesis highlighting the main evidence gaps.
            </small>
          </div>

          <div className="research-milestone-add research-milestone-add-guided">
            <label className="research-milestone-field research-milestone-field-wide">
              <span>Milestone title</span>
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="e.g. Complete literature review"
              />
              <small>Name the research checkpoint or deliverable.</small>
            </label>

            <label className="research-milestone-field research-milestone-field-wide">
              <span>Deliverable / completion criteria</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Describe what must be produced or completed before this milestone can be marked complete."
                rows={3}
              />
              <small>Be specific enough that the team can tell when the milestone is genuinely complete.</small>
            </label>

            <label className="research-milestone-field">
              <span>Accountable owner</span>
              <select
                value={form.ownerId}
                onChange={(event) => setForm({ ...form, ownerId: event.target.value })}
              >
                <option value="">Select owner</option>
                <option value={project.lead_id}>{project.lead_name}</option>
                {project.collaborators.map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
            </label>

            <label className="research-milestone-field">
              <span>Due date</span>
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
              />
            </label>

            <label className="research-milestone-field">
              <span>Priority</span>
              <select
                value={form.priority}
                onChange={(event) => setForm({ ...form, priority: event.target.value })}
              >
                <option>Low</option>
                <option>Normal</option>
                <option>High</option>
                <option>Critical</option>
              </select>
            </label>

            <button
              className="research-milestone-save"
              disabled={!form.title.trim() || !form.ownerId || !form.dueDate}
              onClick={() => void onAddMilestone()}
            >
              Add milestone
            </button>
          </div>
        </details>
      </section>

      <details className="research-external-import-callout research-secondary-disclosure research-external-option">
        <summary>External completion option</summary>
        <div className="research-secondary-disclosure-body">
          <div>
            <small>EXTERNAL REPORT</small>
            <h3>Import completed external research instead</h3>
            <p>
              Use this only when the research work was completed outside REDESY and a report already exists.
              REDESY will still require formal review before publication.
            </p>
          </div>
          <button type="button" className="research-import-action" onClick={onImportExternal}>
            Import external report <span aria-hidden="true">→</span>
          </button>
        </div>
      </details>
    </section>
  );
}

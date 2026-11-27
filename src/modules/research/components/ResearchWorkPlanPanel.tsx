import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { api, type ResearchMilestoneTask, type ResearchProject } from "../../../api";
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
  token: string;
  canManageTasks: boolean;
  form: MilestoneForm;
  setForm: Dispatch<SetStateAction<MilestoneForm>>;
  onImportExternal: () => void;
  onUpdateMilestone: (milestoneId: string, status: string) => Promise<void>;
  onAddMilestone: () => Promise<void>;
  onUpdateMilestoneDetails: (milestoneId: string, input: MilestoneForm) => Promise<void>;
  onRefreshActivity: () => Promise<void>;
};

export default function ResearchWorkPlanPanel({
  project,
  token,
  canManageTasks,
  form,
  setForm,
  onImportExternal,
  onUpdateMilestone,
  onAddMilestone,
  onUpdateMilestoneDetails,
  onRefreshActivity,
}: Props) {
  const [taskRows, setTaskRows] = useState<Record<string, { linked: ResearchMilestoneTask[]; available: ResearchMilestoneTask[] }>>({});
  const [taskSelections, setTaskSelections] = useState<Record<string, string>>({});
  const [taskBusy, setTaskBusy] = useState<Record<string, boolean>>({});
  const [taskNotice, setTaskNotice] = useState<Record<string, string>>({});
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [milestoneNotice, setMilestoneNotice] = useState("");

  const refreshMilestoneTasks = async (milestoneId: string) => {
    const result = await api.researchMilestoneTasks(token, project.id, milestoneId);
    setTaskRows((current) => ({ ...current, [milestoneId]: result }));
  };

  useEffect(() => {
    let active = true;
    Promise.all(project.milestones.map(async (milestone) => {
      try {
        const result = await api.researchMilestoneTasks(token, project.id, milestone.id);
        if (active) {
          setTaskRows((current) => ({ ...current, [milestone.id]: result }));
          setTaskNotice((current) => ({ ...current, [milestone.id]: "" }));
        }
      } catch {
        if (active) setTaskNotice((current) => ({ ...current, [milestone.id]: "Task links could not be loaded for your current access scope." }));
      }
    }));
    return () => { active = false; };
  }, [token, project.id, project.milestones]);

  const linkTask = async (milestoneId: string) => {
    const taskId = taskSelections[milestoneId];
    if (!taskId) return;
    setTaskBusy((current) => ({ ...current, [milestoneId]: true }));
    try {
      await api.linkResearchMilestoneTask(token, project.id, milestoneId, taskId);
      await refreshMilestoneTasks(milestoneId);
      await onRefreshActivity();
      setTaskSelections((current) => ({ ...current, [milestoneId]: "" }));
      setTaskNotice((current) => ({ ...current, [milestoneId]: "Task linked to milestone." }));
    } catch (error) {
      setTaskNotice((current) => ({ ...current, [milestoneId]: error instanceof Error ? error.message : "Task could not be linked." }));
    } finally {
      setTaskBusy((current) => ({ ...current, [milestoneId]: false }));
    }
  };

  const startEditingMilestone = (milestone: ResearchProject["milestones"][number]) => {
    setEditingMilestoneId(milestone.id);
    setMilestoneNotice("");
    setForm({
      title: milestone.title,
      description: milestone.description || "",
      ownerId: milestone.owner_id,
      dueDate: milestone.due_date,
      priority: milestone.priority || "Normal",
    });
  };

  const cancelMilestoneEdit = () => {
    setEditingMilestoneId(null);
    setMilestoneNotice("");
    setForm({ title: "", description: "", ownerId: "", dueDate: "", priority: "Normal" });
  };

  const saveMilestoneDetails = async () => {
    if (!editingMilestoneId) return;
    try {
      await onUpdateMilestoneDetails(editingMilestoneId, form);
      cancelMilestoneEdit();
    } catch (error) {
      setMilestoneNotice(error instanceof Error ? error.message : "Milestone details could not be saved.");
    }
  };

  const unlinkTask = async (milestoneId: string, taskId: string) => {
    setTaskBusy((current) => ({ ...current, [milestoneId]: true }));
    try {
      await api.unlinkResearchMilestoneTask(token, project.id, milestoneId, taskId);
      await refreshMilestoneTasks(milestoneId);
      await onRefreshActivity();
      setTaskNotice((current) => ({ ...current, [milestoneId]: "Task unlinked from milestone." }));
    } catch (error) {
      setTaskNotice((current) => ({ ...current, [milestoneId]: error instanceof Error ? error.message : "Task could not be unlinked." }));
    } finally {
      setTaskBusy((current) => ({ ...current, [milestoneId]: false }));
    }
  };

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
                </div>
                <div>
                  <strong>{milestone.owner_name || "Unassigned"}</strong>
                  <small>{milestone.priority} priority · due {new Date(`${milestone.due_date}T00:00:00`).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })}</small>
                </div>
                <select
                  aria-label={`Status for ${milestone.title}`}
                  value={milestone.status}
                  onChange={(event) => void onUpdateMilestone(milestone.id, event.target.value)}
                >
                  <option>Pending</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                </select>
                {canManageTasks && (
                  <button type="button" className="research-milestone-edit" onClick={() => startEditingMilestone(milestone)}>
                    Edit details
                  </button>
                )}
                <div className="research-milestone-task-links">
                  <strong>Linked tasks</strong>
                  {(taskRows[milestone.id]?.linked || []).map((task) => (
                    <div key={task.id} className="research-milestone-task-row">
                      <span><b>{task.title}</b><small>{task.assignment_title} · {task.owner_name || "Unassigned"} · {task.status}</small></span>
                      {canManageTasks && <button type="button" disabled={Boolean(taskBusy[milestone.id])} onClick={() => void unlinkTask(milestone.id, task.id)}>Unlink</button>}
                    </div>
                  ))}
                  {!taskRows[milestone.id] && <small>{taskNotice[milestone.id] || "Loading milestone tasks…"}</small>}
                  {taskRows[milestone.id] && !taskRows[milestone.id].linked.length && <small>No tasks linked yet.</small>}
                  {canManageTasks && (
                    <div className="research-milestone-task-controls">
                      <select aria-label={`Available task for ${milestone.title}`} value={taskSelections[milestone.id] || ""} onChange={(event) => setTaskSelections((current) => ({ ...current, [milestone.id]: event.target.value }))}>
                        <option value="">Choose a task from a linked assignment</option>
                        {(taskRows[milestone.id]?.available || []).map((task) => <option key={task.id} value={task.id}>{task.title} — {task.assignment_title}</option>)}
                      </select>
                      <button type="button" disabled={!taskSelections[milestone.id] || Boolean(taskBusy[milestone.id])} onClick={() => void linkTask(milestone.id)}>Link task</button>
                    </div>
                  )}
                  {taskNotice[milestone.id] && <small role="status">{taskNotice[milestone.id]}</small>}
                </div>
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

        <details className="research-secondary-disclosure research-add-milestone" open={Boolean(editingMilestoneId) || !project.milestones.length}>
          <summary>{editingMilestoneId ? "Edit milestone details" : project.milestones.length ? "Add another milestone" : "Add first milestone"}</summary>
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

            {milestoneNotice && <small role="alert">{milestoneNotice}</small>}
            <div className="research-milestone-form-actions">
              <button
                className="research-milestone-save"
                disabled={!form.title.trim() || !form.ownerId || !form.dueDate}
                onClick={() => void (editingMilestoneId ? saveMilestoneDetails() : onAddMilestone())}
              >
                {editingMilestoneId ? "Save milestone changes" : "Add milestone"}
              </button>
              {editingMilestoneId && <button type="button" className="research-milestone-cancel" onClick={cancelMilestoneEdit}>Cancel</button>}
            </div>
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
              Use this only when the research work was completed outside APP2 and a report already exists.
              APP2 will still require formal review before publication.
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

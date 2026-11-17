import type { ApiAssignmentTask } from "../../../api";

type TaskFilter = "All" | "My Tasks" | "Not Started" | "In Progress" | "Completed" | "Overdue";

type DueMeta = { state: string; label: string };

type Props = {
  assignmentTasks: ApiAssignmentTask[];
  filteredAssignmentTasks: ApiAssignmentTask[];
  assignmentTaskFilter: TaskFilter;
  currentUserId: string;
  currentUserName: string;
  isManager: boolean;
  onFilterChange: (filter: TaskFilter) => void;
  onOpenAssignTask: () => void;
  onOpenTask: (task: ApiAssignmentTask) => void;
  onOpenTaskReport: (task: ApiAssignmentTask) => void;
  taskDateValue: (value?: string | null) => string;
  taskDateText: (value?: string | null) => string;
  taskDueMeta: (task: ApiAssignmentTask) => DueMeta;
  taskOpenLabel: (task: ApiAssignmentTask) => string;
  taskReportOwnerActionLabel: (task: ApiAssignmentTask) => string;
};

export default function AssignmentTasksPanel({
  assignmentTasks,
  filteredAssignmentTasks,
  assignmentTaskFilter,
  currentUserId,
  currentUserName,
  isManager,
  onFilterChange,
  onOpenAssignTask,
  onOpenTask,
  onOpenTaskReport,
  taskDateValue,
  taskDateText,
  taskDueMeta,
  taskOpenLabel,
  taskReportOwnerActionLabel,
}: Props) {
  const today = taskDateValue(new Date().toISOString());
  const myActiveTasks = assignmentTasks.filter(
    (task) =>
      (task.owner_id === currentUserId || task.owner_name === currentUserName) &&
      task.status !== "Completed",
  );
  const dueToday = myActiveTasks.filter((task) => taskDateValue(task.due_date) === today);
  const upcoming = myActiveTasks.filter(
    (task) => Boolean(task.due_date) && taskDateValue(task.due_date) > today,
  );
  const overdue = myActiveTasks.filter(
    (task) => Boolean(task.due_date) && taskDateValue(task.due_date) < today,
  );
  const completedCount = assignmentTasks.filter((task) => task.status === "Completed").length;

  return (
    <>
      <section className="assignment-my-work" aria-label="My Work">
        <header>
          <div>
            <span className="workspace-eyebrow">MY WORK</span>
            <h3>Your work in this assignment</h3>
          </div>
        </header>
        <div>
          {[
            ["Due Today", dueToday],
            ["Upcoming", upcoming],
            ["Overdue", overdue],
          ].map(([label, rows]) => (
            <button
              type="button"
              key={label as string}
              onClick={() => onFilterChange(label === "Overdue" ? "Overdue" : "My Tasks")}
            >
              <span>{label as string}</span>
              <b>{(rows as ApiAssignmentTask[]).length}</b>
            </button>
          ))}
        </div>
      </section>

      <header className="tasks-minimal-toolbar">
        <p>
          <strong>{assignmentTasks.length}</strong> task{assignmentTasks.length === 1 ? "" : "s"}{" "}
          <span>·</span> {completedCount} complete
        </p>
        <div>
          <select
            aria-label="Filter tasks"
            value={assignmentTaskFilter}
            onChange={(event) => onFilterChange(event.target.value as TaskFilter)}
          >
            {["All", "My Tasks", "Not Started", "In Progress", "Completed", "Overdue"].map((filter) => (
              <option key={filter}>{filter}</option>
            ))}
          </select>
          {isManager && (
            <button type="button" onClick={onOpenAssignTask}>
              + Assign Task
            </button>
          )}
        </div>
      </header>

      <div className="tasks-minimal-list">
        {filteredAssignmentTasks.length > 0 ? (
          <div>
            {filteredAssignmentTasks.map((task) => {
              const dueMeta = taskDueMeta(task);
              const statusClass = String(task.status || "not-started")
                .toLowerCase()
                .replace(/\s+/g, "-");
              return (
                <article className={`task-minimal-row task-row-status-${statusClass}`} key={task.id}>
                  <span className={`task-minimal-state state-${statusClass}`} aria-hidden="true" />
                  <div>
                    <strong>{task.title}</strong>
                    <small>
                      {task.owner_name || "Unassigned"} <span>·</span> Due {taskDateText(task.due_date)}
                    </small>
                    <small className="task-delivery-path-label">
                      {task.assignment_section_title
                        ? `Workstream · ${task.assignment_section_title}`
                        : "Independent task"}
                    </small>
                  </div>
                  <b className={`task-minimal-status status-${statusClass}`}>{task.status}</b>
                  <em className={`task-minimal-due due-${dueMeta.state}`}>{dueMeta.label}</em>
                  <div className="task-minimal-actions">
                    <button type="button" onClick={() => onOpenTask(task)}>
                      {task.reviewer_id === currentUserId &&
                      ["Ready for Integration", "Integrated"].includes(task.contribution_status)
                        ? "Review"
                        : isManager || task.owner_id === currentUserId
                          ? taskOpenLabel(task)
                          : "View"}
                    </button>
                    {task.owner_id === currentUserId && task.status !== "Blocked" && (
                      <button
                        type="button"
                        className="task-report-owner-action"
                        onClick={() => onOpenTaskReport(task)}
                      >
                        {taskReportOwnerActionLabel(task)}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="task-empty-card">
            <div className="task-empty-icon" aria-hidden="true">+</div>
            <strong>
              {assignmentTasks.length ? "No tasks match this filter" : "No tasks have been created yet"}
            </strong>
            <p>{assignmentTasks.length ? "Choose another filter." : "Assign the first piece of work."}</p>
            {isManager && !assignmentTasks.length && (
              <button type="button" onClick={onOpenAssignTask}>Assign first task</button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

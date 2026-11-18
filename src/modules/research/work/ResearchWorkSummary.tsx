import type { ResearchProject } from "../../../api";

type Props = {
  project: ResearchProject;
};

function isPastDue(value?: string | null) {
  if (!value) return false;
  return new Date(`${value}T23:59:59`).getTime() < Date.now();
}

export default function ResearchWorkSummary({ project }: Props) {
  const total = project.milestones?.length || 0;
  const completed =
    project.milestones?.filter((item) => item.status === "Completed").length || 0;
  const inProgress =
    project.milestones?.filter((item) => item.status === "In Progress").length || 0;
  const overdue =
    project.milestones?.filter(
      (item) => item.status !== "Completed" && isPastDue(item.due_date),
    ).length || 0;
  const linkedAssignments = project.assignments?.length || 0;
  const completion = total ? Math.round((completed / total) * 100) : 0;

  return (
    <section className="research-work-overview research-work-overview-compact" aria-label="Research work progress">
      <div className="research-work-overview-title">
        <div>
          <small>WORK EXECUTION</small>
          <strong>Research delivery</strong>
        </div>
        <span>{project.title}</span>
      </div>

      <div className="research-work-inline-progress" aria-label={`${completion}% of milestones completed`}>
        <strong>{completion}%</strong>
        <div aria-hidden="true">
          <i style={{ width: `${completion}%` }} />
        </div>
      </div>

      <div className="research-work-inline-metrics">
        <span><small>Milestones</small><strong>{total}</strong></span>
        <span><small>In progress</small><strong>{inProgress}</strong></span>
        <span className={overdue ? "attention" : ""}><small>Overdue</small><strong>{overdue}</strong></span>
        <span><small>Assignments</small><strong>{linkedAssignments}</strong></span>
      </div>
    </section>
  );
}

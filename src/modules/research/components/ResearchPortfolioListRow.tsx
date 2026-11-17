import type { ResearchProject } from "../../../api";
import { researchStatusOf } from "../researchStatus";

type Props = {
  project: ResearchProject;
  onOpen: (project: ResearchProject) => void;
};

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function shortReference(id: string) {
  return `RES-${id.slice(0, 6).toUpperCase()}`;
}

export default function ResearchPortfolioListRow({ project, onOpen }: Props) {
  const teamCount = (project.collaborators?.length || 0) + 1;

  return (
    <article className="research-portfolio-list-row research-portfolio-list-row-pro">
      <div className="research-list-status">
        <span className="research-list-status-pill research-status-pill-compact">{researchStatusOf(project)}</span>
      </div>

      <div className="research-list-main">
        <div className="research-list-title-line">
          <strong className="research-record-title">{project.title}</strong>
          <small>{shortReference(project.id)}</small>
        </div>
        <span>
          {project.summary || project.research_question || "No summary recorded."}
        </span>
      </div>

      <div className="research-list-cell research-list-lead">
        <small>Lead</small>
        <strong>{project.lead_name || "Not assigned"}</strong>
      </div>

      <div className="research-list-cell research-list-team">
        <small>Team</small>
        <strong>{teamCount}</strong>
      </div>

      <div className="research-list-cell research-list-timeline">
        <small>Timeline</small>
        {project.start_date || project.end_date ? (
          <strong>
            {formatDate(project.start_date)}
            <span aria-hidden="true"> → </span>
            {formatDate(project.end_date)}
          </strong>
        ) : (
          <strong className="research-timeline-not-set">Dates not set</strong>
        )}
      </div>

      <button
        type="button"
        className="research-list-open"
        onClick={() => onOpen(project)}
        aria-label={`Open ${project.title}`}
      >
        Open <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}

import type { ResearchProject } from "../../../api";
import { researchStatusClass, researchStatusOf } from "../researchStatus";

type Props = {
  project: ResearchProject;
  onOpen: (project: ResearchProject) => void;
};

function formatDate(value?: string | null) {
  if (!value) return "Open";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getFullYear() < 2000) return "Not set";
  return parsed.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function workflowLabel(status: string) {
  if (status === "Planning") return "Preparing research brief";
  if (status === "Under Review") return "Formal review";
  if (status === "Completed") return "Completed";
  if (status === "Archived") return "Archived";
  return "Research in progress";
}

export default function ResearchPortfolioCard({ project, onOpen }: Props) {
  const teamSize = (project.collaborators?.length || 0) + 1;
  const status=researchStatusOf(project);

  return (
    <button
      type="button"
      className={`research-control-card status-${researchStatusClass(project)}`}
      onClick={() => onOpen(project)}
      aria-label={`Open ${project.title} research workspace`}
    >
      <header>
        <span className="research-control-status">{status}</span>
        <small>{workflowLabel(status)}</small>
      </header>

      <div className="research-control-card-title">
        <h3>{project.title}</h3>
        <p>{project.summary || "No research summary has been recorded."}</p>
      </div>

      <dl>
        <div>
          <dt>Lead</dt>
          <dd>{project.lead_name || "Not assigned"}</dd>
        </div>
        <div>
          <dt>Team</dt>
          <dd>
            {teamSize} {teamSize === 1 ? "member" : "members"}
          </dd>
        </div>
        <div>
          <dt>Timeline</dt>
          <dd>
            {formatDate(project.start_date)} → {formatDate(project.end_date)}
          </dd>
        </div>
      </dl>

      <footer>
        <span>
          <small>Research ID</small>
          <b>{String(project.id).slice(0, 8).toUpperCase()}</b>
        </span>
        <span className="research-control-card-open">Open workspace <span aria-hidden="true">→</span></span>
      </footer>
    </button>
  );
}

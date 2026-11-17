import type { ReactNode } from "react";
import type { ResearchProject, ResearchSource } from "../../../api";
import FelixAdvicePanel from "../../../components/felix/FelixAdvicePanel";
import "./research-overview-home.css";

type Props = {
  token: string;
  project: ResearchProject;
  researchSources: ResearchSource[];
  active: boolean;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  teamPanel: ReactNode;
  briefPanel: ReactNode;
};

function formatDate(value?: string | null) {
  if (!value) return "Open";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function clean(value?: string | null) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function objectiveLines(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return [];
  const lines = text
    .split(/\r?\n|;|\s+(?=\d+[.)]\s+)/)
    .map((item) => item.replace(/^\s*(?:[•\-*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
  return [...new Map(lines.map((item) => [item.toLowerCase(), item])).values()];
}

export default function ResearchOverviewHome({
  token,
  project,
  researchSources,
  active,
  primaryActionLabel,
  onPrimaryAction,
  teamPanel,
  briefPanel,
}: Props) {
  if (!active) return null;

  const milestoneCount = project.milestones?.length || 0;
  const completedMilestones =
    project.milestones?.filter((item) => item.status === "Completed").length || 0;
  const teamSize = (project.collaborators?.length || 0) + 1;
  const objectives = objectiveLines(project.objectives);

  return (
    <section className="research-overview-home research-overview-app2-native research-overview-compact" aria-label="Research project overview">
      <section className="research-overview-command research-overview-command-compact">
        <div className="research-overview-command-copy">
          <small>OVERVIEW</small>
          <p>{clean(project.summary) || "No project summary has been recorded."}</p>
        </div>
        <button type="button" onClick={onPrimaryAction}>
          {primaryActionLabel} <span aria-hidden="true">→</span>
        </button>
      </section>

      <section className="research-overview-kpis research-overview-kpis-compact" aria-label="Project progress">
        <article>
          <small>Milestones</small>
          <strong>{milestoneCount ? `${completedMilestones}/${milestoneCount}` : "0/0"}</strong>
        </article>
        <article>
          <small>Evidence</small>
          <strong>{researchSources.length}</strong>
        </article>
        <article>
          <small>Team</small>
          <strong>{teamSize}</strong>
        </article>
        <article>
          <small>Due</small>
          <strong>{formatDate(project.end_date)}</strong>
        </article>
      </section>

      <div className="research-overview-essentials">
        <article>
          <small>RESEARCH QUESTION</small>
          <strong>{clean(project.research_question) || "Not recorded"}</strong>
        </article>

        <article>
          <small>OBJECTIVES</small>
          {objectives.length ? (
            <ol>
              {objectives.slice(0, 4).map((objective, index) => (
                <li key={`${index}-${objective}`}>{objective}</li>
              ))}
            </ol>
          ) : (
            <strong>Not recorded</strong>
          )}
        </article>

        <article>
          <small>METHODOLOGY</small>
          <p>{clean(project.methodology) || "Not recorded"}</p>
        </article>

        <article>
          <small>ACCOUNTABILITY</small>
          <dl>
            <div><dt>Lead</dt><dd>{project.lead_name || "Not assigned"}</dd></div>
            <div><dt>Oversight</dt><dd>{project.oversight_manager_name || "Not configured"}</dd></div>
            <div><dt>Timeline</dt><dd>{formatDate(project.start_date)} → {formatDate(project.end_date)}</dd></div>
          </dl>
        </article>
      </div>

      <div className="research-overview-disclosures">
        <details className="research-overview-disclosure">
          <summary><strong>Team & responsibilities</strong><span>{teamSize}</span></summary>
          <div className="research-overview-disclosure-body">{teamPanel}</div>
        </details>

        <details className="research-overview-disclosure">
          <summary><strong>Research brief</strong><span>Open</span></summary>
          <div className="research-overview-disclosure-body">{briefPanel}</div>
        </details>

        <details className="research-overview-felix">
          <summary><strong>Felix research advice</strong><span>Open</span></summary>
          <div>
            <FelixAdvicePanel
              token={token}
              contextType="Research"
              entry={{
                title: project.title,
                summary: project.summary,
                research_question: project.research_question,
                objectives: project.objectives,
                methodology: project.methodology,
                status: project.status,
                start_date: project.start_date,
                end_date: project.end_date,
                lead_id: project.lead_id,
                reviewers: project.reviewers.map((reviewer) => reviewer.reviewer_id),
                sources: researchSources.map((source) => source.id),
              }}
            />
          </div>
        </details>
      </div>
    </section>
  );
}

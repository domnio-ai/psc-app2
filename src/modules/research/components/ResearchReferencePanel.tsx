import type { ResearchProject } from "../../../api";
import "./research-reference-panel.css";

type Props = {
  project: ResearchProject;
  stage: "Work" | "Resources" | "Report";
};

function clean(value?: string | null) {
  return String(value || "").trim();
}

function objectiveLines(value?: string | null) {
  const text = clean(value);
  if (!text) return [];

  let parts = text.split(/\r?\n/).filter(Boolean);

  if (parts.length === 1 && (text.match(/;/g) || []).length) {
    parts = text.split(";").filter(Boolean);
  }

  if (parts.length === 1) {
    const numbered = text.split(/\s+(?=\d+[\.)]\s+)/).filter(Boolean);
    if (numbered.length > 1) parts = numbered;
  }

  return parts
    .map((item) =>
      item.replace(/^\s*(?:[•\-*]|\d+[\.)])\s*/, "").trim(),
    )
    .filter(Boolean);
}

export default function ResearchReferencePanel({ project, stage }: Props) {
  const question =
    clean(project.research_question) ||
    "No research question has been recorded yet.";

  const objectives = objectiveLines(project.objectives);

  const methodology =
    clean(project.methodology) ||
    "No methodology has been recorded yet.";

  return (
    <details
      className={`research-reference-panel research-reference-${stage.toLowerCase()}`}
      data-research-reference-stage={stage}
    >
      <summary>
        <span>
          <small>RESEARCH REFERENCE</small>
          <strong>Question, objectives & methodology</strong>
          <em>
            Open this while working to check that your work still supports the approved research direction.
          </em>
        </span>
        <b>View reference</b>
      </summary>

      <div className="research-reference-body">
        <article>
          <small>RESEARCH QUESTION</small>
          <strong>What the study must answer</strong>
          <p>{question}</p>
          <span>
            Use this to check whether a milestone, source or report section actually helps answer the main research problem.
          </span>
        </article>

        <article>
          <small>OBJECTIVES</small>
          <strong>What the study must achieve</strong>
          {objectives.length ? (
            <ol>
              {objectives.map((objective, index) => (
                <li key={`${index}-${objective}`}>{objective}</li>
              ))}
            </ol>
          ) : (
            <p>No research objectives have been recorded yet.</p>
          )}
          <span>
            Your work should contribute to at least one objective. If it does not, check whether it belongs in this research project.
          </span>
        </article>

        <article>
          <small>METHODOLOGY</small>
          <strong>How evidence should be gathered and analysed</strong>
          <p>{methodology}</p>
          <span>
            Use this to check that the evidence and analysis method are consistent with the agreed research approach.
          </span>
        </article>
      </div>

      <footer>
        <b>Need the full mandate?</b>
        <span>
          Open the Overview tab and expand <strong>Research Brief</strong> for the full authoritative project brief.
        </span>
      </footer>
    </details>
  );
}

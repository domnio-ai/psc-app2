import type { ResearchProject, ResearchSource } from "../../../api";
import FelixAdvicePanel from "../../../components/felix/FelixAdvicePanel";

type Props = {
  token: string;
  selectedResearch: ResearchProject;
  researchSources: ResearchSource[];
  active: boolean;
};

export default function ResearchOverviewPanel({
  token,
  selectedResearch,
  researchSources,
  active,
}: Props) {
  const milestoneCount = selectedResearch.milestones.length;
  const completedMilestones = selectedResearch.milestones.filter(
    (item) => item.status === "Completed",
  ).length;

  return (
    <>
      <section className="research-overview-panel">
        <header className="research-overview-simple-head">
          <div>
            <small>OVERVIEW</small>
            <h3>Project at a glance</h3>
          </div>
        </header>

        <div className="research-overview-metrics">
          <span>
            <small>Reference</small>
            <strong>{`RES-${selectedResearch.id.slice(0, 8).toUpperCase()}`}</strong>
          </span>
          <span>
            <small>Milestones complete</small>
            <strong>
              {milestoneCount ? `${completedMilestones}/${milestoneCount}` : "0/0"}
            </strong>
          </span>
          <span>
            <small>Related assignments</small>
            <strong>{selectedResearch.assignments?.length || 0}</strong>
          </span>
          <span>
            <small>Management oversight</small>
            <strong>{selectedResearch.oversight_manager_name || "Immediate supervisor not configured"}</strong>
          </span>
        </div>
      </section>

      {active && (
        <FelixAdvicePanel
          token={token}
          contextType="Research"
          entry={{
            title: selectedResearch.title,
            summary: selectedResearch.summary,
            research_question: selectedResearch.research_question,
            objectives: selectedResearch.objectives,
            methodology: selectedResearch.methodology,
            status: selectedResearch.status,
            start_date: selectedResearch.start_date,
            end_date: selectedResearch.end_date,
            lead_id: selectedResearch.lead_id,
            reviewers: selectedResearch.reviewers.map((reviewer) => reviewer.reviewer_id),
            sources: researchSources.map((source) => source.id),
          }}
        />
      )}
    </>
  );
}

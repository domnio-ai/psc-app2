export type GovernedWorkflowStageKey = "work" | "draft" | "review" | "finalise" | "complete";

export type GovernedWorkflowStage = {
  key: GovernedWorkflowStageKey;
  label: string;
  detail: string;
};

export const governedWorkflowStages: readonly GovernedWorkflowStage[] = [
  { key: "work", label: "Work", detail: "Carry out the governed work and gather the required evidence." },
  { key: "draft", label: "Draft", detail: "Prepare, save and preview the report before formal handoff." },
  { key: "review", label: "Review", detail: "Submit a locked version for an authorised reviewer decision." },
  { key: "finalise", label: "Finalise", detail: "Generate the approved controlled final output." },
  { key: "complete", label: "Complete", detail: "Publish or preserve the final record and close the governed work." },
];

export function taskGovernedStageIndex(taskStatus: string, contributionStatus: string): number {
  if (contributionStatus === "Accepted" || taskStatus === "Completed") return 4;
  if (contributionStatus === "Integrated") return 3;
  if (contributionStatus === "Ready for Integration") return 2;
  if (taskStatus === "Blocked") return 1;
  if (contributionStatus === "Draft") return 1;
  return 0;
}

export function assignmentGovernedStageIndex(
  status: string,
  workflowStatus: string,
  reportCount: number,
  activeTab: string,
): number {
  const combined = `${status} ${workflowStatus}`.toLowerCase();
  if (/completed|closed|finalized|finalised|published|finalisation complete|finalization complete/.test(combined)) return 4;
  if (/approved|final generation|ready to publish|ready for publication/.test(combined)) return 3;
  if (/submitted|under review|review pending|awaiting review|approval pending|awaiting approval/.test(combined)) return 2;
  if (/final report draft|ready for final report|report draft|reporting|final report/.test(combined)) return 1;
  if (reportCount > 0 || activeTab === "Reports") return 1;
  return 0;
}

export function researchGovernedStageIndex(reportStatus: string | undefined, researchTab: string): number {
  if (reportStatus === "Approved") return 3;
  if (reportStatus === "Submitted") return 2;
  if (reportStatus === "Changes Requested" || reportStatus === "Rejected") return 1;
  if (researchTab === "Review" || researchTab === "Report") return 1;
  return 0;
}

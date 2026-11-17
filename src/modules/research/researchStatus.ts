import type { ResearchProject } from "../../api";

export const researchStatusOf = (project: Pick<ResearchProject, "status" | "workflow_status">) =>
  project.workflow_status || project.status || "Planning";

export const researchStatusClass = (project: Pick<ResearchProject, "status" | "workflow_status">) =>
  researchStatusOf(project).toLowerCase().replaceAll(" ", "-");

export const currentResearchStatuses = new Set([
  "Planning",
  "Active",
  "Under Review",
]);

export const currentResearchWorkflowStatuses = new Set([
  ...currentResearchStatuses,
  "Changes Requested",
]);


export const RESEARCH_DUE_SOON_DAYS = 7;

const localDateOnly = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const researchDeadlineState = (
  project: Pick<ResearchProject, "status" | "workflow_status" | "end_date">,
  now = new Date(),
) => {
  const lifecycle = researchStatusOf(project);
  if (!currentResearchWorkflowStatuses.has(lifecycle)) return "none" as const;

  const end = localDateOnly(project.end_date);
  if (!end) return "none" as const;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.floor((end.getTime() - today.getTime()) / 86400000);

  if (days < 0) return "overdue" as const;
  if (days <= RESEARCH_DUE_SOON_DAYS) return "due-soon" as const;
  return "scheduled" as const;
};

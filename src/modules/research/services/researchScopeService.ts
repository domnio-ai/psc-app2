import {
  api,
  type ResearchProject,
  type ResearchScopeView,
} from "../../../api";

export type { ResearchScopeView };

export async function loadResearchScope(
  token: string,
  view: ResearchScopeView,
): Promise<ResearchProject[]> {
  return api.research(token, view);
}

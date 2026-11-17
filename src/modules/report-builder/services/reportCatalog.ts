import type { ApiUser, DocumentTemplate } from "../../../api";

export type ReportTemplateOption = {
  id: string;
  name: string;
  description: string;
  sections: { key: string; title: string }[];
};

export type ResearchTemplateLibraryItem = {
  template_key: string;
  name: string;
  description: string;
  section_count: number;
};

export type ResearchTemplateLibrarySource = ReadonlyArray<ResearchTemplateLibraryItem>;

export type ReportReviewerOption = {
  id: string;
  name: string;
  role: string;
};

const governedTemplate = (template: DocumentTemplate) =>
  Boolean(
    template.active &&
      ["Standard", "Approved"].includes(template.governance_status),
  );

export const assignmentReportTemplates = (templates: DocumentTemplate[]) =>
  templates
    .filter(
      (template) =>
        template.context === "Assignment" &&
        !template.template_key.startsWith("task-") &&
        governedTemplate(template),
    )
    .sort((left, right) => left.name.localeCompare(right.name));

export const taskReportTemplates = (templates: DocumentTemplate[]) =>
  templates
    .filter(
      (template) =>
        template.context === "Assignment" &&
        template.template_key.startsWith("task-") &&
        governedTemplate(template),
    )
    .sort((left, right) => left.name.localeCompare(right.name));

export const researchReportTemplates = (templates: DocumentTemplate[]) =>
  templates
    .filter(
      (template) =>
        template.context === "Research" && governedTemplate(template),
    )
    .sort((left, right) => {
      if (left.template_key === "research-blank-report") return -1;
      if (right.template_key === "research-blank-report") return 1;
      return left.name.localeCompare(right.name);
    });

export const toReportTemplateOptions = (
  templates: DocumentTemplate[],
): ReportTemplateOption[] =>
  templates.map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    sections: template.sections,
  }));

export const toResearchTemplateLibrary = (
  templates: DocumentTemplate[],
  fallback: ResearchTemplateLibrarySource = [],
): ResearchTemplateLibraryItem[] => {
  const governed = researchReportTemplates(templates);
  if (!governed.length) {
    return [...fallback].sort((left, right) => {
      if (left.template_key === "research-blank-report") return -1;
      if (right.template_key === "research-blank-report") return 1;
      return left.name.localeCompare(right.name);
    });
  }

  return governed.map((template) => ({
    template_key: template.template_key,
    name: template.name,
    description: template.description,
    section_count: template.sections?.length || 0,
  }));
};

export const normalizeReviewerOptions = (
  rows: ApiUser[],
  currentUserId?: string,
): ReportReviewerOption[] =>
  rows
    .filter(
      (reviewer) =>
        reviewer.active !== false &&
        Boolean(reviewer.id) &&
        reviewer.id !== currentUserId,
    )
    .map((reviewer) => ({
      id: reviewer.id,
      name: reviewer.name,
      role: reviewer.role || "Reviewer",
    }))
    .filter(
      (reviewer, index, reviewers) =>
        reviewers.findIndex((candidate) => candidate.id === reviewer.id) ===
        index,
    )
    .sort((left, right) => left.name.localeCompare(right.name));

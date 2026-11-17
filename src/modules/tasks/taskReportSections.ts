export const taskReportRequiredSectionKeys = [
  "title",
  "workCompleted",
  "evidence",
  "findings",
  "recommendations",
  "challenges",
  "nextActions",
] as const;

export type TaskReportSectionKey =
  (typeof taskReportRequiredSectionKeys)[number];

export type TaskReportSectionSource = {
  contributionTitle?: string | null;
  contributionSummary?: string | null;
  evidenceReviewed?: string | null;
  contributionFindings?: string | null;
  contributionRecommendations?: string | null;
  contributionChallenges?: string | null;
  contributionNextActions?: string | null;
};

export type TaskReportSectionPatch = Partial<{
  contributionTitle: string;
  contributionSummary: string;
  evidenceReviewed: string;
  contributionFindings: string;
  contributionRecommendations: string;
  contributionChallenges: string;
  contributionNextActions: string;
}>;

export const buildTaskReportSectionPatch = (
  key: string,
  value: string,
): TaskReportSectionPatch => {
  switch (key as TaskReportSectionKey) {
    case "title":
      return { contributionTitle: value };
    case "workCompleted":
      return { contributionSummary: value };
    case "evidence":
      return { evidenceReviewed: value };
    case "findings":
      return { contributionFindings: value };
    case "recommendations":
      return { contributionRecommendations: value };
    case "challenges":
      return { contributionChallenges: value };
    case "nextActions":
    default:
      return { contributionNextActions: value };
  }
};

const sectionNames: Record<TaskReportSectionKey, string> = {
  title: "Output title",
  workCompleted: "Work completed",
  evidence: "Evidence reviewed",
  findings: "Key findings",
  recommendations: "Recommendations",
  challenges: "Challenges or limitations",
  nextActions: "Next actions",
};

export const taskReportSectionName = (key: string) =>
  sectionNames[key as TaskReportSectionKey] || "Report section";

export const getTaskReportSectionValue = (
  source: TaskReportSectionSource,
  key: string,
) =>
  ({
    title: source.contributionTitle,
    workCompleted: source.contributionSummary,
    evidence: source.evidenceReviewed,
    findings: source.contributionFindings,
    recommendations: source.contributionRecommendations,
    challenges: source.contributionChallenges,
    nextActions: source.contributionNextActions,
  })[key as TaskReportSectionKey] || "";

export const taskReportSectionIndex = (key: string) =>
  taskReportRequiredSectionKeys.findIndex((sectionKey) => sectionKey === key);

export const taskReportPreviousSection = (key: string) => {
  const index = taskReportSectionIndex(key);
  return index > 0 ? taskReportRequiredSectionKeys[index - 1] : null;
};

export const taskReportNextSection = (key: string) => {
  const index = taskReportSectionIndex(key);
  return index >= 0 && index < taskReportRequiredSectionKeys.length - 1
    ? taskReportRequiredSectionKeys[index + 1]
    : null;
};

export const getTaskReportMissingSectionKeys = (
  source: TaskReportSectionSource,
) =>
  taskReportRequiredSectionKeys.filter(
    (key) => getTaskReportSectionValue(source, key).trim().length === 0,
  );

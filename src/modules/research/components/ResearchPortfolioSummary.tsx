type Props = {
  scopeLabel: string;
  totalWorkspaces: number;
  allWorkspaces: number;
  active: number;
  planning: number;
  awaitingReview: number;
  changesRequested: number;
  readyToPublish: number;
  dueSoon: number;
  overdue: number;
  imported: number;
  activeFilter: string;
  onSelectFilter: (filter: "All" | "Current" | "Active" | "Under Review" | "Planning" | "Changes Requested" | "Ready to Publish" | "Due Soon" | "Overdue", title: string) => void;
};

export default function ResearchPortfolioSummary({
  scopeLabel,
  totalWorkspaces,
  allWorkspaces,
  active,
  planning,
  awaitingReview,
  changesRequested,
  readyToPublish,
  dueSoon,
  overdue,
  imported,
  activeFilter,
  onSelectFilter,
}: Props) {
  const items = [
    {
      label: "All Research",
      value: allWorkspaces,
      detail: `${scopeLabel}. All research records in the selected scope.`,
      tone: "portfolio",
      filter: "All" as const,
    },
    {
      label: "Current Research",
      value: totalWorkspaces,
      detail: `${scopeLabel}. Excludes completed and archived research.`,
      tone: "current",
      filter: "Current" as const,
    },
    {
      label: "Active",
      value: active,
      detail: "Research currently in progress.",
      tone: "active",
      filter: "Active" as const,
    },
    {
      label: "Planning",
      value: planning,
      detail: "Research projects still being prepared.",
      tone: "planning",
      filter: "Planning" as const,
    },
    {
      label: "Awaiting Review",
      value: awaitingReview,
      detail: "Research reports awaiting an authorised review decision.",
      tone: "review",
      filter: "Under Review" as const,
    },
    {
      label: "Changes Requested",
      value: changesRequested,
      detail: "Research returned for revision before approval.",
      tone: "changes",
      filter: "Changes Requested" as const,
    },
    {
      label: "Ready to Publish",
      value: readyToPublish,
      detail: "Approved research ready for controlled publication.",
      tone: "publish",
      filter: "Ready to Publish" as const,
    },
    {
      label: "Due Soon",
      value: dueSoon,
      detail: "Current research whose governed end date falls within the next 7 days.",
      tone: "due-soon",
      filter: "Due Soon" as const,
    },
    {
      label: "Overdue",
      value: overdue,
      detail: "Current research whose governed end date has passed.",
      tone: "overdue",
      filter: "Overdue" as const,
    },
  ];

  return (
    <section
      className="research-control-summary research-control-summary-professional"
      aria-label="Research portfolio snapshot"
    >
      {items.map((item) => {
        const isActive = activeFilter === item.filter;
        return (
          <button
            key={item.label}
            type="button"
            className={isActive ? "research-summary-card active" : "research-summary-card"}
            data-tone={item.tone}
            onClick={() => onSelectFilter(item.filter, item.label)}
            aria-pressed={isActive}
            aria-label={`${item.label}: ${item.value}. ${item.detail}`}
          >
            <small>{item.label}</small>
            <strong>{item.value}</strong>
            <span>View {item.filter === "All" ? "all" : "matching"} research →</span>
          </button>
        );
      })}
      <span className="research-control-import-count" hidden>
        {imported}
      </span>
    </section>
  );
}

import type { ResearchProject } from "../../../api";
import { navigateWorkspaceTab } from "../../../utils/workspaceNavigation";

export type ResearchWorkspaceTab =
  | "Overview"
  | "Work"
  | "Resources"
  | "Report"
  | "Review"
  | "Activity";

type ResearchNextAction = {
  title: string;
  detail: string;
  label: string;
  tab: ResearchWorkspaceTab;
} | null;

type HeaderProps = {
  project: ResearchProject;
  isManager: boolean;
  onBack: () => void;
  onClose: () => void;
  onArchive: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
};

function formatWorkspaceDate(value?: string | null) {
  if (!value) return "Open";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Header({
  project,
  isManager,
  onBack,
  onClose,
  onArchive,
  onDelete,
}: HeaderProps) {
  return (
    <header className="workspace-command-header research-command-header research-command-header-simple research-command-header-compact">
      <div className="research-command-simple-row">
        <button
          className="research-command-back"
          type="button"
          title="Back to Research"
          onClick={onBack}
        >
          <span aria-hidden="true">←</span>
          <span>Research</span>
        </button>

        <div className="research-command-title">
          <div className="research-command-title-line">
            <h1>{project.title || "Untitled Research Project"}</h1>
            <span className="research-command-status">{project.status || "Planning"}</span>
          </div>
          <div className="research-command-meta research-command-meta-simple">
            <span className="research-command-meta-item">
              <small>Lead</small>
              <strong>{project.lead_name || "Not assigned"}</strong>
            </span>
            <span className="research-command-meta-item">
              <small>Due</small>
              <strong>{formatWorkspaceDate(project.end_date)}</strong>
            </span>
          </div>
        </div>

        <div className="research-command-right">
          {isManager && (
            <details className="research-project-options">
              <summary>Options</summary>
              <div>
                {project.status !== "Archived" ? (
                  <button type="button" onClick={() => void onArchive()}>
                    Archive research
                  </button>
                ) : (
                  <button type="button" className="danger" onClick={() => void onDelete()}>
                    Delete permanently
                  </button>
                )}
              </div>
            </details>
          )}

          <button
            className="research-command-close"
            type="button"
            aria-label="Close research workspace"
            title="Close workspace"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>
    </header>
  );
}

type NavigationProps = {
  researchTab: ResearchWorkspaceTab;
  onNavigate: (tab: ResearchWorkspaceTab) => void;
  nextAction: ResearchNextAction;
  notice: string;
  onPreviewBrief: () => void;
  onOpenReportBuilder: () => void;
};

const screens = ["Overview", "Work", "Resources", "Report", "Review", "Activity"] as const;

function Navigation({
  researchTab,
  onNavigate,
  nextAction,
  notice,
  onPreviewBrief,
  onOpenReportBuilder,
}: NavigationProps) {
  const navigate = (tab: ResearchWorkspaceTab, source: HTMLElement | null) =>
    navigateWorkspaceTab(tab, onNavigate, source);

  return (
    <>
      <nav
        className="workspace-primary-tabs research-workspace-tabs research-workspace-stepper research-workspace-tabs-compact"
        role="tablist"
        aria-label="Research workspace sections"
      >
        {screens.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`research-workspace-tab-${tab.toLowerCase()}`}
            aria-selected={researchTab === tab}
            tabIndex={researchTab === tab ? 0 : -1}
            className={researchTab === tab ? "active" : ""}
            onClick={(event) => navigate(tab, event.currentTarget)}
          >
            <span>{tab === "Resources" ? "Evidence" : tab}</span>
          </button>
        ))}
      </nav>

      {(nextAction || notice) && (
        <div className="research-context-strip" role={notice ? "status" : undefined}>
          {notice ? (
            <span className="research-context-notice">{notice}</span>
          ) : nextAction ? (
            <>
              <span>
                <small>Next</small>
                <strong>{nextAction.title}</strong>
              </span>
              <button
                type="button"
                onClick={(event) => {
                  if (nextAction.label === "Preview Research Brief") {
                    onPreviewBrief();
                  } else if (nextAction.label === "Open Report Builder") {
                    onOpenReportBuilder();
                  } else {
                    navigate(nextAction.tab, event.currentTarget);
                  }
                }}
              >
                {nextAction.label}
              </button>
            </>
          ) : null}
        </div>
      )}
    </>
  );
}

const ResearchWorkspaceShell = { Header, Navigation };
export default ResearchWorkspaceShell;

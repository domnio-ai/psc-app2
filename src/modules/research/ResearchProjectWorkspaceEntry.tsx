import type { ReactNode } from "react";
import type { ResearchProject } from "../../api";
import "./styles/research-workspace-readonly.css";
import "./styles/research-workspace-visual-v1.css";
import ResearchWorkspaceShell, {
  type ResearchWorkspaceTab,
} from "./components/ResearchWorkspaceShell";

type NextAction = {
  title: string;
  detail: string;
  label: string;
  tab: ResearchWorkspaceTab;
} | null;

type Props = {
  project: ResearchProject;
  isManager: boolean;
  researchTab: ResearchWorkspaceTab;
  onNavigate: (tab: ResearchWorkspaceTab) => void;
  nextAction: NextAction;
  notice: string;
  onBack: () => void;
  onClose: () => void;
  onArchive: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  onPreviewBrief: () => void;
  onOpenReportBuilder: () => void;
  overview: ReactNode;
  children: ReactNode;
  readOnly?: boolean;
  readOnlyMessage?: string;
};

export default function ResearchProjectWorkspaceEntry({
  project,
  isManager,
  researchTab,
  onNavigate,
  nextAction,
  notice,
  onBack,
  onClose,
  onArchive,
  onDelete,
  onPreviewBrief,
  onOpenReportBuilder,
  overview,
  children,
  readOnly = false,
  readOnlyMessage = "",
}: Props) {
  return (
    <div className="research-workspace-frame">
      <div
        className="governed-workspace research-workspace research-project-workspace-entry"
        data-tab={researchTab}
      >
        <ResearchWorkspaceShell.Header
          project={project}
          isManager={readOnly ? false : isManager}
          onBack={onBack}
          onClose={onClose}
          onArchive={onArchive}
          onDelete={onDelete}
        />

        <ResearchWorkspaceShell.Navigation
          researchTab={researchTab}
          onNavigate={onNavigate}
          nextAction={nextAction}
          notice={notice}
          onPreviewBrief={onPreviewBrief}
          onOpenReportBuilder={onOpenReportBuilder}
        />

        {readOnly && (
          <aside className="research-workspace-readonly-banner" role="status" aria-live="polite">
            <strong>Research workspace locked for review</strong>
            <span>{readOnlyMessage || "All research content is read-only until the submitted report is returned for changes."}</span>
          </aside>
        )}

        {researchTab === "Overview" && overview}

        <div
          className="research-workspace-content-boundary"
          data-readonly={readOnly ? "true" : "false"}
          aria-readonly={readOnly || undefined}
          data-active-tab={researchTab}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

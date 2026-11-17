import type { ApiAssignment } from "../../../api";
import type { AssignmentWorkspaceTab } from "./AssignmentWorkspaceShell";

import "../assignment-workflow-v6.css";
import GovernedWorkflowStrip from "../../workflow/GovernedWorkflowStrip";
import { assignmentGovernedStageIndex } from "../../workflow/governedWorkflowModel";
type Attention = {
  tone: "danger" | "warning" | "info" | "success";
  title: string;
  detail: string;
  tab: AssignmentWorkspaceTab;
  action: string;
} | null;

type Props = {
  assignment: ApiAssignment | null;
  activeTab: AssignmentWorkspaceTab;
  reportCount: number;
  daysRemaining: number | null;
  attention: Attention;
  displayLabel: (label: string) => string;
  onNavigate: (tab: AssignmentWorkspaceTab, source: HTMLButtonElement) => void;
};

export default function AssignmentWorkflowGuide({
  assignment,
  activeTab,
  reportCount,
  attention,
  displayLabel,
  onNavigate,
}: Props) {
  const currentIndex = assignmentGovernedStageIndex(
    String(assignment?.status || ""),
    String(assignment?.workflow_status || ""),
    reportCount,
    activeTab,
  );
  const stageTabs: readonly AssignmentWorkspaceTab[] = ["Overview", "Reports", "Reports", "Activity", "Activity"];
  const currentStageLabel = ["Work", "Draft", "Report decision", "Finalise", "Complete"][currentIndex] || "Work";

  return (
    <section className="assignment-workflow-guide" aria-label="Assignment workflow guide">
      <GovernedWorkflowStrip
        currentIndex={currentIndex}
        compact
        label="Assignment governed workflow"
        onSelect={(index, source) => onNavigate(stageTabs[index] || "Overview", source)}
      />

      <div className="assignment-workflow-summary">
        <div className="assignment-workflow-current">
          <small>CURRENT WORKFLOW POSITION</small>
          <strong>{currentStageLabel}</strong>
          <span>{displayLabel(activeTab)} workspace</span>
        </div>

        {attention ? (
          <div className={`assignment-workflow-next assignment-workflow-next-${attention.tone}`}>
            <div>
              <small>NEXT ACTION</small>
              <strong>{attention.title}</strong>
              <p>{attention.detail}</p>
            </div>
            <button
              type="button"
              onClick={(event) => onNavigate(attention.tab, event.currentTarget)}
            >
              {attention.action}
            </button>
          </div>
        ) : (
          <div className="assignment-workflow-next assignment-workflow-next-neutral">
            <div>
              <small>NEXT ACTION</small>
              <strong>Continue assignment work</strong>
              <p>Use the workspace tabs to continue evidence, reporting or activity work.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

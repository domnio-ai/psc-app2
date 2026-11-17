type Props = {
  contributionStatus: string;
  canEdit: boolean;
  taskStatus: string;
  workspaceSaving: boolean;
  managementBusy: boolean;
  titleReady: boolean;
  onStart: () => void;
  onSave: () => void;
};

export default function TaskWorkspaceFooter({
  contributionStatus,
  canEdit,
  taskStatus,
  workspaceSaving,
  managementBusy,
  titleReady,
  onStart,
  onSave,
}: Props) {
  const editableDraft = contributionStatus === "Draft" && canEdit;
  const controlsBusy = workspaceSaving || managementBusy;

  return (
    <footer className="task-workspace-footer task-screen-footer">
      {editableDraft && (
        <div>
          {taskStatus === "Not Started" && (
            <button
              type="button"
              className="task-start-button"
              disabled={controlsBusy}
              onClick={onStart}
            >
              {workspaceSaving ? "Saving..." : "Start Task"}
            </button>
          )}

          <button
            type="button"
            className="task-save-button"
            disabled={controlsBusy || !titleReady}
            onClick={onSave}
          >
            {workspaceSaving ? "Saving..." : "Save Task Details"}
          </button>

          {taskStatus !== "Completed" && (
            <span className="task-completion-rule">
              Task completion is recorded only after the approved final report is generated
              and published to the Repository.
            </span>
          )}
        </div>
      )}
    </footer>
  );
}

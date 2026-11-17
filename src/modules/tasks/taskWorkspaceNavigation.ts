type AssignmentWorkspaceTab =
  | "Overview"
  | "Documents"
  | "Reports"
  | "Activity";

type TaskNavigationTask = {
  status?: string | null;
  contribution_status?: string | null;
};

type TaskWorkspaceNavigationOptions = {
  selectedTask: TaskNavigationTask | null;
  standaloneTaskOrigin: boolean;
  returnTab: () => AssignmentWorkspaceTab;
  setReportPreviewOpen: (open: boolean) => void;
  clearTaskReportSectionModal: () => void;
  clearSelectedTask: () => void;
  setStandaloneTaskOrigin: (value: boolean) => void;
  clearSelectedAssignment: () => void;
  clearSelectedAssignmentId: () => void;
  setActiveWorkspace: (workspace: string) => void;
  selectAssignmentTab: (tab: AssignmentWorkspaceTab) => void;
};

export function createTaskWorkspaceNavigation({
  selectedTask,
  standaloneTaskOrigin,
  returnTab,
  setReportPreviewOpen,
  clearTaskReportSectionModal,
  clearSelectedTask,
  setStandaloneTaskOrigin,
  clearSelectedAssignment,
  clearSelectedAssignmentId,
  setActiveWorkspace,
  selectAssignmentTab,
}: TaskWorkspaceNavigationOptions) {
  const closeTaskReportPreview = () => {
    setReportPreviewOpen(false);

    if (
      selectedTask?.status === "Completed" ||
      selectedTask?.contribution_status === "Accepted"
    ) {
      clearTaskReportSectionModal();
      clearSelectedTask();
      selectAssignmentTab(returnTab());
    }
  };

  const closeTaskWorkspace = () => {
    setReportPreviewOpen(false);
    clearTaskReportSectionModal();
    clearSelectedTask();

    if (standaloneTaskOrigin) {
      setStandaloneTaskOrigin(false);
      clearSelectedAssignment();
      clearSelectedAssignmentId();
      setActiveWorkspace("Tasks");
      return;
    }

    selectAssignmentTab(returnTab());
  };

  return {
    closeTaskReportPreview,
    closeTaskWorkspace,
  };
}

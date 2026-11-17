import type { ComponentProps, ReactNode } from "react";
import AssignmentWorkspaceShell from "./components/AssignmentWorkspaceShell";
import "./assignment-workspace.css";
import "./assignments-dashboard-standard.css";
import "./assignment-report-direct-entry-v2.css";
import "./assignment-workspace-simple-v1.css";

type ShellProps = ComponentProps<typeof AssignmentWorkspaceShell>;

type Props = Omit<ShellProps, "children"> & {
  children: ReactNode;
};

/**
 * Single module boundary for the Assignment Workspace.
 *
 * App.tsx may continue to own orchestration state temporarily, but it no longer
 * enters the assignment workspace through a deep component import.
 */
export default function AssignmentWorkspaceEntry({
  children,
  ...shellProps
}: Props) {
  return (
    <AssignmentWorkspaceShell {...shellProps}>
      {children}
    </AssignmentWorkspaceShell>
  );
}

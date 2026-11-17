import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ApiAssignmentTask } from "../../api";
import "./task-workspace.css";
import "./tasks-dashboard-standard.css";

import "./task-workspace-screen2-v5.css";
import "./task-final-shared-v1-1.css";
type Props = {
  task: ApiAssignmentTask;
  header: ReactNode;
  children: ReactNode;
};

/**
 * Standalone TASK Workspace renderer.
 *
 * TASK execution is mounted independently from the ASSIGNMENT Workspace shell.
 * The TASK may still carry assignment_id and related ASSIGNMENT context for
 * traceability, reporting, review and aggregation, but opening this renderer
 * does not require an ASSIGNMENT Workspace tab.
 */
export default function TaskWorkspaceEntry({
  task,
  header,
  children,
}: Props) {
  const statusClass = task.status
    .toLowerCase()
    .replaceAll(" ", "-");
  const workspaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const workspace = workspaceRef.current;
    const heading = workspace?.querySelector<HTMLElement>(".task-screen-title h2");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, [task.id]);

  return createPortal(
    <div
      ref={workspaceRef}
      className="task-workspace-backdrop task-workspace-fullscreen"
      data-task-id={task.id}
      data-assignment-reference={task.assignment_id || undefined}
      data-task-status={String(task.status || "unknown").toLowerCase()}
      data-task-priority={String(task.priority || "normal").toLowerCase()}
      data-contribution-status={String(task.contribution_status || "Draft").toLowerCase()}
      role="dialog"
      aria-modal="true"
      aria-label={`TASK workspace for ${task.title}`}
    >
      <section
        className={`task-workspace-modal task-workspace-screen task-status-${statusClass}`}
      >
        {header}
        {children}
      </section>
    </div>,
    document.body,
  );
}

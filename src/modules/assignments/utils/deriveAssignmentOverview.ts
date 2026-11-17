import type {
  ApiAssignment,
  ApiAssignmentReview,
  ApiAssignmentTask,
  GeneratedDocumentSummary,
} from "../../../api";
import type { AssignmentWorkspaceTab } from "../components/AssignmentWorkspaceShell";

type UserIdentity = { id?: string; name?: string } | null;

export type AssignmentNextAction = {
  title: string;
  label: string;
  tab: AssignmentWorkspaceTab | "Tasks";
  responsible: string;
  detail: string;
};

const normalizeIdentity = (value?: string | null) =>
  String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();

export function deriveAssignmentOverview({
  assignment,
  tasks,
  documents,
  reviews,
  user,
}: {
  assignment: ApiAssignment | null;
  tasks: ApiAssignmentTask[];
  documents: GeneratedDocumentSummary[];
  reviews: ApiAssignmentReview[];
  user: UserIdentity;
}) {
  const finalReports = documents
    .filter(
      (item) =>
        item.template_key === "assignment-final-report" ||
        /Final Assignment Report/i.test(item.title || ""),
    )
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  const latestFinalReport = finalReports[0] || null;
  const acceptedTaskReportCount = tasks.filter(
    (task) => task.contribution_status === "Accepted",
  ).length;
  const completedTaskCount = tasks.filter(
    (task) => task.status === "Completed",
  ).length;
  const allTaskReportsAccepted =
    tasks.length > 0 && acceptedTaskReportCount === tasks.length;
  const finalReportIsFinal = Boolean(
    latestFinalReport &&
      (latestFinalReport.status === "Final" ||
        latestFinalReport.repository_document_id),
  );
  const finalReportStagePercent = latestFinalReport
    ? latestFinalReport.status === "Final" || latestFinalReport.repository_document_id
      ? 100
      : latestFinalReport.status === "Approved"
        ? 96
        : ["Submitted", "Under Review"].includes(latestFinalReport.status)
          ? 92
          : latestFinalReport.status === "Changes Requested"
            ? 88
            : 84
    : 0;
  const taskExecutionPercent = tasks.length
    ? Math.round((completedTaskCount / tasks.length) * 35)
    : 0;
  const taskReportPercent = tasks.length
    ? Math.round((acceptedTaskReportCount / tasks.length) * 30)
    : 0;
  const completion = finalReportIsFinal
    ? 100
    : latestFinalReport
      ? Math.max(70, finalReportStagePercent)
      : Math.min(80, (tasks.length ? 15 : 5) + taskExecutionPercent + taskReportPercent);
  const daysRemaining = assignment?.due_date
    ? Math.ceil((new Date(assignment.due_date).getTime() - Date.now()) / 86400000)
    : null;
  const lead =
    assignment?.members.find((member) => member.role === "Lead") ||
    assignment?.members[0];
  const hasExplicitLead = Boolean(
    assignment?.members.some((member) => member.role === "Lead"),
  );
  const currentUserMatchesLead = Boolean(
    user &&
      lead &&
      ((user.id && lead.id === user.id) ||
        normalizeIdentity(lead.name) === normalizeIdentity(user.name)),
  );
  const isLead = Boolean(
    assignment &&
      currentUserMatchesLead &&
      (lead?.role === "Lead" || !hasExplicitLead),
  );
  const nextTask = [...tasks]
    .filter((task) => task.status !== "Completed")
    .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"))[0] || null;
  const pendingContributions = tasks.filter(
    (task) => task.contribution_status !== "Accepted",
  );

  const nextAction: AssignmentNextAction = !tasks.length
    ? {
        title: "Prepare the Final Assignment Report",
        label: "Open Reports",
        tab: "Reports",
        responsible: lead?.name || "An authorised manager",
        detail: "This ASSIGNMENT uses the direct-reporting workflow. If delegated work is needed, create a TASK REQUEST from the standalone Tasks module.",
      }
    : nextTask
      ? {
          title: "Continue active task work",
          label: "Open Tasks",
          tab: "Tasks",
          responsible: nextTask.owner_name || "Assignment Lead",
          detail: `${nextTask.title} · ${nextTask.owner_name || "Unassigned"}${nextTask.due_date ? ` · due ${new Date(nextTask.due_date).toLocaleDateString("en-KE")}` : ""}`,
        }
      : pendingContributions.length
        ? {
            title: "Finish task-report review",
            label: "Open Tasks",
            tab: "Tasks",
            responsible: pendingContributions[0]?.reviewer_name || pendingContributions[0]?.owner_name || lead?.name || "Assignment team",
            detail: `${pendingContributions.length} task report${pendingContributions.length === 1 ? "" : "s"} still need submission, review or final acceptance.`,
          }
        : !latestFinalReport
          ? {
              title: "Create the Final Assignment Report",
              label: "Open Reports",
              tab: "Reports",
              responsible: lead?.name || "An authorised manager",
              detail: "All required task reports are accepted. Compile the Final Assignment Report from the approved task-report sources.",
            }
          : latestFinalReport.status === "Changes Requested"
            ? {
                title: "Revise the Final Assignment Report",
                label: "Open Reports",
                tab: "Reports",
                responsible: lead?.name || "An authorised manager",
                detail: "The reviewer requested changes. Update the report and resubmit it.",
              }
            : ["Submitted", "Under Review"].includes(latestFinalReport.status)
              ? {
                  title: "Final Assignment Report is under review",
                  label: "Open Reports",
                  tab: "Reports",
                  responsible: latestFinalReport.reviewer_name || reviews[0]?.reviewer_name || "Assigned reviewer",
                  detail: "The final report has been submitted. Follow its decision status from Reports.",
                }
              : latestFinalReport.status === "Approved" && !latestFinalReport.repository_document_id
                ? {
                    title: "Publish the approved Final Assignment Report",
                    label: "Open Reports",
                    tab: "Reports",
                    responsible: latestFinalReport.reviewer_name || reviews[0]?.reviewer_name || "Approving reviewer",
                    detail: "The report is approved. Complete finalization and publish the controlled final copy.",
                  }
                : finalReportIsFinal
                  ? {
                      title: "Assignment reporting is complete",
                      label: "View Final Report",
                      tab: "Reports",
                      responsible: "No further action required",
                      detail: "The Final Assignment Report has been finalized and is available for reading.",
                    }
                  : {
                      title: "Continue the Final Assignment Report",
                      label: "Open Reports",
                      tab: "Reports",
                      responsible: lead?.name || "An authorised manager",
                      detail: "A Final Assignment Report draft exists and still needs to be completed and submitted.",
                    };

  const operationalStatus = !tasks.length
    ? latestFinalReport ? "Final Report Draft" : "Ready for Final Report"
    : nextTask
      ? "In Progress"
      : pendingContributions.length
        ? "Task Reporting"
        : !latestFinalReport
          ? "Ready for Final Report"
          : latestFinalReport.status === "Changes Requested"
            ? "Changes Requested"
            : ["Submitted", "Under Review"].includes(latestFinalReport.status)
              ? "Final Report Review"
              : latestFinalReport.status === "Approved" && !latestFinalReport.repository_document_id
                ? "Approved · Finalization Pending"
                : finalReportIsFinal ? "Completed" : "Final Report Draft";

  return {
    latestFinalReport,
    acceptedTaskReportCount,
    completedTaskCount,
    allTaskReportsAccepted,
    finalReportIsFinal,
    completion,
    daysRemaining,
    lead,
    isLead,
    pendingContributions,
    nextAction,
    operationalStatus,
  };
}

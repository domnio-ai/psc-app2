import { useEffect, useMemo, useState } from "react";
import type { DocumentImprovementAssignment, DocumentItem } from "../../../api";

export type RepositoryOperationalQueue =
  | "All"
  | "My Records"
  | "My Reviews"
  | "My Improvements"
  | "Review Overdue"
  | "Review Due 30"
  | "No Retention"
  | "No Reviewer"
  | "Improvement Overdue"
  | "Restricted"
  | "Disposition Due"
  | "Legal Hold"
  | "Superseded"
  | "Replacement Records";

type GroupName = "my-work" | "manager" | "continuity";

type Props = {
  documents: DocumentItem[];
  improvements: DocumentImprovementAssignment[];
  currentUserId: string;
  isManager: boolean;
  selected: RepositoryOperationalQueue;
  onSelect: (queue: RepositoryOperationalQueue) => void;
};

const openImprovement = (status: string) =>
  ["Assigned", "In Progress", "Submitted"].includes(status);

const dueAt = (value?: string | null) =>
  value ? new Date(`${value.slice(0, 10)}T23:59:59`).getTime() : null;

export const matchesRepositoryOperationalQueue = (
  item: DocumentItem,
  queue: RepositoryOperationalQueue,
  userId: string,
  improvements: DocumentImprovementAssignment[],
) => {
  if (queue === "All") return true;
  const now = Date.now();
  const reviewAt = dueAt(item.next_review_at || item.review_due_at);
  const retentionAt = dueAt(item.retention_until);
  const openImprovements = improvements.filter(
    (assignment) =>
      assignment.knowledge_id === item.id && openImprovement(assignment.status),
  );

  switch (queue) {
    case "My Records":
      return item.created_by === userId;
    case "My Reviews":
      return (
        item.reviewer_id === userId &&
        !["Approved", "Published", "Archived"].includes(item.status)
      );
    case "My Improvements":
      return openImprovements.some(
        (assignment) =>
          assignment.assignee_id === userId || assignment.reviewer_id === userId,
      );
    case "Review Overdue":
      return reviewAt !== null && reviewAt < now;
    case "Review Due 30":
      return reviewAt !== null && reviewAt >= now && reviewAt <= now + 30 * 86400000;
    case "No Retention":
      return item.status === "Published" && !item.retention_schedule_id;
    case "No Reviewer":
      return !item.reviewer_id && !["Archived", "Published"].includes(item.status);
    case "Improvement Overdue":
      return openImprovements.some(
        (assignment) =>
          Boolean(assignment.due_date) && dueAt(assignment.due_date)! < now,
      );
    case "Restricted":
      return (
        ["NAMED_USERS", "REVIEWER_ONLY", "MANAGEMENT_ONLY", "TEAM"].includes(
          item.protection_scope || "",
        ) ||
        ["CONFIDENTIAL", "RESTRICTED"].includes(
          String(item.classification || "").toUpperCase(),
        )
      );
    case "Disposition Due":
      return (
        (retentionAt !== null && retentionAt <= now) ||
        item.records_lifecycle_state === "Disposition Review"
      );
    case "Legal Hold":
      return item.legal_hold === true;
    case "Superseded":
      return item.records_lifecycle_state === "Superseded" || Boolean(item.superseded_by);
    case "Replacement Records":
      return Boolean(item.supersedes_id);
    default:
      return true;
  }
};

const countQueue = (
  documents: DocumentItem[],
  queue: RepositoryOperationalQueue,
  userId: string,
  improvements: DocumentImprovementAssignment[],
) =>
  documents.filter((item) =>
    matchesRepositoryOperationalQueue(item, queue, userId, improvements),
  ).length;

const groupForQueue = (queue: RepositoryOperationalQueue): GroupName | null => {
  if (["My Records", "My Reviews", "My Improvements"].includes(queue)) return "my-work";
  if (
    ["Review Overdue", "Review Due 30", "No Retention", "No Reviewer", "Improvement Overdue", "Restricted"].includes(queue)
  ) return "manager";
  if (["Disposition Due", "Legal Hold", "Superseded", "Replacement Records"].includes(queue)) return "continuity";
  return null;
};

export default function RepositoryOperationalQueues({
  documents,
  improvements,
  currentUserId,
  isManager,
  selected,
  onSelect,
}: Props) {
  const [openGroup, setOpenGroup] = useState<GroupName | null>(
    groupForQueue(selected),
  );

  useEffect(() => {
    const group = groupForQueue(selected);
    if (group) setOpenGroup(group);
  }, [selected]);

  const queueCount = (queue: RepositoryOperationalQueue) =>
    countQueue(documents, queue, currentUserId, improvements);

  const groupCount = (queues: RepositoryOperationalQueue[]) =>
    documents.filter((item) =>
      queues.some((queue) =>
        matchesRepositoryOperationalQueue(item, queue, currentUserId, improvements),
      ),
    ).length;

  const groups = useMemo(() => {
    const result = [
      {
        key: "my-work" as GroupName,
        title: "My Record Work",
        hint: "Ownership, review and improvement responsibilities.",
        queues: [
          ["My Records", "My records", "Records you own"],
          ["My Reviews", "Awaiting my review", "Reviewer action"],
          ["My Improvements", "My improvements", "Assigned or reviewing"],
        ] as [RepositoryOperationalQueue, string, string][],
      },
    ];
    if (isManager) {
      result.push(
        {
          key: "manager",
          title: "Manager Attention",
          hint: "Exceptions requiring management oversight.",
          queues: [
            ["Review Overdue", "Review overdue", "Governance action required"],
            ["Review Due 30", "Due within 30 days", "Prepare review"],
            ["No Retention", "No retention schedule", "Published records"],
            ["No Reviewer", "No reviewer", "Unassigned governance"],
            ["Improvement Overdue", "Improvement overdue", "Assigned work late"],
            ["Restricted", "Restricted records", "Controlled access"],
          ],
        },
        {
          key: "continuity",
          title: "Disposition & Continuity",
          hint: "Retention, legal hold and supersession decisions.",
          queues: [
            ["Disposition Due", "Disposition due", "Retention action reached"],
            ["Legal Hold", "Legal hold", "Disposition blocked"],
            ["Superseded", "Superseded", "Historical records"],
            ["Replacement Records", "Replacement records", "Current successors"],
          ],
        },
      );
    }
    return result;
  }, [isManager]);

  return (
    <section className="repository-operational-queues repository-operational-queues-compact">
      <header className="repository-operations-summary">
        <div>
          <small>OPERATIONAL RECORDS CONTROL</small>
          <strong>What needs attention now</strong>
          <span>Open a section only when you need it.</span>
        </div>
        {selected !== "All" && (
          <button type="button" onClick={() => onSelect("All")}>
            Clear queue
          </button>
        )}
      </header>

      <div className="repository-queue-accordion">
        {groups.map((group) => {
          const isOpen = openGroup === group.key;
          const activeInGroup = group.queues.some(([queue]) => queue === selected);
          const uniqueCount = groupCount(group.queues.map(([queue]) => queue));

          return (
            <section
              key={group.key}
              className={`repository-queue-dropdown ${isOpen ? "open" : ""} ${activeInGroup ? "has-active-queue" : ""}`}
            >
              <button
                type="button"
                className="repository-queue-dropdown-trigger"
                aria-expanded={isOpen}
                onClick={() => setOpenGroup(isOpen ? null : group.key)}
              >
                <div>
                  <strong>{group.title}</strong>
                  <span>{group.hint}</span>
                </div>
                <div className="repository-queue-dropdown-meta">
                  <b>{uniqueCount}</b>
                  <small>{uniqueCount === 1 ? "record" : "records"}</small>
                  <i aria-hidden="true">{isOpen ? "▴" : "▾"}</i>
                </div>
              </button>

              {isOpen && (
                <div className="repository-queue-dropdown-body">
                  {group.queues.map(([queue, label, hint]) => {
                    const count = queueCount(queue);
                    return (
                      <button
                        key={queue}
                        type="button"
                        className={selected === queue ? "active" : ""}
                        onClick={() => onSelect(selected === queue ? "All" : queue)}
                      >
                        <b>{count}</b>
                        <span>{label}</span>
                        <small>{hint}</small>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}

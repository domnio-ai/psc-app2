import type { DocumentImprovementAssignment, DocumentItem } from "../../../api";

type Props = {
  documents: DocumentItem[];
  improvements: DocumentImprovementAssignment[];
  isManager: boolean;
  currentUserId: string;
  onViewAll: () => void;
  onViewLifecycle: (status: string) => void;
  onOpenImprovement: (document: DocumentItem) => void;
  onUpdateImprovementStatus: (assignment: DocumentImprovementAssignment, status: DocumentImprovementAssignment["status"]) => void;
};

export default function RepositoryRecordsCommandCentre({
  documents,
  improvements,
  isManager,
  currentUserId,
  onViewAll,
  onViewLifecycle,
  onOpenImprovement,
  onUpdateImprovementStatus,
}: Props) {
  const activeImprovements = improvements.filter((item) =>
    ["Assigned", "In Progress", "Submitted"].includes(item.status),
  );
  const reviewDue = documents.filter((item) => {
    if (!item.review_due_at) return false;
    const due = new Date(item.review_due_at).getTime();
    return Number.isFinite(due) && due <= Date.now() + 30 * 24 * 60 * 60 * 1000;
  });
  const legalHold = documents.filter((item) => item.legal_hold);
  const retentionReview = documents.filter((item) =>
    item.records_lifecycle_state === "Disposition Review" ||
    (item.retention_until && new Date(item.retention_until).getTime() <= Date.now()),
  );

  return (
    <section className="repository-records-command-centre" aria-label="Records management command centre">
      <header>
        <div>
          <small>LIFECYCLE ATTENTION</small>
          <h3>Records needing action</h3>
          <p>Only exceptions are shown here. Use the Record Library tabs below to browse records.</p>
        </div>
        <span className="repository-rm-standard">Versioned · reviewed · auditable</span>
      </header>

      <div className="repository-rm-cards repository-rm-exception-cards">
        <button type="button" onClick={() => onViewLifecycle("Under Improvement")}>
          <small>IMPROVEMENT</small><strong>{activeImprovements.length}</strong><span>Assigned updates in progress</span>
        </button>
        <button type="button" onClick={() => onViewLifecycle("Review Due")}>
          <small>REVIEW DUE</small><strong>{reviewDue.length}</strong><span>Due within 30 days</span>
        </button>
        <button type="button" onClick={() => onViewLifecycle("Retention Review")}>
          <small>RETENTION</small><strong>{retentionReview.length}</strong><span>Disposition review required</span>
        </button>
        <button type="button" onClick={() => onViewLifecycle("Legal Hold")}>
          <small>HOLD</small><strong>{legalHold.length}</strong><span>Protected from disposition</span>
        </button>
      </div>

      {activeImprovements.length > 0 && (
        <div className="repository-improvement-strip">
          <div>
            <strong>Active document improvements</strong>
            <span>New versions remain governed until the assigned reviewer completes the upgrade.</span>
          </div>
          <div>
            {activeImprovements.slice(0, 4).map((assignment) => {
              const document = documents.find((item) => item.id === assignment.knowledge_id);
              return (
                <div key={assignment.id}>
                  <button type="button" disabled={!document}
                    onClick={() => document && onOpenImprovement(document)}>
                  <b>{assignment.knowledge_title}</b>
                  <span>{assignment.improvement_type} · {assignment.assignee_name}</span>
                  <small>{assignment.status}{assignment.due_date ? ` · due ${new Date(assignment.due_date).toLocaleDateString("en-KE")}` : ""}</small>
                  </button>
                  {assignment.assignee_id === currentUserId && assignment.status === "Assigned" && (
                    <span role="group" aria-label="Improvement actions">
                      <button type="button" onClick={(event) => { event.stopPropagation(); onUpdateImprovementStatus(assignment, "In Progress"); }}>Start work</button>
                    </span>
                  )}
                  {assignment.assignee_id === currentUserId && assignment.status === "In Progress" && (
                    <span role="group" aria-label="Improvement actions">
                      <button type="button" onClick={(event) => { event.stopPropagation(); onUpdateImprovementStatus(assignment, "Submitted"); }}>Submit for review</button>
                    </span>
                  )}
                  {assignment.reviewer_id === currentUserId && assignment.status === "Submitted" && (
                    <span role="group" aria-label="Reviewer actions">
                      <button type="button" onClick={(event) => { event.stopPropagation(); onUpdateImprovementStatus(assignment, "Completed"); }}>Approve and publish</button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isManager && (
        <p className="repository-rm-scope-note">
          You can read and work on records within your authorised scope. Assignment, declaration,
          retention and disposition controls remain manager-governed.
        </p>
      )}
    </section>
  );
}

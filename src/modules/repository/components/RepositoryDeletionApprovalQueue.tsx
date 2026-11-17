import type { DocumentDeletionRequest } from "../../../api";

type Props = {
  isManager: boolean;
  deletionRequests: DocumentDeletionRequest[];
  onReviewRequest: (item: DocumentDeletionRequest) => void;
};

export default function RepositoryDeletionApprovalQueue({
  isManager,
  deletionRequests,
  onReviewRequest,
}: Props) {
  if (!isManager) return null;

  const pendingRequests = deletionRequests.filter((item) => item.status === "Pending");

  return (
    <section className="deletion-approval-queue">
      <header>
        <div>
          <p>DELETION REQUESTS</p>
          <h3>
            {pendingRequests.length} awaiting manager approval
          </h3>
        </div>
      </header>

      {pendingRequests.map((item) => (
        <article key={item.id}>
          <div>
            <strong>{item.knowledge_title}</strong>
            <small>
              Requested by {item.requested_by_name} ·{" "}
              {new Date(item.created_at).toLocaleDateString("en-KE")}
            </small>
            <p>{item.reason}</p>
          </div>
          <button type="button" onClick={() => onReviewRequest(item)}>
            Review request
          </button>
        </article>
      ))}

      {pendingRequests.length === 0 && (
        <p className="queue-empty">
          No document deletion requests are awaiting approval.
        </p>
      )}
    </section>
  );
}

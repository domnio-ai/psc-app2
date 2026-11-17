import type { ReviewItem } from "../../../api";

type ReviewerOption = {
  id: string;
  name: string;
  role: string;
};

type Props = {
  canReview: boolean;
  isManager: boolean;
  reviewRows: ReviewItem[];
  reviewers: ReviewerOption[];
  assignReviewer: (item: ReviewItem, reviewerId: string) => void | Promise<void>;
  openDocumentVersions: (item: ReviewItem) => void;
  openRepositoryReview: (item: ReviewItem) => void;
};

export default function RepositoryReviewQueue({
  canReview,
  isManager,
  reviewRows,
  reviewers,
  assignReviewer,
  openDocumentVersions,
  openRepositoryReview,
}: Props) {
  // Review visibility is contextual. If the backend returned reviewRows,
  // the user is already within the permitted review scope.
  // Managers may also see the queue for assignment/oversight purposes.
  if (!isManager && reviewRows.length === 0) return null;

  return (
    <section className="review-queue">
      <header>
        <div>
          <p>REVIEW QUEUE</p>
          <h3>
            {reviewRows.length} document
            {reviewRows.length === 1 ? "" : "s"} awaiting a decision
          </h3>
        </div>
        <span data-tooltip="Step 1: open Versions and inspect the latest file. Step 2: assign a reviewer when required. Step 3: approve for publication or reject with clear correction notes.">
          How review works
        </span>
      </header>
      {reviewRows.map((item) => (
        <article key={item.id}>
          <div>
            <strong>{item.title}</strong>
            <small>
              {item.category} | Submitted by {item.created_by_name}
            </small>
          </div>
          {isManager ? (
            <select
              aria-label={`Reviewer for ${item.title}`}
              value={item.reviewer_id || ""}
              onChange={(event) => {
                const reviewerId = event.target.value;
                if (reviewerId) void assignReviewer(item, reviewerId);
              }}
            >
              <option value="" disabled>Choose reviewer</option>
              {reviewers.map((reviewer) => (
                <option key={reviewer.id} value={reviewer.id}>
                  {reviewer.name} | {reviewer.role}
                </option>
              ))}
            </select>
          ) : (
            <span>{item.reviewer_name ? `Under review by ${item.reviewer_name}` : "Reviewer required"}</span>
          )}
          <span className={item.reviewer_id ? "repository-reviewer-state assigned" : "repository-reviewer-state required"}>
            {item.reviewer_id ? `Under review by ${item.reviewer_name || "assigned reviewer"}` : "Reviewer required before decision"}
          </span>
          <button
            data-tooltip="Inspect every uploaded version before recording a decision."
            onClick={() => openDocumentVersions(item)}
          >
            Inspect versions
          </button>
          <button
            className="approve"
            disabled={!canReview || !item.reviewer_id}
            data-tooltip={item.reviewer_id
              ? "Open the review form. Approval publishes the latest version and notifies its author."
              : "Assign an explicit reviewer before this document can proceed to a review decision."}
            onClick={() => openRepositoryReview(item)}
          >
            {!item.reviewer_id ? "Assign reviewer first" : canReview ? "Review now" : "Review unavailable"}
          </button>
        </article>
      ))}
      {!reviewRows.length && (
        <p className="queue-empty">
          The review queue is clear. Newly submitted documents will appear here automatically.
        </p>
      )}
    </section>
  );
}

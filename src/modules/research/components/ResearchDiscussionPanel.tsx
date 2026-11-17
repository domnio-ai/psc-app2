export type ResearchDiscussionCategory = "Update" | "Question" | "Decision" | "Review Note";

export type ResearchDiscussionComment = {
  id: string;
  body: string;
  category: ResearchDiscussionCategory;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  author_id: string;
  author_name: string;
};

type Props = {
  comments: ResearchDiscussionComment[];
  filter: string;
  comment: string;
  category: ResearchDiscussionCategory;
  onFilterChange: (value: string) => void;
  onCommentChange: (value: string) => void;
  onCategoryChange: (value: ResearchDiscussionCategory) => void;
  onResolve: (item: ResearchDiscussionComment) => void | Promise<void>;
  onPost: () => void | Promise<void>;
  onNext: () => void;
};

const filters = ["Open", "All", "Update", "Question", "Decision", "Review Note", "Resolved"];

export default function ResearchDiscussionPanel({
  comments,
  filter,
  comment,
  category,
  onFilterChange,
  onCommentChange,
  onCategoryChange,
  onResolve,
  onPost,
  onNext,
}: Props) {
  const openCount = comments.filter((item) => !item.resolved).length;

  return (
    <section className="research-work-collaboration">
      <details className="research-discussion-panel research-secondary-disclosure research-collaboration-panel">
      <summary>
        <span>
          <strong>Team discussion</strong>
          <small>Updates, questions, decisions and review notes</small>
        </span>
        <b>{openCount} open</b>
      </summary>

      <div className="research-discussion-body">
        <div className="research-discussion-kpis">
          <span><small>Updates</small><strong>{comments.filter((item) => item.category === "Update").length}</strong></span>
          <span><small>Open questions</small><strong>{comments.filter((item) => item.category === "Question" && !item.resolved).length}</strong></span>
          <span><small>Decisions</small><strong>{comments.filter((item) => item.category === "Decision").length}</strong></span>
          <span><small>Review notes</small><strong>{comments.filter((item) => item.category === "Review Note").length}</strong></span>
        </div>

        <div className="research-discussion-filter">
          {filters.map((item) => (
            <button
              type="button"
              key={item}
              className={filter === item ? "active" : ""}
              onClick={() => onFilterChange(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="comments research-thread">
          {comments
            .filter(
              (item) =>
                filter === "All" ||
                (filter === "Open" && !item.resolved) ||
                (filter === "Resolved" && item.resolved) ||
                item.category === filter,
            )
            .map((item) => (
              <div
                className={`comment category-${item.category.toLowerCase().replaceAll(" ", "-")} ${item.resolved ? "resolved" : ""}`}
                key={item.id}
              >
                <span>
                  {item.author_name
                    .split(" ")
                    .map((name) => name[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
                <div>
                  <strong>
                    {item.author_name}
                    <time>{new Date(item.created_at).toLocaleString("en-KE")}</time>
                  </strong>
                  <b>{item.category}</b>
                  <p>{item.body}</p>
                  <button type="button" onClick={() => onResolve(item)}>
                    {item.resolved ? "Reopen item" : "Mark resolved"}
                  </button>
                </div>
              </div>
            ))}

          {!comments.length && <small>No discussion yet.</small>}
        </div>

        <div className="comment-box research-comment-composer">
          <header>
            <div>
              <strong>Add to discussion</strong>
              <small>Use categories so decisions and questions remain easy to find.</small>
            </div>
            <select
              value={category}
              onChange={(event) => onCategoryChange(event.target.value as ResearchDiscussionCategory)}
            >
              <option>Update</option>
              <option>Question</option>
              <option>Decision</option>
              <option>Review Note</option>
            </select>
          </header>

          <textarea
            value={comment}
            onChange={(event) => onCommentChange(event.target.value)}
            placeholder="Write an update for the research team..."
          />

          <div className="research-comment-actions">
            <button type="button" disabled={!comment.trim()} onClick={onPost}>
              Post {category.toLowerCase()}
            </button>
            <button type="button" className="research-comment-next research-comment-next-legacy" onClick={onNext}>
              Continue to Evidence <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
      </details>

      <footer className="research-work-handoff">
        <div>
          <small>NEXT STAGE</small>
          <strong>Evidence</strong>
          <span>Record controlled sources and Repository evidence for this research.</span>
        </div>
        <button type="button" onClick={onNext}>
          Continue to Evidence <span aria-hidden="true">→</span>
        </button>
      </footer>
    </section>
  );
}

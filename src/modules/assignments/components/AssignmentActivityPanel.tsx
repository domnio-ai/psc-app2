import type { ApiHistory } from "../../../api";
import "../assignment-activity-v5.css";

type Props = {
  history: ApiHistory[];
  comments: { id: string; author: string; text: string; created_at: string }[];
  comment: string;
  onCommentChange: (value: string) => void;
  onAddComment: () => void | Promise<void>;
};

const ACTION_LABELS: Record<string, string> = {
  ASSIGNMENT_TASK_CREATED: "Task created",
  ASSIGNMENT_TASK_UPDATED: "Task updated",
  ASSIGNMENT_ATTACHMENT_UPLOADED: "Document uploaded",
  ASSIGNMENT_COMMENT_ADDED: "Comment added",
  ASSIGNMENT_UPDATED: "Assignment updated",
  KNOWLEDGE_ASSIGNMENT_LINKED: "Repository document attached",
  ASSIGNMENT_REVIEW_RECORDED: "Approval recorded",
};

function activityLabel(action: string) {
  return (
    ACTION_LABELS[action] ||
    action
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/^./, (letter) => letter.toUpperCase())
  );
}

export default function AssignmentActivityPanel({
  history,
  comments,
  comment,
  onCommentChange,
  onAddComment,
}: Props) {
  const entries = [
    ...history
      .filter((item) => item.action !== "COMMENTED")
      .map((item) => ({
        id: item.id,
        action: activityLabel(item.action),
        author: item.user_name || "System",
        createdAt: item.created_at,
        detail: "",
      })),
    ...comments.map((item) => ({
      id: item.id,
      action: "Comment added",
      author: item.author || "User",
      createdAt: item.created_at,
      detail: item.text,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <section className="assignment-activity-clean">
      <header className="assignment-activity-clean-head">
        <div>
          <small>HISTORY</small>
          <h2>Assignment activity</h2>
          <p>Chronological record of work and workflow changes.</p>
        </div>

        <span className="assignment-activity-clean-count">
          <strong>{entries.length}</strong>
          event{entries.length === 1 ? "" : "s"}
        </span>
      </header>

      <section
        className="assignment-activity-clean-history"
        aria-label="Assignment activity history"
      >
        {entries.map((item) => (
          <article key={item.id}>
            <span className="assignment-activity-clean-marker" aria-hidden="true" />
            <div>
              <strong>{item.action}</strong>
              <small>
                {item.author} · {new Date(item.createdAt).toLocaleString("en-KE")}
              </small>
              {item.detail && <p>{item.detail}</p>}
            </div>
          </article>
        ))}

        {!entries.length && (
          <div className="assignment-activity-clean-empty">
            <strong>No activity recorded yet</strong>
            <span>
              Work updates, comments, document links, report decisions and task changes will appear here.
            </span>
          </div>
        )}
      </section>

      <section className="assignment-activity-clean-comment" aria-label="Add assignment comment">
        <textarea
          value={comment}
          onChange={(event) => onCommentChange(event.target.value)}
          placeholder="Add a short comment"
          rows={2}
        />
        <button
          type="button"
          disabled={!comment.trim()}
          onClick={() => void onAddComment()}
        >
          Add comment
        </button>
      </section>
    </section>
  );
}

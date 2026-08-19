import { useMemo, useState } from "react";
import type { ApiNotification } from "./api";

type Props = {
  items: ApiNotification[];
  loading: boolean;
  onOpen: (item: ApiNotification) => Promise<void>;
  onNavigate: (item: ApiNotification) => void;
  onMarkAll: () => Promise<void>;
  onRefresh: () => Promise<void>;
};

type Filter = "Action" | "Reviews" | "All" | "Unread" | "Read";

const notificationText = (item: ApiNotification) => `${item.title} ${item.body}`.toLowerCase();
const isReviewNotification = (item: ApiNotification) =>
  /review|approve|approval|changes requested|correction|reject|final report/.test(notificationText(item));
const isActionNotification = (item: ApiNotification) =>
  Boolean(item.entity_id) &&
  (isReviewNotification(item) ||
    !item.read_at ||
    /assigned|overdue|due soon|awaiting|request|required|reopened/.test(notificationText(item)));

const actionLabel = (item: ApiNotification) => {
  if (item.entity_type === "assignment_task") return isReviewNotification(item) ? "Open task review" : "Open task";
  if (item.entity_type === "assignment_task_request") return "Open task request";
  if (item.entity_type === "generated_document") return "Open report";
  if (item.entity_type === "knowledge" || item.entity_type === "document") return isReviewNotification(item) ? "Open document review" : "Open document";
  if (item.entity_type === "research_report_section") return "Open research review";
  if (item.entity_type?.startsWith("assignment")) return "Open assignment";
  if (item.entity_type === "notice") return "Open notice";
  if (item.entity_type === "document_deletion_request") return "Open document actions";
  return "Open related item";
};

export default function NotificationCenter({
  items,
  loading,
  onOpen,
  onNavigate,
  onMarkAll,
  onRefresh,
}: Props) {
  const [selected, setSelected] = useState<ApiNotification | null>(null);
  const [filter, setFilter] = useState<Filter>("Action");
  const unread = items.filter((item) => !item.read_at).length;
  const reviewCount = items.filter(isReviewNotification).length;
  const actionCount = items.filter(isActionNotification).length;

  const visible = useMemo(
    () =>
      items
        .filter((item) => {
          if (filter === "Action") return isActionNotification(item);
          if (filter === "Reviews") return isReviewNotification(item);
          if (filter === "Unread") return !item.read_at;
          if (filter === "Read") return Boolean(item.read_at);
          return true;
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [items, filter],
  );

  const inspect = async (item: ApiNotification) => {
    setSelected(item);
    await onOpen(item);
  };

  const openRelated = async (item: ApiNotification) => {
    if (!item.read_at) await onOpen(item);
    onNavigate(item);
  };

  const filters: { value: Filter; count: number }[] = [
    { value: "Action", count: actionCount },
    { value: "Reviews", count: reviewCount },
    { value: "Unread", count: unread },
    { value: "All", count: items.length },
    { value: "Read", count: items.length - unread },
  ];

  return (
    <section className="notification-centre actionable-notification-centre">
      <div className="notification-toolbar">
        <div>
          <strong>{actionCount} requiring action</strong>
          <small>{reviewCount} review-related · {unread} unread</small>
        </div>
        <div>
          <button type="button" onClick={onRefresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button type="button" onClick={onMarkAll} disabled={!unread || loading}>
            Mark all read
          </button>
        </div>
      </div>

      <div className="notification-filters" role="tablist" aria-label="Notification filters">
        {filters.map(({ value, count }) => (
          <button
            role="tab"
            aria-selected={filter === value}
            className={filter === value ? "active" : ""}
            key={value}
            onClick={() => setFilter(value)}
          >
            {value} ({count})
          </button>
        ))}
      </div>

      <div className="live-notification-list actionable-notification-list">
        {visible.map((item) => (
          <article className={item.read_at ? "read" : "unread"} key={item.id}>
            <button type="button" className="notification-summary" onClick={() => inspect(item)}>
              <span>
                <strong>{item.title}</strong>
                <small>{item.body}</small>
                <time>{new Date(item.created_at).toLocaleString("en-KE")}</time>
              </span>
              {!item.read_at && <b>New</b>}
            </button>
            {item.entity_id && (
              <button type="button" className="notification-direct-action" onClick={() => void openRelated(item)}>
                {actionLabel(item)}
              </button>
            )}
          </article>
        ))}
        {!visible.length && (
          <div className="notification-empty">
            <strong>No {filter.toLowerCase()} notifications</strong>
            <p>Only notifications matching this queue are shown.</p>
          </div>
        )}
      </div>

      {selected && (
        <div className="notification-detail-backdrop" onClick={() => setSelected(null)}>
          <article className="notification-detail" onClick={(event) => event.stopPropagation()}>
            <button className="notification-detail-close" onClick={() => setSelected(null)} aria-label="Close notification details">×</button>
            <small>{selected.entity_type?.replaceAll("_", " ") || "system notification"}</small>
            <h3>{selected.title}</h3>
            <p>{selected.body}</p>
            <time>{new Date(selected.created_at).toLocaleString("en-KE", { dateStyle: "full", timeStyle: "short" })}</time>
            <div>
              <button type="button" onClick={() => setSelected(null)}>Close</button>
              {selected.entity_id && (
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    onNavigate(selected);
                    setSelected(null);
                  }}
                >
                  {actionLabel(selected)}
                </button>
              )}
            </div>
          </article>
        </div>
      )}
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import {api,type ApiNotification,type InternalSentEmail} from "./api";
import InternalEmailComposer from "./modules/notifications/InternalEmailComposer";

type Props = {
  token: string;
  items: ApiNotification[];
  loading: boolean;
  onOpen: (item: ApiNotification) => Promise<void>;
  onNavigate: (item: ApiNotification) => void;
  onMarkAll: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onStateChange: (id: string, state: {read?: boolean; important?: boolean; archived?: boolean}) => Promise<void>;
  onArchiveRead: () => Promise<void>;
};

type Folder = "Inbox" | "Unread" | "Assigned" | "Approvals" | "Notices" | "System" | "Action" | "Reviews" | "Reminders" | "Important" | "Email" | "Sent" | "Archived";
type PriorityFilter = "All" | "Critical" | "High" | "Normal" | "Informational";

const notificationText = (item: ApiNotification) =>
  `${item.title} ${item.body} ${item.entity_type || ""} ${item.reminder_kind || ""}`.toLowerCase();

const notificationTone = (item: ApiNotification) => {
  const text = notificationText(item);
  if (item.priority === "Critical") return "danger";
  if (/overdue|past due|rejected|failed|blocked/.test(text)) return "danger";
  if (item.priority === "High" || /due soon|due today|deadline|awaiting|action required|changes requested/.test(text)) return "warning";
  if (/completed|approved|published|finalised|finalized/.test(text)) return "success";
  if (!item.read_at || /assigned|allocated|new task|new assignment|research task/.test(text)) return "attention";
  return "neutral";
};

const categoryOf = (item: ApiNotification) => {
  if (
    item.entity_type === "assignment_task_request" &&
    /task request awaiting approval/i.test(item.title || "")
  ) return "Review";
  if (
    item.entity_type === "assignment_member_request" &&
    /assignment team request awaiting approval/i.test(item.title || "")
  ) return "Review";
  if (
    item.entity_type === "leave_request" &&
    /leave request awaiting review/i.test(item.title || "")
  ) return "Review";
  return item.notification_category || "Information";
};

const isReviewNotification = (item: ApiNotification) => categoryOf(item) === "Review";
const isReminderNotification = (item: ApiNotification) => categoryOf(item) === "Reminder";
const isActionNotification = (item: ApiNotification) =>
  categoryOf(item) === "Action" ||
  categoryOf(item) === "Review" ||
  categoryOf(item) === "Reminder";

const isAssignedNotification = (item: ApiNotification) => {
  if (categoryOf(item) !== "Action") return false;
  const type = item.entity_type || "";
  return type === "assignment_task" ||
    type === "assignment_task_request" ||
    type === "research" ||
    type === "research_report_section" ||
    type === "task" ||
    type.startsWith("assignment");
};

const isApprovalNotification = (item: ApiNotification) =>
  categoryOf(item) === "Review";

const isNoticeNotification = (item: ApiNotification) =>
  item.entity_type === "notice";

const isSystemNotification = (item: ApiNotification) => {
  if (categoryOf(item) !== "Information") return false;
  if (isNoticeNotification(item)) return false;
  const workflowTypes = new Set([
    "assignment",
    "assignment_task",
    "assignment_task_request",
    "research",
    "research_report_section",
    "knowledge",
    "document",
    "generated_document",
    "document_deletion_request",
  ]);
  return !item.entity_type || !workflowTypes.has(item.entity_type);
};

const workflowLabel = (item: ApiNotification) => {
  const type = item.entity_type || "";
  if (type.toLowerCase().includes("meeting")) return "Meetings";
  if (type === "leave_request") return "Leave";
  if (type === "assignment_task") return "Task";
  if (type === "assignment_task_request") return "Task request";
  if (type.startsWith("assignment")) return "Assignment";
  if (type === "research" || type === "research_report_section") return "Research";
  if (type === "generated_document") return "Report";
  if (type === "knowledge" || type === "document" || type === "document_deletion_request") return "Repository";
  if (type === "notice") return "Notice";
  if (!type) return "System";
  return type.replaceAll("_", " ");
};

const ageBucket = (item: ApiNotification) => {
  const created = new Date(item.created_at);
  const now = new Date();
  const sameDay =
    created.getFullYear() === now.getFullYear() &&
    created.getMonth() === now.getMonth() &&
    created.getDate() === now.getDate();
  if (sameDay) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const wasYesterday =
    created.getFullYear() === yesterday.getFullYear() &&
    created.getMonth() === yesterday.getMonth() &&
    created.getDate() === yesterday.getDate();

  return wasYesterday ? "Yesterday" : "Earlier";
};

const actionLabel = (item: ApiNotification) => {
  if (item.entity_type === "leave_request") return isReviewNotification(item) ? "Open leave approval" : "Open leave request";
  if (item.entity_type === "assignment_task") return isReviewNotification(item) ? "Open task review" : "Open task";
  if (item.entity_type === "assignment_task_request") return "Open task request";
  if (item.entity_type === "generated_document") return "Open report";
  if (item.entity_type === "knowledge" || item.entity_type === "document") return isReviewNotification(item) ? "Open document review" : "Open document";
  if (item.entity_type === "research_report_section") return "Open research review";
  if (item.entity_type === "research") return isReviewNotification(item) ? "Open research review" : "Open research";
  if (item.entity_type?.startsWith("assignment")) return "Open assignment";
  if (item.entity_type === "notice") return "Open notice";
  if (item.entity_type === "document_deletion_request") return "Open document actions";
  if (item.entity_type?.toLowerCase().includes("meeting")) {
    const context = `${item.title || ""} ${item.body || ""} ${item.target_tab || ""} ${item.action || ""}`.toLowerCase();
    if (/schedule.*approval|approval.*schedule/.test(context)) return "Open meeting approval";
    if (/minutes/.test(context)) return "Open meeting minutes";
    if (/transcript/.test(context)) return "Open meeting transcript";
    if (/participant|attendance/.test(context)) return "Open meeting attendance";
    return "Open meeting";
  }
  return "Open related item";
};

const folderMatches = (item: ApiNotification, folder: Folder) => {
  if (folder === "Sent") return false;
  if (folder === "Archived") return Boolean(item.archived_at);
  if (item.archived_at) return false;
  if (folder === "Unread") return !item.read_at;
  if (folder === "Assigned") return isAssignedNotification(item);
  if (folder === "Approvals") return isApprovalNotification(item);
  if (folder === "Notices") return isNoticeNotification(item);
  if (folder === "System") return isSystemNotification(item);
  if (folder === "Action") return isActionNotification(item);
  if (folder === "Reviews") return categoryOf(item) === "Review";
  if (folder === "Reminders") return categoryOf(item) === "Reminder";
  if (folder === "Important") return Boolean(item.important_at) || item.priority === "Critical" || item.priority === "High";
  if (folder === "Email") return Boolean(item.email_eligible || item.email_status && item.email_status !== "Not Required");
  return true;
};

const emailStateLabel = (item: ApiNotification) => {
  if (!item.email_eligible && (!item.email_status || item.email_status === "Not Required")) return "In-app only";
  if (item.email_status === "Sent") return "Email sent";
  if (item.email_status === "Retry") return "Email retry scheduled";
  if (item.email_status === "Failed") return "Email failed";
  if (item.email_status === "Suppressed") return "Email suppressed";
  if (item.email_status === "Sending") return "Sending email";
  return "Email pending";
};

export default function NotificationCenter({
  token,
  items,
  loading,
  onOpen,
  onNavigate,
  onMarkAll,
  onRefresh,
  onStateChange,
  onArchiveRead,
}: Props) {
  const [selected, setSelected] = useState<ApiNotification | null>(null);
  const [folder, setFolder] = useState<Folder>("Inbox");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<PriorityFilter>("All");
  const [composeOpen,setComposeOpen]=useState(false);
  const [sentEmails,setSentEmails]=useState<InternalSentEmail[]>([]);
  const [selectedSent,setSelectedSent]=useState<InternalSentEmail|null>(null);

  const refreshSent=async()=>{
    const rows=await api.sentInternalEmails(token);
    setSentEmails(rows);
    if(folder==="Sent"&&rows.length&&!selectedSent)setSelectedSent(rows[0]);
  };
  useEffect(()=>{void refreshSent().catch(()=>setSentEmails([]));},[token]);

  const unread = items.filter((item) => !item.archived_at && !item.read_at).length;
  const actionCount = items.filter((item) => !item.archived_at && isActionNotification(item)).length;
  const highCount = items.filter((item) => !item.archived_at && (item.priority === "Critical" || item.priority === "High")).length;

  const folderCounts: Record<Folder, number> = {
    Inbox: items.filter((item) => !item.archived_at).length,
    Unread: items.filter((item) => !item.archived_at && !item.read_at).length,
    Assigned: items.filter((item) => !item.archived_at && isAssignedNotification(item)).length,
    Approvals: items.filter((item) => !item.archived_at && isApprovalNotification(item)).length,
    Notices: items.filter((item) => !item.archived_at && isNoticeNotification(item)).length,
    System: items.filter((item) => !item.archived_at && isSystemNotification(item)).length,
    Action: items.filter((item) => !item.archived_at && isActionNotification(item)).length,
    Reviews: items.filter((item) => !item.archived_at && isReviewNotification(item)).length,
    Reminders: items.filter((item) => !item.archived_at && categoryOf(item) === "Reminder").length,
    Important: items.filter((item) => !item.archived_at && (item.important_at || item.priority === "Critical" || item.priority === "High")).length,
    Email: items.filter((item) => !item.archived_at && (item.email_eligible || item.email_status && item.email_status !== "Not Required")).length,
    Sent: sentEmails.length,
    Archived: items.filter((item) => item.archived_at).length,
  };

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items
      .filter((item) => folderMatches(item, folder))
      .filter((item) => priority === "All" || item.priority === priority)
      .filter((item) => !normalizedQuery || notificationText(item).includes(normalizedQuery))
      .sort((a, b) => {
        const priorityRank = (value?: ApiNotification["priority"]) =>
          value === "Critical" ? 0 : value === "High" ? 1 : value === "Normal" ? 2 : 3;
        const p = priorityRank(a.priority) - priorityRank(b.priority);
        if (folder === "Inbox" || folder === "Action") {
          if (p !== 0) return p;
          if (Boolean(a.read_at) !== Boolean(b.read_at)) return a.read_at ? 1 : -1;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [items, folder, priority, query]);

  useEffect(() => {
    if(folder==="Sent")return;
    if (!visible.length) {
      if (selected) setSelected(null);
      return;
    }
    if (!selected || !visible.some((item) => item.id === selected.id)) {
      setSelected(visible[0]);
    }
  }, [visible, selected, folder]);

  const inspect = async (item: ApiNotification) => {
    setSelected(item);
    await onOpen(item);
  };

  const openRelated = async (item: ApiNotification) => {
    if (!item.read_at) await onOpen(item);
    onNavigate(item);
  };

  const chooseFolder = (next: Folder) => {
    setFolder(next);
    setSelected(null);
    setSelectedSent(null);
    if(next==="Sent")void refreshSent();
  };

  const folders: Folder[] = ["Inbox", "Unread", "Action", "Reviews", "Reminders", "Important", "Email", "Sent", "Archived"];
  const primaryFolders: Array<{key: Folder; label: string}> = [
    {key: "Inbox", label: "Inbox"},
    {key: "Unread", label: "Unread"},
    {key: "Assigned", label: "Assigned to me"},
    {key: "Approvals", label: "Reviews & approvals"},
    {key: "Notices", label: "Notices"},
    {key: "System", label: "System"},
  ];
  const secondaryFolders: Array<{key: Folder; label: string}> = [
    {key: "Action", label: "Need action"},
    {key: "Reviews", label: "Reviews"},
    {key: "Reminders", label: "Reminders"},
    {key: "Important", label: "Important"},
    {key: "Email", label: "Email delivery"},
    {key: "Sent", label: "Sent"},
    {key: "Archived", label: "Archived"},
  ];

  return (
    <section className={`notification-centre notification-mailbox ${selected && folder !== "Sent" ? "notification-message-open" : ""}`} aria-label="Notifications inbox">
      <header className="notification-mailbox-header">
        <div>
          <p>NOTIFICATIONS · INBOX & ACTION CENTRE</p>
          <h2>{folder}</h2>
          <span>{actionCount} requiring action · {highCount} high priority · {unread} unread</span>
        </div>
        <div className="notification-header-actions">
          <button type="button" className="notification-compose-button" onClick={()=>setComposeOpen(true)}>Compose email</button>
          <button type="button" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
          <button type="button" onClick={onMarkAll} disabled={!unread || loading}>Mark all read</button>
          <button type="button" onClick={onArchiveRead} disabled={loading}>Archive read</button>
        </div>
      </header>

      <div className="notification-status-strip notification-v2-status-strip" aria-label="Notification summary">
        <button type="button" onClick={() => chooseFolder("Unread")}><strong>{folderCounts.Unread}</strong><span>Unread</span></button>
        <button type="button" onClick={() => chooseFolder("Assigned")}><strong>{folderCounts.Assigned}</strong><span>Assigned to me</span></button>
        <button type="button" onClick={() => chooseFolder("Approvals")}><strong>{folderCounts.Approvals}</strong><span>Reviews & approvals</span></button>
        <button type="button" onClick={() => chooseFolder("Notices")}><strong>{folderCounts.Notices}</strong><span>Notices</span></button>
      </div>

      <div className="notification-mailbox-grid">
        <nav className="notification-folder-rail notification-v2-folder-rail" aria-label="Notification folders">
          <div className="notification-folder-group">
            <small>INBOX</small>
            {primaryFolders.map(({key, label}) => (
              <button
                type="button"
                key={key}
                className={folder === key ? "active" : ""}
                aria-current={folder === key ? "page" : undefined}
                onClick={() => chooseFolder(key)}
              >
                <span>{label}</span>
                <b>{folderCounts[key]}</b>
              </button>
            ))}
          </div>
          <div className="notification-folder-group notification-folder-group-secondary">
            <small>MORE</small>
            {secondaryFolders.map(({key, label}) => (
              <button
                type="button"
                key={key}
                className={folder === key ? "active" : ""}
                aria-current={folder === key ? "page" : undefined}
                onClick={() => chooseFolder(key)}
              >
                <span>{label}</span>
                <b>{folderCounts[key]}</b>
              </button>
            ))}
          </div>
        </nav>

        <section className="notification-message-column" aria-label={`${folder} notifications`}>
          <div className="notification-message-toolbar">
            <label className="notification-search">
              <span className="sr-only">Search notifications</span>
              <input
                type="search"
                value={query}
                placeholder="Search title, message or workflow"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="notification-priority-filter">
              <span>Priority</span>
              <select value={priority} onChange={(event) => setPriority(event.target.value as PriorityFilter)}>
                <option>All</option>
                <option>Critical</option>
                <option>High</option>
                <option>Normal</option>
                <option>Informational</option>
              </select>
            </label>
            {(query || priority !== "All") && (
              <button type="button" className="notification-clear-filter" onClick={() => { setQuery(""); setPriority("All"); }}>
                Clear
              </button>
            )}
          </div>

          {folder==="Sent"?(
            <div className="notification-message-list notification-sent-list">
              {sentEmails.map(message=>(
                <article key={message.id} className={selectedSent?.id===message.id?"selected":""}>
                  <button type="button" className="notification-message-summary" onClick={()=>setSelectedSent(message)}>
                    <span className="notification-message-state" aria-hidden="true">✉</span>
                    <span className="notification-message-copy">
                      <span className="notification-message-title-row"><strong>{message.subject}</strong><time>{new Date(message.created_at).toLocaleString("en-KE",{dateStyle:"medium",timeStyle:"short"})}</time></span>
                      <small>{message.body}</small>
                      <span className="notification-message-meta"><b>Sent mail</b><b>{message.recipients.length} recipient{message.recipients.length===1?"":"s"}</b></span>
                    </span>
                  </button>
                </article>
              ))}
              {!sentEmails.length&&<div className="notification-empty"><strong>No sent email yet</strong><p>Use Compose email to send an institutional email to a REDESY user.</p></div>}
            </div>
          ):(
            <div className="notification-message-list">
            {(["Today", "Yesterday", "Earlier"] as const).map((bucket) => {
              const rows = visible.filter((item) => ageBucket(item) === bucket);
              if (!rows.length) return null;
              return (
                <section className="notification-time-group" key={bucket}>
                  <header><strong>{bucket}</strong><span>{rows.length}</span></header>
                  {rows.map((item) => (
                    <article
                      id={`notification-row-${item.id}`}
                      data-selected={selected?.id === item.id ? "true" : "false"}
                      className={`${item.read_at ? "read" : "unread"} notification-${notificationTone(item)} ${selected?.id === item.id ? "selected" : ""}`}
                      key={item.id}
                    >
                      <button type="button" className="notification-message-summary" onClick={() => void inspect(item)}>
                        <span className="notification-message-state" aria-hidden="true">{item.read_at ? "○" : "●"}</span>
                        <span className="notification-message-copy">
                          <span className="notification-message-title-row">
                            <strong>{item.title}</strong>
                            <time>{new Date(item.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</time>
                          </span>
                          <small>{item.body}</small>
                          <span className="notification-message-meta">
                            <b className={`priority priority-${(item.priority || "Normal").toLowerCase()}`}>{item.priority || "Normal"}</b>
                            <b>{categoryOf(item)}</b>
                            <b>{workflowLabel(item)}</b>
                            {item.email_eligible && <b>{emailStateLabel(item)}</b>}
                          </span>
                        </span>
                      </button>
                      <div className="notification-row-quick-actions" aria-label={`Quick actions for ${item.title}`}>
                        <button type="button" onClick={() => void onStateChange(item.id, { read: !item.read_at })}>
                          {item.read_at ? "Unread" : "Read"}
                        </button>
                        <button type="button" onClick={() => void onStateChange(item.id, { important: !item.important_at })}>
                          {item.important_at ? "Unstar" : "Star"}
                        </button>
                        <button type="button" onClick={() => void onStateChange(item.id, { archived: !item.archived_at })}>
                          {item.archived_at ? "Restore" : "Archive"}
                        </button>
                      </div>
                    </article>
                  ))}
                </section>
              );
            })}

            {!visible.length && (
              <div className="notification-empty">
                <strong>No matching notifications</strong>
                <p>
                  {query
                    ? `Nothing in ${folder.toLowerCase()} matches "${query}".`
                    : folder === "Action"
                      ? "You have no notifications that currently require action."
                      : folder === "Reviews"
                        ? "You have no review or approval notifications."
                        : folder === "Reminders"
                          ? "You have no active reminder notifications."
                          : `There are no notifications in ${folder.toLowerCase()}.`}
                </p>
              </div>
            )}
          </div>
          )}        </section>

        {folder==="Sent"?(
          <aside className={`notification-reading-pane ${selectedSent?"open":""}`} aria-label="Sent email preview">
            {!selectedSent?<div className="notification-reading-empty"><strong>Select sent email</strong><p>Choose a sent message to inspect delivery status.</p></div>:
            <article className="notification-reading-content">
              <header><div><small>SENT EMAIL</small><h3>{selectedSent.subject}</h3></div></header>
              <p className="notification-reading-body">{selectedSent.body}</p>
              <time>{new Date(selectedSent.created_at).toLocaleString("en-KE",{dateStyle:"full",timeStyle:"short"})}</time>
              <dl className="notification-reading-details">
                {selectedSent.recipients.map(recipient=><div key={recipient.id}><dt>{recipient.recipient_name}</dt><dd>{recipient.recipient_email} · {recipient.delivery_status}{recipient.sent_at?` · ${new Date(recipient.sent_at).toLocaleString("en-KE")}`:""}{recipient.last_error?` · ${recipient.last_error}`:""}</dd></div>)}
              </dl>
            </article>}
          </aside>
        ):(
        <aside className={`notification-reading-pane ${selected ? "open" : ""}`} aria-label="Notification preview">
          {!selected ? (
            <div className="notification-reading-empty">
              <strong>No notification selected</strong>
              <p>The reading pane follows the current visible notification automatically.</p>
            </div>
          ) : (
            <article className={`notification-reading-content notification-${notificationTone(selected)}`}>
              <header>
                <div>
                  <small>{selected.entity_type?.replaceAll("_", " ") || "system notification"}</small>
                  <h3>{selected.title}</h3>
                </div>
                <button type="button" className="notification-reading-close" onClick={() => setSelected(null)} aria-label="Back to inbox">← Back to inbox</button>
              </header>

              <div className="notification-reading-badges">
                <b className={`priority priority-${(selected.priority || "Normal").toLowerCase()}`}>{selected.priority || "Normal"}</b>
                <b>{categoryOf(selected)}</b>
                {selected.reminder_kind && <b>{selected.reminder_kind.replaceAll("_", " ")}</b>}
                {selected.important_at && <b>Important</b>}
                {!selected.read_at && <b>Unread</b>}
              </div>

              <p className="notification-reading-body">{selected.body}</p>
              <time>{new Date(selected.created_at).toLocaleString("en-KE", { dateStyle: "full", timeStyle: "short" })}</time>

              <section className="notification-reading-summary" aria-label="Notification summary">
                <div><span>Category</span><strong>{categoryOf(selected)}</strong></div>
                <div><span>Priority</span><strong>{selected.priority || "Normal"}</strong></div>
                <div><span>State</span><strong>{selected.read_at ? "Read" : "Unread"}</strong></div>
                {selected.closed_at && <div><span>Closed</span><strong>{selected.close_reason || "Work completed"}</strong></div>}
              </section>

              <dl className="notification-reading-details">
                <div><dt>Delivery</dt><dd>{emailStateLabel(selected)}</dd></div>
                {selected.email_sent_at && <div><dt>Email sent</dt><dd>{new Date(selected.email_sent_at).toLocaleString("en-KE")}</dd></div>}
                {selected.reminder_kind && <div><dt>Reminder</dt><dd>{selected.reminder_kind.replaceAll("_", " ")}</dd></div>}
                <div><dt>Workflow</dt><dd>{workflowLabel(selected)}</dd></div>
                <div><dt>Why you are seeing this</dt><dd>{
                  categoryOf(selected) === "Review" ? "A review or approval is assigned to you." :
                  categoryOf(selected) === "Reminder" ? "Open work in your scope has reached a deadline reminder point." :
                  isAssignedNotification(selected) ? "Work has been assigned to you or requires your next action." :
                  isNoticeNotification(selected) ? "A notice relevant to your authorised audience was published or updated." :
                  categoryOf(selected) === "Action" ? "This workflow event requires an action from you." :
                  isSystemNotification(selected) ? "This is a system or governance update relevant to your account." :
                  "This is a workflow update for your authorised work."
                }</dd></div>
              </dl>

              <div className="notification-reading-actions">
                <button type="button" onClick={() => void onStateChange(selected.id, { read: !selected.read_at })}>{selected.read_at ? "Mark unread" : "Mark read"}</button>
                <button type="button" onClick={() => void onStateChange(selected.id, { important: !selected.important_at })}>{selected.important_at ? "Remove important" : "Mark important"}</button>
                <button type="button" onClick={() => void onStateChange(selected.id, { archived: !selected.archived_at })}>{selected.archived_at ? "Restore" : "Archive"}</button>
                {selected.entity_id && (
                  <button type="button" className="primary" onClick={() => void openRelated(selected)}>
                    {actionLabel(selected)}
                  </button>
                )}
              </div>
            </article>
          )}
        </aside>

        )}      </div>
      <InternalEmailComposer token={token} open={composeOpen} onClose={()=>setComposeOpen(false)}
        onSent={async()=>{await refreshSent();setFolder("Sent");setComposeOpen(false)}}/>
    </section>
  );
}

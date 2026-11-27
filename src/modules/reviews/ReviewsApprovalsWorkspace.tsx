import { useEffect, useState } from "react";
import { meetingsApi } from "../meetings/meetingsApi";
import type { MeetingSummary } from "../meetings/types";
import type { DashboardResponse, DashboardWorkItem, ReviewItem } from "../../api";
import LeaveApprovalQueue from "./LeaveApprovalQueue";
import MeetingScheduleApprovalQueue from "./MeetingScheduleApprovalQueue";
import "./reviews-approvals.css";

type Props = {
  token: string;
  currentUserId: string;
  isManager: boolean;
  onDomainDecisionComplete: () => void | Promise<void>;
  reviews: DashboardWorkItem[];
  history: DashboardWorkItem[];
  finalizations: DashboardWorkItem[];
  management: DashboardResponse["management"];
  onOpen: (item: DashboardWorkItem) => void | Promise<void>;
  onOpenRepositoryReview: (item: ReviewItem) => void;
};

export default function ReviewsApprovalsWorkspace({
  token,
  currentUserId,
  isManager,
  onDomainDecisionComplete,
  reviews,
  history,
  finalizations,
  management,
  onOpen,
  onOpenRepositoryReview,
}: Props) {
  const [leaveApprovalCount, setLeaveApprovalCount] = useState(0);
  // APP2_UNIVERSAL_MEETING_HISTORY_OPTION_B_R3
  const [meetingApprovalCount, setMeetingApprovalCount] = useState(0);
  const [meetingRows, setMeetingRows] = useState<MeetingSummary[]>([]);
  const [meetingRowsError, setMeetingRowsError] = useState("");
  useEffect(() => {
    let active = true;
    void meetingsApi.list(token).then((rows) => {
      if (active) {
        setMeetingRows(rows);
        setMeetingRowsError("");
      }
    }).catch((error: unknown) => {
      if (active) setMeetingRowsError(error instanceof Error ? error.message : "Meeting records could not be loaded.");
    });
    return () => { active = false; };
  }, [token]);

  // Option B: completed meetings whose latest minutes are not approved are surfaced for follow-up.
  // This is navigation/visibility only; no new approval or finalisation endpoint is invented.
  const meetingFinalisation: DashboardWorkItem[] = meetingRows
    .filter((row) => row.status === "Completed" && row.minutes_status !== "Approved")
    .map((row) => ({
      id: row.id,
      type: "Finalization",
      title: row.title,
      status: row.minutes_status || "Minutes not prepared",
      dueDate: null,
      nextAction: "Review final meeting records",
      destination: "Meetings",
      contextId: row.id,
      contextTitle: "Completed meeting Â· minutes require follow-up",
      ownerName: row.created_by_name,
      updatedAt: row.schedule_approval_submitted_at || undefined,
    }));

  // The authorized meeting list is already scoped to this user. Show only
  // schedule decisions made by this user in their review history.
  const meetingHistory: DashboardWorkItem[] = meetingRows
    .filter((row) =>
      row.schedule_approval_decided_by === currentUserId &&
      ["Approved", "Returned", "Rejected"].includes(row.schedule_approval_status || "")
    )
    .map((row) => ({
      id: row.id,
      type: "Review",
      title: row.title,
      status: row.schedule_approval_status || "Decision recorded",
      dueDate: null,
      nextAction: "Open meeting record",
      destination: "Meetings",
      contextId: row.id,
      contextTitle: "Meeting schedule decision",
      ownerName: row.created_by_name,
      reviewKind: "Meeting Schedule Approval",
      updatedAt: row.schedule_approval_decided_at || undefined,
    }));
  const combinedHistory = [...history, ...meetingHistory]
    .filter((item, index, all) => all.findIndex((candidate) =>
      candidate.id === item.id && candidate.reviewKind === item.reviewKind
    ) === index)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  const combinedFinalisations = [...finalizations, ...meetingFinalisation]
    .filter((item, index, all) => all.findIndex((candidate) =>
      candidate.id === item.id && candidate.contextTitle === item.contextTitle
    ) === index)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  return (
    <section className="reviews-workspace">
      <header className="reviews-workspace-head compact">
        <div className="reviews-control-title">
          <small>APP2 · DECISION WORKSPACE</small>
          <h2>Reviews &amp; approvals</h2>
          <p>Move open decisions forward and keep a complete record of the work you have reviewed.</p>
        </div>
        <div className="reviews-workspace-metrics">
          <article>
            <small>NEEDS MY DECISION</small>
            <strong>{reviews.length + leaveApprovalCount + meetingApprovalCount}</strong>
          </article>

          <article>
            <small>MY REVIEW HISTORY</small>
            <strong>{combinedHistory.length}</strong>
          </article>

          <article>
            <small>FINALISATION PENDING</small>
            <strong>{combinedFinalisations.length}</strong>
          </article>
        </div>
      </header>

      <LeaveApprovalQueue
        token={token}
        currentUserId={currentUserId}
        isManager={isManager}
        onDecisionComplete={onDomainDecisionComplete}
        onPendingCountChange={setLeaveApprovalCount}
      />
      <MeetingScheduleApprovalQueue token={token} onDecisionComplete={onDomainDecisionComplete} onPendingCountChange={setMeetingApprovalCount} />

      <div className="reviews-workspace-grid">
        <ReviewList
          title="Needs My Decision"
          eyebrow="MY ACTIONS"
          items={reviews}
          empty="No review decisions are waiting."
          action="Open review"
          onOpen={onOpen}
        />

        <ReviewList
          title="Finalisation Pending"
          eyebrow="CONTROLLED OUTPUTS"
          items={combinedFinalisations}
          empty="No finalisation actions are waiting."
          action="Open finalisation"
          onOpen={onOpen}
          compactEmpty
        />
      </div>

      {meetingRowsError && <p className="reviews-management-note" role="status">{meetingRowsError}</p>}
      <ReviewList
        title="My Review History"
        eyebrow="ACCOUNTABILITY RECORD"
        items={combinedHistory}
        empty="No completed review decisions yet."
        action="Open record"
        onOpen={onOpen}
        showHistoryMetadata
      />
      {/* APP2_TEAM_REVIEW_STATUS_PANEL */}
      {management && (
        <section className="reviews-workspace-card reviews-team-status">
          <header>
            <div>
              <p>MANAGEMENT OVERSIGHT</p>
              <h3>Team Review Status</h3>
            </div>
            <b>{management.reviews.pending}</b>
          </header>

          <div className="reviews-management-summary">
            <span>
              <strong>{management.reviews.generatedDocuments}</strong>
              <small>Assignment reports</small>
            </span>

            <span>
              <strong>{management.reviews.taskReports}</strong>
              <small>Task reports</small>
            </span>

            <span>
              <strong>{management.reviews.researchReports}</strong>
              <small>Research reports</small>
            </span>

            <span>
              <strong>{management.reviews.repositoryDocuments}</strong>
              <small>Repository reviews</small>
            </span>
          </div>

          <div className="reviews-workspace-list">
            {management.reviews.items.slice(0, 6).map((item) => (
              <button
                type="button"
                key={`team-review-${item.review_kind}-${item.id}`}
                onClick={() =>
                  void onOpen({
                    id: item.id,
                    type: "Review",
                    title: item.title,
                    status: item.status,
                    dueDate: item.due_date,
                    nextAction: "Review",
                    destination:
                      item.review_context === "Assignment" ||
                      item.review_context === "Assignment Task"
                        ? "Assignments"
                        : item.review_context === "Research"
                          ? "Research Repository"
                          : "Document Repository",
                    contextId: item.context_id || item.id,
                    contextTitle: item.context_title,
                    reviewKind: item.review_kind,
                    updatedAt: item.updated_at,
                  })
                }
              >
                <span>
                  <small>{item.review_kind}</small>
                  <strong>{item.title}</strong>
                  <em>{item.context_title || "Controlled review"}</em>
                </span>

                <span>
                  <b>{item.status}</b>
                  <small>
                    {item.reviewer_name
                      ? "Reviewer: " + item.reviewer_name
                      : "Reviewer pending"}
                  </small>
                </span>
              </button>
            ))}

            {management.reviews.items.length === 0 && (
              <div className="reviews-workspace-empty">
                <strong>No team reviews are currently pending.</strong>
              </div>
            )}
          </div>

          <small className="reviews-management-note">
            Management visibility does not grant authority to make another
            reviewer&apos;s formal decision.
          </small>
        </section>
      )}
      {management && (
        management.repository.pendingReview === 0 ? (
          <section className="reviews-management-empty-strip">
            <span>
              <strong>Repository Review Oversight</strong>
              <small>No repository reviews are pending in your management scope.</small>
            </span>

            <span>
              <b>{management.team.total}</b>
              <small>people in scope</small>
            </span>
          </section>
        ) : (
          <section className="reviews-workspace-card reviews-management-oversight">
            <header>
              <div>
                <p>MANAGEMENT OVERSIGHT</p>
                <h3>Repository Review Oversight</h3>
              </div>
              <b>{management.repository.pendingReview}</b>
            </header>

            <div className="reviews-management-summary">
              <span>
                <strong>{management.repository.pendingReview}</strong>
                <small>Pending repository reviews</small>
              </span>

              <span>
                <strong>{management.team.total}</strong>
                <small>People in management scope</small>
              </span>
            </div>

            <div className="reviews-workspace-list">
              {management.repository.pendingItems.slice(0, 6).map((item) => (
                <button
                  type="button"
                  key={`manager-review-${item.id}`}
                  onClick={() => onOpenRepositoryReview(item)}
                >
                  <span>
                    <small>{item.category || "Repository document"}</small>
                    <strong>{item.title}</strong>
                    <em>
                      {item.reviewer_name
                        ? `Reviewer: ${item.reviewer_name}`
                        : "Reviewer not assigned"}
                    </em>
                  </span>

                  <span>
                    <b>{item.status}</b>
                    <small>Open oversight</small>
                  </span>
                </button>
              ))}
            </div>

            <small className="reviews-management-note">
              Management visibility does not grant formal review-decision authority.
            </small>
          </section>
        )
      )}
    </section>
  );
}

function reviewTimingLabel(item: DashboardWorkItem) {
  if (!item.dueDate) return null;

  const due = new Date(item.dueDate);
  const today = new Date();

  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const days = Math.round(
    (due.getTime() - today.getTime()) / 86400000,
  );

  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";

  return `Due ${due.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
  })}`;
}

function reviewTimingClass(item: DashboardWorkItem) {
  if (!item.dueDate) return "";

  const due = new Date(item.dueDate);
  const today = new Date();

  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const days = Math.round(
    (due.getTime() - today.getTime()) / 86400000,
  );

  if (days < 0) return "overdue";
  if (days <= 1) return "urgent";
  if (days <= 7) return "due-soon";

  return "";
}

// APP2_REVIEW_HISTORY_METADATA
function ReviewList({
  title,
  eyebrow,
  items,
  empty,
  action,
  onOpen,
  compactEmpty = false,
  showHistoryMetadata = false,
}: {
  title: string;
  eyebrow: string;
  items: DashboardWorkItem[];
  empty: string;
  action: string;
  onOpen: (item: DashboardWorkItem) => void | Promise<void>;
  compactEmpty?: boolean;
  showHistoryMetadata?: boolean;
}) {
  return (
    <section
      className={`reviews-workspace-card ${
        compactEmpty && items.length === 0 ? "compact-empty" : ""
      }`}
    >
      <header>
        <div>
          <p>{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        <b>{items.length}</b>
      </header>

      <div className="reviews-workspace-list">
        {items.map((item) => (
          <button
            type="button"
            key={`${item.type}-${item.id}-${title}`}
            className={reviewTimingClass(item)}
            onClick={() => void onOpen(item)}
          >
            <span>
              <small>
                {item.reviewKind || item.contextTitle || item.type}
              </small>
              <strong>{item.title}</strong>
              <em>
                {showHistoryMetadata
                  ? [
                      item.ownerName ? "By " + item.ownerName : null,
                      item.contextTitle || null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || item.status
                  : item.contextTitle || item.status}
              </em>
            </span>

            <span>
              <b>{item.status}</b>

              {reviewTimingLabel(item) && (
                <small className="reviews-timing">
                  {reviewTimingLabel(item)}
                </small>
              )}

              {showHistoryMetadata && item.updatedAt && (
                <small className="reviews-history-date">
                  {new Date(item.updatedAt).toLocaleDateString("en-KE", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </small>
              )}

              <small>{action}</small>
            </span>
          </button>
        ))}

        {!items.length && (
          <div className="reviews-workspace-empty">
            <strong>{empty}</strong>
          </div>
        )}
      </div>
    </section>
  );
}

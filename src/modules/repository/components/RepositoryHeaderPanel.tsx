import type { ReactNode } from "react";

type Props = {
  documentStatus: string;
  documentSearch: string;
  allCount: number;
  publishedCount: number;
  reviewCount: number;
  draftChangesCount: number;
  archivedCount: number;
  shownCount: number;
  searchIcon: ReactNode;
  onAddDocument: () => void;
  onSummaryStatusChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSearchChange: (value: string) => void;
};

export default function RepositoryHeaderPanel({
  documentStatus,
  documentSearch,
  allCount,
  publishedCount,
  reviewCount,
  draftChangesCount,
  archivedCount,
  shownCount,
  searchIcon,
  onAddDocument,
  onSummaryStatusChange,
  onStatusChange,
  onSearchChange,
}: Props) {
  return (
    <>
      <div className="assignment-page-head">
        <div>
          <p>RECORDS & DOCUMENT MANAGEMENT</p>
          <h2>Records Repository</h2>
          <span>
            One governed home for records, working documents, versions, improvements, review, retention and audit history.
          </span>
        </div>
        <div className="repository-head-actions">
          <span className="repository-governance-chip">Versioned · reviewer governed · audited</span>
          <button onClick={onAddDocument}>+ Add record / document</button>
        </div>
      </div>

      <div className="repository-summary">
        <button className={documentStatus === "All" ? "active" : ""} onClick={() => onSummaryStatusChange("All")}>
          <strong>{allCount}</strong>
          <span>All documents</span>
        </button>
        <button className={documentStatus === "Published" ? "active" : ""} onClick={() => onSummaryStatusChange("Published")}>
          <strong>{publishedCount}</strong>
          <span>Published</span>
        </button>
        <button className={documentStatus === "Pending Approval" ? "active" : ""} onClick={() => onSummaryStatusChange("Pending Approval")}>
          <strong>{reviewCount}</strong>
          <span>Awaiting review</span>
        </button>
        <button
          className={documentStatus === "Drafts & changes" ? "active" : ""}
          onClick={() => onSummaryStatusChange("Drafts & changes")}
        >
          <strong>{draftChangesCount}</strong>
          <span>Drafts & changes</span>
        </button>
        <button className={documentStatus === "Archived" ? "active" : ""} onClick={() => onSummaryStatusChange("Archived")}>
          <strong>{archivedCount}</strong>
          <span>Archived</span>
        </button>
      </div>

      <div className="repository-canonical-toolbar">
        <label className="repository-canonical-search">
          {searchIcon}
          <input
            value={documentSearch}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="Search title, record number, class, owner, reviewer, source, status or description"
            placeholder="Search title, record number, class, owner, source or description"
          />
        </label>
        <select
          aria-label="Filter repository by status"
          value={documentStatus}
          onChange={(event) => onStatusChange(event.target.value)}
        >
          {[
            "All",
            "Drafts & changes",
            "Draft",
            "Pending Approval",
            "Published",
            "Rejected",
            "Archived",
          ].map((value) => (
            <option key={value} value={value}>
              {value === "All" ? "All statuses" : value}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="repository-clear-filter"
          disabled={!documentSearch && documentStatus === "All"}
          onClick={() => {
            onSearchChange("");
            onStatusChange("All");
          }}
        >
          Clear
        </button>
        <strong>{shownCount} shown</strong>
      </div>
    </>
  );
}

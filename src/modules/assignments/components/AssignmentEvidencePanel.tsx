import type { ApiAttachment, KnowledgeItem } from "../../../api";
import "../assignment-evidence-v5.css";

type AssignmentDocumentFilter = "All" | "Documents" | "Research Notes";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  filter: AssignmentDocumentFilter;
  onFilterChange: (value: AssignmentDocumentFilter) => void;
  repositoryLinkId: string;
  onRepositoryLinkIdChange: (value: string) => void;
  knowledgeRows: KnowledgeItem[];
  assignmentFiles: ApiAttachment[];
  selectedAssignmentId: string | null;
  comment: string;
  onCommentChange: (value: string) => void;
  onAttachRepositoryDocument: () => void | Promise<void>;
  onDownloadAttachment: (file: ApiAttachment) => void;
  onPreviewRepository: (item: KnowledgeItem) => void;
  onAddResearchNote: () => void | Promise<void>;
};

export default function AssignmentEvidencePanel({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  repositoryLinkId,
  onRepositoryLinkIdChange,
  knowledgeRows,
  assignmentFiles,
  selectedAssignmentId,
  comment,
  onCommentChange,
  onAttachRepositoryDocument,
  onDownloadAttachment,
  onPreviewRepository,
  onAddResearchNote,
}: Props) {
  const normalizedSearch = search.trim().toLowerCase();
  const matches = (value: string) =>
    !normalizedSearch || value.toLowerCase().includes(normalizedSearch);

  const repositoryOptions = knowledgeRows.filter((item) => matches(item.title));

  const linkedRepositoryDocuments = knowledgeRows.filter(
    (item) =>
      item.assignments?.some(
        (assignment) => assignment.id === selectedAssignmentId,
      ) && matches(item.title),
  );

  const visibleFiles = assignmentFiles.filter((item) =>
    matches(item.original_name),
  );

  const visibleDocumentCount =
    visibleFiles.length + linkedRepositoryDocuments.length;

  return (
    <section className="assignment-evidence-clean">
      <header className="assignment-evidence-clean-head">
        <div>
          <small>EVIDENCE</small>
          <h2>Assignment evidence and research notes</h2>
          <p>
            Search, attach approved evidence, and record research notes for this assignment.
          </p>
        </div>

        <div className="assignment-evidence-clean-counts" aria-label="Evidence summary">
          <span>
            <strong>{visibleDocumentCount}</strong>
            documents
          </span>
          <span>
            <strong>{linkedRepositoryDocuments.length}</strong>
            repository
          </span>
        </div>
      </header>

      <section className="assignment-evidence-clean-controls">
        <div className="assignment-evidence-clean-search">
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search evidence and notes"
            aria-label="Search assignment documents and notes"
          />

          <div className="assignment-evidence-clean-filters" role="group" aria-label="Evidence filter">
            {(["All", "Documents", "Research Notes"] as const).map((item) => (
              <button
                type="button"
                className={filter === item ? "active" : ""}
                key={item}
                onClick={() => onFilterChange(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="assignment-evidence-clean-attach">
          <select
            value={repositoryLinkId}
            onChange={(event) => onRepositoryLinkIdChange(event.target.value)}
            aria-label="Existing repository document"
          >
            <option value="">Attach existing repository document</option>
            {repositoryOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={!repositoryLinkId || !selectedAssignmentId}
            onClick={() => void onAttachRepositoryDocument()}
          >
            Attach
          </button>
        </div>

        {(filter === "All" || filter === "Research Notes") && (
          <div className="assignment-evidence-clean-note">
            <textarea
              value={comment}
              onChange={(event) => onCommentChange(event.target.value)}
              placeholder="Write a short research note"
            />
            <button
              type="button"
              disabled={!comment.trim() || !selectedAssignmentId}
              onClick={() => void onAddResearchNote()}
            >
              Add note
            </button>
          </div>
        )}
      </section>

      {(filter === "All" || filter === "Documents") && (
        <section className="assignment-evidence-clean-list" aria-label="Assignment documents">
          {visibleFiles.map((file) => (
            <article key={file.id}>
              <div>
                <small>UPLOADED DOCUMENT</small>
                <strong>{file.original_name}</strong>
                <span>{new Date(file.created_at).toLocaleDateString("en-KE")}</span>
              </div>

              <button type="button" onClick={() => onDownloadAttachment(file)}>
                Download
              </button>
            </article>
          ))}

          {linkedRepositoryDocuments.map((item) => (
            <article key={item.id}>
              <div>
                <small>REPOSITORY DOCUMENT</small>
                <strong>{item.title}</strong>
                <span>{item.status}</span>
              </div>

              <button type="button" onClick={() => onPreviewRepository(item)}>
                Preview
              </button>
            </article>
          ))}

          {!visibleDocumentCount && (
            <div className="assignment-evidence-clean-empty">
              <strong>No matching evidence</strong>
              <span>
                Attach an approved Repository document or add supporting files to the assignment.
              </span>
            </div>
          )}
        </section>
      )}

      {filter === "Research Notes" && (
        <div className="assignment-evidence-clean-empty assignment-evidence-clean-note-help">
          <strong>Research notes</strong>
          <span>
            Use the note field above to record concise observations, findings, or follow-up points.
          </span>
        </div>
      )}
    </section>
  );
}

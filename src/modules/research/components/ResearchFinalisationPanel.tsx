import { useState } from "react";
import type { ResearchReportVersion } from "../../../api";
import "../styles/research-finalisation-action.css";

type Props = {
  authoredApprovedCount: number;
  authoredSectionCount: number;
  latestApprovedVersion: ResearchReportVersion | null | undefined;
  currentUserId?: string;
  generating: boolean;
  generationNotice?: string;
  hasReportSections: boolean;
  canGenerateApprovedFinal: boolean;
  allAuthoredSectionsApproved: boolean;
  hasControlledEvidence: boolean;
  researchStatus: string;
  onOpenResources: () => void;
  onGenerate: () => void | Promise<void>;
};

export default function ResearchFinalisationPanel({
  authoredApprovedCount,
  authoredSectionCount,
  latestApprovedVersion,
  currentUserId,
  generating,
  generationNotice = "",
  hasReportSections,
  canGenerateApprovedFinal,
  allAuthoredSectionsApproved,
  hasControlledEvidence,
  researchStatus,
  onOpenResources,
  onGenerate,
}: Props) {
  const [localActionNotice, setLocalActionNotice] = useState("");
  const [localBusy, setLocalBusy] = useState(false);
  const alreadyCompleted = researchStatus === "Completed";
  const isReportCreator = Boolean(latestApprovedVersion?.submitted_by === currentUserId);
  const blockers = [
    !hasReportSections ? "The report has no governed sections." : "",
    !latestApprovedVersion ? "The complete submitted report has not yet been formally approved." : "",
    latestApprovedVersion && !canGenerateApprovedFinal
      ? isReportCreator
        ? "Separation of duties: the report creator cannot generate the final controlled copy."
        : `Only ${latestApprovedVersion.reviewed_by_name || latestApprovedVersion.reviewer_name || "the recorded approver"} can generate the final controlled copy.`
      : "",
    !hasControlledEvidence ? "Add at least one controlled research source or linked published Repository document." : "",
  ].filter(Boolean);

  const ready = !alreadyCompleted && blockers.length === 0;
  const disabled = generating || localBusy || alreadyCompleted || !ready;
  const buttonLabel = alreadyCompleted
    ? "Final Report Generated"
    : (generating || localBusy)
      ? "Generating Final Report…"
      : "Generate Final Report & Save to Repository";

  return (
    <>
      <section className={`research-final-report-card research-finalisation-v836${ready ? " is-ready" : ""}${alreadyCompleted ? " is-complete" : ""}`}>
        <header className="research-finalisation-heading">
          <div>
            <small>FINALISATION ACTION</small>
            <h3>{alreadyCompleted ? "Controlled final report published" : "Publish the approved controlled report"}</h3>
            <p>
              Final generation uses the immutable approved submission. The recorded approver publishes the controlled DOCX to the Document Repository and completes the research project.
            </p>
          </div>
          <div className="research-finalisation-header-actions">
            <strong className={`research-finalisation-state ${alreadyCompleted ? "complete" : ready ? "ready" : "blocked"}`}>
              {alreadyCompleted ? "COMPLETED" : ready ? "READY TO PUBLISH" : "ACTION REQUIRED"}
            </strong>
            <button
              type="button"
              className="research-finalisation-primary-action research-finalisation-primary-action-header"
              disabled={disabled}
              aria-busy={generating || localBusy}
              data-action="publish-research-final"
              onClick={async () => {
                if (disabled) return;
                setLocalBusy(true);
                setLocalActionNotice("Publication request started…");
                try {
                  await onGenerate();
                  setLocalActionNotice("");
                } catch (error) {
                  setLocalActionNotice(error instanceof Error ? error.message : "Final report publication failed.");
                } finally {
                  setLocalBusy(false);
                }
              }}
            >
              {buttonLabel}
            </button>
            <span className="research-finalisation-action-help research-finalisation-action-help-header">
              {ready
                ? "Creates the immutable final DOCX, publishes it to the Document Repository and marks the project Completed."
                : alreadyCompleted
                  ? "The governed final report has already been generated for this project."
                  : "Resolve the readiness item(s) below before final generation."}
            </span>
          </div>
        </header>

        <div className="research-finalisation-readiness research-finalisation-readiness-v836">
          <span className={latestApprovedVersion ? "ready" : ""}>
            <b>{latestApprovedVersion ? "✓" : "1"}</b>
            <strong>Approved locked version</strong>
          </span>
          <span className={hasControlledEvidence ? "ready" : ""}>
            <b>{hasControlledEvidence ? "✓" : "2"}</b>
            <strong>Controlled evidence linked</strong>
          </span>
          <span className={canGenerateApprovedFinal ? "ready" : ""}>
            <b>{canGenerateApprovedFinal ? "✓" : "3"}</b>
            <strong>Recorded approver authorised</strong>
          </span>
        </div>

        <div className="research-finalisation-summary">
          <div>
            <small>APPROVED VERSION</small>
            <strong>{latestApprovedVersion ? `Version ${latestApprovedVersion.version_number}` : "Not approved"}</strong>
          </div>
          <div>
            <small>RECORDED APPROVER</small>
            <strong>{latestApprovedVersion?.reviewed_by_name || latestApprovedVersion?.reviewer_name || "Not recorded"}</strong>
          </div>
          <div>
            <small>SECTION CHECK</small>
            <strong>{authoredApprovedCount} / {authoredSectionCount || 0} currently marked approved</strong>
            {!allAuthoredSectionsApproved && latestApprovedVersion && (
              <span>The approved locked submission remains the authority for final generation.</span>
            )}
          </div>
        </div>

        {blockers.length > 0 && !alreadyCompleted && (
          <div className="research-finalisation-blockers" role="status">
            <strong>Why finalisation is not available</strong>
            <ul>{blockers.map((item) => <li key={item}>{item}</li>)}</ul>
            {!hasControlledEvidence && <button type="button" onClick={onOpenResources}>Open Resources to add evidence</button>}
          </div>
        )}

        {(generationNotice || localActionNotice) && (
          <div className="research-finalisation-notice" role="status" aria-live="assertive">
            {generationNotice || localActionNotice}
          </div>
        )}

      </section>
    </>
  );
}

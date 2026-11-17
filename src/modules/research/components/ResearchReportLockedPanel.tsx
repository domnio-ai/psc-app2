import "../styles/research-report-locked-panel.css";

type Props = {
  status: string;
  reviewerName: string;
  versionNumber?: number | null;
  submittedAt?: string | null;
  message: string;
  onPreview: () => void;
  onOpenReview: () => void;
};

export default function ResearchReportLockedPanel(props: Props) {
  return (
    <section className="research-report-locked-panel" aria-label="Research report review status">
      <header>
        <div className="research-report-lock-icon" aria-hidden="true">🔒</div>
        <div>
          <small>GOVERNED REPORT STATUS</small>
          <h2>{props.status}</h2>
          <p>
            This report is being handled by <strong>{props.reviewerName}</strong>.
          </p>
        </div>
      </header>

      <div className="research-report-lock-facts">
        <div>
          <span>Report state</span>
          <strong>{props.status}</strong>
        </div>
        <div>
          <span>Reviewer</span>
          <strong>{props.reviewerName}</strong>
        </div>
        <div>
          <span>Submitted version</span>
          <strong>{props.versionNumber ? `Version ${props.versionNumber}` : "Recorded version"}</strong>
        </div>
        <div>
          <span>Submitted</span>
          <strong>{props.submittedAt ? new Date(props.submittedAt).toLocaleString() : "Recorded in workflow"}</strong>
        </div>
      </div>

      <div className="research-report-lock-message">
        <strong>Editing is locked</strong>
        <p>{props.message}</p>
      </div>

      <footer>
        <button type="button" className="primary" onClick={props.onPreview}>
          Preview Submitted Report
        </button>
        <button type="button" onClick={props.onOpenReview}>
          Open Review Status
        </button>
      </footer>
    </section>
  );
}

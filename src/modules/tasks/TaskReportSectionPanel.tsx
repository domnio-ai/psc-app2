import TaskSectionWorkspace from "../assignments/components/TaskSectionWorkspace";

type ReviewerOption = {
  id: string;
  name: string;
  role: string;
};

type OutlineSection = {
  id: string;
  title: string;
  status?: string;
};

type TemplateOption = {
  id: string;
  name: string;
  description?: string;
  sections?: { key: string; title: string }[];
};

type Props = {
  previewOpen?: boolean;
  sectionKey: string;
  currentReviewerId?: string | null;
  sectionTitle: string;
  reportTitle: string;
  contextTitle: string;
  reportDocumentMode?: "blank" | "structured";
  documentFrameMeta?: {
    reference?: string;
    assignment?: string;
    preparedBy?: string;
    status?: string;
    savedAt?: string;
  };
  value: string;
  busy: boolean;
  statusMessage?: string;
  statusTone?: "info" | "success" | "error";
  reviewerOptions: ReviewerOption[];
  reviewerOptionsError?: string;
  reviewerOptionsLoading?: boolean;
  onRetryReviewerOptions?: () => void;
  readySectionCount: number;
  totalSectionCount: number;
  submissionReady: boolean;
  sectionNumber: number;
  outlineSections: OutlineSection[];
  templateOptions: TemplateOption[];
  canGoPrevious: boolean;
  canGoNext: boolean;
  onChange: (value: string) => void;
  onImmediateChange?: (value: string) => void;
  onSave: (
    latestValue?: string,
    reviewerId?: string,
    options?: { autoSave?: boolean },
  ) => void | boolean | Promise<void | boolean>;
  onSelectSection: (key: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onPreviewReport: (latestValue?: string) => void | Promise<void>;
  onProceedForReview: (latestValue?: string) => void | Promise<void>;
  onSubmitForReview: (reviewerId: string, latestValue?: string) => void | Promise<void>;
  onClose: () => void;
  onOpenFinalDocument: () => void | Promise<void>;
};

export default function TaskReportSectionPanel({
  previewOpen = false,
  sectionKey,
  currentReviewerId,
  sectionTitle,
  reportTitle,
  contextTitle,
  reportDocumentMode,
  documentFrameMeta,
  value,
  busy,
  statusMessage,
  statusTone,
  reviewerOptions,
  reviewerOptionsError,
  reviewerOptionsLoading,
  onRetryReviewerOptions,
  readySectionCount,
  totalSectionCount,
  submissionReady,
  sectionNumber,
  outlineSections,
  templateOptions,
  canGoPrevious,
  canGoNext,
  onChange,
  onImmediateChange,
  onSave,
  onSelectSection,
  onPrevious,
  onNext,
  onPreviewReport,
  onProceedForReview,
  onSubmitForReview,
  onClose,
  onOpenFinalDocument,
}: Props) {
  return (
      <TaskSectionWorkspace
      suspended={previewOpen}
      title={sectionTitle}
      reportTitle={reportTitle}
      contextTitle={contextTitle}
      reportDocumentMode={reportDocumentMode}
      documentFrameMeta={documentFrameMeta}
      mode="edit"
      isEditable
      status="Draft"
      value={value}
      busy={busy}
      statusMessage={statusMessage}
      statusTone={statusTone}
      reviewerOptionsError={reviewerOptionsError}
      reviewerOptionsLoading={reviewerOptionsLoading}
      onRetryReviewerOptions={onRetryReviewerOptions}
      saveLabel="Save Draft"
      closeLabel="Return to Task"
      workspaceVariant="task-report"
      reviewerOptions={reviewerOptions}
      reviewerLocked
      submissionNoteEnabled={false}
      canSubmitForReview={Boolean(reviewerOptions.length)}
      readySectionCount={readySectionCount}
      totalSectionCount={totalSectionCount}
      submissionReady={submissionReady}
      sectionNumber={sectionNumber}
      sectionCount={totalSectionCount}
      currentSectionId={sectionKey}
      currentReviewerId={currentReviewerId || undefined}
      outlineSections={outlineSections}
      templateOptions={templateOptions}
      onChange={onChange}
      onImmediateChange={onImmediateChange}
      onSave={onSave}
      onSelectSection={onSelectSection}
      canGoPrevious={canGoPrevious}
      canGoNext={canGoNext}
      onPrevious={onPrevious}
      onNext={onNext}
      onPreviewReport={onPreviewReport}
      onProceedForReview={onProceedForReview}
      onSubmitForReview={(reviewerId, _comments, latestValue) =>
        onSubmitForReview(reviewerId, latestValue)
      }
      onClose={onClose}
      onOpenFinalDocument={onOpenFinalDocument}
      />
  );
}

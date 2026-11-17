import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  api,
  type DocumentTemplate,
  type GeneratedDocument,
  type GeneratedDocumentSection,
} from "../../../api";
import TaskSectionWorkspace from "./TaskSectionWorkspace";
import {
  assignmentReportTemplates,
  normalizeReviewerOptions,
} from "../../report-builder";
const AssignmentReportReader = lazy(() => import("./AssignmentReportReader"));

type Member = { id: string; name: string; role: string };
type ReviewerOption = { id: string; name: string; role: string };
type Props = {
  token: string;
  document: GeneratedDocument;
  templates: DocumentTemplate[];
  members: Member[];
  currentUserName: string;
  currentUserId?: string;
  assignmentTitle?: string;
  linkedTasks?: { id: string; title: string; status?: string }[];
  taskCount?: number;
  reviewers?: ReviewerOption[];
  canReview: boolean;
  canAdministerAssignment?: boolean;
  canArchiveAssignment?: boolean;
  onArchiveAssignment?: () => void | Promise<void>;
  canEditAssignmentReport?: boolean;
  initialPreview?: boolean;
  onClose: () => void;
  onRefresh: (id: string) => Promise<void>;
  onSubmitForReview?: (
    documentId: string,
    reviewerId: string,
    comments: string,
  ) => Promise<void>;
  onExternalImported?: (
    documentId: string,
    imported: import("../../../api").ExternalAssignmentReportImport,
  ) => Promise<void> | void;
};

const normalizeReportMarkup = (value: string) =>
  String(value || "")
    .replaceAll("\u00c3\u00a2\u00e2\u201a\u00ac\u201d", "—")
    .replaceAll("\u00c3\u00a2\u00e2\u201a\u00ac\u00c2\u009d", "”")
    .replaceAll("\u00c3\u201a\u00c2\u00b7", "·")
    .replaceAll("\u00c2\u00b7", "·");

const normalizeAssignmentReportContent = (
  value: string,
  taskCount: number,
) => {
  const normalized = normalizeReportMarkup(value);
  if (taskCount !== 0) return normalized;

  return normalized.replace(
    /This final assignment report consolidates 0 approved task reports for ([^.]+)\./gi,
    "This final assignment report is prepared directly for $1.",
  );
};

function LegacyAssignmentReportBuilder({
  token,
  document,
  templates,
  assignmentTitle,
  currentUserId,
  linkedTasks,
  taskCount = linkedTasks?.length || 0,
  reviewers = [],
  canEditAssignmentReport,
  canAdministerAssignment = false,
  canArchiveAssignment = false,
  onArchiveAssignment,
  initialPreview,
  onClose,
  onSubmitForReview,
}: Props) {
  const [report, setReport] = useState(document);
  const [section, setSection] = useState<GeneratedDocumentSection | null>(
    document.sections[0] || null,
  );
  const [content, setContent] = useState(
    normalizeAssignmentReportContent(section?.content || "", taskCount),
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [readerPreview, setReaderPreview] = useState<GeneratedDocument | null>(null);
  const [workspaceMessage, setWorkspaceMessage] = useState("");
  const [workspaceMessageTone, setWorkspaceMessageTone] = useState<
    "info" | "success" | "error"
  >("info");
  const [availableTemplates, setAvailableTemplates] = useState(
    assignmentReportTemplates(templates),
  );
  const [availableReviewers, setAvailableReviewers] = useState<ReviewerOption[]>(
    reviewers.filter((reviewer) => reviewer.id !== currentUserId),
  );

  const reportStageEditable = ![
    "Submitted",
    "Under Review",
    "Approved",
    "Final",
  ].includes(report.status);

  const serverCanEdit = report.can_edit_report;
  const userCanEditSection = Boolean(
    serverCanEdit ??
      (canEditAssignmentReport ??
        (["Lead", "Manager"].includes(report.current_user_role || "") ||
          Boolean(currentUserId && report.created_by === currentUserId) ||
          Boolean(currentUserId && section?.owner_id === currentUserId))),
  );
  const editable = reportStageEditable && userCanEditSection;
  const canSubmit = Boolean(
    report.can_submit_report ??
      (reportStageEditable &&
        (["Lead", "Manager"].includes(report.current_user_role || "") ||
          canEditAssignmentReport)),
  );
  const canImportExternal = Boolean(
    reportStageEditable &&
      (report.current_user_role === "Lead" ||
        report.current_user_role === "Manager" ||
        report.current_user_role === "Contributor" ||
        report.created_by === currentUserId),
  );

  const draftedSectionCount = useMemo(
    () => report.sections.filter((item) =>
      String(item.content || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").trim(),
    ).length,
    [report.sections],
  );
  const meaningfulDraftLength = useMemo(
    () => report.sections.map((item) =>
      String(item.content || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim(),
    ).join(" ").trim().length,
    [report.sections],
  );
  const submissionReady = Boolean(report.external_import || meaningfulDraftLength >= 100);

  const refresh = async (targetSectionId?: string) => {
    const fresh = await api.generatedDocument(token, report.id);
    setReport(fresh);
    const current =
      fresh.sections.find((item) => item.id === (targetSectionId || section?.id)) ||
      fresh.sections[0] ||
      null;
    setSection(current);
    setContent(normalizeAssignmentReportContent(current?.content || "", taskCount));
    setDirty(false);
    return fresh;
  };

  useEffect(() => {
    setAvailableTemplates(assignmentReportTemplates(templates));
  }, [templates]);

  useEffect(() => {
    let cancelled = false;

    void api
      .documentTemplates(token, "Assignment")
      .then((rows) => {
        if (cancelled) return;
        setAvailableTemplates(assignmentReportTemplates(rows));
      })
      .catch(() => {
        // Keep the governed templates already supplied by the parent.
      });

    return () => {
      cancelled = true;
    };
  }, [token, document.id]);

  useEffect(() => {
    let cancelled = false;

    void api
      .assignmentReportReviewers(token, document.context_id)
      .then((rows) => {
        if (cancelled) return;
        setAvailableReviewers(normalizeReviewerOptions(rows, currentUserId));
      })
      .catch(() => {
        if (cancelled) return;
        setAvailableReviewers(
          reviewers
            .filter((reviewer) => reviewer.id !== currentUserId)
            .sort((left, right) => left.name.localeCompare(right.name)),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [token, document.context_id, currentUserId, reviewers]);

  useEffect(() => {
    setReport(document);
    const selected =
      document.sections.find((item) => item.id === section?.id) ||
      document.sections[0] ||
      null;
    setSection(selected);
    setContent(normalizeAssignmentReportContent(selected?.content || "", taskCount));
    setDirty(false);
    window.history.replaceState(
      {},
      "",
      `/assignments/${document.context_id}/reports/${document.id}/edit`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = async (markReady = false, latestContent?: string) => {
    if (!section) return true;
    if (!editable) {
      setWorkspaceMessageTone("error");
      setWorkspaceMessage(
        "This report is read-only for your account or workflow stage.",
      );
      return false;
    }
    const workingContent = normalizeReportMarkup(latestContent ?? content);
    if (!dirty && !markReady && latestContent === undefined) return true;
    setSaving(true);
    setWorkspaceMessage("");
    try {
      const plain = workingContent
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .trim();
      if (markReady && !plain) {
        throw new Error("Add content before marking this section Ready.");
      }
      const savedSection = await api.saveGeneratedDocumentSection(
        token,
        report.id,
        section.id,
        workingContent,
        markReady ? 100 : plain ? Math.max(section.completion || 0, 35) : 0,
        markReady ? "Ready" : plain ? "In Progress" : "Not Started",
      );
      setContent(workingContent);
      setDirty(false);
      let refreshWarning = "";
      try {
        await refresh(section.id);
      } catch (refreshError) {
        refreshWarning = " The saved section could not be refreshed from the server yet.";
      }
      const repositoryPending = Boolean(savedSection.repository_sync_status && !["done", "not_requested"].includes(savedSection.repository_sync_status));
      setWorkspaceMessageTone(repositoryPending || refreshWarning ? "info" : "success");
      setWorkspaceMessage(repositoryPending
        ? (savedSection.repository_sync_message || "Section saved. Repository synchronization is queued for automatic retry.") + refreshWarning
        : (markReady ? "Section saved." : "Draft saved.") + refreshWarning);
      return true;
    } catch (error) {
      setWorkspaceMessageTone("error");
      setWorkspaceMessage(
        error instanceof Error
          ? error.message
          : markReady
            ? "This section could not be marked Ready."
            : "This section could not be saved.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openSection = async (sectionId: string, latestContent?: string) => {
    const next = report.sections.find((item) => item.id === sectionId);
    if (!next || next.id === section?.id) return;
    if ((dirty || latestContent !== undefined) && !(await save(false, latestContent))) return;
    setSection(next);
    setContent(normalizeReportMarkup(next.content || ""));
    setDirty(false);
  };

  const move = async (offset: number, latestContent?: string) => {
    if (!section) return;
    const index = report.sections.findIndex((item) => item.id === section.id);
    const next = report.sections[index + offset];
    if (next) await openSection(next.id, latestContent);
  };

  const close = () => {
    onClose();
  };

  const importExternalReport = async (file: File) => {
    setWorkflowBusy(true);
    setWorkspaceMessage("");
    try {
      if (dirty && !(await save())) return;
      await api.importAssignmentReport(token, report.id, file);
      await refresh(section?.id);
      setWorkspaceMessageTone("success");
      setWorkspaceMessage(
        `${file.name} imported as the external report for formal review. The original file is preserved unchanged.`,
      );
    } catch (error) {
      setWorkspaceMessageTone("error");
      setWorkspaceMessage(
        error instanceof Error ? error.message : "The external report could not be imported.",
      );
      throw error;
    } finally {
      setWorkflowBusy(false);
    }
  };

  const submitForReview = async (reviewerId: string, comments: string) => {
    if (!onSubmitForReview) return;
    setWorkflowBusy(true);
    setWorkspaceMessage("");
    try {
      if (dirty && !(await save())) return;
      await onSubmitForReview(report.id, reviewerId, comments);
      await refresh(section?.id);
      setWorkspaceMessageTone("success");
      setWorkspaceMessage("Report submitted to the assigned reviewer.");
    } catch (error) {
      setWorkspaceMessageTone("error");
      setWorkspaceMessage(
        error instanceof Error ? error.message : "The report could not be submitted.",
      );
      throw error;
    } finally {
      setWorkflowBusy(false);
    }
  };

  if (readerPreview) {
    return (
      <Suspense fallback={<div className="session-message">Opening report reader...</div>}>

        <AssignmentReportReader
        token={token}
        document={readerPreview}
        assignmentTitle={assignmentTitle}
        onClose={() => setReaderPreview(null)}
      />

      </Suspense>
    );
  }

  if (!section) return null;
  const sectionIndex = report.sections.findIndex((item) => item.id === section.id);

  return (
    <>
      {canAdministerAssignment && (
        <details className="assignment-report-admin assignment-report-admin-compact">
          <summary>Assignment Admin</summary>
          <div className="assignment-report-admin-popover">
            <small>ASSIGNMENT ADMINISTRATION</small>
            <strong>Archive this assignment</strong>
            <p>
              Archive preserves the assignment, report history and review provenance.
            </p>
            <button
              type="button"
              disabled={workflowBusy || !canArchiveAssignment}
              onClick={() => void onArchiveAssignment?.()}
              title={
                canArchiveAssignment
                  ? "Archive this assignment"
                  : "Archiving requires manager authority"
              }
            >
              Archive Assignment
            </button>
            {!canArchiveAssignment && (
              <span className="assignment-admin-authority-note">
                Assignment Lead access — archive remains manager-controlled.
              </span>
            )}
            <button type="button" disabled>
              Delete Assignment
            </button>
            <span>
              Delete locked — formal reporting has started.
            </span>
          </div>
        </details>
      )}

      <TaskSectionWorkspace
      key={section.id}
      workspaceVariant="assignment-report"
      title={section.title}
      reportTitle={normalizeReportMarkup(report.title)}
      contextTitle={
        assignmentTitle
          ? `${assignmentTitle} — Assignment Report`
          : normalizeReportMarkup(report.title)
      }
      documentFrameMeta={{
        reference: report.reference,
        assignment: assignmentTitle || normalizeReportMarkup(report.title),
        preparedBy: report.created_by_name,
        reviewer: report.reviewer_name || "Not assigned",
        status: report.status,
        version: `v${report.version}`,
        classification: report.classification || "Official",
        savedAt: report.updated_at
          ? new Date(report.updated_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })
          : "Not saved yet",
      }}
      linkedWorkItems={linkedTasks}
      onInsertLinkedWorkItem={async (taskId, destinationSectionId) => {
        if (dirty && !(await save())) return;
        const targetSectionId = destinationSectionId || section.id;
        await api.addTaskToAssignmentReportSection(
          token,
          report.id,
          targetSectionId,
          taskId,
        );
        await refresh(targetSectionId);
      }}
      mode={editable ? "edit" : "review"}
      isEditable={editable}
      initialPreview={initialPreview}
      status={
        ["Final", "Approved"].includes(report.status)
          ? "Final"
          : ["Submitted", "Under Review"].includes(report.status)
            ? "In Review"
            : "Draft"
      }
      value={content}
      busy={saving || workflowBusy}
      sectionNumber={sectionIndex + 1}
      sectionCount={report.sections.length}
      currentSectionId={section.id}
      outlineSections={report.sections.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.section_status,
      }))}
      canGoPrevious={sectionIndex > 0}
      canGoNext={sectionIndex < report.sections.length - 1}
      statusMessage={workspaceMessage}
      statusTone={workspaceMessageTone}
      templateOptions={availableTemplates.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        sections: item.sections,
      }))}
      currentTemplateId={report.template_id}
      onApplyDocumentTemplate={async (templateId) => {
        if (dirty && !(await save())) return;
        setWorkflowBusy(true);
        setWorkspaceMessage("");
        try {
          await api.applyAssignmentReportTemplate(token, report.id, templateId, true);
          const fresh = await refresh();
          setWorkspaceMessageTone("success");
          setWorkspaceMessage(`Report outline changed to ${availableTemplates.find((item) => item.id === templateId)?.name || "the selected template"}. ${fresh.sections.length} sections loaded.`);
        } catch (error) {
          setWorkspaceMessageTone("error");
          setWorkspaceMessage(error instanceof Error ? error.message : "The report template could not be applied.");
          throw error;
        } finally {
          setWorkflowBusy(false);
        }
      }}
      finalDocumentLabel={editable ? "Download Draft PDF" : "Download Reviewed PDF"}
      saveLabel="Save Draft"
      reviewerOptions={availableReviewers}
      canSubmitForReview={canSubmit}
      submissionReady={submissionReady}
      readySectionCount={draftedSectionCount}
      totalSectionCount={report.sections.length}
      externalReport={report.external_import || undefined}
      canImportExternalReport={canImportExternal}
      onImportExternalReport={importExternalReport}
      onOpenExternalReport={() =>
        report.external_import
          ? api.openImportedAssignmentReport(
              token,
              report.id,
              report.external_import.original_name,
              report.external_import.mime_type,
            )
          : Promise.resolve()
      }
      onSubmitForReview={submitForReview}
      onChange={(value) => {
        setContent(value);
        setDirty(true);
      }}
      onClose={close}
      onSave={async (latestValue) => {
        return save(false, latestValue);
      }}
      onPreviewReport={async (latestValue) => {
        const saved = await save(false, latestValue);
        if (!saved) {
          throw new Error("The report draft could not be saved. Preview was not opened.");
        }
        try {
          const fresh = await refresh(section.id);
          setReaderPreview(fresh);
        } catch {
          const savedContent = normalizeReportMarkup(latestValue ?? content);
          setReaderPreview({ ...report, sections: report.sections.map((item) => item.id === section.id ? { ...item, content: savedContent } : item) });
          setWorkspaceMessageTone("info");
          setWorkspaceMessage("Section saved. Preview is using the saved content; the live report refresh is temporarily unavailable.");
        }
      }}
      onPrevious={(latestValue) => move(-1, latestValue)}
      onNext={(latestValue) => move(1, latestValue)}
      onSelectSection={(sectionId, latestValue) =>
        openSection(sectionId, latestValue)
      }
      onOpenFinalDocument={async (latestValue) => {
        const saved = await save(false, latestValue);
        if (!saved) {
          throw new Error("The report draft could not be saved. PDF export was not started.");
        }
        await api.exportGeneratedDocument(token, report.id, report.reference, "pdf");
      }}
    />
    </>
  );
}


export default function AssignmentReportBuilder(props: Props) {
  if (props.document.context === "Assignment") {
    const lockedForReview = ["Submitted", "Under Review", "Approved", "Final"].includes(
      props.document.status,
    );
    if (props.initialPreview || lockedForReview) {
      return (
        <Suspense fallback={<div className="session-message">Opening report reader...</div>}>

          <AssignmentReportReader
          token={props.token}
          document={props.document}
          assignmentTitle={props.assignmentTitle}
          onClose={props.onClose}
        />

        </Suspense>
      );
    }
    const canEdit = Boolean(
      props.document.can_edit_report ?? props.canEditAssignmentReport,
    );
    if (!canEdit) {
      return (
        <div className="document-builder-backdrop">
          <section className="document-builder-shell" aria-label="Assignment report access">
            <header className="document-builder-header">
              <div>
                <small>ASSIGNMENT REPORT</small>
                <h2>Report builder access</h2>
                <p>
                  This report is assigned to {props.document.created_by_name || "the designated report builder"}.
                </p>
              </div>
              <div className="document-builder-state">
                <b>READ ONLY</b>
                <span>{props.document.status}</span>
                <button type="button" onClick={props.onClose}>Close</button>
              </div>
            </header>
            <div className="document-builder-message info">
              You are not the assigned report builder. Ask the Assignment Lead or a Research Manager if responsibility should be reassigned.
            </div>
          </section>
        </div>
      );
    }
    return <LegacyAssignmentReportBuilder {...props} />;
  }
  return <LegacyAssignmentReportBuilder {...props} />;
}

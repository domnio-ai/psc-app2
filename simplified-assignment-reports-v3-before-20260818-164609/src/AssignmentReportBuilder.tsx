import { useEffect, useMemo, useState } from "react";
import {
  api,
  type DocumentTemplate,
  type GeneratedDocument,
  type GeneratedDocumentSection,
} from "./api";
import TaskSectionWorkspace from "./TaskSectionWorkspace";
import AssignmentReportSimpleEditor from "./AssignmentReportSimpleEditor";
import AssignmentReportReader from "./AssignmentReportReader";

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
  reviewers?: ReviewerOption[];
  canReview: boolean;
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
    imported: import("./api").ExternalAssignmentReportImport,
  ) => Promise<void> | void;
};

const normalizeReportMarkup = (value: string) =>
  String(value || "")
    .replaceAll("Ã¢â‚¬”", "—")
    .replaceAll("Ã¢â‚¬Â", "”")
    .replaceAll("Ã‚Â·", "·")
    .replaceAll("Â·", "·");

function LegacyAssignmentReportBuilder({
  token,
  document,
  templates,
  assignmentTitle,
  currentUserId,
  linkedTasks,
  reviewers = [],
  canEditAssignmentReport,
  initialPreview,
  onClose,
  onSubmitForReview,
}: Props) {
  const [report, setReport] = useState(document);
  const [section, setSection] = useState<GeneratedDocumentSection | null>(
    document.sections[0] || null,
  );
  const [content, setContent] = useState(
    normalizeReportMarkup(section?.content || ""),
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [workspaceMessage, setWorkspaceMessage] = useState("");
  const [workspaceMessageTone, setWorkspaceMessageTone] = useState<
    "info" | "success" | "error"
  >("info");

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

  const readyCount = useMemo(
    () =>
      report.sections.filter((item) =>
        ["Ready", "Complete"].includes(item.section_status),
      ).length,
    [report.sections],
  );
  const sectionsReady =
    report.sections.length > 0 && readyCount === report.sections.length;
  const submissionReady = Boolean(report.external_import || sectionsReady);

  const refresh = async (targetSectionId?: string) => {
    const fresh = await api.generatedDocument(token, report.id);
    setReport(fresh);
    const current =
      fresh.sections.find((item) => item.id === (targetSectionId || section?.id)) ||
      fresh.sections[0] ||
      null;
    setSection(current);
    setContent(normalizeReportMarkup(current?.content || ""));
    setDirty(false);
    return fresh;
  };

  useEffect(() => {
    setReport(document);
    const selected =
      document.sections.find((item) => item.id === section?.id) ||
      document.sections[0] ||
      null;
    setSection(selected);
    setContent(normalizeReportMarkup(selected?.content || ""));
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
      await api.saveGeneratedDocumentSection(
        token,
        report.id,
        section.id,
        workingContent,
        markReady ? 100 : plain ? Math.max(section.completion || 0, 35) : 0,
        markReady ? "Ready" : plain ? "In Progress" : "Not Started",
      );
      const fresh = await refresh(section.id);
      setWorkspaceMessageTone("success");
      setWorkspaceMessage(
        markReady
          ? `Section marked Ready. ${fresh.sections.filter((item) => ["Ready", "Complete"].includes(item.section_status)).length}/${fresh.sections.length} sections are ready.`
          : "Draft saved.",
      );
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

  const openSection = async (sectionId: string) => {
    const next = report.sections.find((item) => item.id === sectionId);
    if (!next || next.id === section?.id) return;
    if (dirty && !(await save())) return;
    setSection(next);
    setContent(normalizeReportMarkup(next.content || ""));
    setDirty(false);
  };

  const move = async (offset: number) => {
    if (!section) return;
    const index = report.sections.findIndex((item) => item.id === section.id);
    const next = report.sections[index + offset];
    if (next) await openSection(next.id);
  };

  const close = () => {
    if (dirty && !window.confirm("Close without saving your changes?")) return;
    window.history.pushState({}, "", `/assignments/${report.context_id}`);
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

  if (!section) return null;
  const sectionIndex = report.sections.findIndex((item) => item.id === section.id);

  return (
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
      canMarkReady={editable}
      statusMessage={workspaceMessage}
      statusTone={workspaceMessageTone}
      templateOptions={templates.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        sections: item.sections,
      }))}
      currentTemplateId={report.template_id}
      finalDocumentLabel={editable ? "Download Current Draft" : "Download Reviewed Report"}
      saveLabel="Save Draft"
      reviewerOptions={reviewers.filter((reviewer) => reviewer.id !== currentUserId)}
      canSubmitForReview={canSubmit}
      submissionReady={submissionReady}
      readySectionCount={readyCount}
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
      onMarkReady={async (latestValue) => {
        await save(true, latestValue);
      }}
      onSave={async (latestValue) => {
        await save(false, latestValue);
      }}
      onPrevious={() => move(-1)}
      onNext={() => move(1)}
      onSelectSection={openSection}
      onOpenFinalDocument={() =>
        api.exportGeneratedDocument(token, report.id, report.reference, "docx")
      }
    />
  );
}


export default function AssignmentReportBuilder(props: Props) {
  if (props.document.context === "Assignment") {
    const lockedForReview = ["Submitted", "Under Review", "Approved", "Final"].includes(
      props.document.status,
    );
    if (props.initialPreview || lockedForReview) {
      return (
        <AssignmentReportReader
          token={props.token}
          document={props.document}
          assignmentTitle={props.assignmentTitle}
          onClose={props.onClose}
        />
      );
    }
    return (
      <AssignmentReportSimpleEditor
        token={props.token}
        document={props.document}
        assignmentTitle={props.assignmentTitle}
        linkedTasks={props.linkedTasks}
        reviewers={props.reviewers}
        canEditAssignmentReport={props.canEditAssignmentReport}
        onClose={props.onClose}
        onSubmitForReview={props.onSubmitForReview}
        onExternalImported={props.onExternalImported}
      />
    );
  }
  return <LegacyAssignmentReportBuilder {...props} />;
}

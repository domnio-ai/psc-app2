import { useEffect, useState } from "react";
import {
  api,
  type DocumentTemplate,
  type GeneratedDocument,
  type GeneratedDocumentSection,
} from "./api";
import TaskSectionWorkspace from "./TaskSectionWorkspace";

type Member = { id: string; name: string; role: string };
type Props = {
  token: string;
  document: GeneratedDocument;
  templates: DocumentTemplate[];
  members: Member[];
  currentUserName: string;
  assignmentTitle?: string;
  linkedTasks?: { id: string; title: string; status?: string }[];
  canReview: boolean;
  onClose: () => void;
  onRefresh: (id: string) => Promise<void>;
};

export default function AssignmentReportBuilder({
  token,
  document,
  templates,
  assignmentTitle,
  linkedTasks,
  onClose,
}: Props) {
  const [report, setReport] = useState(document);
  const [section, setSection] = useState<GeneratedDocumentSection | null>(
    document.sections[0] || null,
  );
  const [content, setContent] = useState(section?.content || "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const editable = !["Submitted", "Under Review", "Approved", "Final"].includes(
    report.status,
  );

  useEffect(() => {
    setReport(document);
    const selected =
      document.sections.find((item) => item.id === section?.id) ||
      document.sections[0] ||
      null;
    setSection(selected);
    setContent(selected?.content || "");
    setDirty(false);
    window.history.replaceState(
      {},
      "",
      `/assignments/${document.context_id}/reports/${document.id}/edit`,
    );
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

  const save = async () => {
    if (!section || !dirty) return true;
    setSaving(true);
    try {
      const plain = content.replace(/<[^>]+>/g, " ").trim();
      await api.saveGeneratedDocumentSection(
        token,
        report.id,
        section.id,
        content,
        plain ? 35 : 0,
        plain ? "In Progress" : "Not Started",
      );
      const fresh = await api.generatedDocument(token, report.id);
      setReport(fresh);
      const current = fresh.sections.find((item) => item.id === section.id);
      if (current) {
        setSection(current);
        setContent(current.content || "");
      }
      setDirty(false);
      return true;
    } finally {
      setSaving(false);
    }
  };

  const openSection = async (sectionId: string) => {
    const next = report.sections.find((item) => item.id === sectionId);
    if (!next || next.id === section?.id) return;
    if (dirty && !(await save())) return;
    setSection(next);
    setContent(next.content || "");
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

  if (!section) return null;
  const sectionIndex = report.sections.findIndex((item) => item.id === section.id);

  return (
    <TaskSectionWorkspace
      key={section.id}
      title={section.title}
      reportTitle={report.title}
      contextTitle={assignmentTitle ? `${assignmentTitle} — Assignment Report` : report.title}
      linkedWorkItems={linkedTasks}
      onInsertLinkedWorkItem={async (taskId, destinationSectionId) => {
        if (dirty && !(await save())) return;
        const targetSectionId = destinationSectionId || section.id;
        await api.addTaskToAssignmentReportSection(token, report.id, targetSectionId, taskId);
        const fresh = await api.generatedDocument(token, report.id);
        setReport(fresh);
        const current = fresh.sections.find((item) => item.id === targetSectionId);
        if (current) {
          setSection(current);
          setContent(current.content || "");
        }
        setDirty(false);
      }}
      mode={editable ? "edit" : "review"}
      status={
        ["Final", "Approved"].includes(report.status)
          ? "Final"
          : ["Submitted", "Under Review"].includes(report.status)
            ? "In Review"
            : "Draft"
      }
      value={content}
      busy={saving}
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
      templateOptions={templates.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        sections: item.sections,
      }))}
      currentTemplateId={report.template_id}
      finalDocumentLabel="Export final document"
      onChange={(value) => {
        setContent(value);
        setDirty(true);
      }}
      onClose={close}
      onSave={async () => {
        if (await save()) {
          window.history.pushState({}, "", `/assignments/${report.context_id}`);
          onClose();
        }
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

import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { createPortal } from "react-dom";

import type { App2LexicalReportEditorHandle } from "../../report-editor/App2LexicalReportEditor";
import { normalizeReportHtml, sanitizeReportHtmlForEditor } from "../../report-editor/reportHtml";
import {
  markSelectedReportImage,
  prepareReportImage,
} from "../../report-editor/reportImageProcessing";
import "../../report-builder/styles/report-builder.css";
import "../../report-builder/styles/report-builder-command-layout.css";
import TaskReportReviewerPicker from "../../tasks/TaskReportReviewerPicker";
import { taskReportTemplatePreferenceKey } from "../../tasks/taskReportDraftWorkflow";
import "../../tasks/task-report-workspace.css";
import "./assignment-report-workspace.css";

const App2LexicalReportEditor = lazy(
  () => import("../../report-editor/App2LexicalReportEditor"),
);
const WORKSPACE_SIZE_KEY = "app2-report-workspace-maximized";

const cleanKnownMojibake = (value: string) =>
  value
    .replaceAll("\u00e2\u20ac\u201d", "\u2014")
    .replaceAll("\u00e2\u20ac\u201c", "\u2013")
    .replaceAll("\u00e2\u20ac\u02dc", "\u2018")
    .replaceAll("\u00e2\u20ac\u2122", "\u2019")
    .replaceAll("\u00e2\u20ac\u0153", "\u201c")
    .replaceAll("\u00c2\u00a0", " ")
    .replaceAll("\u00c2 ", " ");


type Props = {
  suspended?: boolean;
  title: string;
  reportTitle: string;
  reportDocumentMode?: "blank" | "structured";
  documentFrameMeta?: {
    reference?: string;
    assignment?: string;
    preparedBy?: string;
    reviewer?: string;
    status?: string;
    version?: string;
    classification?: string;
    savedAt?: string;
  };
  contextTitle?: string;
  linkedWorkItems?: { id: string; title: string; status?: string }[];
  onInsertLinkedWorkItem?: (
    id: string,
    sectionId?: string,
  ) => void | Promise<void>;
  linkedWorkLabel?: string;
  linkedWorkPlaceholder?: string;
  linkedWorkActionLabel?: string;
  mode: "edit" | "review";
  isEditable?: boolean;
  initialPreview?: boolean;
  status: "Draft" | "In Review" | "Final";
  value: string;
  busy?: boolean;
  canSendReview?: boolean;
  canMarkFinal?: boolean;
  canMarkReady?: boolean;
  statusMessage?: string;
  statusTone?: "info" | "success" | "error";
  reviewerOptionsError?: string;
  reviewerOptionsLoading?: boolean;
  onRetryReviewerOptions?: () => void;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  sectionNumber?: number;
  sectionCount?: number;
  outlineSections?: { id: string; title: string; status?: string }[];
  currentSectionId?: string;
  currentReviewerId?: string;
  finalDocumentLabel?: string;
  templateOptions?: {
    id: string;
    name: string;
    description?: string;
    sections?: { key: string; title: string }[];
  }[];
  currentTemplateId?: string;
  reportTemplateOptions?: {
    key: string;
    name: string;
    description?: string;
    sectionCount?: number;
  }[];
  onApplyReportTemplate?: (templateKey: string) => void | Promise<void>;
  onApplyDocumentTemplate?: (templateId: string) => void | Promise<void>;
  workspaceVariant?: "default" | "assignment-report" | "task-report" | "research-report";
  reviewerLocked?: boolean;
  submissionNoteEnabled?: boolean;
  saveLabel?: string;
  closeLabel?: string;
  reviewerOptions?: { id: string; name: string; role: string }[];
  canSubmitForReview?: boolean;
  submissionReady?: boolean;
  readySectionCount?: number;
  totalSectionCount?: number;
  externalReport?: {
    id: string;
    version_number: number;
    original_name: string;
    mime_type: string;
    size_bytes: number;
    status: string;
  };
  canImportExternalReport?: boolean;
  onImportExternalReport?: (file: File) => void | Promise<void>;
  onOpenExternalReport?: () => void | Promise<void>;
  onSubmitForReview?: (
    reviewerId: string,
    comments: string,
    latestValue?: string,
  ) => void | Promise<void>;
  onChange: (value: string) => void;
  onImmediateChange?: (value: string) => void;
  onClose: () => void;
  onSave: (
    latestValue?: string,
    reviewerId?: string,
    options?: { autoSave?: boolean },
  ) => void | boolean | Promise<void | boolean>;
  onPrevious?: (latestValue?: string) => void | Promise<void>;
  onNext?: (latestValue?: string) => void | Promise<void>;
  onSendReview?: () => void | Promise<void>;
  onMarkFinal?: () => void | Promise<void>;
  onMarkReady?: (latestValue?: string) => void | Promise<void>;
  onOpenFinalDocument?: (latestValue?: string) => void | Promise<void>;
  onSelectSection?: (
    sectionId: string,
    latestValue?: string,
  ) => void | Promise<void>;
  onProceedForReview?: (latestValue?: string) => void | Promise<void>;
  onPreviewReport?: (latestValue?: string, reviewerId?: string) => void | Promise<void>;
};



export default function TaskSectionWorkspace(props: Props) {
  const {
    title: rawTitle,
    reportTitle: rawReportTitle,
    mode,
    status,
    value: rawValue,
    busy,
    onChange,
  } = props;
  const cleanTaskText = (input: string) =>
    props.workspaceVariant === "task-report" ? cleanKnownMojibake(input) : input;
  const title = cleanTaskText(rawTitle);
  const reportTitle = cleanTaskText(rawReportTitle);
  const cleanedValue = cleanTaskText(rawValue);
  const value =
    props.workspaceVariant === "task-report" && cleanedValue.trim()
      ? normalizeReportHtml(cleanedValue)
      : cleanedValue;
  const contextTitle = props.contextTitle
    ? cleanTaskText(props.contextTitle)
    : undefined;
  const reportEditorRef = useRef<App2LexicalReportEditorHandle | null>(null);
  const reportEditorHostRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const reportImportInputRef = useRef<HTMLInputElement | null>(null);
  const externalReportInputRef = useRef<HTMLInputElement | null>(null);
  const imageToReplaceRef = useRef<HTMLImageElement | null>(null);
  const latestValueRef = useRef(value);
  const lastSavedValueRef = useRef(value);
  const autoSaveTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const autoSaveInFlightRef = useRef(false);
  const [find, setFind] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [preview, setPreview] = useState(props.initialPreview ?? mode === "review");
  const [maximized, setMaximized] = useState(
    () => sessionStorage.getItem(WORKSPACE_SIZE_KEY) !== "false",
  );
  const [fontFamily, setFontFamily] = useState("Calibri");
  const [fontSize, setFontSize] = useState("12");
  const taskTemplateStorageKey =
    props.workspaceVariant === "task-report"
      ? taskReportTemplatePreferenceKey(contextTitle || reportTitle)
      : "";
  const readPersistedTaskTemplateId = () => {
    if (!taskTemplateStorageKey) return "";
    try {
      return window.localStorage.getItem(taskTemplateStorageKey) || "";
    } catch {
      return "";
    }
  };
  const persistTaskTemplateId = (templateId: string) => {
    if (!taskTemplateStorageKey) return;
    try {
      window.localStorage.setItem(taskTemplateStorageKey, templateId);
    } catch {
      // Template persistence is a convenience; editing must still work if storage is unavailable.
    }
  };
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    () => props.currentTemplateId || readPersistedTaskTemplateId(),
  );
  const [templatePreviewOpen, setTemplatePreviewOpen] = useState(false);
  const [reportTemplateKey, setReportTemplateKey] = useState("");
  const [reportTemplateBusy, setReportTemplateBusy] = useState(false);
  const [reportTemplateMessage, setReportTemplateMessage] = useState("");
  const [linkedWorkItemId, setLinkedWorkItemId] = useState("");
  const [linkedWorkSectionId, setLinkedWorkSectionId] = useState(
    props.currentSectionId || "",
  );
  const [activeOutlineSectionId, setActiveOutlineSectionId] = useState(
    props.currentSectionId || "",
  );
  const [insertingLinkedWork, setInsertingLinkedWork] = useState(false);
  const [linkedWorkError, setLinkedWorkError] = useState("");
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(
    null,
  );
  const [reportImportError, setReportImportError] = useState("");
  const [importingReport, setImportingReport] = useState(false);
  const [activeRibbonTab, setActiveRibbonTab] = useState("Home");
  const [reviewerId, setReviewerId] = useState(props.currentReviewerId || "");
  const [reviewNote, setReviewNote] = useState("");
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [workflowAction, setWorkflowAction] = useState<"save" | "preview" | null>(null);
  const [markingReady, setMarkingReady] = useState(false);
  const [workflowMessage, setWorkflowMessage] = useState("");
  const [workflowTone, setWorkflowTone] = useState<"success" | "error" | "info">("info");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error" | "conflict">("idle");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const editMode = mode === "edit" && props.isEditable !== false;
  const openRibbonTab = (tab: string) => {
    setActiveRibbonTab(tab);
  };

  useEffect(() => {
    setPreview(props.initialPreview ?? mode === "review");
    setCursorPosition(0);
    lastSavedValueRef.current = latestValueRef.current;
  }, [mode, title, props.initialPreview]);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => () => {
    if (autoSaveTimerRef.current !== null) window.clearTimeout(autoSaveTimerRef.current);
  }, []);

  useEffect(() => {
    setLinkedWorkSectionId(props.currentSectionId || "");
    setActiveOutlineSectionId(props.currentSectionId || "");
  }, [props.currentSectionId]);

  useEffect(() => {
    if (!editMode) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (currentEditorValue() === lastSavedValueRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [editMode]);

  useEffect(() => {
    const options = props.reviewerOptions || [];
    setReviewerId((current) => {
      if (options.some((reviewer) => reviewer.id === current)) return current;
      if (props.currentReviewerId && options.some((reviewer) => reviewer.id === props.currentReviewerId)) {
        return props.currentReviewerId;
      }
      return options.length === 1 ? options[0].id : "";
    });
  }, [props.currentReviewerId, props.reviewerOptions]);

  useEffect(() => {
    const options = props.templateOptions || [];
    const persistedTemplateId = readPersistedTaskTemplateId();
    setSelectedTemplateId((current) => {
      if (current === "__blank__" || options.some((item) => item.id === current))
        return current;
      if (
        props.currentTemplateId &&
        options.some((item) => item.id === props.currentTemplateId)
      )
        return props.currentTemplateId;
      if (
        persistedTemplateId === "__blank__" ||
        options.some((item) => item.id === persistedTemplateId)
      )
        return persistedTemplateId;
      return options[0]?.id || "";
    });
  }, [props.currentTemplateId, props.templateOptions, taskTemplateStorageKey]);

  const isTaskReportRevisionConflict = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return /changed in another session|newer draft was saved|revision conflict|stale draft/i.test(message);
  };

  const hasUnsavedChanges = () => currentEditorValue() !== lastSavedValueRef.current;

  const rememberSavedDraft = (latestValue: string) => {
    lastSavedValueRef.current = latestValue;
    if (props.workspaceVariant === "task-report") {
      setLastSavedAt(new Date().toLocaleTimeString("en-KE", {
        hour: "2-digit",
        minute: "2-digit",
      }));
      setSaveState("saved");
    }
  };

  const scheduleTaskReportAutoSave = (delay = 1500) => {
    if (props.workspaceVariant !== "task-report" || !editMode) return;
    if (autoSaveTimerRef.current !== null) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      if (saveState === "conflict") return;
      if (autoSaveInFlightRef.current) {
        scheduleTaskReportAutoSave(delay);
        return;
      }
      if (busy || workflowBusy) {
        scheduleTaskReportAutoSave(delay);
        return;
      }
      const latestValue = currentEditorValue();
      if (latestValue === lastSavedValueRef.current) return;
      setSaveState("saving");
      autoSaveInFlightRef.current = true;
      let conflictDetected = false;
      let saveSucceeded = false;
      void Promise.resolve().then(() => props.onSave(latestValue, undefined, { autoSave: true })).then((result) => {
        if (result === false) throw new Error("The Task Report draft could not be saved.");
        saveSucceeded = true;
        rememberSavedDraft(latestValue);
        setWorkflowMessage("");
      }).catch((error) => {
        const conflict = isTaskReportRevisionConflict(error);
        conflictDetected = conflict;
        setSaveState(conflict ? "conflict" : "error");
        setWorkflowTone("error");
        setWorkflowMessage(error instanceof Error ? error.message : "The Task Report draft could not be saved.");
        if (!conflict) scheduleTaskReportAutoSave(5000);
      }).finally(() => {
        autoSaveInFlightRef.current = false;
        if (saveSucceeded && currentEditorValue() !== lastSavedValueRef.current && !conflictDetected) {
          scheduleTaskReportAutoSave();
        }
      });
    }, delay);
  };

  const saveDraftAndRemember = async () => {
    if (autoSaveTimerRef.current !== null) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = null;
    if (props.workspaceVariant === "task-report" && saveState === "conflict") return false;
    const latestValue = currentEditorValue();
    // Reviewer assignment is persisted by persistTaskReviewerChoice when the
    // picker changes. Re-sending it during a content save can race that request
    // and make preview fail even though the selected reviewer is already saved.
    const result = await props.onSave(latestValue, undefined);
    if (result !== false) {
      rememberSavedDraft(latestValue);
      return true;
    }
    return false;
  };

  // A close is a user-requested Draft save, not a background auto-save. This
  // lets the server refresh the Repository HTML working-copy mirror on close.
  const saveClosingDraftAndRemember = async () => {
    if (autoSaveTimerRef.current !== null) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = null;
    if (props.workspaceVariant === "task-report" && saveState === "conflict") return false;
    const latestValue = currentEditorValue();
    const result = await props.onSave(latestValue, undefined);
    if (result !== false) {
      rememberSavedDraft(latestValue);
      return true;
    }
    return false;
  };

  const handleSaveDraft = async () => {
    if (workflowBusy) return;

    setWorkflowBusy(true);
    setWorkflowAction("save");
    setWorkflowTone("info");
    setWorkflowMessage("Saving the latest Task Report draft...");

    try {
      const saved = await saveDraftAndRemember();
      if (!saved) {
        throw new Error("The Task Report draft could not be saved.");
      }

      const time = new Date().toLocaleTimeString("en-KE", {
        hour: "2-digit",
        minute: "2-digit",
      });
      setWorkflowTone("success");
      setWorkflowMessage(`Draft saved successfully at ${time}.`);
    } catch (error) {
      setWorkflowTone("error");
      if (props.workspaceVariant === "task-report") {
        setSaveState(
          isTaskReportRevisionConflict(error) || saveState === "conflict"
            ? "conflict"
            : "error",
        );
      }
      setWorkflowMessage(
        error instanceof Error ? error.message : "The draft could not be saved.",
      );
    } finally {
      setWorkflowAction(null);
      setWorkflowBusy(false);
    }
  };

  const handlePreview = () => {
    if (props.workspaceVariant === "task-report" && props.onPreviewReport) {
      void runFullReportPreview();
      return;
    }

    if (props.onPreviewReport && !preview) {
      void runFullReportPreview();
      return;
    }

    setPreview((current) => !current);
  };

  const persistTaskReviewerChoice = async (nextReviewerId: string) => {
    setReviewerId(nextReviewerId);
    if (props.workspaceVariant !== "task-report" || !nextReviewerId) return;
    setWorkflowBusy(true);
    setWorkflowMessage("");
    try {
      const latestValue = currentEditorValue();
      const saved = await props.onSave(latestValue, nextReviewerId);
      if (saved === false) throw new Error("The reviewer could not be saved.");
      lastSavedValueRef.current = latestValue;
      setLastSavedAt(new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }));
      setSaveState("saved");
      setWorkflowTone("success");
      setWorkflowMessage("Reviewer selected and draft saved.");
    } catch (error) {
      setWorkflowTone("error");
      setWorkflowMessage(
        error instanceof Error ? error.message : "The reviewer could not be saved.",
      );
    } finally {
      setWorkflowBusy(false);
    }
  };

  const requestClose = async () => {
    /* APP2_TASK_REPORT_CLOSE_SAVE_V1 */
    if (props.workspaceVariant === "task-report" && saveState === "conflict") {
      const discard = window.confirm(
        "A newer Task Report draft exists on the server. Copy any unsaved text first. Close without saving and reopen the task to load the latest version? Your unsaved editor changes will be lost.",
      );
      if (discard) props.onClose();
      return;
    }
    if (props.workspaceVariant === "task-report") {
      if (!editMode) {
        props.onClose();
        return;
      }
      if (busy || workflowBusy) {
        setWorkflowTone("info");
        setWorkflowMessage("Please wait for the current report action to finish before closing.");
        return;
      }
      setWorkflowBusy(true);
      setWorkflowAction(null);
      setWorkflowTone("info");
      setWorkflowMessage("Saving the latest changes before closing...");
      let closeAfterSave = false;
      try {
        const saved = await saveClosingDraftAndRemember();
        if (!saved) throw new Error("The latest Task Report changes could not be saved. The workspace remains open.");
        setWorkflowMessage("Draft saved. Closing workspace...");
        closeAfterSave = true;
      } catch (error) {
        setSaveState(
          isTaskReportRevisionConflict(error) || saveState === "conflict"
            ? "conflict"
            : "error",
        );
        setWorkflowTone("error");
        setWorkflowMessage(error instanceof Error ? error.message : "The Task Report could not be saved. The workspace remains open.");
      } finally {
        setWorkflowBusy(false);
      }
      if (closeAfterSave) props.onClose();
      return;
    }
    if (!editMode || !hasUnsavedChanges()) {
      props.onClose();
      return;
    }
    if (busy || workflowBusy) {
      setWorkflowTone("info");
      setWorkflowMessage("Please wait for the current report action to finish before closing.");
      return;
    }
    setWorkflowBusy(true);
    setWorkflowMessage("Saving the latest changes before closing...");
    let closeAfterSave = false;
    try {
      const saved = await saveDraftAndRemember();
      if (!saved) throw new Error("The latest report changes could not be saved. The workspace remains open.");
      setWorkflowMessage("Draft saved. Closing workspace...");
      closeAfterSave = true;
    } catch (error) {
      setWorkflowTone("error");
      setWorkflowMessage(error instanceof Error ? error.message : "The report could not be saved. The workspace remains open.");
    } finally {
      setWorkflowBusy(false);
    }
    if (closeAfterSave) props.onClose();
  };

  const runFullReportPreview = async () => {
    if (!props.onPreviewReport || workflowBusy || busy) {
      if (!props.onPreviewReport) setPreview((current) => !current);
      return;
    }

    setWorkflowBusy(true);
    setWorkflowAction("preview");
    setWorkflowTone("info");
    setWorkflowMessage("Opening preview from the current editor content...");

    try {
      const latestValue = currentEditorValue();
      if (props.workspaceVariant === "task-report") {
        const saved = await saveDraftAndRemember();
        if (!saved) throw new Error("The latest Task Report draft could not be saved. Preview was not opened.");
      }
      // The explicit reviewer picker owns reviewer persistence. Preview only
      // saves the latest content and must not start a competing reviewer write.
      await props.onPreviewReport(latestValue, undefined);
    } catch (error) {
      if (props.workspaceVariant === "task-report") {
        setSaveState(
          isTaskReportRevisionConflict(error) || saveState === "conflict"
            ? "conflict"
            : "error",
        );
      }
      setWorkflowTone("error");
      setWorkflowMessage(
        error instanceof Error
          ? error.message
          : "The full Task Report preview could not be opened.",
      );
    } finally {
      setWorkflowAction(null);
      setWorkflowBusy(false);
    }
  };

  const visualLines = (text: string) =>
    text
      .replace(/<[^>]+>/g, " ")
      .split("\n")
      .reduce(
        (total, line) => total + Math.max(1, Math.ceil(line.length / 88)),
        0,
      );
  const totalPages = Math.max(1, Math.ceil(visualLines(value) / 42));
  const currentPage = Math.min(
    totalPages,
    Math.max(1, Math.ceil(visualLines(value.slice(0, cursorPosition)) / 42)),
  );
  const currentEditorValue = (): string =>
    reportEditorRef.current?.getHTML() ?? latestValueRef.current;

  /* APP2_TASK_REPORT_EXPLICIT_SAVE_ONLY_V1 - task report drafts never save in the background. */
  const runFooterAction = async (
    action: (latestValue?: string) => unknown | Promise<unknown>,
    failureMessage: string,
    resetDocumentPosition = false,
  ) => {
    if (busy || workflowBusy) return;
    setWorkflowBusy(true);
    setWorkflowMessage("");
    try {
      const result = await action(currentEditorValue());
      if (result === false) throw new Error(failureMessage);
      if (resetDocumentPosition) {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            const stage = document.querySelector<HTMLElement>(
              ".section-workspace-backdrop .section-document-stage",
            );
            stage?.scrollTo({ top: 0, left: 0, behavior: "auto" });
          });
        });
      }
    } catch (error) {
      setWorkflowTone("error");
      setWorkflowMessage(
        error instanceof Error ? error.message : failureMessage,
      );
    } finally {
      setWorkflowBusy(false);
    }
  };
  const selectReportImage = (image: HTMLImageElement | null) => {
    markSelectedReportImage(selectedImage, image);
    setSelectedImage(image);
  };
  const insertImage = async (file?: File) => {
    if (!file) return;

    try {
      const prepared = await prepareReportImage(file);
      const replacement = imageToReplaceRef.current;

      if (replacement) {
        reportEditorRef.current?.updateImage(replacement, {
          src: prepared.src,
          alt: prepared.alt,
        });
      } else {
        reportEditorRef.current?.insertImage(
          prepared.src,
          prepared.alt,
          "70%",
        );
      }

      imageToReplaceRef.current = null;
      selectReportImage(null);
    } catch (error) {
      setWorkflowTone("error");
      setWorkflowMessage(
        error instanceof Error ? error.message : "The image could not be inserted.",
      );
    }
  };
  const importReport = async (file?: File) => {
    if (!file) return;
    setImportingReport(true);
    setReportImportError("");
    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      let html = "";
      if (extension === "pdf") {
        const [{ getDocument, GlobalWorkerOptions }, worker] =
          await Promise.all([
            import("pdfjs-dist"),
            import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
          ]);
        GlobalWorkerOptions.workerSrc = worker.default;
        const pdf = await getDocument({ data: await file.arrayBuffer() })
          .promise;
        const pages: string[] = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const text = await page.getTextContent();
          const content = text.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ")
            .trim();
          pages.push(`<h2>Page ${pageNumber}</h2><p>${safeName(content)}</p>`);
        }
        html = pages.join('<div class="imported-page-break"></div>');
      } else if (["html", "htm", "doc"].includes(extension || "")) {
        const parsed = new DOMParser().parseFromString(
          await file.text(),
          "text/html",
        );
        parsed
          .querySelectorAll("script,style,iframe,object,embed,link,meta")
          .forEach((node) => node.remove());
        parsed.querySelectorAll("*").forEach((node) =>
          [...node.attributes].forEach((attribute) => {
            if (attribute.name.startsWith("on"))
              node.removeAttribute(attribute.name);
          }),
        );
        html = parsed.body.innerHTML;
      } else if (["txt", "md", "markdown"].includes(extension || "")) {
        html = (await file.text())
          .split(/\r?\n/)
          .map((line) => {
            if (line.startsWith("# "))
              return `<h1>${safeName(line.slice(2))}</h1>`;
            if (line.startsWith("## "))
              return `<h2>${safeName(line.slice(3))}</h2>`;
            return line ? `<p>${safeName(line)}</p>` : "<p><br></p>";
          })
          .join("");
      } else if (extension === "docx") {
        throw new Error(
          "Convert this DOCX to PDF or Word 97–2003 (.doc), then import it. REDESY preserves those formats as editable content.",
        );
      } else {
        throw new Error("Use PDF, Word .doc, HTML, text or Markdown.");
      }
      if (!html.trim())
        throw new Error(
          "No readable text was found in this report. A scanned PDF may require OCR first.",
        );
      setSelectedTemplateId("__blank__");
      setTemplatePreviewOpen(false);
      latestValueRef.current = html;
      onChange(html);
    } catch (error) {
      setReportImportError(
        error instanceof Error
          ? error.message
          : "The report could not be imported.",
      );
    } finally {
      setImportingReport(false);
    }
  };
  const setImageWidth = (width: string) => {
    if (!selectedImage) return;
    reportEditorRef.current?.updateImage(selectedImage, { width });
  };
  const alignImage = (alignment: "left" | "center" | "right") => {
    if (!selectedImage) return;
    reportEditorRef.current?.updateImage(selectedImage, { alignment });
  };
  const command = (name: string, argument?: string) => {
    reportEditorRef.current?.executeCommand(name, argument);
  };
  const createEditorLink = () => {
    const href = window.prompt("Enter link address");
    if (!href?.trim()) return;
    command("createLink", href.trim());
  };
  const toggleMaximized = () =>
    setMaximized((current) => {
      const next = !current;
      sessionStorage.setItem(WORKSPACE_SIZE_KEY, String(next));
      return next;
    });
  const selectedTemplate = props.templateOptions?.find(
    (template) => template.id === selectedTemplateId,
  );
  const selectedReportStructure = props.reportTemplateOptions?.find(
    (template) => template.key === reportTemplateKey,
  );
  const selectedReviewer = props.reviewerOptions?.find(
    (reviewer) => reviewer.id === reviewerId,
  );
  const reviewerCount = props.reviewerOptions?.length || 0;
  const readySectionCount = props.readySectionCount || 0;
  const totalSectionCount = props.totalSectionCount || 0;
  const remainingSectionCount = Math.max(
    0,
    totalSectionCount - readySectionCount,
  );
  const blankDocumentMode = selectedTemplateId === "__blank__";
  const blankDocumentText = value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const hasBlankDocumentContent = blankDocumentText.length > 0;
  const effectiveSubmissionReady =
    props.workspaceVariant === "task-report"
      ? hasBlankDocumentContent
      : blankDocumentMode
        ? hasBlankDocumentContent
        : Boolean(props.submissionReady);
  const submissionBlockers = [
    !reviewerId
      ? reviewerCount
        ? "Select a reviewer."
        : "No eligible reviewer is currently available."
      : "",
    !effectiveSubmissionReady
      ? props.workspaceVariant === "task-report"
        ? "Add report content before submitting this Task Report."
        : blankDocumentMode
          ? "Add report content before submitting this blank report."
          : remainingSectionCount
            ? `${remainingSectionCount} report section${
                remainingSectionCount === 1 ? "" : "s"
              } still need drafting.`
            : "The report is not yet marked ready for submission."
      : "",
    busy || workflowBusy ? "Wait for the current operation to finish." : "",
  ].filter(Boolean);
  const submissionBlockerMessage =
    submissionBlockers[0] || "All submission requirements are complete.";
  const submissionActionLabel = !reviewerId
    ? "Select reviewer to submit"
    : !effectiveSubmissionReady
      ? props.workspaceVariant === "task-report"
        ? "Add report content to submit"
        : blankDocumentMode
          ? "Add report content to submit"
          : `Complete ${remainingSectionCount} section${remainingSectionCount === 1 ? "" : "s"} to submit`
      : "Submit to Reviewer";
  const templateMatchesOutline = selectedTemplate?.sections?.every((section) =>
    props.outlineSections?.some((item) => item.id === section.key),
  );
  const displayedOutline = blankDocumentMode
    ? undefined
    : props.workspaceVariant === "task-report"
      ? selectedTemplate?.sections?.length
        ? selectedTemplate.sections.map((section) => ({
            id: section.key,
            title: section.title,
            status: props.outlineSections?.find((item) => item.id === section.key)
              ?.status || "Not Started",
          }))
        : props.outlineSections
      : selectedTemplate?.sections?.length && templateMatchesOutline
        ? selectedTemplate.sections.map((section) => ({
            id: section.key,
            title: section.title,
            status: props.outlineSections?.find((item) => item.id === section.key)
              ?.status,
          }))
        : props.outlineSections;
  const navigateToOutlineSection = (section: { id: string; title: string }) => {
    setActiveOutlineSectionId(section.id);
    const editor = reportEditorHostRef.current?.querySelector<HTMLElement>(
      ".app2-lexical-document",
    );
    const normalizeHeading = (text: string) =>
      text
        .replace(/&nbsp;|&#160;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLocaleLowerCase();
    const headingAliases: Record<string, string[]> = {
      title: ["output title", "field activity title"],
      workCompleted: ["work completed", "activity completed"],
      evidence: ["evidence reviewed", "observations and evidence"],
      findings: ["key findings", "findings"],
      recommendations: ["recommendations", "recommended action"],
      challenges: ["challenges or limitations", "limitations"],
      nextActions: ["next actions", "follow-up actions", "follow up actions"],
    };
    const wanted = [section.title, ...(headingAliases[section.id] || [])].map(
      normalizeHeading,
    );
    const heading = editor
      ? Array.from(editor.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6"))
          .find((node) => wanted.includes(normalizeHeading(node.innerText || node.textContent || "")))
      : undefined;
    (heading || editor)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const findNext = () => {
    const editor =
      reportEditorHostRef.current?.querySelector<HTMLElement>(
        ".app2-lexical-document",
      ) ?? null;
    if (!editor || !find) return;
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const index = (node.textContent || "")
        .toLowerCase()
        .indexOf(find.toLowerCase());
      if (index >= 0) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + find.length);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        editor.focus();
        return;
      }
      node = walker.nextNode();
    }
  };
  const formattedHtml = () => {
    const normalizedValue = normalizeReportHtml(value);
    if (/<[a-z][\s\S]*>/i.test(normalizedValue)) {
      return sanitizeReportHtmlForEditor(normalizedValue);
    }
    return normalizedValue
      .split("\n")
      .map((line) => {
        let safe = line
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;");
        safe = safe
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/_(.+?)_/g, "<em>$1</em>")
          .replace(/\+\+(.+?)\+\+/g, "<u>$1</u>")
          .replace(/~~(.+?)~~/g, "<s>$1</s>")
          .replace(
            /\[font=([^\]]+)]\[size=(\d+)](.+?)\[\/size]\[\/font]/g,
            '<span style="font-family:$1;font-size:$2pt">$3</span>',
          )
          .replace(
            /\[align=(left|center|right|justify)](.+?)\[\/align]/g,
            '<span style="display:block;text-align:$1">$2</span>',
          );
        if (safe.startsWith("## ")) return `<h3>${safe.slice(3)}</h3>`;
        if (safe.startsWith("# ")) return `<h2>${safe.slice(2)}</h2>`;
        return safe ? `<p>${safe}</p>` : "<p><br></p>";
      })
      .join("");
  };
  const safeName = (text: string) =>
    text.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const downloadTemplate = () => {
    const template = selectedTemplate || props.templateOptions?.[0];
    if (!template) return;
    const sections = template.sections?.length
      ? template.sections
          .map((section) => `<h2>${safeName(section.title)}</h2><p><br></p>`)
          .join("")
      : "<p><br></p>";
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:22mm}body{font-family:Calibri,sans-serif;font-size:11pt;line-height:1.5}h1{margin-bottom:1.2cm}h2{margin-top:1cm}</style></head><body><h1>${safeName(template.name)}</h1>${sections}</body></html>`;
    const url = URL.createObjectURL(
      new Blob([html], { type: "application/msword" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${template.name}-blank-template.doc`.replace(
      /[^a-z0-9.-]+/gi,
      "-",
    );
    link.click();
    URL.revokeObjectURL(url);
  };
  const applySelectedTemplateStructure = async () => {
    const selection = selectedTemplateId;
    if (!selection || selection === "__blank__" || selection === "__download__") return;
    const template = props.templateOptions?.find((item) => item.id === selection);
    if (!template) return;
    if (props.onApplyDocumentTemplate && selection !== props.currentTemplateId) {
      if (!window.confirm(`Change the report outline to “${template.name}”? Matching section content will be preserved, but drafted sections absent from the new template will be removed.`)) return;
      await props.onApplyDocumentTemplate(selection);
      return;
    }

    if (props.workspaceVariant === "task-report" && template.sections?.length) {
      const currentHtml = String(currentEditorValue() || "");
      const normalizedHeading = (html: string) =>
        html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ")
          .replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim().toLocaleLowerCase();
      const existingHeadings = new Set(
        Array.from(currentHtml.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi))
          .map((match) => normalizedHeading(match[1])),
      );
      const missingSections = template.sections.filter((section) =>
        !existingHeadings.has(normalizedHeading(section.title)),
      );
      if (!missingSections.length) return;
      const hasBody = currentHtml.replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
      const parsed = new DOMParser().parseFromString(hasBody ? currentHtml : "", "text/html");
      const templatePositions = new Map<string, number>(
        template.sections.map((section, index) => [normalizedHeading(section.title), index]),
      );
      missingSections.forEach((section) => {
        const sectionIndex = templatePositions.get(normalizedHeading(section.title)) ?? -1;
        const heading = parsed.createElement("h2");
        heading.textContent = section.title;
        const placeholder = parsed.createElement("p");
        placeholder.append(parsed.createElement("br"));
        const insertion = parsed.createDocumentFragment();
        insertion.append(heading, placeholder);
        const nextTemplateHeading = Array.from(
          parsed.body.querySelectorAll("h1,h2,h3,h4,h5,h6"),
        ).find((candidate) => {
          const candidatePosition = templatePositions.get(normalizedHeading(candidate.innerHTML));
          return candidatePosition !== undefined && candidatePosition > sectionIndex;
        });
        if (nextTemplateHeading?.parentNode) {
          nextTemplateHeading.parentNode.insertBefore(insertion, nextTemplateHeading);
        } else {
          parsed.body.append(insertion);
        }
      });
      const nextHtml = parsed.body.innerHTML;
      latestValueRef.current = nextHtml;
      reportEditorRef.current?.setHTML(nextHtml);
      props.onChange(nextHtml);
      scheduleTaskReportAutoSave();
    }
  };

  const selectTemplate = async (selection: string) => {
    if (selection === "__blank__") {
      setSelectedTemplateId("__blank__");
      persistTaskTemplateId("__blank__");
      setTemplatePreviewOpen(false);
      return;
    }
    if (selection === "__download__") {
      downloadTemplate();
      return;
    }
    setSelectedTemplateId(selection);
    setTemplatePreviewOpen(false);
    persistTaskTemplateId(selection);
  };
  const downloadWord = () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Calibri,sans-serif;margin:2.5cm;font-size:11pt;line-height:1.5}</style></head><body><h1>${safeName(reportTitle)}</h1><h2>${safeName(title)}</h2>${formattedHtml()}<footer>Page 1 of ${totalPages}</footer></body></html>`;
    const url = URL.createObjectURL(
      new Blob([html], { type: "application/msword" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${reportTitle}-${title}.doc`.replace(
      /[^a-z0-9.-]+/gi,
      "-",
    );
    link.click();
    URL.revokeObjectURL(url);
  };
  const printSection = () => {
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) return;
    popup.document.write(
      `<!doctype html><html><head><title>${safeName(title)}</title><style>@page{size:A4;margin:22mm}body{font-family:Calibri,sans-serif;font-size:11pt;line-height:1.55}</style></head><body><h1>${safeName(reportTitle)}</h1><h2>${safeName(title)}</h2>${formattedHtml()}</body></html>`,
    );
    popup.document.close();
    popup.focus();
    popup.print();
  };

  return createPortal(
    <div
      className="section-workspace-backdrop app2-report-builder"
      role="dialog"
      aria-modal="true"
      aria-hidden={props.suspended || undefined}
      style={props.suspended ? { visibility: "hidden", pointerEvents: "none" } : undefined}
      aria-label={`${editMode ? "Edit" : "Review"} ${title}`}
    >
      <section
        className={`section-workspace-shell${maximized ? " maximized" : ""}${props.workspaceVariant === "assignment-report" ? " assignment-report-v2" : ""}${props.workspaceVariant === "task-report" ? " task-report-builder-v1 task-report-builder-refined" : ""}`}
        data-workspace-variant={props.workspaceVariant || "default"}
      >
        <header>
          <div>
            <small>
              {props.workspaceVariant === "task-report"
                ? editMode
                  ? "TASK REPORT · EDITING DOCUMENT"
                  : "TASK REPORT · PREVIEWING DOCUMENT"
                : editMode
                  ? "EDITING REPORT SECTION"
                  : "PREVIEWING REPORT SECTION"}
              {props.workspaceVariant !== "task-report" &&
              props.sectionNumber &&
              props.sectionCount
                ? ` · ${props.sectionNumber} OF ${props.sectionCount}`
                : ""}
            </small>
            <h2>{title}</h2>
            <p>{contextTitle || reportTitle}</p>
            {props.statusMessage && (
              <div
                className={`section-workspace-feedback ${props.statusTone || "info"}`}
                role={props.statusTone === "error" ? "alert" : "status"}
              >
                {props.statusMessage}
              </div>
            )}
            {props.reviewerOptionsError && (
              <div className="task-reviewer-load-error" role="alert">
                <span>Reviewers could not be loaded: {props.reviewerOptionsError}</span>
                <button type="button" disabled={props.reviewerOptionsLoading} onClick={props.onRetryReviewerOptions}>
                  {props.reviewerOptionsLoading ? "Retrying…" : "Retry reviewer list"}
                </button>
              </div>
            )}
            {!!props.linkedWorkItems?.length && (
              <>
                <div
                  className="workspace-linked-work"
                  aria-label={`${props.linkedWorkLabel || "Add from task"} to this section`}
                >
                  <span>{props.linkedWorkLabel || "Add from task"}</span>
                  <select
                    aria-label={
                      props.linkedWorkPlaceholder || "Completed assignment task"
                    }
                    value={linkedWorkItemId}
                    onChange={(event) => {
                      setLinkedWorkItemId(event.target.value);
                      setLinkedWorkError("");
                    }}
                  >
                    <option value="">
                      {props.linkedWorkPlaceholder || "Choose completed task"}
                    </option>
                    {props.linkedWorkItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                        {item.status ? ` — ${item.status}` : ""}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Destination report section"
                    value={linkedWorkSectionId}
                    onChange={(event) => {
                      setLinkedWorkSectionId(event.target.value);
                      setLinkedWorkError("");
                    }}
                  >
                    <option value="">Choose report section</option>
                    {props.outlineSections?.map((item) => (
                      <option key={item.id} value={item.id}>{item.title}</option>
                    ))}
                  </select>
                  {props.onInsertLinkedWorkItem && (
                    <button
                      type="button"
                      disabled={!linkedWorkItemId || !linkedWorkSectionId || insertingLinkedWork}
                      onClick={async () => {
                        setInsertingLinkedWork(true);
                        setLinkedWorkError("");
                        try {
                          await props.onInsertLinkedWorkItem?.(
                            linkedWorkItemId,
                            linkedWorkSectionId,
                          );
                          setLinkedWorkItemId("");
                        } catch (error) {
                          setLinkedWorkError(
                            error instanceof Error
                              ? error.message
                              : "The selected item could not be attached.",
                          );
                        } finally {
                          setInsertingLinkedWork(false);
                        }
                      }}
                    >
                      {insertingLinkedWork
                        ? "Adding…"
                        : `${props.linkedWorkActionLabel || "Add to"} ${props.outlineSections?.find((item) => item.id === linkedWorkSectionId)?.title || "report section"}`}
                    </button>
                  )}
                  {props.workspaceVariant === "assignment-report" &&
                    !!props.templateOptions?.length && (
                      <label className="assignment-header-template-picker">
                        <span>Assignment template</span>
                        <select
                          aria-label="Assignment report template"
                          value={selectedTemplateId}
                          onChange={(event) =>
                            void selectTemplate(event.target.value)
                          }
                        >
                          {props.templateOptions.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                </div>
                {linkedWorkError && (
                  <small className="workspace-linked-work-error">
                    {linkedWorkError}
                  </small>
                )}
              </>
            )}
          </div>
          <div className="section-workspace-state">
            <strong className={`section-editability ${editMode ? "editable" : "readonly"}`}>
              {editMode ? "EDITABLE" : "READ ONLY"}
            </strong>
            <small>STATUS</small>
            <span
              className={`section-status section-${status.toLowerCase().replaceAll(" ", "-")}`}
            >
              {status}
            </span>
          </div>
          <div className="section-window-actions">
            {props.closeLabel && (
              <button
                type="button"
                className="section-return-button"
                onClick={() => void requestClose()}
              >
                {props.closeLabel}
              </button>
            )}
            <button type="button" onClick={toggleMaximized}>
              {maximized ? "Minimize" : "Maximize"}
            </button>
            <button
              type="button"
              aria-label="Close section workspace"
              onClick={() => void requestClose()}
            >
              ×
            </button>
          </div>
        </header>
        {props.workspaceVariant === "task-report" && editMode && (
          <section className="task-report-governance-bar" aria-label="Task report governance">
            <TaskReportReviewerPicker
              options={props.reviewerOptions || []}
              value={reviewerId}
              busy={busy || workflowBusy}
              onChange={(nextReviewerId) => persistTaskReviewerChoice(nextReviewerId)}
              label="Reviewer for this Task Report"
            />
            <div className="task-report-governance-state" role="status">
              <div className="task-report-review-meta" aria-label="Task report readiness">
                <span>
                  <small>Document</small>
                  <strong>Task Report</strong>
                </span>
                <span>
                  <small>Reviewer</small>
                  <strong>{selectedReviewer?.name || "Select reviewer"}</strong>
                </span>
                <span>
                  <small>Structure</small>
                  <strong>{blankDocumentMode ? "Blank document" : selectedTemplate?.name || "Task report"}</strong>
                </span>
                <span className={effectiveSubmissionReady && reviewerId ? "ready" : "action-required"}>
                  <small>Status</small>
                  <strong>{effectiveSubmissionReady && reviewerId ? "Ready for review" : submissionBlockerMessage}</strong>
                </span>
              </div>
              <div className="task-report-primary-actions" aria-label="Task report primary actions">
                <button
                  type="button"
                  className="primary task-report-save-primary"
                  disabled={workflowBusy}
                  onClick={() => void handleSaveDraft()}
                >
                  {workflowAction === "save" || busy ? "Saving..." : "Save Draft"}
                </button>
                <button
                  type="button"
                  className="task-report-preview-primary"
                  disabled={workflowBusy}
                  onClick={handlePreview}
                >
                  {workflowAction === "preview" ? "Opening..." : "Preview"}
                </button>
              </div>
              {(workflowMessage || props.statusMessage) && (
                <div
                  className={`task-report-action-feedback ${
                    workflowMessage ? workflowTone : props.statusTone || "info"
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {workflowMessage || props.statusMessage}
                </div>
              )}
              <div className={`task-report-save-status ${saveState}`} role="status" aria-live="polite">
                {saveState === "saving"
                    ? "Saving draft changes…"
                    : saveState === "conflict"
                    ? workflowMessage || "A newer draft was saved in another session. Copy any unsaved text, then reload this task before continuing."
                    : saveState === "error"
                      ? workflowMessage || "Draft save failed. Your edits remain open; retry Save Draft."
                      : saveState === "saved" && lastSavedAt
                        ? `Draft saved at ${lastSavedAt}`
                        : "Draft changes save automatically after a short pause. You can also save or preview at any time."}
              </div>
            </div>
          </section>
        )}
                <div className="document-ribbon">
          <div className="report-command-row">
            <nav className="ribbon-tabs" aria-label="Document ribbon">
            {[
              "Home",
              "Insert",
              "Layout",
              "References",
              "Review",
              "View",
              ...(props.reportTemplateOptions?.length || props.templateOptions?.length
                ? ["Templates"]
                : []),
            ].map((tab) => (
              <button
                type="button"
                key={tab}
                className={activeRibbonTab === tab ? "active" : ""}
                aria-pressed={activeRibbonTab === tab}
                onClick={() => openRibbonTab(tab)}
              >
                {tab}
              </button>
            ))}
            </nav>
            <div className="report-command-workflow-slot">
            {["assignment-report", "task-report"].includes(
              props.workspaceVariant || "",
            ) &&
              (props.workspaceVariant === "task-report" ||
                activeRibbonTab === "Review") && (
                <section
                  className="report-review-workflow"
                  aria-label={
                    props.workspaceVariant === "task-report"
                      ? "Task report workflow"
                      : "Assignment report workflow"
                  }
                >
            {props.workspaceVariant !== "task-report" && (
              <div className="assignment-report-editor-status">
                <span>
                  {props.externalReport
                    ? `External report v${props.externalReport.version_number}: ${props.externalReport.original_name}`
                    : `${props.readySectionCount || 0}/${props.totalSectionCount || 0} drafted`}
                </span>
              </div>
            )}
            {props.onSubmitForReview && props.workspaceVariant !== "task-report" && (
              <>
                <div
                  className={`report-compact-readiness ${
                    props.submissionReady ? "ready" : "incomplete"
                  }`}
                  aria-label="Report submission readiness"
                  title={submissionBlockerMessage}
                >
                  <strong>
                    {readySectionCount}/{totalSectionCount} drafted
                  </strong>
                  <span aria-hidden="true">·</span>
                  <span>
                    {props.submissionReady
                      ? "Ready for review"
                      : `${Math.max(totalSectionCount - readySectionCount, 0)} sections remaining`}
                  </span>
                </div>

                <div className="report-readiness-contract" role="status">
                  <span>Submission readiness</span>
                  <span>
                    {selectedReviewer
                      ? `Reviewer: ${selectedReviewer.name}`
                      : "Reviewer"}
                  </span>
                  <span>
                    {selectedReportStructure
                      ? `Report structure: ${selectedReportStructure.name}`
                      : "Report structure"}
                  </span>
                  <span>Sections drafted</span>
                  <span>
                    {props.submissionReady && reviewerId
                      ? "Ready to submit"
                      : "Action required"}
                  </span>
                  <span>{submissionBlockerMessage}</span>
                </div>
              </>
            )}
            {(props.workspaceVariant === "task-report" ||
              props.canSubmitForReview) &&
              props.onSubmitForReview && (
              <div className="assignment-report-submit-inline">
                {!props.reviewerLocked && props.workspaceVariant !== "task-report" && (
                  <select className="report-reviewer-select"
                    aria-label="Reviewer"
                    value={reviewerId}
                    onChange={(event) => setReviewerId(event.target.value)}
                  >
                    <option value="">Select reviewer</option>
                    {props.reviewerOptions?.map((reviewer) => (
                      <option key={reviewer.id} value={reviewer.id}>
                        {reviewer.name} — {reviewer.role}
                      </option>
                    ))}
                  </select>
                )}
                {props.submissionNoteEnabled !== false && (
                  <input className="report-submission-note"
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    placeholder="Submission note (optional)"
                  />
                )}
                <button
                  type="button"
                  className="report-action-submit primary"
                  disabled={busy || workflowBusy}
                  aria-disabled={submissionBlockers.length > 0}
                  title={
                    submissionBlockers.length
                      ? submissionBlockerMessage
                      : "Submit the completed report to the selected reviewer."
                  }
                  onClick={() => {
                    const latestValue = currentEditorValue();
                    const latestTaskText = latestValue
                      .replace(/<[^>]+>/g, " ")
                      .replace(/&nbsp;|&#160;/gi, " ")
                      .replace(/\s+/g, " ")
                      .trim();
                    const blockers = props.workspaceVariant === "task-report"
                      ? [
                          !reviewerId
                            ? reviewerCount
                              ? "Select a reviewer."
                              : "No eligible reviewer is currently available."
                            : "",
                          !latestTaskText
                            ? "Add report content before submitting this Task Report."
                            : "",
                        ].filter(Boolean)
                      : submissionBlockers;
                    if (blockers.length) {
                      setWorkflowTone("error");
                      setWorkflowMessage(blockers[0]);
                      return;
                    }
                    if (!reviewerId) return;
                    setWorkflowBusy(true);
                    setWorkflowMessage("");
                    void Promise.resolve(
                      props.onSubmitForReview?.(
                        reviewerId,
                        reviewNote.trim(),
                        latestValue,
                      ),
                    )
                      .then(() => {
                        setWorkflowTone("success");
                        setWorkflowMessage("Report submitted to reviewer.");
                      })
                      .catch((error) => {
                        setWorkflowTone("error");
                        setWorkflowMessage(
                          error instanceof Error
                            ? error.message
                            : "The report could not be submitted.",
                        );
                      })
                      .finally(() => setWorkflowBusy(false));
                  }}
                >
                  {workflowBusy ? "Working..." : submissionActionLabel}
                </button>
              </div>
            )}
            {workflowMessage && (
              <div className={`assignment-report-workflow-message ${workflowTone}`}>
                {workflowMessage}
              </div>
            )}
          
              {props.externalReport && props.onOpenExternalReport && (
                <button
                  type="button"
                  className="secondary"
                  disabled={busy || workflowBusy}
                  onClick={() => void props.onOpenExternalReport?.()}
                >
                  Open Imported Report
                </button>
              )}
                </section>
              )}
            </div>
            <div className="assignment-report-editor-buttons report-command-actions">
              {editMode && props.workspaceVariant !== "task-report" && (
                <button
                  type="button"
                  className="primary report-action-save"
                  title="Save the current report draft"
                  disabled={busy || workflowBusy}
                  onClick={handleSaveDraft}
                >
                  Save Draft
                </button>
              )}
              {props.workspaceVariant !== "task-report" && (
              <button
                type="button"
                className="report-action-preview"
                title="Preview the full report"
                disabled={busy || workflowBusy}
                onClick={handlePreview}
              >
                {preview ? "Return to Edit" : "Preview"}
              </button>
              )}
              {props.canImportExternalReport && (
                <>
                  <button
                    type="button"
                    className="report-action-import"
                    title="Import a PDF or DOCX report for formal review"
                    disabled={busy || workflowBusy}
                    onClick={() => externalReportInputRef.current?.click()}
                  >
                    Import
                  </button>
                  <input
                    ref={externalReportInputRef}
                    hidden
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      if (!file || !props.onImportExternalReport) return;
                      setWorkflowBusy(true);
                      setWorkflowMessage("");
                      void Promise.resolve(props.onImportExternalReport(file))
                        .then(() => {
                          setWorkflowTone("success");
                          setWorkflowMessage("External report imported and preserved for formal review.");
                        })
                        .catch((error) => {
                          setWorkflowTone("error");
                          setWorkflowMessage(
                            error instanceof Error
                              ? error.message
                              : "The external report could not be imported.",
                          );
                        })
                        .finally(() => setWorkflowBusy(false));
                    }}
                  />
                </>
              )}
            </div>
          </div>
          <nav
            className="section-word-toolbar"
            aria-label="Document tools"
            data-active-tab={activeRibbonTab}
          >
            {props.workspaceVariant === "task-report" &&
              activeRibbonTab === "References" && (
                <div className="task-report-ribbon-empty">
                  References tools are not required for this TASK Report.
                </div>
              )}
            {editMode && (
              <>
{(props.workspaceVariant !== "task-report" || activeRibbonTab === "Home") && (
                  <>
                <div className="ribbon-group history-tools">
                  <button
                    type="button"
                    title="Undo"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => command("undo")}
                  >
                    ↶
                  </button>
                  <button
                    type="button"
                    title="Redo"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => command("redo")}
                  >
                    ↷
                  </button>
                  <small>History</small>
                </div>
                  </>
                )}
{(props.workspaceVariant !== "task-report" || activeRibbonTab === "Home") && (
                  <>
                <div className="ribbon-group font-tools">
                  <span>
                    <select
                      aria-label="Font family"
                      value={fontFamily}
                      onChange={(event) => {
                        setFontFamily(event.target.value);
                        command("fontName", event.target.value);
                      }}
                    >
                      <option>Calibri</option>
                      <option>Arial</option>
                      <option>Times New Roman</option>
                      <option>Georgia</option>
                      <option>Verdana</option>
                    </select>
                    <select
                      aria-label="Font size"
                      value={fontSize}
                      onChange={(event) => {
                        setFontSize(event.target.value);
                        command("fontSize", event.target.value);
                      }}
                    >
                      {[9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32].map(
                        (size) => (
                          <option key={size}>{size}</option>
                        ),
                      )}
                    </select>
                  </span>
                  <span>
                    <button
                      type="button"
                      title="Bold"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => command("bold")}
                    >
                      Bold
                    </button>
                    <button
                      type="button"
                      title="Italic"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => command("italic")}
                    >
                      Italic
                    </button>
                    <button
                      type="button"
                      title="Underline"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => command("underline")}
                    >
                      Underline
                    </button>
                    <button
                      type="button"
                      title="Strikethrough"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => command("strikeThrough")}
                    >
                      Strike
                    </button>
                  </span>
                  <small>Font</small>
                </div>
                  </>
                )}
{(props.workspaceVariant !== "task-report" || activeRibbonTab === "Home") && (
                  <>
                <div className="ribbon-group paragraph-tools">
                  <span>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => command("insertUnorderedList")}
                    >
                      • List
                    </button>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => command("insertOrderedList")}
                    >
                      1. List
                    </button>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => command("indent")}
                    >
                      Increase indent
                    </button>
                  </span>
                  <span>
                    <button
                      type="button"
                      title="Align left"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => command("justifyLeft")}
                    >
                      Left
                    </button>
                    <button
                      type="button"
                      title="Align center"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => command("justifyCenter")}
                    >
                      Centre
                    </button>
                    <button
                      type="button"
                      title="Align right"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => command("justifyRight")}
                    >
                      Right
                    </button>
                    <button
                      type="button"
                      title="Justify"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => command("justifyFull")}
                    >
                      Justify
                    </button>
                  </span>
                  <small>Paragraph</small>
                </div>
                  </>
                )}
{(props.workspaceVariant !== "task-report" || activeRibbonTab === "Layout") && (
                  <>
                <div className="ribbon-group layout-tools">
                  <span>
                    <button
                      type="button"
                      title="Decrease indent"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => command("outdent")}
                    >
                      Decrease indent
                    </button>
                    <button
                      type="button"
                      title="Increase indent"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => command("indent")}
                    >
                      Increase indent
                    </button>
                  </span>
                  <span>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => command("justifyLeft")}
                    >
                      Align left
                    </button>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => command("justifyCenter")}
                    >
                      Centre
                    </button>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => command("justifyRight")}
                    >
                      Align right
                    </button>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => command("justifyFull")}
                    >
                      Justify
                    </button>
                  </span>
                  <small>Layout</small>
                </div>
                  </>
                )}
{(props.workspaceVariant !== "task-report" || activeRibbonTab === "Home") && (
                  <>
                <div className="ribbon-group styles-tools">
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => command("formatBlock", "p")}
                  >
                    Paragraph
                  </button>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => command("formatBlock", "h2")}
                  >
                    Heading 1
                  </button>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => command("formatBlock", "h3")}
                  >
                    Heading 2
                  </button>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => command("formatBlock", "blockquote")}
                  >
                    Quote
                  </button>
                  <small>Styles</small>
                </div>
                  </>
                )}
{(props.workspaceVariant !== "task-report" || activeRibbonTab === "Insert") && (
                  <>
                <div className="ribbon-group insert-tools">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                  >
                    Image
                  </button>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    hidden
                    onChange={(event) => {
                      insertImage(event.target.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                  />
                  <small>Insert</small>
                </div>
                <div className="ribbon-group table-tools">
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("insertTable")}>
                    Insert table
                  </button>
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("addRowAfter")}>
                    Add row
                  </button>
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("deleteRow")}>
                    Delete row
                  </button>
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("addColumnAfter")}>
                    Add column
                  </button>
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("deleteColumn")}>
                    Delete column
                  </button>
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("toggleHeaderRow")}>
                    Header row
                  </button>
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("mergeCells")}>
                    Merge cells
                  </button>
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("splitCell")}>
                    Split cell
                  </button>
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("deleteTable")}>
                    Delete table
                  </button>
                  <small>Table</small>
                </div>
                  </>
                )}
                {selectedImage &&
                  (props.workspaceVariant !== "task-report" || activeRibbonTab === "Insert") && (
                  <div className="ribbon-group image-tools">
                    <span>
                      <button
                        type="button"
                        onClick={() => setImageWidth("40%")}
                      >
                        Small
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageWidth("70%")}
                      >
                        Medium
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageWidth("100%")}
                      >
                        Full
                      </button>
                    </span>
                    <span>
                      <button
                        type="button"
                        title="Align image left"
                        onClick={() => alignImage("left")}
                      >
                        Left
                      </button>
                      <button
                        type="button"
                        title="Centre image"
                        onClick={() => alignImage("center")}
                      >
                        Centre
                      </button>
                      <button
                        type="button"
                        title="Align image right"
                        onClick={() => alignImage("right")}
                      >
                        Right
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          imageToReplaceRef.current = selectedImage;
                          imageInputRef.current?.click();
                        }}
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const alt = window.prompt(
                            "Describe this image for accessibility",
                            selectedImage.alt,
                          );
                          if (alt !== null) {
                            reportEditorRef.current?.updateImage(
                              selectedImage,
                              { alt: alt.trim() },
                            );
                            selectReportImage(null);
                          }
                        }}
                      >
                        Alt text
                      </button>
                      <button
                        type="button"
                        className="image-remove"
                        onClick={() => {
                          reportEditorRef.current?.removeImage(selectedImage);
                          selectReportImage(null);
                        }}
                      >
                        Remove
                      </button>
                    </span>
                    <small>Selected image</small>
                  </div>
                )}
{(props.workspaceVariant !== "task-report" || activeRibbonTab === "Review") && (
                  <>
                <div className="ribbon-group editing-tools">
                  <label>
                    Find
                    <input
                      value={find}
                      onChange={(event) => setFind(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          findNext();
                        }
                      }}
                    />
                  </label>
                  <button type="button" onClick={findNext}>
                    Find next
                  </button>
                  <button
                    type="button"
                    title="Create link"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={createEditorLink}
                  >
                    Link
                  </button>
                  <button
                    type="button"
                    title="Remove link"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => command("unlink")}
                  >
                    Unlink
                  </button>
                  <button
                    type="button"
                    title="Clear formatting"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => command("removeFormat")}
                  >
                    Clear formatting
                  </button>
                  <button
                    type="button"
                    className={preview ? "active-view" : ""}
                    onClick={() => {
                      if (props.onPreviewReport) {
                        void props.onPreviewReport(
                          currentEditorValue(),
                        );
                        return;
                      }
                      setPreview((current) => !current);
                    }}
                  >
                    {preview ? "Edit" : "Preview"}
                  </button>
                  <small>Review & preview</small>
                </div>
                  </>
                )}
              </>
            )}
            {!!props.reportTemplateOptions?.length &&
              (props.workspaceVariant !== "task-report" || activeRibbonTab === "Templates") && (
              <div className="ribbon-group report-template-tools">
                <label className="workspace-report-template-picker">
                  Report template
                  <select
                    aria-label="Report structure template"
                    value={reportTemplateKey}
                    disabled={reportTemplateBusy}
                    onChange={(event) => {
                      setReportTemplateKey(event.target.value);
                      setReportTemplateMessage("");
                    }}
                  >
                    <option value="">Choose report structure</option>
                    {props.reportTemplateOptions.map((template) => (
                      <option key={template.key} value={template.key}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="primary"
                  disabled={!reportTemplateKey || reportTemplateBusy}
                  onClick={() => {
                    if (!reportTemplateKey || !props.onApplyReportTemplate) return;
                    setReportTemplateBusy(true);
                    setReportTemplateMessage("Updating outline...");
                    void Promise.resolve(
                      props.onApplyReportTemplate(reportTemplateKey),
                    )
                      .then(() => {
                        setReportTemplateMessage("Report outline updated.");
                        setReportTemplateKey("");
                      })
                      .catch((error) => {
                        setReportTemplateMessage(
                          error instanceof Error
                            ? error.message
                            : "Template could not be applied.",
                        );
                      })
                      .finally(() => setReportTemplateBusy(false));
                  }}
                >
                  {reportTemplateBusy ? "Applying..." : "Apply to Outline"}
                </button>
                <small>
                  {reportTemplateMessage ||
                    `${props.reportTemplateOptions.length} report structures`}
                </small>
              </div>
            )}
            {!!props.templateOptions?.length &&
              (props.workspaceVariant !== "task-report" || activeRibbonTab === "Templates") &&
              (props.workspaceVariant !== "assignment-report" || activeRibbonTab === "Templates") && (
              <div className="ribbon-group template-tools">
                <label className="workspace-template-picker">
                  Template
                  <select
                    aria-label="Document template"
                    value={selectedTemplateId}
                    onChange={(event) => void selectTemplate(event.target.value)}
                  >
                    <option value="">Select approved template</option>
                    <option value="__blank__">
                      Blank document (no template)
                    </option>
                    {props.templateOptions.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                    <option value="__download__">
                      Download selected template
                    </option>
                  </select>
                </label>
                {props.workspaceVariant === "task-report" && (
                  <button
                    type="button"
                    className="task-report-template-details-toggle"
                    onClick={() => setTemplatePreviewOpen((open) => !open)}
                    aria-expanded={templatePreviewOpen}
                  >
                    {templatePreviewOpen ? "Hide details" : "Template details"}
                  </button>
                )}
                {props.workspaceVariant === "task-report" && selectedTemplate?.sections?.length ? (
                  <button
                    type="button"
                    onClick={() => void applySelectedTemplateStructure()}
                    title="Add any missing template headings to the end of the current document"
                  >
                    Insert missing headings
                  </button>
                ) : null}
                <>
                    <button
                      type="button"
                      disabled={importingReport}
                      onClick={() => reportImportInputRef.current?.click()}
                    >
                      {importingReport ? "Importing…" : "Import into section"}
                    </button>
                    <input
                      ref={reportImportInputRef}
                      hidden
                      type="file"
                      accept=".pdf,.doc,.docx,.html,.htm,.txt,.md,.markdown"
                      onChange={(event) => {
                        void importReport(event.target.files?.[0]);
                        event.currentTarget.value = "";
                      }}
                    />
                </>
                <small>Template & import</small>
              </div>
            )}
{(props.workspaceVariant !== "task-report" || activeRibbonTab === "View") && (
                  <>
            <div className="ribbon-group view-tools">
              <button type="button" onClick={toggleMaximized}>
                {maximized ? "Window view" : "Full screen"}
              </button>
              <small>View</small>
            </div>
                  </>
                )}
{(props.workspaceVariant !== "task-report" || activeRibbonTab === "View") && (
                  <>
            <div className="ribbon-group output-tools">
              <button type="button" onClick={downloadWord}>
                Word
              </button>
              <button type="button" onClick={printSection}>
                Print
              </button>
              <small>Output</small>
            </div>
                  </>
                )}
          </nav>
        </div>
        {templatePreviewOpen && selectedTemplate && (
          <aside className="workspace-template-preview">
            <header>
              <div>
                <small>APPROVED TEMPLATE</small>
                <strong>{selectedTemplate.name}</strong>
                <p>
                  {selectedTemplate.description ||
                    "Controlled document structure"}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close template preview"
                onClick={() => setTemplatePreviewOpen(false)}
              >
                ×
              </button>
            </header>
            <ol>
              {selectedTemplate.sections?.map((section, index) => (
                <li key={section.key}>
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <span>{section.title}</span>
                </li>
              ))}
            </ol>
            <footer>
              <span>
                {selectedTemplate.sections?.length || 0} controlled sections
              </span>
              <button
                type="button"
                onClick={() => setTemplatePreviewOpen(false)}
              >
                Keep selected
              </button>
            </footer>
          </aside>
        )}
        {reportImportError && (
          <div className="workspace-import-error" role="alert">
            <span>{reportImportError}</span>
            <button type="button" onClick={() => setReportImportError("")}>
              Dismiss
            </button>
          </div>
        )}
        <div
          className={`section-document-stage${blankDocumentMode ? " blank-document-mode" : ""}`}
        >
          {!!displayedOutline?.length && (
            <aside
              className={`workspace-section-outline${props.workspaceVariant === "task-report" ? " task-report-outline" : ""}`}
              aria-label={props.workspaceVariant === "task-report" ? "Task report outline" : "Report outline"}
            >
              <header>
                <small>{props.workspaceVariant === "task-report" ? "TASK REPORT OUTLINE" : "REPORT OUTLINE"}</small>
                <strong>{displayedOutline.length} sections</strong>
              </header>
              {props.workspaceVariant === "task-report" && selectedTemplate?.name && (
                <div className="task-report-outline-template" title={selectedTemplate.name}>
                  {selectedTemplate.name}
                </div>
              )}
              {props.workspaceVariant === "task-report" ? (
                <>
                  {(() => {
                    const groups: { label: string; ids: string[] }[] = [
                    { label: "REPORT IDENTITY", ids: ["title"] },
                    { label: "WORK & EVIDENCE", ids: ["workCompleted", "evidence", "findings"] },
                    { label: "ACTIONS & FOLLOW-UP", ids: ["recommendations", "challenges", "nextActions"] },
                    ];
                    const knownIds = new Set(groups.flatMap((group) => group.ids));
                    const allGroups = [
                      ...groups,
                      {
                        label: "OTHER SECTIONS",
                        ids: displayedOutline
                          .map((section) => section.id)
                          .filter((id) => !knownIds.has(id)),
                      },
                    ];
                    return allGroups.map((group) => {
                    const sections = displayedOutline
                      .map((section, index) => ({ section, index }))
                      .filter(({ section }) => group.ids.some((id: string) => id === section.id));
                    if (!sections.length) return null;
                    return (
                      <section className="task-report-outline-group" key={group.label}>
                        <h2>{group.label}</h2>
                        {sections.map(({ section, index }) => (
                          <button
                            key={section.id}
                            type="button"
                            className={section.id === activeOutlineSectionId ? "active" : ""}
                            aria-current={section.id === activeOutlineSectionId ? "location" : undefined}
                            onClick={() => navigateToOutlineSection(section)}
                          >
                            <b>{String(index + 1).padStart(2, "0")}</b>
                            <span>
                              <strong>{section.title}</strong>
                              <small data-status={section.status || "Not Started"}>{section.status || "Not Started"}</small>
                            </span>
                          </button>
                        ))}
                      </section>
                    );
                    });
                  })()}
                </>
              ) : displayedOutline.map((section, index) => (
                <button
                  key={section.id}
                  type="button"
                  className={
                    section.id === props.currentSectionId ? "active" : ""
                  }
                  onClick={() =>
                    void props.onSelectSection?.(
                      section.id,
                      currentEditorValue(),
                    )
                  }
                >
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <span>
                    <strong>{section.title}</strong>
                    <small>{section.status || "Draft"}</small>
                  </span>
                </button>
              ))}
            </aside>
          )}
          <main>
            <div className="a4-document-page">
              {props.workspaceVariant === "assignment-report" && props.sectionNumber === 1 && props.documentFrameMeta && (
                <section className="assignment-report-document-control" aria-label="Document control">
                  <div className="assignment-report-document-control-heading">
                    <div className="assignment-report-psc-brand">
                      <img src="/psc-logo.png" alt="Public Service Commission logo" />
                      <span>PUBLIC SERVICE COMMISSION<small>RESEARCH DEPARTMENT</small></span>
                    </div>
                    <strong>DOCUMENT CONTROL</strong>
                  </div>
                  <dl>
                    <div><dt>Report reference</dt><dd>{props.documentFrameMeta.reference || "Not recorded"}</dd></div>
                    <div><dt>Assignment</dt><dd>{props.documentFrameMeta.assignment || "Not specified"}</dd></div>
                    <div><dt>Prepared by</dt><dd>{props.documentFrameMeta.preparedBy || "Not recorded"}</dd></div>
                    <div><dt>Reviewer</dt><dd>{props.documentFrameMeta.reviewer || "Not assigned"}</dd></div>
                    <div><dt>Version</dt><dd>{props.documentFrameMeta.version || "1"}</dd></div>
                    <div><dt>Status</dt><dd>{props.documentFrameMeta.status || "Draft"}</dd></div>
                    <div><dt>Classification</dt><dd>{props.documentFrameMeta.classification || "Official"}</dd></div>
                    <div><dt>Last updated</dt><dd>{props.documentFrameMeta.savedAt || "Not saved yet"}</dd></div>
                  </dl>
                </section>
              )}
              {props.workspaceVariant === "task-report" &&
              props.reportDocumentMode === "blank" ? (
                <section className="task-report-document-frame app2-task-report-draft">
                <div className="app2-psc-report-brand" aria-label="Public Service Commission">
                  <img src="/psc-logo.png" alt="Public Service Commission logo" />
                  <div>
                    <strong>PUBLIC SERVICE COMMISSION</strong>
                    <span>RESEARCH DEPARTMENT</span>
                  </div>
                </div>
                  <p className="app2-task-report-kicker">TASK REPORT · WORKING DRAFT</p>
                  <h1 className="app2-task-report-title">{reportTitle}</h1>
                  <div className="app2-task-report-meta">
                    <p className="app2-task-report-meta-item">
                      <strong>Reference:</strong>
                      <span>{props.documentFrameMeta?.reference || "Not recorded"}</span>
                    </p>
                    <p className="app2-task-report-meta-item">
                      <strong>Assignment:</strong>
                      <span>{props.documentFrameMeta?.assignment || "Not specified"}</span>
                    </p>
                    <p className="app2-task-report-meta-item">
                      <strong>Prepared by:</strong>
                      <span>{props.documentFrameMeta?.preparedBy || "Not recorded"}</span>
                    </p>
                    <p className="app2-task-report-meta-item">
                      <strong>Status:</strong>
                      <span>{props.documentFrameMeta?.status || "Draft"}</span>
                    </p>
                    <p className="app2-task-report-meta-item">
                      <strong>Saved:</strong>
                      <span>{props.documentFrameMeta?.savedAt || "Not saved yet"}</span>
                    </p>
                  </div>

                  <section className="app2-task-report-section">
                    <h2 className="app2-task-report-section-title">Report body</h2>
                  </section>
                </section>
              ) : !blankDocumentMode ? (
                <header className="a4-document-header">
                  <small>{reportTitle}</small>
                  <h1>{title}</h1>
                </header>
              ) : null}
              {editMode && !preview ? (
                <div
                  ref={reportEditorHostRef}
                  className="report-lexical-host"
                  onClick={(event) => {
                    const target = event.target;
                    selectReportImage(
                      target instanceof HTMLImageElement ? target : null,
                    );
                  }}
                  onPaste={(event) => {
                    const image = [...event.clipboardData.items]
                      .find((item) => item.type.startsWith("image/"))
                      ?.getAsFile();
                    if (image) {
                      event.preventDefault();
                      insertImage(image);
                    }
                  }}
                >
                  <Suspense
                    fallback={
                      <div
                        className="app2-report-editor-engine app2-report-editor-engine-loading"
                        role="status"
                        aria-live="polite"
                      >
                        Loading report editor…
                      </div>
                    }
                  >
                    <App2LexicalReportEditor
                      ref={reportEditorRef}
                      value={
                        /<[a-z][\s\S]*>/i.test(value.trim())
                          ? value
                          : value
                              .split("\n")
                              .map((line) =>
                                line
                                  ? `<p>${safeName(line)}</p>`
                                  : "<p><br></p>",
                              )
                              .join("")
                      }
                      onChange={(html) => {
                        latestValueRef.current = html;
                        onChange(html);
                        scheduleTaskReportAutoSave();
                      }}
                      onImmediateChange={props.onImmediateChange}
                      editable={!(props.workspaceVariant === "task-report" && workflowAction === "preview")}
                      ariaLabel={`${reportTitle} editor`}
                    />
                  </Suspense>
                </div>
              ) : (
                <article
                  dangerouslySetInnerHTML={{
                    __html: value
                      ? formattedHtml()
                      : "<p>Paste or write the complete report here.</p>",
                  }}
                />
              )}
              <span className="a4-page-number">
                Page {editMode ? currentPage : 1} of {totalPages}
              </span>
            </div>
          </main>
        </div>
        <footer className={props.workspaceVariant === "task-report" ? "task-report-footer" : undefined}>
          <span>
            {editMode
              ? `${value.length.toLocaleString()} characters · ${totalPages} page${totalPages === 1 ? "" : "s"} · Changes save as Draft`
              : "Read-only report preview"}
          </span>
          <div className="section-footer-navigation">
            {preview && props.onProceedForReview && (
              <>
                <button
                  type="button"
                  className="secondary research-preview-back"
                  onClick={() => setPreview(false)}
                >
                  Back to Editing
                </button>
                <button
                  type="button"
                  className="research-preview-proceed"
                  disabled={busy || workflowBusy}
                  onClick={() =>
                    void props.onProceedForReview?.(
                      currentEditorValue(),
                    )
                  }
                >
                  Proceed for Review
                </button>
              </>
            )}
            {!preview && props.workspaceVariant !== "task-report" && !blankDocumentMode && props.onPrevious && (
              <button
                type="button"
                className="report-footer-prev secondary"
                disabled={!props.canGoPrevious || busy || workflowBusy}
                title={
                  props.canGoPrevious
                    ? "Save this section and open the previous section."
                    : "This is the first report section."
                }
                onClick={() =>
                  void runFooterAction(
                    props.onPrevious!,
                    "The previous report section could not be opened.",
                    true,
                  )
                }
              >
                ← Previous section
              </button>
            )}
            {!preview && props.workspaceVariant !== "task-report" && !blankDocumentMode && props.onNext && (
              <button
                type="button"
                className="report-footer-next secondary"
                disabled={!props.canGoNext || busy || workflowBusy}
                title={
                  props.canGoNext
                    ? "Save this section and open the next section."
                    : "This is the final report section."
                }
                onClick={() =>
                  void runFooterAction(
                    props.onNext!,
                    "The next report section could not be opened.",
                    true,
                  )
                }
              >
                Next section →
              </button>
            )}
            {!preview && props.onPreviewReport && props.workspaceVariant !== "task-report" && (
              <button
                type="button"
                className="report-footer-preview secondary research-footer-preview"
                disabled={busy || workflowBusy}
                onClick={() =>
                  void runFooterAction(
                    props.onPreviewReport!,
                    "The report preview could not be opened.",
                  )
                }
              >
                Preview Report
              </button>
            )}
            {props.onOpenFinalDocument && (
              <button
                type="button"
                className="secondary final-document-link"
                disabled={busy || workflowBusy}
                onClick={() =>
                  void runFooterAction(
                    props.onOpenFinalDocument!,
                    "The report PDF could not be downloaded.",
                  )
                }
              >
                {props.finalDocumentLabel || "Download"}
              </button>
            )}
            {!preview && (
              <button
                type="button"
                className="report-footer-cancel secondary"
                disabled={busy || workflowBusy}
                onClick={() => void requestClose()}
              >
                {props.closeLabel || (editMode ? "Cancel" : "Close")}
              </button>
            )}
            {!preview && editMode && props.workspaceVariant !== "task-report" && props.onMarkReady && (
              <button
                type="button"
                className="secondary mark-ready-button"
                disabled={busy || markingReady}
                title={props.canMarkReady === false ? "Add content before marking this section Ready." : "Save this section and mark it Ready."}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setMarkingReady(true);
                  void Promise.resolve(
                    props.onMarkReady?.(
                      currentEditorValue(),
                    ),
                  ).finally(() => setMarkingReady(false));
                }}
              >
                {busy || markingReady ? "Marking Ready…" : "Mark Section Ready"}
              </button>
            )}
            {!preview && editMode && props.workspaceVariant !== "task-report" && (
              <button className="report-footer-save"
                type="button"
                disabled={busy || workflowBusy}
                onClick={() =>
                  void runFooterAction(
                    props.onSave,
                    "The report draft could not be saved.",
                  )
                }
              >
                {busy ? "Saving Draft..." : props.saveLabel || "Save Draft & Return"}
              </button>
            )}
            {mode === "review" && props.canSendReview && props.onSendReview && (
              <button
                type="button"
                disabled={busy}
                onClick={props.onSendReview}
              >
                Send for Review
              </button>
            )}
            {mode === "review" && props.canMarkFinal && props.onMarkFinal && (
              <button
                type="button"
                className="final"
                disabled={busy}
                onClick={props.onMarkFinal}
              >
                Mark Final
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}


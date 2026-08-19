import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./task-section-workspace.css";

const WORKSPACE_SIZE_KEY = "app2-report-workspace-maximized";

type Props = {
  title: string;
  reportTitle: string;
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
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  sectionNumber?: number;
  sectionCount?: number;
  outlineSections?: { id: string; title: string; status?: string }[];
  currentSectionId?: string;
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
  workspaceVariant?: "default" | "assignment-report";
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
  ) => void | Promise<void>;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: (latestValue?: string) => void | boolean | Promise<void | boolean>;
  onPrevious?: () => void | Promise<void>;
  onNext?: () => void | Promise<void>;
  onSendReview?: () => void | Promise<void>;
  onMarkFinal?: () => void | Promise<void>;
  onMarkReady?: (latestValue?: string) => void | Promise<void>;
  onOpenFinalDocument?: (latestValue?: string) => void | Promise<void>;
  onSelectSection?: (sectionId: string) => void | Promise<void>;
  onProceedForReview?: (latestValue?: string) => void | Promise<void>;
};


export default function TaskSectionWorkspace(props: Props) {
  const { title, reportTitle, mode, status, value, busy, onChange } = props;
  const editorRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const reportImportInputRef = useRef<HTMLInputElement | null>(null);
  const externalReportInputRef = useRef<HTMLInputElement | null>(null);
  const imageToReplaceRef = useRef<HTMLImageElement | null>(null);
  const savedEditorRangeRef = useRef<Range | null>(null);
  const latestValueRef = useRef(value);
  const syncFrameRef = useRef<number | null>(null);
  const [find, setFind] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [preview, setPreview] = useState(props.initialPreview ?? mode === "review");
  const [maximized, setMaximized] = useState(
    () => sessionStorage.getItem(WORKSPACE_SIZE_KEY) !== "false",
  );
  const [fontFamily, setFontFamily] = useState("Calibri");
  const [fontSize, setFontSize] = useState("12");
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    props.currentTemplateId || "",
  );
  const [templatePreviewOpen, setTemplatePreviewOpen] = useState(false);
  const [reportTemplateKey, setReportTemplateKey] = useState("");
  const [reportTemplateBusy, setReportTemplateBusy] = useState(false);
  const [reportTemplateMessage, setReportTemplateMessage] = useState("");
  const [linkedWorkItemId, setLinkedWorkItemId] = useState("");
  const [linkedWorkSectionId, setLinkedWorkSectionId] = useState(
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
  const [reviewerId, setReviewerId] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [workflowMessage, setWorkflowMessage] = useState("");
  const [workflowTone, setWorkflowTone] = useState<"success" | "error" | "info">("info");
  const editMode = mode === "edit" && props.isEditable !== false;
  const openRibbonTab = (tab: string, selector: string) => {
    setActiveRibbonTab(tab);
    window.requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(selector)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        }),
    );
  };

  useEffect(() => {
    setPreview(props.initialPreview ?? mode === "review");
    setCursorPosition(0);
  }, [mode, title, props.initialPreview]);

  useEffect(() => {
    setLinkedWorkSectionId(props.currentSectionId || "");
  }, [props.currentSectionId]);

  useEffect(() => {
    if (!editorRef.current || preview || !editMode) return;
    const source = value.trim();
    editorRef.current.innerHTML = /<[a-z][\s\S]*>/i.test(source)
      ? source
      : source
          .split("\n")
          .map((line) => (line ? `<p>${safeName(line)}</p>` : "<p><br></p>"))
          .join("");
    window.requestAnimationFrame(() => editorRef.current?.focus({ preventScroll: true }));
  }, [title, mode, preview]);

  useEffect(() => {
    const editor = editorRef.current;
    if (
      !editor ||
      preview ||
      !editMode ||
      document.activeElement === editor
    )
      return;
    const source = value.trim();
    const html = /<[a-z][\s\S]*>/i.test(source)
      ? source
      : source
          .split("\n")
          .map((line) => (line ? `<p>${safeName(line)}</p>` : "<p><br></p>"))
          .join("");
    if (editor.innerHTML !== html) editor.innerHTML = html;
  }, [value, mode, preview]);

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
  const syncEditor = () => {
    latestValueRef.current = editorRef.current?.innerHTML || "";
    if (syncFrameRef.current !== null) return;
    syncFrameRef.current = window.requestAnimationFrame(() => {
      syncFrameRef.current = null;
      onChange(latestValueRef.current);
    });
  };
  useEffect(
    () => () => {
      if (syncFrameRef.current !== null)
        cancelAnimationFrame(syncFrameRef.current);
    },
    [],
  );
  const selectEditorContents = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const range = document.createRange();
    range.selectNodeContents(editor);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };
  const rememberEditorSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer))
      savedEditorRangeRef.current = range.cloneRange();
  };
  const insertImage = (file?: File) => {
    if (!file?.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 900 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas
          .getContext("2d")
          ?.drawImage(image, 0, 0, canvas.width, canvas.height);
        const source = canvas.toDataURL("image/jpeg", 0.62);
        editorRef.current?.focus();
        const replacement = imageToReplaceRef.current;
        let inserted: HTMLImageElement | null = replacement;
        if (replacement && editorRef.current?.contains(replacement))
          replacement.src = source;
        else {
          const insertedImage = document.createElement("img");
          inserted = insertedImage;
          insertedImage.src = source;
          insertedImage.alt = file.name.replace(/\.[^.]+$/, "");
          insertedImage.style.width = "70%";
          insertedImage.style.height = "auto";
          const range = savedEditorRangeRef.current;
          if (
            range &&
            editorRef.current?.contains(range.commonAncestorContainer)
          ) {
            range.deleteContents();
            range.insertNode(insertedImage);
            range.setStartAfter(insertedImage);
            range.collapse(true);
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
          } else editorRef.current?.append(insertedImage);
        }
        imageToReplaceRef.current = null;
        if (inserted) {
          inserted.alt = file.name.replace(/\.[^.]+$/, "");
          if (!replacement) {
            inserted.style.width = "70%";
            inserted.style.height = "auto";
          }
          setSelectedImage(inserted);
        }
        syncEditor();
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  };
  const updateSelectedImage = (change: (image: HTMLImageElement) => void) => {
    if (!selectedImage || !editorRef.current?.contains(selectedImage)) return;
    change(selectedImage);
    syncEditor();
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
          "Convert this DOCX to PDF or Word 97–2003 (.doc), then import it. App2 preserves those formats as editable content.",
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
      if (editorRef.current) editorRef.current.innerHTML = html;
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
  const setImageWidth = (width: string) =>
    updateSelectedImage((image) => {
      image.style.width = width;
      image.style.height = "auto";
    });
  const alignImage = (alignment: "left" | "center" | "right") =>
    updateSelectedImage((image) => {
      image.style.display = "block";
      image.style.marginLeft = alignment === "left" ? "0" : "auto";
      image.style.marginRight = alignment === "right" ? "0" : "auto";
    });
  const command = (name: string, argument?: string) => {
    editorRef.current?.focus();
    document.execCommand(name, false, argument);
    syncEditor();
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
  const blankDocumentMode = selectedTemplateId === "__blank__";
  const templateMatchesOutline = selectedTemplate?.sections?.every((section) =>
    props.outlineSections?.some((item) => item.id === section.key),
  );
  const displayedOutline = blankDocumentMode
    ? undefined
    : selectedTemplate?.sections?.length && templateMatchesOutline
      ? selectedTemplate.sections.map((section) => ({
          id: section.key,
          title: section.title,
          status: props.outlineSections?.find((item) => item.id === section.key)
            ?.status,
        }))
      : props.outlineSections;
  const findNext = () => {
    const editor = editorRef.current;
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
    if (/<[a-z][\s\S]*>/i.test(value)) {
      const container = document.createElement("div");
      container.innerHTML = value;
      container
        .querySelectorAll("script,style,iframe,object,embed")
        .forEach((node) => node.remove());
      container.querySelectorAll("*").forEach((node) =>
        [...node.attributes].forEach((attribute) => {
          if (attribute.name.startsWith("on"))
            node.removeAttribute(attribute.name);
        }),
      );
      return container.innerHTML;
    }
    return value
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
  const selectTemplate = (selection: string) => {
    if (selection === "__blank__") {
      setSelectedTemplateId("__blank__");
      setTemplatePreviewOpen(false);
      return;
    }
    if (selection === "__download__") {
      downloadTemplate();
      return;
    }
    setSelectedTemplateId(selection);
    setTemplatePreviewOpen(Boolean(selection));
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
      className="section-workspace-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${editMode ? "Edit" : "Review"} ${title}`}
    >
      <section
        className={`section-workspace-shell${maximized ? " maximized" : ""}${props.workspaceVariant === "assignment-report" ? " assignment-report-v2" : ""}`}
      >
        <header>
          <div>
            <small>
              {editMode
                ? "EDITING REPORT SECTION"
                : "PREVIEWING REPORT SECTION"}
              {props.sectionNumber && props.sectionCount
                ? ` · ${props.sectionNumber} OF ${props.sectionCount}`
                : ""}
            </small>
            <h2>{title}</h2>
            <p>{props.contextTitle || reportTitle}</p>
            {props.statusMessage && (
              <div
                className={`section-workspace-feedback ${props.statusTone || "info"}`}
                role={props.statusTone === "error" ? "alert" : "status"}
              >
                {props.statusMessage}
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
            <small>SAVING AS</small>
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
                onClick={props.onClose}
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
              onClick={props.onClose}
            >
              ×
            </button>
          </div>
        </header>
        {props.workspaceVariant === "assignment-report" && (
          <section className="assignment-report-editor-actions" aria-label="Assignment report workflow">
            <div className="assignment-report-editor-status">
              <strong>{editMode ? "EDITABLE" : "READ ONLY"}</strong>
              <span>
                {props.externalReport
                  ? `External report v${props.externalReport.version_number}: ${props.externalReport.original_name}`
                  : `${props.readySectionCount || 0}/${props.totalSectionCount || 0} sections Ready`}
              </span>
            </div>
            <div className="assignment-report-editor-buttons">
              {editMode && (
                <button
                  type="button"
                  className="primary"
                  disabled={busy || workflowBusy}
                  onClick={() =>
                    void props.onSave(
                      editorRef.current?.innerHTML ?? latestValueRef.current,
                    )
                  }
                >
                  Save Draft
                </button>
              )}
              <button
                type="button"
                className="secondary"
                disabled={busy || workflowBusy}
                onClick={() => setPreview((current) => !current)}
              >
                {preview ? "Return to Edit" : "Preview Report"}
              </button>
              {props.canImportExternalReport && (
                <>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy || workflowBusy}
                    onClick={() => externalReportInputRef.current?.click()}
                  >
                    Import PDF/DOCX for Review
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
            </div>
            {props.canSubmitForReview && props.onSubmitForReview && (
              <div className="assignment-report-submit-inline">
                <select
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
                <input
                  value={reviewNote}
                  onChange={(event) => setReviewNote(event.target.value)}
                  placeholder="Submission note (optional)"
                />
                <button
                  type="button"
                  className="primary"
                  disabled={
                    !reviewerId ||
                    !props.submissionReady ||
                    busy ||
                    workflowBusy
                  }
                  title={
                    props.submissionReady
                      ? "Submit the current controlled report to the selected reviewer."
                      : "Mark all sections Ready, or import a complete PDF/DOCX report first."
                  }
                  onClick={() => {
                    if (!reviewerId) return;
                    setWorkflowBusy(true);
                    setWorkflowMessage("");
                    void Promise.resolve(
                      props.onSubmitForReview?.(reviewerId, reviewNote.trim()),
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
                  {workflowBusy ? "Working..." : "Submit to Reviewer"}
                </button>
              </div>
            )}
            {!props.submissionReady && props.canSubmitForReview && (
              <small className="assignment-report-submit-hint">
                Complete and mark all sections Ready, or import a complete PDF/DOCX report for formal review.
              </small>
            )}
            {workflowMessage && (
              <div className={`assignment-report-workflow-message ${workflowTone}`}>
                {workflowMessage}
              </div>
            )}
          </section>
        )}
        <div className="document-ribbon">
          <nav className="ribbon-tabs" aria-label="Document ribbon">
            {[
              ["Home", ".font-tools"],
              ["Insert", ".insert-tools"],
              ["Layout", ".paragraph-tools"],
              [
                props.reportTemplateOptions?.length ? "Templates" : "References",
                props.reportTemplateOptions?.length
                  ? ".report-template-tools"
                  : ".template-tools",
              ],
              ["Review", ".editing-tools"],
              ["View", ".output-tools"],
            ].map(([tab, selector]) => (
              <button
                type="button"
                key={tab}
                className={activeRibbonTab === tab ? "active" : ""}
                aria-pressed={activeRibbonTab === tab}
                onClick={() => openRibbonTab(tab, selector)}
              >
                {tab}
              </button>
            ))}
          </nav>
          <nav className="section-word-toolbar" aria-label="Document tools">
            {editMode && (
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
                        command(
                          "fontSize",
                          String(
                            Math.max(
                              1,
                              Math.min(
                                7,
                                Math.round(Number(event.target.value) / 5),
                              ),
                            ),
                          ),
                        );
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
                      B
                    </button>
                    <button
                      type="button"
                      title="Italic"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => command("italic")}
                    >
                      <em>I</em>
                    </button>
                    <button
                      type="button"
                      title="Underline"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => command("underline")}
                    >
                      <u>U</u>
                    </button>
                    <button
                      type="button"
                      title="Strikethrough"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => command("strikeThrough")}
                    >
                      <s>ab</s>
                    </button>
                  </span>
                  <small>Font</small>
                </div>
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
                      ≡
                    </button>
                    <button
                      type="button"
                      title="Align center"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => command("justifyCenter")}
                    >
                      ≡
                    </button>
                    <button
                      type="button"
                      title="Align right"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => command("justifyRight")}
                    >
                      ≡
                    </button>
                    <button
                      type="button"
                      title="Justify"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => command("justifyFull")}
                    >
                      ☰
                    </button>
                  </span>
                  <small>Paragraph</small>
                </div>
                <div className="ribbon-group styles-tools">
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
                  <small>Styles</small>
                </div>
                <div className="ribbon-group insert-tools">
                  <button
                    type="button"
                    onMouseDown={() => rememberEditorSelection()}
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
                {selectedImage && (
                  <div className="ribbon-group image-tools">
                    <span>
                      <button
                        type="button"
                        onClick={() => setImageWidth("30%")}
                      >
                        Small
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageWidth("60%")}
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
                          if (alt !== null)
                            updateSelectedImage((image) => {
                              image.alt = alt.trim();
                            });
                        }}
                      >
                        Alt text
                      </button>
                      <button
                        type="button"
                        className="image-remove"
                        onClick={() => {
                          selectedImage.remove();
                          setSelectedImage(null);
                          syncEditor();
                        }}
                      >
                        Remove
                      </button>
                    </span>
                    <small>Selected image</small>
                  </div>
                )}
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
                    className={preview ? "active-view" : ""}
                    onClick={() => setPreview((current) => !current)}
                  >
                    {preview ? "Edit" : "Preview"}
                  </button>
                  <small>Editing</small>
                </div>
              </>
            )}
            {!!props.reportTemplateOptions?.length && (
              <div className="ribbon-group report-template-tools">
                <label className="workspace-report-template-picker">
                  Report template
                  <select
                    aria-label="Research report template"
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
                    `${props.reportTemplateOptions.length} research structures`}
                </small>
              </div>
            )}
            {!!props.templateOptions?.length && (
              <div className="ribbon-group template-tools">
                <label className="workspace-template-picker">
                  Template
                  <select
                    aria-label="Document template"
                    value={selectedTemplateId}
                    onChange={(event) => selectTemplate(event.target.value)}
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
                {props.workspaceVariant !== "assignment-report" && (
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
                )}
                <small>Template & import</small>
              </div>
            )}
            <div className="ribbon-group output-tools">
              <button type="button" onClick={downloadWord}>
                Word
              </button>
              <button type="button" onClick={printSection}>
                Print
              </button>
              <small>Output</small>
            </div>
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
            <aside className="workspace-section-outline">
              <header>
                <small>REPORT OUTLINE</small>
                <strong>{displayedOutline.length} sections</strong>
              </header>
              {displayedOutline.map((section, index) => (
                <button
                  key={section.id}
                  type="button"
                  className={
                    section.id === props.currentSectionId ? "active" : ""
                  }
                  onClick={() => void props.onSelectSection?.(section.id)}
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
              {!blankDocumentMode && (
                <header className="a4-document-header">
                  <small>{reportTitle}</small>
                  <h1>{title}</h1>
                </header>
              )}
              {editMode && !preview ? (
                <div
                  ref={editorRef}
                  className="rich-document-editor"
                  contentEditable={editMode}
                  tabIndex={editMode ? 0 : -1}
                  role="textbox"
                  aria-multiline="true"
                  aria-readonly={!editMode}
                  spellCheck
                  suppressContentEditableWarning
                  onInput={syncEditor}
                  onMouseUp={rememberEditorSelection}
                  onKeyUp={rememberEditorSelection}
                  onClick={(event) => {
                    const target = event.target;
                    setSelectedImage(
                      target instanceof HTMLImageElement ? target : null,
                    );
                    rememberEditorSelection();
                  }}
                  onKeyDown={(event) => {
                    if (
                      (event.ctrlKey || event.metaKey) &&
                      event.key.toLowerCase() === "a"
                    ) {
                      event.preventDefault();
                      selectEditorContents();
                      rememberEditorSelection();
                    }
                    if (
                      (event.key === "Delete" || event.key === "Backspace") &&
                      selectedImage
                    ) {
                      event.preventDefault();
                      selectedImage.remove();
                      setSelectedImage(null);
                      syncEditor();
                    }
                  }}
                  onPaste={(event) => {
                    const image = [...event.clipboardData.items]
                      .find((item) => item.type.startsWith("image/"))
                      ?.getAsFile();
                    if (image) {
                      event.preventDefault();
                      rememberEditorSelection();
                      insertImage(image);
                    }
                  }}
                />
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
        <footer>
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
                      editorRef.current?.innerHTML ?? latestValueRef.current,
                    )
                  }
                >
                  Proceed for Review
                </button>
              </>
            )}
            {!preview && props.onPrevious && (
              <button
                type="button"
                className="secondary"
                disabled={!props.canGoPrevious}
                onClick={() => void props.onPrevious?.()}
              >
                ← Previous section
              </button>
            )}
            {!preview && props.onNext && (
              <button
                type="button"
                className="secondary"
                disabled={!props.canGoNext}
                onClick={() => void props.onNext?.()}
              >
                Next section →
              </button>
            )}
            {props.onOpenFinalDocument && (
              <button
                type="button"
                className="secondary final-document-link"
                disabled={busy}
                onClick={() =>
                  void props.onOpenFinalDocument?.(
                    editorRef.current?.innerHTML ?? latestValueRef.current,
                  )
                }
              >
                {props.finalDocumentLabel || "Templates & final document"}
              </button>
            )}
            {!preview && (
              <button type="button" className="secondary" onClick={props.onClose}>
                {props.closeLabel || (editMode ? "Cancel" : "Close")}
              </button>
            )}
            {!preview && editMode && props.onMarkReady && (
              <button
                type="button"
                className="secondary mark-ready-button"
                disabled={busy}
                title={props.canMarkReady === false ? "Add content before marking this section Ready." : "Save this section and mark it Ready."}
                onClick={() =>
                  void props.onMarkReady?.(
                    editorRef.current?.innerHTML ?? latestValueRef.current,
                  )
                }
              >
                {busy ? "Saving…" : "Mark Section Ready"}
              </button>
            )}
            {!preview && editMode && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void props.onSave(
                    editorRef.current?.innerHTML ?? latestValueRef.current,
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

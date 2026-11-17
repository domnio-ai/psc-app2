import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { App2LexicalReportEditorHandle } from "../../report-editor/App2LexicalReportEditor";
import { prepareReportImage } from "../../report-editor/reportImageProcessing";
import "../styles/research-report-workspace.css";

const App2LexicalReportEditor = lazy(
  () => import("../../report-editor/App2LexicalReportEditor"),
);

type OutlineSection = {
  id: string;
  title: string;
  status?: string;
};

type ReportTemplateOption = {
  key: string;
  name: string;
  description?: string;
  sectionCount?: number;
};

type LinkedWorkItem = {
  id: string;
  title: string;
  status?: string;
};

type ReviewerOption = {
  id: string;
  name: string;
  role: string;
};

type Props = {
  title: string;
  reportTitle: string;
  mode: "edit" | "review";
  workspaceVariant?: string;
  contextTitle?: string;
  templateOptions?: unknown[];
  closeLabel?: string;
  saveLabel?: string;
  status: string;
  value: string;
  busy?: boolean;
  canEditSection?: boolean;
  sectionOwnerName?: string | null;
  readOnlyReason?: string;
  sectionNumber: number;
  sectionCount: number;
  currentSectionId: string;
  outlineSections: OutlineSection[];
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  reportTemplateOptions?: ReportTemplateOption[];
  onApplyReportTemplate?: (templateKey: string) => void | Promise<void>;
  linkedWorkItems?: LinkedWorkItem[];
  linkedWorkLabel?: string;
  linkedWorkPlaceholder?: string;
  linkedWorkActionLabel?: string;
  onInsertLinkedWorkItem?: (id: string) => void | Promise<void>;
  reviewerOptions?: ReviewerOption[];
  repositoryDraftVersion?: number | null;
  canSubmitForReview?: boolean;
  submissionReady?: boolean;
  readySectionCount?: number;
  totalSectionCount?: number;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: (latestValue?: string) => void | boolean | { saved?: boolean; message?: string } | Promise<void | boolean | { saved?: boolean; message?: string }>;
  onPrevious?: (latestValue?: string) => void | Promise<void>;
  onNext?: (latestValue?: string) => void | Promise<void>;
  onSelectSection?: (
    sectionId: string,
    latestValue?: string,
  ) => void | Promise<void>;
  onProceedForReview?: (latestValue?: string) => void | Promise<void>;
  onPreviewReport?: (latestValue?: string) => void | Promise<void>;
};

type RibbonTab = "Home" | "Insert" | "Layout" | "Templates" | "Review" | "View";
type PageWidth = "page" | "wide" | "full";

const sectionStateClass = (status?: string) =>
  String(status || "Not Started")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const plainTextLength = (html: string) =>
  html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().length;

export default function ResearchReportWorkspace(props: Props) {
  const editorRef = useRef<App2LexicalReportEditorHandle | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<RibbonTab>("Home");
  const [maximized, setMaximized] = useState(true);
  const [showOutline, setShowOutline] = useState(true);
  const [pageWidth, setPageWidth] = useState<PageWidth>("page");
  const [fontFamily, setFontFamily] = useState("Calibri");
  const [fontSize, setFontSize] = useState("12");
  const [templateKey, setTemplateKey] = useState("");
  const [linkedWorkId, setLinkedWorkId] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  const readOnlySection = props.mode === "review" || props.canEditSection !== true;
  const editable = props.mode === "edit" && props.canEditSection === true && !props.busy;
  const currentValue = () => editorRef.current?.getHTML() ?? props.value;
  const wordCount = useMemo(() => {
    const text = props.value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();
    return text ? text.split(/\s+/).length : 0;
  }, [props.value]);
  const completion = props.totalSectionCount
    ? Math.round(((props.readySectionCount || 0) / props.totalSectionCount) * 100)
    : 0;

  useEffect(() => {
    if (!templateKey && props.reportTemplateOptions?.length) {
      setTemplateKey(props.reportTemplateOptions[0].key);
    }
  }, [props.reportTemplateOptions, templateKey]);

  useEffect(() => {
    if (reviewerId && props.reviewerOptions?.some((reviewer) => reviewer.id === reviewerId)) return;
    setReviewerId(props.reviewerOptions?.length === 1 ? props.reviewerOptions[0].id : "");
  }, [props.reviewerOptions, reviewerId]);

  const run = (command: string, argument?: string) => {
    const ok = editorRef.current?.executeCommand(command, argument) ?? false;
    if (!ok) setMessage(`The ${command} command is not available for the current selection.`);
    else setMessage("");
  };

  const guarded = async (action: () => void | Promise<void>, successMessage = "") => {
    if (working || props.busy) return;
    setWorking(true);
    setMessage("");
    try {
      await action();
      if (successMessage) setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The requested report action failed.");
    } finally {
      setWorking(false);
    }
  };

  const closeWorkspace = () => {
    if (readOnlySection) {
      props.onClose();
      return;
    }
    void guarded(async () => {
      const result = await props.onSave(currentValue());
      if (result === false || (typeof result === "object" && result !== null && result.saved === false)) {
        throw new Error("The current report section could not be saved. The workspace remains open.");
      }
      props.onClose();
    }, "Draft saved before returning to Research.");
  };

  const applyTemplate = () => guarded(async () => {
    if (!templateKey || !props.onApplyReportTemplate) {
      throw new Error("Choose a report template first.");
    }
    await props.onApplyReportTemplate(templateKey);
  }, "Report outline updated from the selected template.");

  const insertLinkedWork = () => guarded(async () => {
    if (!linkedWorkId || !props.onInsertLinkedWorkItem) {
      throw new Error("Choose an assignment report to attach first.");
    }
    await props.onInsertLinkedWorkItem(linkedWorkId);
    setLinkedWorkId("");
  }, "Assignment evidence inserted and saved.");

  const insertImage = async (file: File) => {
    try {
      const prepared=await prepareReportImage(file);
      if (!editorRef.current?.insertImage(prepared.src, prepared.alt, "70%")) {
        setMessage("The image could not be inserted at the current cursor position.");
      } else {
        setMessage("");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The image could not be prepared.");
    }
  };

  const openPreview = () => guarded(async () => {
    if (!props.onPreviewReport) throw new Error("Report preview is unavailable.");
    await props.onPreviewReport(currentValue());
  });

  const shell = (
    <div className="research-report-workspace-backdrop" role="presentation">
      <section
        className={`research-report-workspace${maximized ? " maximized" : ""} page-${pageWidth}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${props.reportTitle} Report Builder`}
      >
        <header className="research-report-titlebar">
          <div className="research-report-titleblock">
            <strong>{props.title}</strong>
            <span>{props.reportTitle}</span>
          </div>
          <div className="research-report-statebar" aria-label="Report state">
            <span className="report-label editable-label">{editable ? "EDITABLE" : props.mode === "edit" && props.canEditSection !== true ? "READ ONLY" : "LOCKED"}</span>
            <span className="report-label status-label">{props.status}</span>
            <button type="button" onClick={closeWorkspace}>Return to Research</button>
            <button type="button" aria-label={maximized ? "Restore report editor" : "Maximise report editor"} title={maximized ? "Restore report editor" : "Maximise report editor"} aria-pressed={maximized} onClick={() => setMaximized((value) => !value)}>
              {maximized ? "Restore" : "Maximise"}
            </button>
            <button type="button" className="icon-button" aria-label="Close Report Builder" onClick={closeWorkspace}>×</button>
          </div>
        </header>

        {message && (
          <div className="session-message" role="status" aria-live="polite">
            {message}
          </div>
        )}        {(props.canEditSection !== true || props.mode === "review") && (
          <div className="session-message research-section-access-notice" role="status" aria-live="polite">
            <strong>{props.mode === "edit" && props.canEditSection === false ? "READ-ONLY ACCESS" : props.mode === "edit" && props.canEditSection !== true ? "VERIFYING ACCESS" : "READ-ONLY SECTION"}</strong>
            <span>Section owner: {props.sectionOwnerName || "Unassigned"}</span>
            <span>{props.readOnlyReason || (props.mode === "review" ? "This section is open for permitted review and reading." : "Editing is disabled until section access is verified or the research lead reassigns the section to you.")}</span>
          </div>
        )}

        <nav className="research-report-ribbon-tabs" role="tablist" aria-label="Report Builder tools">
          {(["Home", "Insert", "Layout", "Templates", "Review", "View"] as RibbonTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={activeTab === tab ? "active" : ""}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>

        <section className="research-report-ribbon-panel" aria-label={`${activeTab} tools`}>
          {activeTab === "Home" && (
            <>
              <div className="tool-group"><span className="tool-label">History</span><button type="button" disabled={!editable} onClick={() => run("undo")}>Undo</button><button type="button" disabled={!editable} onClick={() => run("redo")}>Redo</button></div>
              <div className="tool-group"><span className="tool-label">Font</span><select value={fontFamily} disabled={!editable} onChange={(event) => { setFontFamily(event.target.value); run("fontName", event.target.value); }}><option>Calibri</option><option>Arial</option><option>Georgia</option><option>Times New Roman</option></select><select value={fontSize} disabled={!editable} onChange={(event) => { setFontSize(event.target.value); run("fontSize", event.target.value); }}>{[10,11,12,14,16,18,20,24].map((size) => <option key={size} value={size}>{size}</option>)}</select></div>
              <div className="tool-group"><span className="tool-label">Format</span><button type="button" disabled={!editable} onClick={() => run("bold")}><b>B</b></button><button type="button" disabled={!editable} onClick={() => run("italic")}><i>I</i></button><button type="button" disabled={!editable} onClick={() => run("underline")}><u>U</u></button><button type="button" disabled={!editable} onClick={() => run("strikeThrough")}>S</button></div>
              <div className="tool-group"><span className="tool-label">Paragraph</span><button type="button" disabled={!editable} onClick={() => run("insertUnorderedList")}>• List</button><button type="button" disabled={!editable} onClick={() => run("insertOrderedList")}>1. List</button><button type="button" disabled={!editable} onClick={() => run("justifyLeft")}>Left</button><button type="button" disabled={!editable} onClick={() => run("justifyCenter")}>Centre</button><button type="button" disabled={!editable} onClick={() => run("justifyRight")}>Right</button><button type="button" disabled={!editable} onClick={() => run("justifyFull")}>Justify</button></div>
              <div className="tool-group"><span className="tool-label">Editing</span><button type="button" disabled={!editable} onClick={() => { const href = window.prompt("Link URL"); if (href) run("createLink", href); }}>Link</button><button type="button" disabled={!editable} onClick={() => run("unlink")}>Unlink</button><button type="button" disabled={!editable} onClick={() => run("removeFormat")}>Clear formatting</button></div>
            </>
          )}

          {activeTab === "Insert" && (
            <>
              <div className="tool-group"><span className="tool-label">Table</span><button type="button" disabled={!editable} onClick={() => run("insertTable")}>Insert table</button><button type="button" disabled={!editable} onClick={() => run("addRowAfter")}>Add row</button><button type="button" disabled={!editable} onClick={() => run("deleteRow")}>Delete row</button><button type="button" disabled={!editable} onClick={() => run("addColumnAfter")}>Add column</button><button type="button" disabled={!editable} onClick={() => run("deleteColumn")}>Delete column</button><button type="button" disabled={!editable} onClick={() => run("toggleHeaderRow")}>Header row</button><button type="button" disabled={!editable} onClick={() => run("mergeCells")}>Merge cells</button><button type="button" disabled={!editable} onClick={() => run("splitCell")}>Split cell</button><button type="button" disabled={!editable} onClick={() => run("deleteTable")}>Delete table</button></div>
              <div className="tool-group"><span className="tool-label">Image</span><button type="button" onClick={() => imageInputRef.current?.click()} disabled={!editable}>Insert image</button><input ref={imageInputRef} hidden type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void insertImage(file); event.currentTarget.value = ""; }} /></div>
              <div className="tool-group linked-work-tools"><span className="tool-label">Research evidence</span><select value={linkedWorkId} disabled={!editable} onChange={(event) => setLinkedWorkId(event.target.value)}><option value="">{props.linkedWorkPlaceholder || "Choose assignment report"}</option>{(props.linkedWorkItems || []).map((item) => <option key={item.id} value={item.id}>{item.title}{item.status ? ` — ${item.status}` : ""}</option>)}</select><button type="button" onClick={insertLinkedWork} disabled={!editable || !linkedWorkId || working}>{props.linkedWorkActionLabel || "Attach report"}</button></div>
            </>
          )}

          {activeTab === "Layout" && (
            <>
              <div className="tool-group"><span className="tool-label">Page width</span><button type="button" className={pageWidth === "page" ? "active-tool" : ""} onClick={() => setPageWidth("page")}>A4 page</button><button type="button" className={pageWidth === "wide" ? "active-tool" : ""} onClick={() => setPageWidth("wide")}>Wide</button><button type="button" className={pageWidth === "full" ? "active-tool" : ""} onClick={() => setPageWidth("full")}>Full width</button></div>
              <div className="tool-group"><span className="tool-label">Structure</span><button type="button" disabled={!editable} onClick={() => run("formatBlock", "p")}>Normal</button><button type="button" disabled={!editable} onClick={() => run("formatBlock", "h2")}>Heading 2</button><button type="button" disabled={!editable} onClick={() => run("formatBlock", "h3")}>Heading 3</button><button type="button" disabled={!editable} onClick={() => run("formatBlock", "blockquote")}>Quote</button></div>
            </>
          )}

          {activeTab === "Templates" && (
            <div className="template-panel">
              <div className="tool-group template-tools"><span className="tool-label">Governed research template</span><select value={templateKey} disabled={!editable} onChange={(event) => setTemplateKey(event.target.value)}>{(props.reportTemplateOptions || []).map((template) => <option key={template.key} value={template.key}>{template.name}{template.sectionCount ? ` (${template.sectionCount} sections)` : ""}</option>)}</select><button type="button" onClick={applyTemplate} disabled={!editable || !templateKey || working}>Apply to Outline</button></div>
              <p>{props.reportTemplateOptions?.find((template) => template.key === templateKey)?.description || "Choose a governed research report structure."}</p>
            </div>
          )}

          {activeTab === "Review" && (
            <div className="review-panel">
              <div className="readiness-card"><span className="tool-label">Readiness</span><strong>{props.readySectionCount || 0} / {props.totalSectionCount || props.sectionCount} sections with content</strong><progress max={100} value={completion} /><small>{completion}% drafted</small></div>
              <div className="reviewer-card"><span className="tool-label">Formal reviewer</span><select value={reviewerId} disabled={!editable} onChange={(event) => setReviewerId(event.target.value)}><option value="">{props.reviewerOptions?.length ? "Select formal reviewer" : "No eligible reviewers available"}</option>{(props.reviewerOptions || []).map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.name} — {reviewer.role}</option>)}</select><small>The formal reviewer is confirmed in the governed Review stage.</small></div>
              <button type="button" className="primary-action" disabled={readOnlySection || !props.canSubmitForReview || working} onClick={() => guarded(async () => { if (!props.onProceedForReview) throw new Error("Review handoff is unavailable."); await props.onProceedForReview(currentValue()); })}>Proceed to Review</button>
            </div>
          )}

          {activeTab === "View" && (
            <>
              <div className="tool-group"><span className="tool-label">Workspace</span><button type="button" className={showOutline ? "active-tool" : ""} onClick={() => setShowOutline((value) => !value)}>{showOutline ? "Hide outline" : "Show outline"}</button><button type="button" aria-label={maximized ? "Restore report editor" : "Maximise report editor"} title={maximized ? "Restore report editor" : "Maximise report editor"} aria-pressed={maximized} onClick={() => setMaximized((value) => !value)}>{maximized ? "Restore" : "Maximise"}</button></div>
              <div className="tool-group"><span className="tool-label">Report</span><button type="button" onClick={openPreview}>Preview complete report</button></div>
            </>
          )}
        </section>

        <section className="research-report-commandbar">
          <div className="section-context"><strong>Section {props.sectionNumber} of {props.sectionCount}</strong><span>{props.title}</span><span>{wordCount} words</span>{props.repositoryDraftVersion ? <span className="repository-draft-receipt">Repository draft v{props.repositoryDraftVersion}</span> : null}</div>
          <div className="command-actions"><button type="button" className="primary-action" disabled={working || props.busy || !editable} onClick={() => guarded(async () => { const result = await props.onSave(currentValue()); if (result === false || (typeof result === "object" && result !== null && result.saved === false)) throw new Error("The draft was not saved."); if (typeof result === "object" && result !== null && result.message) setMessage(result.message); })}>Save Draft</button><button type="button" disabled={working || props.busy} onClick={openPreview}>Preview</button></div>
        </section>



        <main className={`research-report-body${showOutline ? "" : " outline-hidden"}`}>
          {showOutline && (
            <aside className="research-report-outline" aria-label="Report outline">
              <header><strong>REPORT OUTLINE</strong><span>{props.sectionCount} sections</span></header>
              <div className="outline-list">
                {props.outlineSections.map((section, index) => (
                  <button
                    key={section.id}
                    type="button"
                    className={`${section.id === props.currentSectionId ? "active" : ""} state-${sectionStateClass(section.status)}`.trim()}
                    onClick={() => guarded(async () => { if (props.onSelectSection) await props.onSelectSection(section.id, currentValue()); })}
                  >
                    <span className="section-index">{String(index + 1).padStart(2, "0")}</span>
                    <span><strong>{section.title}</strong><small>{section.status || "Not Started"}</small></span>
                  </button>
                ))}
              </div>
            </aside>
          )}
          <section className="research-report-document-stage">
            <article className="research-report-paper">
              <header><small>{props.reportTitle.toUpperCase()}</small><h1>{props.title}</h1></header>
              <Suspense fallback={<div role="status" aria-live="polite">Loading report editor...</div>}>
                <App2LexicalReportEditor
                  ref={editorRef}
                  value={props.value}
                  onChange={props.onChange}
                  editable={editable}
                  ariaLabel={`${props.title} report section`}
                  className="research-report-editor"
                />
              </Suspense>
            </article>
          </section>
        </main>

        <footer className="research-report-footer">
          <div className="document-status"><span>{plainTextLength(props.value).toLocaleString()} text characters · {props.value.length.toLocaleString()} editor HTML characters</span><span>{wordCount} words</span><span>Explicit Save Draft creates a Repository version</span></div>
          <div className="section-navigation"><button type="button" disabled={!props.canGoPrevious || working} onClick={() => guarded(async () => { if (props.onPrevious) await props.onPrevious(currentValue()); })}>← Previous section</button><button type="button" disabled={!props.canGoNext || working} onClick={() => guarded(async () => { if (props.onNext) await props.onNext(currentValue()); })}>Next section →</button></div>
        </footer>


      </section>
    </div>
  );

  return createPortal(shell, document.body);
}

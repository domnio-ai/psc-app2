import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type CSSProperties,
  type JSX,
  type MutableRefObject,
} from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { CodeNode } from "@lexical/code";
import { LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { ListItemNode, ListNode, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
import {
  HeadingNode,
  QuoteNode,
  $createQuoteNode,
  type HeadingTagType,
  type SerializedHeadingNode,
} from "@lexical/rich-text";
import {
  $applyNodeReplacement,
  ParagraphNode,
  $getNodeByKey,
  $getNearestNodeFromDOMNode,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $isTextNode,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  DecoratorNode,
  type DOMConversionMap,
  type DOMExportOutput,
  type EditorConfig,
  type ElementFormatType,
  type LexicalEditor,
  type NodeKey,
  type SerializedLexicalNode,
  type SerializedParagraphNode,
  type Spread,
} from "lexical";
import { $patchStyleText, $setBlocksType } from "@lexical/selection";
import {
  $deleteTableColumnAtSelection,
  $deleteTableRowAtSelection,
  $findTableNode,
  $insertTableColumnAtSelection,
  $insertTableRowAtSelection,
  $isTableCellNode,
  $isTableRowNode,
  $isTableSelection,
  $mergeCells,
  $setTableRowIsHeader,
  $unmergeCell,
  INSERT_TABLE_COMMAND,
  TableCellHeaderStates,
  TableCellNode,
  TableNode,
  TableRowNode,
} from "@lexical/table";
import { $getNearestNodeOfType } from "@lexical/utils";
import { REDO_COMMAND as HISTORY_REDO_COMMAND, UNDO_COMMAND as HISTORY_UNDO_COMMAND } from "lexical";
import {
  hasNestedReportTables,
  normalizeExportedReportHtml,
  normalizeReportHtml,
  sanitizeReportHtmlForEditor,
} from "./reportHtml";
import "./lexical-editor.css";
import "../report-builder/styles/report-editor-standard.css";

type ImageAlignment = "left" | "center" | "right";
const APP2_IMPORT_HTML_TAG = "app2-import-html";
const REPORT_IMAGE_DEFAULT_WIDTH = "70%";

const safeImageSource = (source: string) => {
  const url = source.trim();
  if (!url) return false;
  if (/^(?:https?:\/\/|data:image\/(?:png|jpe?g|gif|webp);base64,)/i.test(url)) return true;
  // Permit same-origin relative URLs, but reject arbitrary schemes and
  // protocol-relative URLs that can bypass the report image source policy.
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return false;
  return !url.startsWith("//") && !url.startsWith("\\\\");
};

const safeLinkHref = (source: string) => {
  const url = source.trim();
  if (!url || url.startsWith("//") || url.startsWith("\\\\")) return false;
  if (/^(?:https?:\/\/|mailto:)/i.test(url)) return true;
  // Relative paths and in-page anchors are allowed; arbitrary schemes are not.
  return !/^[a-z][a-z0-9+.-]*:/i.test(url);
};

const safeImageWidth = (width: string | undefined) => {
  const value = String(width || REPORT_IMAGE_DEFAULT_WIDTH).trim();
  return /^(?:\d{1,3}(?:\.\d+)?%|\d{1,4}(?:\.\d+)?px)$/.test(value)
    ? value
    : REPORT_IMAGE_DEFAULT_WIDTH;
};

const imageMargins = (alignment: ImageAlignment) => ({
  marginLeft: alignment === "left" ? "0" : alignment === "right" ? "auto" : "auto",
  marginRight: alignment === "right" ? "0" : alignment === "left" ? "auto" : "auto",
});

type SerializedApp2ImageNode = Spread<{
  src: string;
  alt: string;
  width: string;
  alignment: ImageAlignment;
}, SerializedLexicalNode>;

export class App2ImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __alt: string;
  __width: string;
  __alignment: ImageAlignment;

  static getType() { return "app2-image"; }
  static clone(node: App2ImageNode) {
    return new App2ImageNode(node.__src, node.__alt, node.__width, node.__alignment, node.__key);
  }

  constructor(src: string, alt = "", width = REPORT_IMAGE_DEFAULT_WIDTH, alignment: ImageAlignment = "center", key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__alt = alt;
    this.__width = safeImageWidth(width);
    this.__alignment = alignment;
  }

  static importJSON(serializedNode: SerializedApp2ImageNode) {
    return $createApp2ImageNode(serializedNode.src, serializedNode.alt, serializedNode.width, serializedNode.alignment);
  }

  exportJSON(): SerializedApp2ImageNode {
    return {
      ...super.exportJSON(),
      src: this.getSrc(),
      alt: this.getAlt(),
      width: this.getWidth(),
      alignment: this.getAlignment(),
    };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: (_domNode: Node) => ({
        conversion: (node: HTMLElement) => {
          const image = node as HTMLImageElement;
          const src = String(image.getAttribute("src") || "").trim();
          if (!safeImageSource(src)) return { node: null };
          const styleWidth = image.style.width || image.getAttribute("width") || REPORT_IMAGE_DEFAULT_WIDTH;
          const marginLeft = image.style.marginLeft;
          const marginRight = image.style.marginRight;
          const alignment: ImageAlignment =
            marginLeft === "0px" || marginLeft === "0" ? "left" :
            marginRight === "0px" || marginRight === "0" ? "right" : "center";
          return {
            node: $createApp2ImageNode(
              src,
              String(image.getAttribute("alt") || ""),
              styleWidth,
              alignment,
            ),
          };
        },
        priority: 2,
      }),
    };
  }

  isInline() { return false; }

  createDOM(_config: EditorConfig) {
    const element = document.createElement("div");
    element.className = "app2-lexical-image-node";
    return element;
  }

  updateDOM() { return false; }

  decorate() {
    const width = this.getWidth();
    const margins = imageMargins(this.getAlignment());
    const style: CSSProperties = {
      display: "block",
      width,
      maxWidth: "100%",
      height: "auto",
      ...margins,
    };
    return (
      <img
        src={this.getSrc()}
        alt={this.getAlt()}
        title={this.getAlt() || undefined}
        data-app2-report-image="true"
        draggable={false}
        style={style}
      />
    );
  }

  exportDOM(_editor: LexicalEditor): DOMExportOutput {
    const image = document.createElement("img");
    image.setAttribute("src", this.getSrc());
    if (this.getAlt()) image.setAttribute("alt", this.getAlt());
    image.setAttribute("width", this.getWidth());
    image.style.display = "block";
    image.style.width = this.getWidth();
    image.style.maxWidth = "100%";
    image.style.height = "auto";
    const margins = imageMargins(this.getAlignment());
    image.style.marginLeft = margins.marginLeft;
    image.style.marginRight = margins.marginRight;
    return { element: image };
  }

  getSrc() { return this.getLatest().__src; }
  getAlt() { return this.getLatest().__alt; }
  getWidth() { return this.getLatest().__width; }
  getAlignment() { return this.getLatest().__alignment; }
  setSrc(src: string) { this.getWritable().__src = src; return this; }
  setAlt(alt: string) { this.getWritable().__alt = alt; return this; }
  setWidth(width: string) { this.getWritable().__width = safeImageWidth(width); return this; }
  setAlignment(alignment: ImageAlignment) { this.getWritable().__alignment = alignment; return this; }
}

export const $createApp2ImageNode = (
  src: string,
  alt = "",
  width = REPORT_IMAGE_DEFAULT_WIDTH,
  alignment: ImageAlignment = "center",
) => $applyNodeReplacement(new App2ImageNode(src, alt, width, alignment));

export const $isApp2ImageNode = (node: unknown): node is App2ImageNode => node instanceof App2ImageNode;

const MAX_REPORT_INDENT_LEVEL = 6;
const REPORT_BLOCK_ALIGNMENTS = new Set(["left", "center", "right", "justify", "start", "end"]);

const reportIndentLevelFromElement = (element: HTMLElement) => {
  const rawLevel = element.getAttribute("data-app2-indent");
  if (rawLevel !== null) {
    const parsed = Number(rawLevel);
    return Number.isFinite(parsed)
      ? Math.max(0, Math.min(MAX_REPORT_INDENT_LEVEL, Math.round(parsed)))
      : 0;
  }
  const match = element.style.marginLeft.trim().match(/^(\d+(?:\.\d+)?)(px|rem|em)$/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const level = amount / (unit === "px" ? 24 : 1.5);
  return Number.isFinite(level)
    ? Math.max(0, Math.min(MAX_REPORT_INDENT_LEVEL, Math.round(level)))
    : 0;
};

const applyImportedReportBlockAttributes = <T extends ParagraphNode | HeadingNode>(
  node: T,
  element: HTMLElement,
): T => {
  const alignment = element.style.textAlign.trim().toLowerCase();
  if (REPORT_BLOCK_ALIGNMENTS.has(alignment)) {
    node.setFormat(alignment as ElementFormatType);
  }
  node.setIndent(reportIndentLevelFromElement(element));
  if (element.dir === "ltr" || element.dir === "rtl") node.setDirection(element.dir);
  return node;
};

const applyExportedReportIndent = (element: HTMLElement, indent: number) => {
  const level = Math.max(0, Math.min(MAX_REPORT_INDENT_LEVEL, Math.round(indent || 0)));
  if (level > 0) {
    element.setAttribute("data-app2-indent", String(level));
    element.style.marginLeft = `${level * 1.5}rem`;
  } else {
    element.removeAttribute("data-app2-indent");
  }
};

/**
 * Lexical's stock paragraph/heading HTML import does not preserve App2's
 * data-app2-indent contract by itself. These nodes retain the same HTML
 * elements while mapping the existing metadata to Lexical's native indent
 * field, so indentation survives editor -> HTML -> editor round-trips.
 */
type SerializedApp2ParagraphNode = Omit<SerializedParagraphNode, "type"> & { type: "app2-paragraph" };

type SerializedApp2HeadingNode = Omit<SerializedHeadingNode, "type"> & { type: "app2-heading" };

export class App2ParagraphNode extends ParagraphNode {
  static getType() { return "app2-paragraph"; }
  static clone(node: App2ParagraphNode) { return new App2ParagraphNode(node.__key); }

  static importJSON(serializedNode: SerializedApp2ParagraphNode) {
    return $createApp2ParagraphNode().updateFromJSON(serializedNode);
  }

  exportJSON(): SerializedApp2ParagraphNode {
    return { ...super.exportJSON(), type: "app2-paragraph" };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      p: () => ({
        conversion: (element: HTMLElement) => ({
          node: applyImportedReportBlockAttributes($createApp2ParagraphNode(), element),
        }),
        priority: 2,
      }),
    };
  }

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const output = super.exportDOM(editor);
    if (output.element instanceof HTMLElement) applyExportedReportIndent(output.element, this.getIndent());
    return output;
  }
}

export const $createApp2ParagraphNode = () => $applyNodeReplacement(new App2ParagraphNode());

export class App2HeadingNode extends HeadingNode {
  static getType() { return "app2-heading"; }
  static clone(node: App2HeadingNode) { return new App2HeadingNode(node.getTag(), node.__key); }

  static importJSON(serializedNode: SerializedApp2HeadingNode) {
    return $createApp2HeadingNode(serializedNode.tag).updateFromJSON(serializedNode);
  }

  exportJSON(): SerializedApp2HeadingNode {
    return { ...super.exportJSON(), type: "app2-heading" };
  }

  static importDOM(): DOMConversionMap | null {
    const importHeading = (tag: HeadingTagType) => () => ({
      conversion: (element: HTMLElement) => ({
        node: applyImportedReportBlockAttributes($createApp2HeadingNode(tag), element),
      }),
      priority: 2 as const,
    });
    return {
      h1: importHeading("h1"),
      h2: importHeading("h2"),
      h3: importHeading("h3"),
      h4: importHeading("h4"),
      h5: importHeading("h5"),
      h6: importHeading("h6"),
    };
  }

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const output = super.exportDOM(editor);
    if (output.element instanceof HTMLElement) applyExportedReportIndent(output.element, this.getIndent());
    return output;
  }
}

export const $createApp2HeadingNode = (tag: HeadingTagType = "h2") =>
  $applyNodeReplacement(new App2HeadingNode(tag));

type App2LexicalReportEditorProps = {
  value: string;
  onChange: (html: string) => void;
  onImmediateChange?: (html: string) => void;
  editable?: boolean;
  ariaLabel?: string;
  className?: string;
};

export type App2LexicalReportEditorHandle = {
  getHTML: () => string;
  setHTML: (html: string) => boolean;
  focus: () => void;
  executeCommand: (name: string, argument?: string) => boolean;
  insertImage: (src: string, alt?: string, width?: string) => boolean;
  updateImage: (
    image: HTMLImageElement,
    patch: { src?: string; alt?: string; width?: string; alignment?: ImageAlignment },
  ) => boolean;
  removeImage: (image: HTMLImageElement) => boolean;
};

type EditorBridge = App2LexicalReportEditorHandle;

const EDITOR_THEME = {
  paragraph: "app2-lexical-paragraph",
  heading: {
    h1: "app2-lexical-heading app2-lexical-heading-1",
    h2: "app2-lexical-heading app2-lexical-heading-2",
    h3: "app2-lexical-heading app2-lexical-heading-3",
    h4: "app2-lexical-heading app2-lexical-heading-4",
    h5: "app2-lexical-heading app2-lexical-heading-5",
    h6: "app2-lexical-heading app2-lexical-heading-6",
  },
  quote: "app2-lexical-quote",
  list: {
    ul: "app2-lexical-list app2-lexical-list-unordered",
    ol: "app2-lexical-list app2-lexical-list-ordered",
    listitem: "app2-lexical-list-item",
  },
  link: "app2-lexical-link",
  text: {
    bold: "app2-lexical-bold",
    italic: "app2-lexical-italic",
    underline: "app2-lexical-underline",
    strikethrough: "app2-lexical-strikethrough",
    code: "app2-lexical-code",
  },
  table: "app2-report-table",
  tableCell: "app2-report-table-cell",
  tableCellHeader: "app2-report-table-header",
  tableCellSelected: "app2-lexical-table-cell-selected",
  tableRow: "app2-lexical-table-row",
};

const isLexicalEditorFocused = (editor: LexicalEditor) => {
  const root = editor.getRootElement();
  return Boolean(root && document.activeElement && root.contains(document.activeElement));
};

const createEditorDocument = (editor: LexicalEditor, html: string) => {
  const sanitized = sanitizeReportHtmlForEditor(html);
  const dom = new DOMParser().parseFromString(sanitized, "text/html");
  const nodes = $generateNodesFromDOM(editor, dom);
  const root = $getRoot();
  root.clear();
  root.select();
  if (nodes.length) $insertNodes(nodes);
  if (root.getChildrenSize() === 0) root.append($createApp2ParagraphNode());
  root.selectEnd();
};

const editorHTML = (editor: LexicalEditor) =>
  editor.read(() => normalizeExportedReportHtml($generateHtmlFromNodes(editor, null)));

const findTableForSelection = () => {
  const selection = $getSelection();
  if (!selection) return null;
  for (const node of selection.getNodes()) {
    const table = $findTableNode(node);
    if (table) return table;
  }
  return null;
};

const findSelectedImageKey = (editor: LexicalEditor, image: HTMLImageElement): NodeKey | null => {
  let result: NodeKey | null = null;
  editor.read(() => {
    const node = $getNearestNodeFromDOMNode(image);
    if ($isApp2ImageNode(node)) result = node.getKey();
  });
  return result;
};

function EditorBridgePlugin({
  apiRef,
  value,
  onChange,
  onImmediateChange,
  editable,
}: {
  apiRef: MutableRefObject<EditorBridge | null>;
  value: string;
  onChange: App2LexicalReportEditorProps["onChange"];
  onImmediateChange: App2LexicalReportEditorProps["onImmediateChange"];
  editable: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const changeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHtmlRef = useRef<string | null>(null);
  const emittedHtmlEchoesRef = useRef<string[]>([]);
  const lastIncomingHtmlRef = useRef(normalizeReportHtml(value));
  const latestOnChangeRef = useRef(onChange);
  const latestOnImmediateChangeRef = useRef(onImmediateChange);
  const latestValueRef = useRef(normalizeReportHtml(value));
  const latestEditableRef = useRef(editable);

  useEffect(() => { latestEditableRef.current = editable; }, [editable]);
  useEffect(() => { latestOnChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { latestOnImmediateChangeRef.current = onImmediateChange; }, [onImmediateChange]);

  useEffect(() => {
    const clearTimer = () => {
      if (changeTimerRef.current !== null) {
        window.clearTimeout(changeTimerRef.current);
        changeTimerRef.current = null;
      }
    };
    const flushPending = () => {
      clearTimer();
      const pending = pendingHtmlRef.current;
      pendingHtmlRef.current = null;
      if (pending !== null) latestOnChangeRef.current(pending);
    };
    const unregisterUpdateListener = editor.registerUpdateListener(({ tags }) => {
      if (tags.has(APP2_IMPORT_HTML_TAG)) return;
      const html = editor.read(() => normalizeExportedReportHtml($generateHtmlFromNodes(editor, null)));
      if (html === latestValueRef.current) return;
      latestValueRef.current = html;
      latestOnImmediateChangeRef.current?.(html);
      pendingHtmlRef.current = html;
      clearTimer();
      changeTimerRef.current = window.setTimeout(() => {
        changeTimerRef.current = null;
        const pending = pendingHtmlRef.current;
        pendingHtmlRef.current = null;
        if (pending === null) return;
        const echoes = emittedHtmlEchoesRef.current.filter((item) => item !== pending);
        echoes.push(pending);
        emittedHtmlEchoesRef.current = echoes.slice(-12);
        latestOnChangeRef.current(pending);
      }, 120);
    });

    const incoming = normalizeReportHtml(value);
    lastIncomingHtmlRef.current = incoming;
    latestValueRef.current = incoming;
    if (!hasNestedReportTables(incoming)) {
      editor.update(() => createEditorDocument(editor, incoming), { tag: APP2_IMPORT_HTML_TAG, discrete: true });
    }

    const bridge: EditorBridge = {
      getHTML: () => editorHTML(editor),
      setHTML: (html) => {
        if (!latestEditableRef.current || hasNestedReportTables(html)) return false;
        clearTimer();
        pendingHtmlRef.current = null;
        const normalized = normalizeReportHtml(html);
        lastIncomingHtmlRef.current = normalized;
        latestValueRef.current = normalized;
        editor.update(() => createEditorDocument(editor, normalized), { tag: APP2_IMPORT_HTML_TAG, discrete: true });
        return true;
      },
      focus: () => editor.focus(),
      executeCommand: (name, argument) => {
        if (!latestEditableRef.current) return false;
        // Match the previous editor's focus-restoring command contract so
        // toolbar clicks in Task, Assignment and Research retain the selection.
        editor.focus();
        if (name === "undo") return editor.dispatchCommand(HISTORY_UNDO_COMMAND, undefined);
        if (name === "redo") return editor.dispatchCommand(HISTORY_REDO_COMMAND, undefined);
        if (name === "insertUnorderedList") return editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
        if (name === "insertOrderedList") return editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
        if (name === "createLink") return argument && safeLinkHref(argument) ? editor.dispatchCommand(TOGGLE_LINK_COMMAND, argument.trim()) : false;
        if (name === "unlink") return editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
        if (name === "insertTable") return editor.dispatchCommand(INSERT_TABLE_COMMAND, { rows: "3", columns: "3", includeHeaders: { rows: true, columns: false } });

        let result = false;
        editor.update(() => {
          const selection = $getSelection();
          if (!selection) return;
          switch (name) {
            case "bold": result = editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold"); return;
            case "italic": result = editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic"); return;
            case "underline": result = editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline"); return;
            case "strikeThrough": result = editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough"); return;
            case "fontName":
              if (argument && $isRangeSelection(selection)) {
                $patchStyleText(selection, { "font-family": argument });
                result = true;
              }
              return;
            case "fontSize": {
              const size = Number(argument);
              if (Number.isFinite(size) && size >= 6 && size <= 96 && $isRangeSelection(selection)) {
                $patchStyleText(selection, { "font-size": `${size}px` });
                result = true;
              }
              return;
            }
            case "justifyLeft": result = editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "left"); return;
            case "justifyCenter": result = editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "center"); return;
            case "justifyRight": result = editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "right"); return;
            case "justifyFull": result = editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "justify"); return;
            case "formatBlock":
              if (argument === "h2") $setBlocksType(selection, () => $createApp2HeadingNode("h2"));
              else if (argument === "h3") $setBlocksType(selection, () => $createApp2HeadingNode("h3"));
              else if (argument === "blockquote") $setBlocksType(selection, () => $createQuoteNode());
              else if (argument === "p") $setBlocksType(selection, () => $createApp2ParagraphNode());
              else return;
              result = true;
              return;
            case "indent":
            case "outdent": {
              if (!$isRangeSelection(selection)) return;
              const anchorNode = selection.anchor.getNode();
              const listItem = $getNearestNodeOfType(anchorNode, ListItemNode);
              if (listItem) {
                result = editor.dispatchCommand(name === "indent" ? INDENT_CONTENT_COMMAND : OUTDENT_CONTENT_COMMAND, undefined);
                return;
              }
              // Indent the nearest paragraph/heading, not the document's top-level
              // table when the caret is inside a table cell.
              const reportBlock =
                $getNearestNodeOfType(anchorNode, ParagraphNode) ??
                $getNearestNodeOfType(anchorNode, HeadingNode);
              if (!reportBlock) return;
              const current = reportBlock.getIndent();
              const next = name === "indent" ? Math.min(current + 1, 6) : Math.max(current - 1, 0);
              reportBlock.setIndent(next);
              result = true;
              return;
            }
            case "removeFormat":
              if (!$isRangeSelection(selection)) return;
              for (const node of selection.getNodes()) {
                if ($isTextNode(node)) {
                  node.setFormat(0);
                  node.setStyle("");
                }
              }
              $patchStyleText(selection, {
                "font-family": null,
                "font-size": null,
                color: null,
                "background-color": null,
                "text-decoration": null,
              });
              result = true;
              return;
            case "addRowAfter":
              if (!findTableForSelection()) return;
              $insertTableRowAtSelection(true);
              result = true;
              return;
            case "deleteRow":
              if (!findTableForSelection()) return;
              $deleteTableRowAtSelection();
              result = true;
              return;
            case "addColumnAfter":
              if (!findTableForSelection()) return;
              $insertTableColumnAtSelection(true);
              result = true;
              return;
            case "deleteColumn":
              if (!findTableForSelection()) return;
              $deleteTableColumnAtSelection();
              result = true;
              return;
            case "mergeCells": {
              if (!$isTableSelection(selection)) return;
              const selectedCells = selection.getNodes().filter($isTableCellNode);
              if (selectedCells.length < 2) return;
              result = $mergeCells(selectedCells) !== null;
              return;
            }
            case "splitCell": {
              if (!$isRangeSelection(selection) && !$isTableSelection(selection)) return;
              const selectedCell = $getNearestNodeOfType(selection.anchor.getNode(), TableCellNode);
              if (
                !$isTableCellNode(selectedCell) ||
                (selectedCell.getColSpan() <= 1 && selectedCell.getRowSpan() <= 1)
              ) return;
              $unmergeCell();
              result = true;
              return;
            }
            case "toggleHeaderRow": {
              const table = findTableForSelection();
              const firstRow = table?.getFirstChild();
              if (!table || !$isTableRowNode(firstRow)) return;
              const cells = firstRow.getChildren().filter($isTableCellNode);
              if (!cells.length) return;
              const isHeader = cells.every((cell) => cell.hasHeaderState(TableCellHeaderStates.ROW));
              const rowIndex = table.getChildren().findIndex((row) => row.is(firstRow));
              if (rowIndex < 0) return;
              $setTableRowIsHeader(table, rowIndex, !isHeader);
              result = true;
              return;
            }
            case "deleteTable": {
              const table = findTableForSelection();
              if (!table) return;
              table.remove();
              result = true;
              return;
            }
            default: return;
          }
        }, { discrete: true });
        return result;
      },
      insertImage: (src, alt = "", width = REPORT_IMAGE_DEFAULT_WIDTH) => {
        if (!latestEditableRef.current || !safeImageSource(src)) return false;
        editor.update(() => {
          $insertNodes([$createApp2ImageNode(src, alt, width, "center")]);
        }, { discrete: true });
        return true;
      },
      updateImage: (image, patch) => {
        if (!latestEditableRef.current) return false;
        const key = findSelectedImageKey(editor, image);
        if (!key) return false;
        let updated = false;
        editor.update(() => {
          const node = $getNodeByKey(key);
          if (!$isApp2ImageNode(node)) return;
          if (patch.src !== undefined) {
            if (!safeImageSource(patch.src)) return;
            node.setSrc(patch.src);
          }
          if (patch.alt !== undefined) node.setAlt(patch.alt);
          if (patch.width !== undefined) node.setWidth(patch.width);
          if (patch.alignment !== undefined) node.setAlignment(patch.alignment);
          updated = true;
        }, { discrete: true });
        return updated;
      },
      removeImage: (image) => {
        if (!latestEditableRef.current) return false;
        const key = findSelectedImageKey(editor, image);
        if (!key) return false;
        let removed = false;
        editor.update(() => {
          const node = $getNodeByKey(key);
          if (!$isApp2ImageNode(node)) return;
          node.remove();
          removed = true;
        }, { discrete: true });
        return removed;
      },
    };
    apiRef.current = bridge;

    return () => {
      unregisterUpdateListener();
      if (changeTimerRef.current !== null) window.clearTimeout(changeTimerRef.current);
      if (pendingHtmlRef.current !== null) latestOnChangeRef.current(pendingHtmlRef.current);
      apiRef.current = null;
    };
  // The plugin lifecycle follows the Lexical editor instance; callbacks are read through refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => {
    const incoming = normalizeReportHtml(value);
    if (incoming === lastIncomingHtmlRef.current) return;
    lastIncomingHtmlRef.current = incoming;
    if (emittedHtmlEchoesRef.current.includes(incoming)) return;
    if (isLexicalEditorFocused(editor) || hasNestedReportTables(incoming)) return;
    const current = editorHTML(editor);
    if (incoming === current) return;
    latestValueRef.current = incoming;
    editor.update(() => createEditorDocument(editor, incoming), { tag: APP2_IMPORT_HTML_TAG, discrete: true });
  }, [editor, value]);

  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);
  return null;
}

export const App2LexicalReportEditor = forwardRef<
  App2LexicalReportEditorHandle,
  App2LexicalReportEditorProps
>(function App2LexicalReportEditor({
  value,
  onChange,
  onImmediateChange,
  editable = true,
  ariaLabel = "Report document editor",
  className = "",
}, ref) {
  const normalizedValue = useMemo(() => normalizeReportHtml(value), [value]);
  const nestedTableContent = useMemo(() => hasNestedReportTables(normalizedValue), [normalizedValue]);
  const apiRef = useRef<EditorBridge | null>(null);
  const initialConfig = useMemo(() => ({
    namespace: "App2LexicalReportEditor",
    theme: EDITOR_THEME,
    nodes: [
      HeadingNode,
      App2HeadingNode,
      App2ParagraphNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      LinkNode,
      TableNode,
      TableRowNode,
      TableCellNode,
      App2ImageNode,
      CodeNode,
      HorizontalRuleNode,
    ],
    onError(error: Error) {
      console.error("App2 report editor error", error);
    },
    editorState: null,
  }), []);

  useImperativeHandle(ref, () => ({
    getHTML: () => nestedTableContent ? normalizedValue : apiRef.current?.getHTML() ?? normalizedValue,
    setHTML: (html) => nestedTableContent ? false : apiRef.current?.setHTML(html) ?? false,
    focus: () => { if (!nestedTableContent) apiRef.current?.focus(); },
    executeCommand: (name, argument) => nestedTableContent ? false : apiRef.current?.executeCommand(name, argument) ?? false,
    insertImage: (src, alt, width) => nestedTableContent ? false : apiRef.current?.insertImage(src, alt, width) ?? false,
    updateImage: (image, patch) => nestedTableContent ? false : apiRef.current?.updateImage(image, patch) ?? false,
    removeImage: (image) => nestedTableContent ? false : apiRef.current?.removeImage(image) ?? false,
  }), [normalizedValue, nestedTableContent]);

  if (nestedTableContent) {
    return (
      <div className={`app2-lexical-editor-engine app2-lexical-nested-table-blocked ${className}`.trim()} data-editor-engine="lexical">
        <div className="app2-lexical-nested-table-notice" role="alert">
          <strong>This report contains a nested table.</strong>
          <p>Editing is disabled to prevent table data loss. Lexical does not officially support nested tables. Keep this original content intact and convert the nested table to a flat table before editing.</p>
        </div>
        <label className="app2-lexical-raw-content-label" htmlFor="app2-lexical-unsupported-html">Preserved original report HTML</label>
        <textarea id="app2-lexical-unsupported-html" readOnly value={normalizedValue} rows={8} />
      </div>
    );
  }

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className={`app2-lexical-editor-engine ${className}`.trim()} data-editor-engine="lexical" data-editor-schema="app2-report-html-v1">
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="app2-lexical-document"
              role="textbox"
              aria-label={ariaLabel}
              aria-multiline="true"
              spellCheck={true}
            />
          }
          placeholder={<div className="app2-lexical-placeholder">Write the report here...</div>}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <TablePlugin hasCellMerge={true} hasCellBackgroundColor={true} hasHorizontalScroll={true} hasNestedTables={false} />
        <EditorBridgePlugin
          apiRef={apiRef}
          value={normalizedValue}
          onChange={onChange}
          onImmediateChange={onImmediateChange}
          editable={editable}
        />
      </div>
    </LexicalComposer>
  );
});

export default App2LexicalReportEditor;

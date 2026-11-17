import sanitizeHtml from "sanitize-html";
import {
  AlignmentType,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
} from "docx";

const ALLOWED_TAGS = [
  "p", "br", "hr", "div", "span", "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "del", "sup", "sub", "code", "pre",
  "ul", "ol", "li", "blockquote", "table", "thead", "tbody", "tfoot", "tr",
  "th", "td", "colgroup", "col", "a", "img", "figure", "figcaption",
  "main", "header", "article", "footer", "section",
];

const ALLOWED_STYLE_RULES = {
  "text-align": [/^(?:left|right|center|justify)$/i],
  "font-size": [/^\d{1,3}(?:\.\d+)?(?:px|pt|em|rem|%)$/i],
  "font-family": [/^[a-zA-Z0-9 ,_'"-]{1,100}$/],
  color: [/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i],
  "background-color": [/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i],
  width: [/^\d{1,4}(?:\.\d+)?(?:px|%)$/i],
  "min-width": [/^\d{1,4}(?:\.\d+)?(?:px|%)$/i],
  "max-width": [/^\d{1,4}(?:\.\d+)?(?:px|%)$/i],
  height: [/^(?:auto|\d{1,4}(?:\.\d+)?(?:px|%))$/i],
  "min-height": [/^\d{1,4}(?:\.\d+)?(?:px|%)$/i],
  display: [/^block$/i],
  "border-collapse": [/^(?:collapse|separate)$/i],
  "table-layout": [/^(?:auto|fixed)$/i],
  "vertical-align": [/^(?:top|middle|bottom|baseline)$/i],
  "font-weight": [/^(?:normal|bold|[1-9]00)$/i],
  "line-height": [/^(?:normal|\d{1,2}(?:\.\d+)?|\d{1,3}(?:\.\d+)?(?:px|pt|em|rem|%))$/i],
  padding: [/^\d{1,3}(?:\.\d+)?(?:px|pt|em|rem)(?:\s+\d{1,3}(?:\.\d+)?(?:px|pt|em|rem)){0,3}$/i],
  border: [/^(?:0|\d{1,3}(?:\.\d+)?px\s+(?:solid|dashed|dotted|double)\s+(?:#[0-9a-f]{3,6}|black|white|gray|grey|transparent))$/i],
  "white-space": [/^(?:normal|nowrap|pre-wrap|pre-line)$/i],
  "overflow-wrap": [/^(?:normal|anywhere|break-word)$/i],
  "word-break": [/^(?:normal|break-all|keep-all)$/i],
  "text-decoration": [/^(?:none|underline|line-through|overline)$/i],
  "margin-left": [/^\d{1,3}(?:\.\d+)?(?:px|em|rem)$/i],
  "margin-right": [/^(?:auto|\d{1,3}(?:\.\d+)?(?:px|em|rem))$/i],
};

const recoverEscapedTaskReportMarkup = (value) => {
  const source = String(value ?? "");
  const escapedTags = source.match(/&(?:amp;)*lt;\s*\/?\s*(?:p|br|hr|div|span|h[1-6]|strong|b|em|i|u|s|ul|ol|li|blockquote|table|thead|tbody|tr|th|td|colgroup|col|a|img)\b/gi) || [];
  if (escapedTags.length < 2) return source;
  return source
    .replace(/&(?:amp;)*lt;/gi, "<")
    .replace(/&(?:amp;)*gt;/gi, ">")
    .replace(/&(?:amp;)*quot;/gi, '"')
    .replace(/&(?:amp;)*(?:#0*39;|apos;)/gi, "'");
};

export const sanitizeTaskReportHtml = (value) => sanitizeHtml(recoverEscapedTaskReportMarkup(value), {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    "*": ["style", "class", "data-app2-indent"],
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "style"],
    table: ["data-orientation"],
    col: ["span", "style", "width"],
    th: ["colspan", "rowspan", "colwidth", "scope", "style"],
    td: ["colspan", "rowspan", "colwidth", "style"],
  },
  allowedClasses: {
    p: ["empty", "app2-task-report-kicker", "app2-task-report-meta-item", "app2-task-report-empty"],
  div: ["empty", "app2-psc-report-brand", "app2-task-report-draft", "app2-task-report-meta", "app2-task-report-section", "app2-task-report-section-content", "app2-repository-report-content", "app2-repository-document-control-heading", "imported-page-break", "app2-page-break", "identity", "draft-banner", "meta"],
    main: ["paper"],
    header: ["identity"],
    article: ["content"],
    footer: ["foot"],
    section: ["meta", "app2-repository-report-cover", "app2-repository-document-control"],
    span: ["empty"],
    h1: ["app2-task-report-title"],
    h2: ["app2-task-report-section-title"],
    table: ["app2-report-table"],
    th: ["app2-report-table-header"],
    td: ["app2-report-table-cell"],
  },
  allowedStyles: { "*": ALLOWED_STYLE_RULES },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
  },
  exclusiveFilter: (frame) => frame.tag === "img" && (
    !frame.attribs.src || /^data:image\/svg\+xml/i.test(frame.attribs.src)
  ),
}).trim();

const decodeHtmlEntity = (entity) => {
  const normalized = entity.toLowerCase();
  if (normalized === "&nbsp;") return "\u00a0";
  if (normalized === "&amp;") return "&";
  if (normalized === "&lt;") return "<";
  if (normalized === "&gt;") return ">";
  if (normalized === "&quot;") return '"';
  if (normalized === "&apos;" || normalized === "&#39;") return "'";
  const numeric = normalized.match(/^&#(x[0-9a-f]+|\d+);$/i)?.[1];
  if (!numeric) return entity;
  const codePoint = numeric[0].toLowerCase() === "x"
    ? parseInt(numeric.slice(1), 16)
    : Number(numeric);
  try { return String.fromCodePoint(codePoint); } catch { return entity; }
};

const decodeHtmlText = (value) => String(value ?? "")
  .replace(/&(?:#(?:x[0-9a-f]+|\d+)|nbsp|amp|lt|gt|quot|apos);/gi, decodeHtmlEntity);

const textForRuns = (runs) => (runs ?? []).map((run) => run.text ?? "").join("");

export const taskReportHtmlToPlainText = (value) => String(value ?? "")
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<\/(td|th)>/gi, " | ")
  .replace(/<\/tr>/gi, "\n")
  .replace(/<\/p>|<\/li>|<\/h[1-6]>/gi, "\n")
  .replace(/<li[^>]*>/gi, "• ")
  .replace(/<[^>]+>/g, "")
  .replace(/&(?:#(?:x[0-9a-f]+|\d+)|nbsp|amp|lt|gt|quot|apos);/gi, decodeHtmlEntity)
  .replace(/ \|[ \t]*(?=\n|$)/g, "")
  .replace(/[ \t]+\n/g, "\n")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

const pdfInlineRuns = (nodes, inherited = {}) => {
  const runs = [];
  for (const node of nodes ?? []) {
    if (node.tag === "#text") {
      if (node.text) runs.push({ text: node.text, ...inherited });
      continue;
    }
    if (node.tag === "br") {
      runs.push({ text: "", lineBreak: true, ...inherited });
      continue;
    }
    if (node.tag === "img") {
      const alt = String(node.attrs?.alt ?? "").trim();
      if (alt) runs.push({ text: `[${alt}]`, ...inherited });
      continue;
    }
    const format = mergeFormat(node, inherited);
    if (["p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "pre"].includes(node.tag)) {
      const content = pdfInlineRuns(node.children, format);
      if (content.length && runs.length && !String(runs.at(-1)?.text ?? "").endsWith("\n")) {
        runs.push({ text: "\n", ...inherited });
      }
      runs.push(...content);
      if (content.length && !String(runs.at(-1)?.text ?? "").endsWith("\n")) {
        runs.push({ text: "\n", ...inherited });
      }
      continue;
    }
    if (node.tag === "a") {
      const href = String(node.attrs?.href ?? "");
      runs.push(...pdfInlineRuns(node.children, {
        ...format,
        ...( /^(?:https?:\/\/|mailto:)/i.test(href) ? { link: href } : {}),
      }));
      continue;
    }
    runs.push(...pdfInlineRuns(node.children, format));
  }
  return runs;
};

const pdfBlocksFromNodes = (nodes, blocks = []) => {
  for (const node of nodes ?? []) {
    if (node.tag === "#text") {
      const text = node.text.replace(/\u00a0/g, " ").trim();
      if (text) blocks.push({ type: "paragraph", runs: [{ text }] });
      continue;
    }
    if (node.tag === "img") {
      const image = taskReportImageToPdfBlock(node);
      if (image) {
        blocks.push(image);
      } else {
        const alt = String(node.attrs?.alt || "").trim();
        if (alt) blocks.push({ type: "paragraph", runs: [{ text: `[${alt}]` }] });
      }
      continue;
    }
    if (node.tag === "div" && /(?:^|\s)(?:imported-page-break|app2-page-break)(?:\s|$)/.test(node.attrs?.class || "")) {
      blocks.push({ type: "pageBreak" });
      continue;
    }
    if (node.tag === "table") {
      const tableRows = descendants(node, "tr").map((row) => (row.children ?? [])
        .filter((cell) => cell.tag === "th" || cell.tag === "td")
        .map((cell) => {
          const styles = styleMap(cell.attrs?.style);
          const background = String(styles["background-color"] ?? "").match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
          const color = String(styles.color ?? "").match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
          return {
            header: cell.tag === "th",
            align: ["left", "center", "right", "justify"].includes(styles["text-align"]?.toLowerCase())
              ? styles["text-align"].toLowerCase() : "left",
            ...(background ? { background: `#${background}` } : {}),
            ...(color ? { color: `#${color}` } : {}),
            runs: pdfInlineRuns(cell.children),
          };
        }));
      const firstRow = tableRows[0] ?? [];
      const headerLabel = /^(?:#|no\.?|step|actor|timeline|system(?: behaviour| behavior)?|output(?:\s*\/\s*record)?|report|req(?:uirement)?(?:\.?\s*ref(?:erence)?)?|reference|remarks?|responsible(?: officer)?|target date|status|action(?:\s*\/\s*follow[- ]?up)?)\b/i;
      const inferredHeader = tableRows.length > 1 && firstRow.length >= 3 &&
        firstRow.filter((cell) => headerLabel.test(taskReportHtmlToPlainText(textForRuns(cell.runs)))).length >= Math.ceil(firstRow.length * 0.5);
      const rows = tableRows.map((row, rowIndex) => row.map((cell) => ({
        ...cell,
        header: cell.header || (inferredHeader && rowIndex === 0),
      })));
      if (rows.length) blocks.push({ type: "table", rows, orientation: node.attrs?.["data-orientation"] || null });
      continue;
    }
    if (node.tag === "ul" || node.tag === "ol") {
      const items = (node.children ?? []).filter((child) => child.tag === "li");
      items.forEach((item, index) => {
        const nested = (item.children ?? []).filter((child) => child.tag === "ul" || child.tag === "ol");
        const content = (item.children ?? []).filter((child) => !["ul", "ol"].includes(child.tag));
        const marker = node.tag === "ol" ? `${index + 1}. ` : "• ";
        blocks.push({ type: "paragraph", list: true, runs: [{ text: marker }, ...pdfInlineRuns(content)] });
        nested.forEach((child) => pdfBlocksFromNodes([child], blocks));
      });
      continue;
    }
    if (node.tag === "hr") {
      blocks.push({ type: "rule" });
      continue;
    }
    if (["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "figcaption"].includes(node.tag)) {
      const style = styleMap(node.attrs?.style);
      const heading = /^h[1-6]$/.test(node.tag) ? Number(node.tag.slice(1)) : 0;
      const align = ["left", "center", "right", "justify"].includes(style["text-align"]?.toLowerCase())
        ? style["text-align"].toLowerCase() : "left";
      let runs = [];
      for (const run of pdfInlineRuns(node.children)) {
        if (run.lineBreak) {
          blocks.push({ type: "paragraph", heading, align, runs });
          runs = [];
        } else runs.push(run);
      }
      blocks.push({ type: "paragraph", heading, align, runs });
      continue;
    }
    pdfBlocksFromNodes(node.children, blocks);
  }
  return blocks;
};

export const taskReportHtmlToPdfBlocks = (value) => {
  const sanitized = sanitizeTaskReportHtml(String(value ?? ""));
  return pdfBlocksFromNodes(parseHtmlFragment(sanitized));
};

const VOID_TAGS = new Set(["br", "hr", "img"]);
const BLOCK_TAGS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "div", "blockquote", "pre", "figure", "figcaption"]);

const parseAttributes = (source) => {
  const attrs = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = pattern.exec(source))) {
    const key = match[1].toLowerCase();
    if (key === "style" || key === "class" || key === "href" || key === "src" || key === "alt" ||
        key === "title" || key === "width" || key === "height" || key === "colspan" ||
        key === "rowspan" || key === "scope" || key === "data-app2-indent" || key === "data-orientation") {
      attrs[key] = decodeHtmlText(match[2] ?? match[3] ?? match[4] ?? "");
    }
  }
  return attrs;
};

const parseHtmlFragment = (html) => {
  const root = { tag: "#root", attrs: {}, children: [] };
  const stack = [root];
  const tokens = String(html ?? "").match(/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-zA-Z][^>]*>|[^<]+|</g) ?? [];
  for (const token of tokens) {
    if (token.startsWith("<!--") || /^<!/i.test(token)) continue;
    const close = token.match(/^<\s*\/\s*([a-zA-Z][\w-]*)[^>]*>$/);
    if (close) {
      const tag = close[1].toLowerCase();
      for (let index = stack.length - 1; index > 0; index -= 1) {
        if (stack[index].tag === tag) {
          stack.length = index;
          break;
        }
      }
      continue;
    }
    const open = token.match(/^<\s*([a-zA-Z][\w-]*)([\s\S]*?)>$/);
    if (open) {
      const tag = open[1].toLowerCase();
      const attrs = parseAttributes(open[2].replace(/\/\s*$/, ""));
      const node = { tag, attrs, children: [] };
      stack[stack.length - 1].children.push(node);
      if (!VOID_TAGS.has(tag) && !/\/\s*>$/.test(token)) stack.push(node);
      continue;
    }
    if (token === "<") {
      stack[stack.length - 1].children.push({ tag: "#text", text: "<", attrs: {}, children: [] });
      continue;
    }
    stack[stack.length - 1].children.push({ tag: "#text", text: decodeHtmlText(token), attrs: {}, children: [] });
  }
  return root.children;
};

const styleMap = (styleText) => Object.fromEntries(String(styleText ?? "")
  .split(";")
  .map((chunk) => {
    const separator = chunk.indexOf(":");
    return separator < 0 ? null : [chunk.slice(0, separator).trim().toLowerCase(), chunk.slice(separator + 1).trim()];
  })
  .filter(Boolean));

const mergeFormat = (node, parent = {}) => {
  const format = { ...parent };
  const tag = node.tag;
  const styles = styleMap(node.attrs?.style);
  if (["strong", "b"].includes(tag)) format.bold = true;
  if (["em", "i"].includes(tag)) format.italics = true;
  if (tag === "u") format.underline = true;
  if (["s", "del"].includes(tag)) format.strike = true;
  if (tag === "code" || tag === "pre") format.font = "Consolas";
  const color = String(styles.color ?? "").match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (color) {
    const hex = color[1];
    format.color = (hex.length === 3 ? [...hex].map((digit) => `${digit}${digit}`).join("") : hex).toUpperCase();
  }
  if (styles["font-family"]) format.font = styles["font-family"].split(",")[0].replace(/["']/g, "").trim();
  const size = styles["font-size"]?.match(/^(\d+(?:\.\d+)?)(px|pt)$/i);
  if (size) {
    const points = Number(size[1]) * (size[2].toLowerCase() === "px" ? 0.75 : 1);
    if (points >= 6 && points <= 48) format.size = Math.round(points * 2);
  }
  return format;
};

const textRun = (text, format = {}) => new TextRun({
  text,
  ...(format.bold ? { bold: true } : {}),
  ...(format.italics ? { italics: true } : {}),
  ...(format.underline ? { underline: { type: UnderlineType.SINGLE } } : {}),
  ...(format.strike ? { strike: true } : {}),
  ...(format.color ? { color: format.color } : {}),
  ...(format.font ? { font: format.font } : {}),
  ...(format.size ? { size: format.size } : {}),
});

const safeImageBuffer = (src) => {
  const match = String(src ?? "").match(/^data:image\/(png|jpe?g|gif);base64,([a-z0-9+/=\r\n]+)$/i);
  if (!match) return null;
  try {
    const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
    if (!buffer.length || buffer.length > 8 * 1024 * 1024) return null;
    const type = match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
    let width = 640;
    let height = 420;
    if (type === "png" && buffer.length > 24 && buffer.toString("ascii", 1, 4) === "PNG") {
      width = buffer.readUInt32BE(16);
      height = buffer.readUInt32BE(20);
    } else if (type === "gif" && buffer.length > 10) {
      width = buffer.readUInt16LE(6);
      height = buffer.readUInt16LE(8);
    } else if (type === "jpg") {
      let offset = 2;
      while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) { offset += 1; continue; }
        const marker = buffer[offset + 1];
        offset += 2;
        if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
        if (offset + 7 >= buffer.length) break;
        const length = buffer.readUInt16BE(offset);
        if (length < 2 || offset + length > buffer.length) break;
        if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
          height = buffer.readUInt16BE(offset + 3);
          width = buffer.readUInt16BE(offset + 5);
          break;
        }
        offset += length;
      }
    }
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return null;
    const ratio = Math.min(1, 520 / width, 650 / height);
    return { data: buffer, type, width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
  } catch {
    return null;
  }
};

// PDFKit and DOCX use the same normalized raster formats for controlled copies.
export const taskReportImageToPdfBlock = (node) => {
  const image = safeImageBuffer(node?.attrs?.src);
  if (!image) return null;
  return {
    type: "image",
    data: image.data.toString("base64"),
    format: image.type,
    width: image.width,
    height: image.height,
    alt: String(node?.attrs?.alt || "Report figure"),
  };
};

const inlineRuns = (nodes, inherited = {}) => {
  const runs = [];
  for (const node of nodes ?? []) {
    if (node.tag === "#text") {
      const value = node.text.replace(/\s+/g, " ");
      if (value) runs.push(textRun(value, inherited));
      continue;
    }
    const format = mergeFormat(node, inherited);
    if (node.tag === "br") {
      runs.push(new TextRun({ text: "", break: 1, ...(format.bold ? { bold: true } : {}), ...(format.italics ? { italics: true } : {}) }));
      continue;
    }
    if (node.tag === "img") {
      const embedded = safeImageBuffer(node.attrs?.src);
      if (embedded) {
        const widthStyle = String(node.attrs?.style ?? "").match(/width\s*:\s*(\d+(?:\.\d+)?)%/i);
        const scale = widthStyle ? Math.min(1, Number(widthStyle[1]) / 100) : 1;
        runs.push(new ImageRun({ data: embedded.data, type: embedded.type, transformation: { width: Math.max(1, Math.round(embedded.width * scale)), height: Math.max(1, Math.round(embedded.height * scale)) }, altText: { title: node.attrs?.alt || "Report image", description: node.attrs?.alt || "Report image", name: node.attrs?.alt || "Report image" } }));
      } else {
        const src = String(node.attrs?.src ?? "");
        const alt = String(node.attrs?.alt ?? "Embedded image").trim() || "Embedded image";
        if (/^https?:\/\//i.test(src)) runs.push(new ExternalHyperlink({ link: src, children: [textRun(`[${alt} — open image]`, format)] }));
        else runs.push(textRun(`[${alt} — image unavailable in final document]`, format));
      }
      continue;
    }
    const children = inlineRuns(node.children, format);
    if (node.tag === "a") {
      const href = String(node.attrs?.href ?? "");
      if (/^(?:https?:\/\/|mailto:)/i.test(href)) runs.push(new ExternalHyperlink({ link: href, children: children.length ? children : [textRun(href, format)] }));
      else runs.push(...children);
    } else {
      runs.push(...children);
    }
  }
  return runs;
};

const descendants = (node, tag, found = []) => {
  for (const child of node.children ?? []) {
    if (child.tag === tag) found.push(child);
    descendants(child, tag, found);
  }
  return found;
};

const paragraphFromNode = (node, extraFormat = {}) => {
  const runs = inlineRuns(node.children, extraFormat);
  const style = styleMap(node.attrs?.style);
  const options = { children: runs.length ? runs : [new TextRun("")] };
  const alignments = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED };
  if (alignments[style["text-align"]?.toLowerCase()]) options.alignment = alignments[style["text-align"].toLowerCase()];
  const indentLevel = Number(node.attrs?.["data-app2-indent"] || 0);
  if (Number.isFinite(indentLevel) && indentLevel > 0) options.indent = { left: Math.min(indentLevel, 6) * 360 };
  const headingMap = { h1: HeadingLevel.HEADING_1, h2: HeadingLevel.HEADING_2, h3: HeadingLevel.HEADING_3, h4: HeadingLevel.HEADING_4, h5: HeadingLevel.HEADING_5, h6: HeadingLevel.HEADING_6 };
  if (headingMap[node.tag]) options.heading = headingMap[node.tag];
  if (node.tag === "blockquote") options.indent = { left: 360, right: 180 };
  return new Paragraph(options);
};

const listToBlocks = (node, level = 0) => {
  const out = [];
  const listItems = (node.children ?? []).filter((child) => child.tag === "li");
  listItems.forEach((item, index) => {
    const nestedLists = (item.children ?? []).filter((child) => child.tag === "ul" || child.tag === "ol");
    const inlineChildren = (item.children ?? []).filter((child) => !["ul", "ol"].includes(child.tag));
    const marker = node.tag === "ol" ? `${index + 1}. ` : "• ";
    const runs = [textRun(marker), ...inlineRuns(inlineChildren)];
    out.push(new Paragraph({ children: runs, indent: { left: 360 * (level + 1), hanging: 180 } }));
    nestedLists.forEach((nested) => out.push(...listToBlocks(nested, level + 1)));
  });
  return out;
};

const tableToBlock = (node) => {
  const rows = descendants(node, "tr");
  if (!rows.length) return [new Paragraph("[Table contained no readable rows]")];
  const docxRows = rows.map((row) => {
    const cells = (row.children ?? []).filter((child) => child.tag === "th" || child.tag === "td");
    return new TableRow({ children: cells.length ? cells.map((cell) => {
      const cellBlocks = blocksFromNodes(cell.children);
      const formattedBlocks = cellBlocks.length ? cellBlocks : [new Paragraph("")];
      return new TableCell({
        children: formattedBlocks,
        ...(cell.tag === "th" ? { shading: { fill: "E8EDF2" } } : {}),
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
      });
    }) : [new TableCell({ children: [new Paragraph("")] })] });
  });
  return [new Table({ rows: docxRows, width: { size: 100, type: WidthType.PERCENTAGE } })];
};

const blocksFromNodes = (nodes) => {
  const blocks = [];
  for (const node of nodes ?? []) {
    if (node.tag === "#text") {
      const content = node.text.replace(/\u00a0/g, " ").trim();
      if (content) blocks.push(new Paragraph(content));
      continue;
    }
    if (node.tag === "table") {
      blocks.push(...tableToBlock(node));
      continue;
    }
    if (node.tag === "ul" || node.tag === "ol") {
      blocks.push(...listToBlocks(node));
      continue;
    }
    if (node.tag === "hr") {
      blocks.push(new Paragraph({ children: [new TextRun("────────────────────────────────────────")] }));
      continue;
    }
    if (BLOCK_TAGS.has(node.tag)) {
      // A wrapper with block children should not become a single paragraph.
      if (["div", "figure"].includes(node.tag) && (node.children ?? []).some((child) => BLOCK_TAGS.has(child.tag) || child.tag === "table" || child.tag === "ul" || child.tag === "ol")) {
        blocks.push(...blocksFromNodes(node.children));
      } else {
        blocks.push(paragraphFromNode(node));
      }
      continue;
    }
    if (node.tag === "img" || node.tag === "a" || node.tag === "span" || node.tag === "strong" || node.tag === "b" || node.tag === "em" || node.tag === "i" || node.tag === "u" || node.tag === "s" || node.tag === "del" || node.tag === "code" || node.tag === "pre" || node.tag === "sup" || node.tag === "sub") {
      blocks.push(new Paragraph({ children: inlineRuns([node]) }));
      continue;
    }
    blocks.push(...blocksFromNodes(node.children));
  }
  return blocks;
};

export const taskReportHtmlToDocxElements = (content) => {
  const raw = String(content ?? "");
  if (!raw.trim()) return [new Paragraph("")];
  const sanitized = sanitizeTaskReportHtml(raw);
  const hasMarkup = /<\/?(?:p|br|h[1-6]|strong|b|em|i|u|s|ul|ol|li|blockquote|table|thead|tbody|tr|th|td|a|img|span|div|hr)\b/i.test(sanitized);
  if (!hasMarkup) {
    return raw.replace(/\r\n?/g, "\n").split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line) => new Paragraph(decodeHtmlText(line)));
  }
  const blocks = blocksFromNodes(parseHtmlFragment(sanitized));
  return blocks.length ? blocks : [new Paragraph("")];
};

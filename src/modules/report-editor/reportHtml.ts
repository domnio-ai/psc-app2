const REPORT_TAG_NAMES =
  "(?:html|head|body|main|article|section|header|footer|nav|p|div|span|h[1-6]|table|thead|tbody|tfoot|tr|td|th|ul|ol|li|br|hr|strong|b|em|i|u|s|del|ins|a|img|figure|figcaption|blockquote|pre|code|sup|sub|small|mark|dl|dt|dd|caption|colgroup|col|font)";

const ENCODED_LT = String.raw`&(?:amp;)*(?:lt|#0*60|#x0*3c);`;
const MAX_HTML_ESCAPE_LAYERS = 5;

const actualReportMarkupPattern = new RegExp(
  `<\\/?${REPORT_TAG_NAMES}\\b[^<>]*>`,
  "i",
);

const encodedReportTagStartPattern = new RegExp(
  `${ENCODED_LT}\\s*\\/?\\s*${REPORT_TAG_NAMES}\\b`,
  "gi",
);

const decodeHtmlEntityLayer = (value: string) =>
  value.replace(
    /&(?:amp|lt|gt|quot|apos|nbsp|#(?:[0-9]+|x[0-9a-f]+));/gi,
    (entity) => {
      const name = entity.slice(1, -1).toLowerCase();
      switch (name) {
        case "amp": return "&";
        case "lt": return "<";
        case "gt": return ">";
        case "quot": return '"';
        case "apos": return "'";
        case "nbsp": return "\u00a0";
        default: {
          const codePoint = name.startsWith("#x")
            ? Number.parseInt(name.slice(2), 16)
            : Number.parseInt(name.slice(1), 10);
          if (
            !Number.isInteger(codePoint) ||
            codePoint <= 0 ||
            codePoint > 0x10ffff ||
            (codePoint >= 0xd800 && codePoint <= 0xdfff)
          ) return entity;
          return String.fromCodePoint(codePoint);
        }
      }
    },
  );

const hasEncodedReportMarkup = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed || actualReportMarkupPattern.test(trimmed)) return false;
  const beginsWithReportTag = new RegExp(
    `^${ENCODED_LT}\\s*${REPORT_TAG_NAMES}\\b`,
    "i",
  ).test(trimmed);
  if (!beginsWithReportTag) return false;
  return (trimmed.match(encodedReportTagStartPattern) || []).length >= 2;
};

/**
 * Recover historical reports that were HTML-entity encoded before being saved.
 * Decoding is bounded and only starts when the entire value looks like an
 * encoded report document; prose that mentions an escaped tag is untouched.
 */
export const normalizeReportHtml = (value: string) => {
  const source = String(value ?? "");
  if (!source.trim()) return "<p></p>";
  if (!hasEncodedReportMarkup(source)) return source;

  let normalized = source;
  for (let layer = 0; layer < MAX_HTML_ESCAPE_LAYERS; layer += 1) {
    if (actualReportMarkupPattern.test(normalized)) return normalized;
    if (!hasEncodedReportMarkup(normalized)) return normalized;
    const next = decodeHtmlEntityLayer(normalized);
    if (next === normalized) return normalized;
    normalized = next;
  }
  return normalized;
};

export const isReportHtml = (value: string) =>
  /<[a-z][\s\S]*>/i.test(normalizeReportHtml(String(value ?? "")));

export const reportHtmlEquivalent = (left: string, right: string) =>
  normalizeReportHtml(String(left ?? "")).trim() ===
  normalizeReportHtml(String(right ?? "")).trim();

const SAFE_STYLE_PROPERTIES = new Set([
  "text-align", "font-size", "font-family", "color", "background-color",
  "width", "min-width", "max-width", "height", "min-height", "display",
  "border-collapse", "table-layout", "vertical-align", "font-weight",
  "line-height", "padding", "border", "white-space", "overflow-wrap",
  "word-break", "text-decoration", "margin-left", "margin-right",
  "margin-top", "margin-bottom",
]);

const SAFE_REPORT_TAGS = new Set([
  "p", "br", "hr", "div", "span", "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "del", "ins", "sup", "sub", "small",
  "mark", "code", "pre", "ul", "ol", "li", "blockquote", "table", "thead",
  "tbody", "tfoot", "tr", "th", "td", "colgroup", "col", "a", "img", "figure",
  "figcaption", "caption", "section", "header", "footer", "main", "article",
  "nav", "dl", "dt", "dd",
]);

const SAFE_CLASS_NAMES = new Set([
  "empty", "app2-report-table", "app2-report-table-header", "app2-report-table-cell",
  "app2-task-report-kicker", "app2-task-report-meta-item", "app2-task-report-empty",
  "app2-psc-report-brand", "app2-task-report-draft", "app2-task-report-meta",
  "app2-task-report-section", "app2-task-report-section-content",
  "app2-repository-report-content", "app2-repository-document-control-heading",
  "imported-page-break", "app2-page-break", "app2-repository-report-cover",
  "app2-repository-document-control", "app2-task-report-title",
  "app2-task-report-section-title", "app2-report-image-selected",
]);

const sanitizeStyle = (raw: string) => {
  const scratch = document.createElement("span");
  scratch.setAttribute("style", raw);
  const input = scratch.style;
  const output: string[] = [];
  for (const property of SAFE_STYLE_PROPERTIES) {
    const value = input.getPropertyValue(property).trim();
    if (!value || /url\s*\(|expression\s*\(|javascript:|vbscript:/i.test(value)) continue;
    if (property === "font-size" && !/^\d{1,3}(?:\.\d+)?(?:px|pt|em|rem|%)$/i.test(value)) continue;
    if (property === "font-family" && !/^[a-zA-Z0-9 ,_'"-]{1,100}$/.test(value)) continue;
    if ((property === "color" || property === "background-color") && !/^(?:#[0-9a-f]{3,8}|rgba?\([0-9 ,.]+\)|transparent|black|white|gray|grey)$/i.test(value)) continue;
    if ((property === "width" || property === "min-width" || property === "max-width" || property === "height" || property === "min-height" || property === "margin-left" || property === "margin-right" || property === "margin-top" || property === "margin-bottom") && !/^(?:auto|0|\d{1,4}(?:\.\d+)?(?:px|pt|em|rem|%))$/i.test(value)) continue;
    if (property === "text-align" && !/^(?:left|right|center|justify|start|end)$/i.test(value)) continue;
    output.push(`${property}:${value}`);
  }
  return output.join(";");
};

const safeUrl = (value: string, attribute: "href" | "src") => {
  const url = value.trim();
  if (!url || url.startsWith("//") || url.startsWith("\\\\")) return false;
  if (attribute === "href" && /^(?:https?:|mailto:)/i.test(url)) return true;
  if (attribute === "src" && /^https?:/i.test(url)) return true;
  if (attribute === "src" && /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(url)) return true;
  // Only allow relative same-origin URLs beyond the explicit schemes above.
  return !/^[a-z][a-z0-9+.-]*:/i.test(url);
};

const normalizePreviewImages = async (root: ParentNode) => {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  await Promise.all(images.map(async (image) => {
    const src = image.getAttribute("src") || "";
    if (!/^data:image\/webp;base64,/i.test(src)) return;
    const decoded = new Image();
    const loaded = new Promise<void>((resolve) => {
      decoded.onload = () => resolve();
      decoded.onerror = () => resolve();
    });
    decoded.src = src;
    await loaded;
    if (!decoded.naturalWidth || !decoded.naturalHeight) {
      image.remove();
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = decoded.naturalWidth;
    canvas.height = decoded.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(decoded, 0, 0);
    image.src = canvas.toDataURL("image/png");
  }));
};

/**
 * Sanitize imported/stored HTML before Lexical parses it. This is a focused
 * allow-list for report content rather than a generic HTML renderer. It keeps
 * normal tables, cell spans, images, links and presentation styles.
 */
export const sanitizeReportHtmlForEditor = (value: string) => {
  const normalized = normalizeReportHtml(String(value ?? ""));
  if (typeof DOMParser === "undefined" || typeof document === "undefined") return normalized;

  const appearsToContainMarkup = actualReportMarkupPattern.test(normalized);
  if (!appearsToContainMarkup) {
    const paragraph = document.createElement("p");
    paragraph.textContent = normalized;
    return paragraph.outerHTML.replace(/\r?\n/g, "<br />");
  }

  const parsed = new DOMParser().parseFromString(normalized, "text/html");
  parsed.querySelectorAll(
    "script,style,iframe,object,embed,link,meta,form,input,button,textarea,select,svg,math,template",
  ).forEach((node) => node.remove());
  Array.from(parsed.body.querySelectorAll("*")).forEach((element) => {
    const tag = element.tagName.toLowerCase();
    if (!SAFE_REPORT_TAGS.has(tag)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const rawValue = attribute.value;
      if (name.startsWith("on") || name === "srcdoc" || name === "contenteditable") {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (name === "style") {
        const safe = sanitizeStyle(rawValue);
        if (safe) element.setAttribute("style", safe);
        else element.removeAttribute("style");
        continue;
      }
      if (name === "class") {
        const kept = rawValue.split(/\s+/).filter((className) => SAFE_CLASS_NAMES.has(className));
        if (kept.length) element.setAttribute("class", kept.join(" "));
        else element.removeAttribute("class");
        continue;
      }
      if ((name === "href" || name === "src") && !safeUrl(rawValue, name)) {
        element.removeAttribute(attribute.name);
        continue;
      }
      const universal = name === "title" || name === "dir";
      const tabular = ["colspan", "rowspan", "scope", "colwidth", "width", "height", "align", "valign"].includes(name);
      const app2Data = name === "data-app2-indent" || name === "data-orientation";
      const supported =
        universal || tabular || app2Data ||
        (tag === "a" && ["href", "target", "rel"].includes(name)) ||
        (tag === "img" && ["src", "alt"].includes(name));
      if (!supported) element.removeAttribute(attribute.name);
    }
    if (tag === "a" && element.hasAttribute("href")) {
      element.setAttribute("rel", "noopener noreferrer");
    }
    if ((tag === "p" || /^h[1-6]$/.test(tag)) && element.hasAttribute("data-app2-indent")) {
      const parsedLevel = Number(element.getAttribute("data-app2-indent"));
      const level = Number.isFinite(parsedLevel) ? Math.max(0, Math.min(6, parsedLevel)) : 0;
      if (level > 0) (element as HTMLElement).style.marginLeft = `${level * 1.5}rem`;
      else element.removeAttribute("data-app2-indent");
    }
  });

  return parsed.body.innerHTML;
};

/**
 * Normalize and sanitize HTML for the iframe-based Task Report Preview/Review.
 * If input is already a complete HTML document, preserve its safe head styles;
 * sanitize the body with the same contract as the editor. Fragments are wrapped
 * in a predictable document shell so tables have the same baseline presentation.
 */
export const normalizeReportDocumentForPreview = (value: string) => {
  const source = String(value ?? "");
  if (typeof DOMParser === "undefined" || typeof document === "undefined") {
    return normalizeReportHtml(source);
  }
  const parsed = new DOMParser().parseFromString(source, "text/html");
  parsed.querySelectorAll("script,iframe,object,embed,link,meta,base,form,input,button,textarea,select,svg,math,template")
    .forEach((node) => node.remove());
  // Report templates use embedded stylesheets for their controlled layout.
  // The document is rendered in a sandboxed iframe, so CSS stays inside that
  // document; reject external resources and executable constructs while
  // preserving template selectors such as body, .page, and @media rules.
  parsed.querySelectorAll("style").forEach((style) => {
    const safeCss = style.textContent || "";
    if (/@import|url\s*\(|expression\s*\(|javascript:|vbscript:|behavior\s*:|-moz-binding\s*:/i.test(safeCss)) {
      style.remove();
    }
  });
  const bodyMarkup = normalizeReportHtml(parsed.body.innerHTML);
  parsed.body.innerHTML = sanitizeReportHtmlForEditor(bodyMarkup);
  parsed.querySelectorAll("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name.toLowerCase().startsWith("on") || attribute.name.toLowerCase() === "srcdoc") {
        element.removeAttribute(attribute.name);
      }
    }
  });
  const head = parsed.head;
  if (!head.querySelector("style[data-app2-report-preview-base]")) {
    const style = document.createElement("style");
    style.setAttribute("data-app2-report-preview-base", "true");
    style.textContent = `
      html { min-height: 100%; background: #e6ebf1; }
      body { box-sizing: border-box; width: min(1040px, calc(100% - 48px)); min-height: 1180px; margin: 24px auto; padding: 70px 76px; border: 1px solid #d9dee7; background: #fff; box-shadow: 0 8px 22px rgba(31,38,48,.08); color: #172033; font-family: Calibri, Arial, sans-serif; font-size: 12pt; line-height: 1.5; overflow-wrap: anywhere; zoom: var(--task-report-reader-zoom, 1); }
      img { display: block; max-width: 100%; height: auto; object-fit: contain; }
      table { width: 100%; max-width: 100%; border-collapse: collapse; table-layout: fixed; margin: 12px 0; }
      th, td { min-width: 72px; border: 1px solid #aeb9c7; padding: 7px 8px; vertical-align: top; text-align: left; overflow-wrap: anywhere; }
      th, .app2-report-table-header { background: #f4f6f9; color: #172033; font-weight: 700; }
      p { margin: 0 0 .75em; }
      h1, h2, h3, h4, h5, h6 { color: #172033; font-family: Calibri, Arial, sans-serif; line-height: 1.25; page-break-after: avoid; }
      @media (max-width: 720px) { body { min-height: 100%; padding: 24px; } }
    `;
    head.appendChild(style);
  }
  return `<!doctype html>\n${parsed.documentElement.outerHTML}`;
};

export const normalizeReportDocumentForPreviewAsync = async (value: string) => {
  const source = String(value ?? "");
  if (typeof DOMParser === "undefined" || typeof document === "undefined") {
    return normalizeReportDocumentForPreview(source);
  }
  const normalized = normalizeReportDocumentForPreview(source);
  const parsed = new DOMParser().parseFromString(normalized, "text/html");
  await normalizePreviewImages(parsed);
  return `<!doctype html>\n${parsed.documentElement.outerHTML}`;
};

export const hasNestedReportTables = (value: string) => {
  const source = normalizeReportHtml(String(value ?? ""));
  if (typeof DOMParser !== "undefined") {
    const parsed = new DOMParser().parseFromString(source, "text/html");
    return Array.from(parsed.querySelectorAll("table")).some((table) => Boolean(table.querySelector("table")));
  }
  return /<table\b[\s\S]*?<table\b/i.test(source);
};

/** Add stable App2 classes to serialized Lexical tables so editor, Preview and
 * Repository use the same table presentation without mutating persisted text. */
export const normalizeExportedReportHtml = (value: string) => {
  const source = String(value ?? "");
  if (typeof DOMParser === "undefined") return source;
  const parsed = new DOMParser().parseFromString(source, "text/html");
  parsed.querySelectorAll("table").forEach((table) => {
    table.classList.add("app2-report-table");
    table.querySelectorAll("th").forEach((cell) => cell.classList.add("app2-report-table-header"));
    table.querySelectorAll("td").forEach((cell) => cell.classList.add("app2-report-table-cell"));
  });
  parsed.body.querySelectorAll("p[data-app2-indent],h1[data-app2-indent],h2[data-app2-indent],h3[data-app2-indent],h4[data-app2-indent],h5[data-app2-indent],h6[data-app2-indent],p[style],h1[style],h2[style],h3[style],h4[style],h5[style],h6[style]").forEach((element) => {
    const margin = (element as HTMLElement).style.marginLeft.trim();
    const match = margin.match(/^([0-9]+(?:\.[0-9]+)?)(px|rem|em)$/i);
    if (!match) return;
    const size = Number(match[1]);
    const unit = match[2].toLowerCase();
    const level = Math.max(0, Math.min(6, Math.round(size / (unit === "px" ? 24 : 1.5))));
    if (level > 0) element.setAttribute("data-app2-indent", String(level));
  });
  return parsed.body.innerHTML;
};

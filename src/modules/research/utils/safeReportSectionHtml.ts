import { normalizeReportHtml, sanitizeReportHtmlForEditor } from "../../report-editor/reportHtml";

/**
 * Shared safe renderer for Research preview sections. It uses the same bounded
 * legacy-HTML recovery and allow-list as the editor, preventing preview-only
 * entity rendering and ensuring tables/inline report structure survive.
 */
export function safeReportSectionHtml(value: string) {
  const source = String(value ?? "");
  if (!source.trim()) return "";
  return sanitizeReportHtmlForEditor(normalizeReportHtml(source));
}

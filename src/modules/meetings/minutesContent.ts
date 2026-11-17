/**
 * Converts the generated meeting-minutes plain-text/Markdown draft to safe HTML
 * for the shared App2 Lexical report editor. Existing editor HTML passes through
 * so formatting survives subsequent edits and saves.
 */
const knownHtmlBlock = /<(?:h[1-6]|p|div|ul|ol|li|table|blockquote|br|hr)(?:\s|\/?>)/i;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function minutesContentToEditorHtml(input: string): string {
  const source = String(input ?? "");
  if (!source.trim()) return "";
  if (knownHtmlBlock.test(source)) return source;

  const output: string[] = [];
  let listTag: "ul" | "ol" | null = null;
  const closeList = () => {
    if (listTag) output.push(`</${listTag}>`);
    listTag = null;
  };

  for (const rawLine of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${escapeHtml(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = /^[-*+]\s+(.+)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line);
    const item = bullet || numbered;
    if (item) {
      const desiredTag: "ul" | "ol" = bullet ? "ul" : "ol";
      if (listTag !== desiredTag) {
        closeList();
        output.push(`<${desiredTag}>`);
        listTag = desiredTag;
      }
      output.push(`<li>${escapeHtml(item[1])}</li>`);
      continue;
    }

    closeList();
    output.push(`<p>${escapeHtml(line)}</p>`);
  }

  closeList();
  return output.join("");
}
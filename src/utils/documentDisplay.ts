import type { DocumentItem } from "../api";

export function displayFileName(
  value: string | null | undefined,
  fallback = "Unnamed file",
) {
  const source = String(value || "").trim();
  if (!source) return fallback;

  let decoded = source.replaceAll("+", " ");
  for (let pass = 0; pass < 3 && /%[0-9a-f]{2}/i.test(decoded); pass += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }

  return (
    decoded
      .replace(/%20/gi, " ")
      .replaceAll("_", " ")
      .replace(/\s+/g, " ")
      .trim() || fallback
  );
}

export function displayDocumentTitle(value: string | null | undefined) {
  const title = displayFileName(value, "Untitled document");
  if (title !== title.toLowerCase()) return title;

  return title.replace(/\b(?:ai|app2|psc)\b|\b[a-z]/g, (word) =>
    word.toLowerCase() === "ai"
      ? "AI"
      : word.toLowerCase() === "app2"
        ? "REDESY"
        : word.toLowerCase() === "psc"
          ? "PSC"
          : word.toUpperCase(),
  );
}

export function normalizeDocument<T extends DocumentItem>(item: T): T {
  return {
    ...item,
    title: displayDocumentTitle(item.title),
    original_name: displayFileName(item.original_name, "No file attached"),
    created_by_name: displayFileName(item.created_by_name, "Unknown user"),
  };
}

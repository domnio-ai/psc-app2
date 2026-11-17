const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const value = (...candidates) => candidates
  .map((candidate) => String(candidate ?? "").trim())
  .find(Boolean) || "";

const yearOf = (record) => {
  const explicitYear = Number(record.publication_year);
  if (Number.isInteger(explicitYear) && explicitYear > 0) return String(explicitYear);
  const date = value(record.publication_date, record.document_date);
  if (!date) return "n.d.";
  const year = new Date(date).getFullYear();
  return Number.isFinite(year) && year > 0 ? String(year) : "n.d.";
};

const formatReference = (record) => {
  const title = value(record.title);
  if (!title) return null;
  const author = value(record.author);
  const year = yearOf(record);
  const publisher = value(record.publisher);
  const identifier = value(record.identifier);
  const url = value(record.url);
  const style = value(record.citation_style, record.citationStyle).toLowerCase();
  let formatted;

  if (style === "harvard") {
    formatted = `${author ? `${author} ` : `${title} `}(${year})${author ? `, ${title}` : ""}.${publisher ? ` ${publisher}.` : ""}`;
  } else if (style === "chicago") {
    formatted = `${author ? `${author}. ` : ""}“${title}.”${publisher ? ` ${publisher},` : ""} ${year}.`;
  } else {
    formatted = `${author ? `${author}. ` : ""}(${year}). ${title}.${publisher ? ` ${publisher}.` : ""}`;
  }

  if (identifier) formatted += ` Identifier: ${identifier}.`;
  if (url && /^https?:\/\//i.test(url)) {
    formatted += ` <a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`;
  }
  return `<li>${formatted.split(/(<a\b[^>]*>.*?<\/a>)/is).map((part) => part.startsWith("<a ") ? part : escapeHtml(part)).join("")}</li>`;
};

export const buildReportReferencesSection = (records = []) => {
  const seen = new Set();
  const items = [];
  for (const record of records) {
    const title = value(record.title);
    if (!title) continue;
    const key = [record.author, yearOf(record), title, record.publisher, record.identifier, record.url]
      .map((part) => String(part ?? "").trim().toLocaleLowerCase()).join("\u0000");
    if (seen.has(key)) continue;
    seen.add(key);
    const item = formatReference(record);
    if (item) items.push(item);
  }
  return items.length ? { title: "References", content: `<ol>${items.join("")}</ol>` } : null;
};

export const hasAuthoredReferencesSection = (sections = []) => sections.some((section) =>
  /^(?:references|bibliography|works cited)$/i.test(String(section.title || section.section_title || "").trim())
);

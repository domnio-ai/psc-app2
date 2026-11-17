import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildPscTaskFinalPdf } from "../src/task-report-pdf.js";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { buildReportReferencesSection, hasAuthoredReferencesSection } from "../src/report-references.js";

test("published bibliography preserves recorded metadata and each selected citation style", () => {
  const section = buildReportReferencesSection([
    {
      author: "Ochieng, Élodie",
      publication_year: 2024,
      title: "Evidence and Findings",
      publisher: "PSC Research Unit",
      citation_style: "APA",
      url: "https://example.invalid/evidence",
      identifier: "DOI 10.0000/example",
    },
    {
      author: "Wanjiku, Njeri",
      publication_date: "2022-05-01",
      title: "Policy Review",
      publisher: "PSC",
      citation_style: "Harvard",
    },
    {
      title: "Field Notes",
      citation_style: "Chicago",
    },
    {
      author: "Ochieng, Élodie",
      publication_year: 2024,
      title: "Evidence and Findings",
      publisher: "PSC Research Unit",
      citation_style: "APA",
      url: "https://example.invalid/evidence",
      identifier: "DOI 10.0000/example",
    },
  ]);

  assert.equal(section.title, "References");
  assert.match(section.content, /Ochieng, Élodie\. \(2024\)\. Evidence and Findings\./);
  assert.match(section.content, /<a href="https:\/\/example\.invalid\/evidence">https:\/\/example\.invalid\/evidence<\/a>/);
  assert.match(section.content, /Identifier: DOI 10\.0000\/example/);
  assert.match(section.content, /Wanjiku, Njeri \(2022\), Policy Review/);
  assert.match(section.content, /“Field Notes\.” n\.d\./);
  assert.equal((section.content.match(/Evidence and Findings/g) || []).length, 1, "exact duplicate references are collapsed");
  assert.equal(buildReportReferencesSection([]), null, "empty References sections are omitted");
});

test("authored bibliography sections are not duplicated during final publication", () => {
  assert.equal(hasAuthoredReferencesSection([{ title: "Bibliography" }]), true);
  assert.equal(hasAuthoredReferencesSection([{ title: "Findings" }]), false);
});

test("generated APA references survive the published PDF renderer as searchable text", async () => {
  const section = buildReportReferencesSection([{
    author: "QA Author",
    publication_year: 2024,
    title: "QA bibliography entry with Élodie",
    publisher: "QA Research Unit",
    citation_style: "APA",
  }]);
  const bytes = await buildPscTaskFinalPdf("Reference QA fixture", {}, [section]);
  const document = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  const page = await document.getPage(1);
  const content = await page.getTextContent();
  const text = content.items.map((item) => item.str || "").join(" ");
  assert.match(text, /QA Author\. \(2024\)\. QA bibliography entry with Élodie\. QA Research Unit\./);
  assert.doesNotMatch(text, /(?:Ã¢â‚¬|â€™|â€œ|â€|�)/);
});

test("Assignment and Research finalizers draw references from governed records or approved snapshots", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(app, /SELECT source_type,title,author,publication_year,publisher,url,identifier,citation_style FROM generated_document_references WHERE document_id=\$1::uuid/);
  assert.match(app, /const sources=\(await client\.query\('SELECT source_type,title,author,publisher,publication_date,url,identifier FROM research_sources/);
  assert.match(app, /JSON\.stringify\(\{team,sections,sources\}\)/);
  assert.match(app, /buildReportReferencesSection\(\[\.\.\.\(approvedSnapshot\.sources\|\|\[\]\),\.\.\.linkedKnowledgeReferences\]\)/);
  assert.match(app, /SELECT title,author,document_date,source_url FROM knowledge_items WHERE id=ANY\(\$1::uuid\[\]\) AND status='Published'/);
  assert.match(app, /\.\.\.linkedKnowledgeReferences/);
  assert.match(app, /INSERT INTO generated_document_references\(document_id,source_type,title,author,publication_year,publisher,url,identifier,citation_style,created_by\)VALUES\(\$1,\$2,\$3,\$4,\$5,\$6,\$7,\$8,'APA',\$9\)/);
  assert.match(app, /hasAuthoredReferencesSection\(repositorySections\)/);
});

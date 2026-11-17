import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPscTaskFinalPdf } from "../src/task-report-pdf.js";
import { taskReportHtmlToPdfBlocks, taskReportHtmlToPlainText } from "../src/task-report-formatting.js";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const suspicious = /(?:Ã¢â‚¬|â€™|â€œ|â€|ï»¿|�)/;

const extractPdfText = async (bytes) => {
  const document = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  let text = "";
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    text += `${content.items.map((item) => item.str || "").join(" ")}\n`;
  }
  return { document, text };
};

test("Task Report text conversion decodes entities once and keeps document structure", () => {
  const html = "<h2>Findings</h2><p>Line one<br>Line two &amp; more</p><ul><li>Next step</li></ul><table><tr><th>Measure</th><th>Value</th></tr><tr><td>Cases</td><td>12</td></tr></table>";
  assert.equal(taskReportHtmlToPlainText(html), "Findings\nLine one\nLine two & more\n• Next step\nMeasure | Value\nCases | 12");
  assert.equal(taskReportHtmlToPlainText("<p>&amp;lt;literal&amp;gt; &amp;amp; encoded</p>"), "&lt;literal&gt; &amp; encoded");
});

test("supported inline report figures are embedded and captions survive PDF rendering", async () => {
  const logo = readFileSync("public/psc-logo.png").toString("base64");
  const html = `<figure><img src="data:image/png;base64,${logo}" alt="PSC evidence emblem"><figcaption>Figure 1. PSC evidence emblem</figcaption></figure>`;
  const blocks = taskReportHtmlToPdfBlocks(html);
  assert.equal(blocks[0]?.type, "image");
  assert.equal(blocks[0]?.alt, "PSC evidence emblem");
  const bytes = await buildPscTaskFinalPdf("Figure QA fixture", {}, [{ title: "Figures", content: html }]);
  const { text } = await extractPdfText(bytes);
  assert.ok(text.includes("Figure 1. PSC evidence emblem"));
  assert.match(bytes.toString("latin1"), /\/Subtype \/Image/);
});

test("the production Task Final PDF renderer preserves Unicode and readable structure", async () => {
  const title = "Task Report — Évidence and Findings";
  const unicode = "O’Connor — “Evidence” and en dash –; Élodie, Wanjiku, Mwangi.";
  const sections = [
    { title: "Work Completed", content: `<h2>Highlights</h2><p>${unicode}</p><p>First paragraph<br>Second line</p><ul><li>Review the evidence</li></ul>` },
    { title: "Evidence Reviewed", content: "<table><tr><th>Measure</th><th>Value</th></tr><tr><td>Cases</td><td>12</td></tr></table>" },
    { title: "Literal Entity", content: "<p>&amp;lt;literal&amp;gt; &amp;amp; text</p>" },
    { title: "Review and Approval", content: "Status: FINAL — APPROVED" },
    { title: "References", content: "<p>Reference section content remains on the page without clipping.</p>" },
  ];
  const bytes = await buildPscTaskFinalPdf(title, { "Prepared by": "Njeri Wanjiku" }, sections);
  assert.equal(bytes.subarray(0, 5).toString("ascii"), "%PDF-");
  const { document, text } = await extractPdfText(bytes);
  assert.equal(document.numPages, 1, "short report should not create phantom footer pages");
  for (const fragment of [title, "Njeri Wanjiku", "O’Connor", "“Evidence”", "Élodie", "Wanjiku", "Mwangi", "First paragraph", "Second line", "Measure", "Value", "Cases", "12", "&lt;literal&gt; &amp; text", "FINAL — APPROVED", "Reference section content remains on the page without clipping."]) {
    assert.ok(text.includes(fragment), `PDF text contains ${JSON.stringify(fragment)}`);
  }
  const firstPage = await document.getPage(1);
  const referenceLine = (await firstPage.getTextContent()).items.find((item) => item.str.includes("Reference section content"));
  assert.ok(referenceLine, "reference content has a positioned text item");
  assert.ok(referenceLine.transform[4] >= 40 && referenceLine.transform[4] + referenceLine.width <= firstPage.view[2] - 40, "reference content fits within printable margins");
  assert.ok(text.includes("• Review the evidence"), "list marker survives PDF text output");
  assert.ok(text.includes("Page 1 of 1"), "footer stays on the report page");
  assert.doesNotMatch(text, suspicious, "PDF text contains no known mojibake or replacement character");
  assert.match(bytes.toString("latin1"), /TimesNewRomanPSMT/);
  assert.doesNotMatch(bytes.toString("latin1"), /Helvetica/);
});

test("long approved report content paginates without blank pages and keeps every page footer", async () => {
  const paragraph = "Approved findings preserve the original evidence, citations, and readable line wrapping. ".repeat(44);
  const sections = Array.from({ length: 8 }, (_, index) => ({
    title: `Findings ${index + 1}`,
    content: `<p>${paragraph}</p>`,
  }));
  const bytes = await buildPscTaskFinalPdf("Long approved report", {}, sections);
  const { document } = await extractPdfText(bytes);
  assert.ok(document.numPages > 1, "long report should span multiple pages");
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str || "").join(" ");
    assert.ok(pageText.length > 80, `page ${pageNumber} contains report content`);
    assert.ok(pageText.includes(`Page ${pageNumber} of ${document.numPages}`), `page ${pageNumber} has its footer`);
  }
});

test("Task Final PDF renderer retains PSC gold accents and the published artifact's required font path", () => {
  const renderer = readFileSync("backend/src/task-report-pdf.js", "utf8");
  assert.match(renderer, /const GOLD = "#8B6914"/);
  assert.match(renderer, /const DIVIDER = "#C89B2C"/);
  assert.match(renderer, /pdf\.registerFont\("TNR"/);
  assert.match(renderer, /pdf\.registerFont\("TNR-Bold"/);
  assert.doesNotMatch(renderer, /Helvetica/);
});

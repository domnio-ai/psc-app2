import { access, readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { taskReportHtmlToPdfBlocks, taskReportHtmlToPlainText } from "./task-report-formatting.js";

const GOLD = "#8B6914";
const DIVIDER = "#C89B2C";
const INK = "#222222";
const MUTED = "#555555";
const PAGE_MARGIN = 56;
const FONT_FILES = {
  regular: "times.ttf",
  bold: "timesbd.ttf",
  italic: "timesi.ttf",
  boldItalic: "timesbi.ttf",
};
const LIBERATION_SERIF_FILES = {
  regular: "LiberationSerif-Regular.ttf",
  bold: "LiberationSerif-Bold.ttf",
  italic: "LiberationSerif-Italic.ttf",
  boldItalic: "LiberationSerif-BoldItalic.ttf",
};

export const resolvePscTimesFontPaths = () => {
  const configuredRoot = process.env.PSC_TIMES_NEW_ROMAN_DIR;
  const roots = configuredRoot
    ? [configuredRoot]
    : process.platform === "win32"
      ? ["C:\\Windows\\Fonts"]
      : [
          "/usr/share/fonts/truetype/msttcorefonts",
          "/usr/share/fonts/liberation",
          "/usr/share/fonts/truetype/liberation",
          "/usr/share/fonts/truetype/liberation2",
        ];
  const fileSet = configuredRoot || process.platform === "win32" ? FONT_FILES : LIBERATION_SERIF_FILES;
  return roots.map((root) => Object.fromEntries(
    Object.entries(fileSet).map(([style, file]) => [style, path.join(root, file)]),
  ));
};

const registerTimesFonts = async (pdf) => {
  const pathOptions = resolvePscTimesFontPaths();
  let paths = null;
  for (const candidate of pathOptions) {
    const available = await Promise.all(Object.values(candidate).map((file) => access(file).then(() => true, () => false)));
    if (available.every(Boolean)) {
      paths = candidate;
      break;
    }
  }
  if (!paths) throw new Error("The PDF service requires Times New Roman or Liberation Serif regular, bold, italic and bold italic font files. Install the approved font package or set PSC_TIMES_NEW_ROMAN_DIR to an approved font directory.");
  pdf.registerFont("TNR", paths.regular);
  pdf.registerFont("TNR-Bold", paths.bold);
  pdf.registerFont("TNR-Italic", paths.italic);
  pdf.registerFont("TNR-BoldItalic", paths.boldItalic);
};

const runFont = (run) => run.bold && run.italics ? "TNR-BoldItalic"
  : run.bold ? "TNR-Bold"
    : run.italics ? "TNR-Italic" : "TNR";

const runOptions = (run, size) => ({
  font: runFont(run),
  fontSize: Math.min(48, Math.max(7, Number(run.size) ? Number(run.size) / 2 : size)),
  color: run.color ? `#${String(run.color).replace(/^#/, "")}` : INK,
  ...(run.underline ? { underline: true } : {}),
  ...(run.strike ? { strike: true } : {}),
  ...(run.link ? { link: run.link } : {}),
});

const textForRuns = (runs) => (runs ?? []).map((run) => run.text).join("");

const drawRichParagraph = (pdf, block, { size = 10.5, color = INK, heading = false } = {}) => {
  const actualSize = heading ? ({ 1: 16, 2: 13, 3: 11.5 }[block.heading] || 11) : size;
  const runs = block.runs?.length ? block.runs : [{ text: "" }];
  const width = pdf.page.width - PAGE_MARGIN * 2 - (block.list ? 16 : 0);
  pdf.x = PAGE_MARGIN;
  runs.forEach((run, index) => {
    const options = runOptions(run, actualSize);
    pdf.font(heading ? "TNR-Bold" : options.font).fontSize(heading ? actualSize : options.fontSize)
      .fillColor(heading ? GOLD : (options.color || color))
      .text(run.text, {
        width,
        align: block.align || "left",
        lineGap: 2,
        paragraphGap: heading ? 1 : 4,
        indent: block.list ? 16 : 0,
        continued: index < runs.length - 1,
        underline: options.underline,
        strike: options.strike,
        link: options.link,
        ...(block.heading ? { keepTogether: true } : {}),
      });
  });
  pdf.moveDown(heading ? 0.35 : 0.3);
};

const pageOrientation = (pdf) => pdf.page.width > pdf.page.height ? "landscape" : "portrait";

const tableOrientation = (block) => {
  const columns = Math.max(1, ...(block.rows || []).map((row) => row.length));
  return block.orientation === "landscape" || (block.orientation !== "portrait" && columns >= 5)
    ? "landscape" : "portrait";
};

const addPageWithOrientation = (pdf, orientation = "portrait") => {
  pdf.addPage({ size: "A4", layout: orientation, margin: PAGE_MARGIN });
};

const ensureOrientation = (pdf, orientation, { forceNewPage = false } = {}) => {
  const current = pageOrientation(pdf);
  if (current !== orientation) {
    addPageWithOrientation(pdf, orientation);
    return;
  }
  if (forceNewPage && pdf.y > PAGE_MARGIN + 2) addPageWithOrientation(pdf, orientation);
};

const ensureRoom = (pdf, height) => {
  if (pdf.y + height > pdf.page.height - 64) {
    addPageWithOrientation(pdf, pageOrientation(pdf));
  }
};

const drawDocumentControl = (pdf, metadata) => {
  const entries = Object.entries(metadata || {}).filter(([key]) => String(key).trim());
  if (!entries.length) return;
  const gap = 10;
  const cellWidth = (pdf.page.width - PAGE_MARGIN * 2 - gap) / 2;
  const pairs = [];
  for (let index = 0; index < entries.length; index += 2) pairs.push(entries.slice(index, index + 2));
  const rowHeights = pairs.map((pair) => Math.max(38, ...pair.map(([key, value]) => {
    pdf.font("TNR").fontSize(9);
    return 20 + pdf.heightOfString(String(value ?? ""), { width: cellWidth - 20, lineGap: 1 });
  })));
  const totalHeight = rowHeights.reduce((sum, height) => sum + height, 0) + (pairs.length - 1) * 4;
  ensureRoom(pdf, totalHeight + 18);
  pdf.font("TNR-Bold").fontSize(10).fillColor(GOLD).text("DOCUMENT CONTROL", PAGE_MARGIN, pdf.y);
  pdf.moveDown(0.25);
  for (let rowIndex = 0; rowIndex < pairs.length; rowIndex += 1) {
    const row = pairs[rowIndex];
    const height = rowHeights[rowIndex];
    const top = pdf.y;
    row.forEach(([key, value], columnIndex) => {
      const x = PAGE_MARGIN + columnIndex * (cellWidth + gap);
      pdf.save();
      pdf.roundedRect(x, top, cellWidth, height, 3).fillAndStroke("#F8F6F0", "#D9CCAA");
      pdf.font("TNR-Bold").fontSize(7).fillColor(GOLD)
        .text(String(key).toUpperCase(), x + 9, top + 6, { width: cellWidth - 18, lineBreak: false });
      pdf.font("TNR").fontSize(9).fillColor(INK)
        .text(String(value ?? ""), x + 9, top + 17, { width: cellWidth - 18, height: height - 21, lineGap: 1 });
      pdf.restore();
    });
    pdf.y = top + height + 4;
  }
  pdf.moveDown(0.25);
};

const drawApprovalRecord = (pdf, content) => {
  const lines = String(content ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return;
  const x = PAGE_MARGIN + 8;
  const width = pdf.page.width - PAGE_MARGIN * 2 - 16;
  const heights = lines.map((line) => {
    pdf.font("TNR").fontSize(9.5);
    return pdf.heightOfString(line, { width: width - 18, lineGap: 1 }) + 6;
  });
  const panelHeight = heights.reduce((sum, height) => sum + height, 0) + 18;
  ensureRoom(pdf, panelHeight + 4);
  const top = pdf.y;
  pdf.save();
  pdf.roundedRect(x, top, width, panelHeight, 4).fillAndStroke("#FBF9F3", "#C89B2C");
  let y = top + 9;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const separator = line.indexOf(":");
    if (separator > 0) {
      pdf.font("TNR-Bold").fontSize(9.5).fillColor(INK)
        .text(`${line.slice(0, separator + 1)} `, x + 9, y, { continued: true });
      pdf.font("TNR").fontSize(9.5).fillColor(INK)
        .text(line.slice(separator + 1).trim(), { width: width - 18, lineGap: 1 });
    } else {
      pdf.font("TNR").fontSize(9.5).fillColor(INK).text(line, x + 9, y, { width: width - 18, lineGap: 1 });
    }
    y += heights[index];
  }
  pdf.restore();
  pdf.y = top + panelHeight + 4;
};

const wrapPdfCellRuns = (pdf, cell, width, baseSize) => {
  const lines = [];
  let lineRuns = [];
  let lineWidth = 0;
  let lineHeight = baseSize * 1.25 + 1;
  const append = (text, run) => {
    if (!text) return;
    const previous = lineRuns.at(-1);
    if (previous && runFont(previous) === runFont(run) && previous.bold === run.bold &&
        previous.italics === run.italics && previous.color === run.color &&
        previous.underline === run.underline && previous.strike === run.strike && previous.link === run.link) {
      previous.text += text;
    } else lineRuns.push({ ...run, text });
  };
  const finishLine = (nextFontSize = baseSize) => {
    lines.push({ runs: lineRuns, height: lineHeight });
    lineRuns = [];
    lineWidth = 0;
    lineHeight = nextFontSize * 1.25 + 1;
  };
  for (const run of cell.runs ?? []) {
    const text = (run.lineBreak ? "\n" : String(run.text ?? "")).replace(/\r\n?/g, "\n");
    const options = runOptions(run, baseSize);
    pdf.font(runFont(run)).fontSize(options.fontSize);
    lineHeight = Math.max(lineHeight, options.fontSize * 1.25 + 1);
    for (const token of text.match(/\n|[^\S\n]+|[^\s]+/gu) ?? []) {
      if (token === "\n") { finishLine(options.fontSize); continue; }
      if (/^\s+$/u.test(token) && !lineRuns.length) continue;
      const tokenWidth = pdf.widthOfString(token);
      if (/^\s+$/u.test(token)) {
        if (lineWidth + tokenWidth > width) finishLine(options.fontSize);
        else { append(token, run); lineWidth += tokenWidth; }
        continue;
      }
      if (tokenWidth <= width) {
        if (lineWidth > 0 && lineWidth + tokenWidth > width) finishLine(options.fontSize);
        append(token, run);
        lineWidth += tokenWidth;
        continue;
      }
      if (lineWidth > 0) finishLine(options.fontSize);
      for (const character of Array.from(token)) {
        const characterWidth = pdf.widthOfString(character);
        if (lineWidth > 0 && lineWidth + characterWidth > width) finishLine(options.fontSize);
        append(character, run);
        lineWidth += characterWidth;
      }
    }
  }
  if (lineRuns.length) finishLine();
  while (lines.length > 1 && !lines.at(-1).runs.length) lines.pop();
  return lines;
};

const drawTable = (pdf, block, drawRunningHeader, context = {}) => {
  const rows = block.rows || [];
  if (!rows.length) return;
  const columns = Math.max(1, ...rows.map((row) => row.length));
  const orientation = tableOrientation(block);
  ensureOrientation(pdf, orientation, { forceNewPage: orientation === "landscape" && pageOrientation(pdf) !== "landscape" });
  const width = pdf.page.width - PAGE_MARGIN * 2;
  const headerRow = rows[0]?.some((cell) => cell.header) ? rows[0] : null;
  const sample = Array.from({ length: columns }, (_, index) => rows.reduce((max, row) => {
    const length = textForRuns(row[index]?.runs).length;
    return Math.max(max, Math.min(length, 48));
  }, 8));
  const padding = 6;
  const minimumWidths = Array.from({ length: columns }, (_, index) => {
    const label = headerRow ? textForRuns(headerRow[index]?.runs) : "";
    pdf.font("TNR-Bold").fontSize(9);
    return Math.max(32, Math.min(84, pdf.widthOfString(label) + padding * 2 + 4));
  });
  const minimumTotal = minimumWidths.reduce((sum, value) => sum + value, 0);
  const remainingWidth = Math.max(0, width - Math.min(width, minimumTotal));
  const totalWeight = sample.reduce((sum, value) => sum + value, 0);
  const widths = minimumTotal <= width
    ? minimumWidths.map((minimum, index) => minimum + remainingWidth * sample[index] / totalWeight)
    : minimumWidths.map((minimum) => width * minimum / minimumTotal);
  const layoutRow = (row) => Array.from({ length: columns }, (_, index) => wrapPdfCellRuns(
    pdf,
    row[index] || { runs: [] },
    Math.max(24, widths[index] - padding * 2),
    row[index]?.header ? 9 : 9.5,
  ));
  const rowHeight = (cellLines) => Math.max(22, ...cellLines.map((lines) =>
    lines.reduce((sum, line) => sum + line.height, 0) + padding * 2,
  ));
  const drawRow = (row, cellLines, height) => {
    const top = pdf.y;
    let x = PAGE_MARGIN;
    for (let index = 0; index < columns; index += 1) {
      const cell = row[index] || { runs: [] };
      const cellWidth = widths[index];
      const isHeader = Boolean(cell.header);
      pdf.save();
      pdf.rect(x, top, cellWidth, height).fillAndStroke(cell.background || (isHeader ? GOLD : "#FFFFFF"), DIVIDER);
      let lineY = top + padding;
      for (const line of cellLines[index] || []) {
        pdf.x = x + padding;
        pdf.y = lineY;
        line.runs.forEach((run, runIndex) => {
          const options = runOptions(run, isHeader ? 9 : 9.5);
          pdf.font(isHeader && !run.bold && !run.italics ? "TNR-Bold" : options.font)
            .fontSize(options.fontSize)
            .fillColor(run.color ? options.color : (cell.color || (isHeader ? "#FFFFFF" : INK)))
            .text(run.text, {
              width: Math.max(24, cellWidth - padding * 2),
              height: Math.max(8, line.height),
              align: cell.align || "left",
              lineGap: 1,
              ellipsis: false,
              continued: runIndex < line.runs.length - 1,
              underline: options.underline,
              strike: options.strike,
              link: options.link,
            });
        });
        lineY += line.height;
      }
      pdf.restore();
      x += cellWidth;
    }
    pdf.y = top + height;
    pdf.x = PAGE_MARGIN;
  };
  const headerLines = headerRow ? layoutRow(headerRow) : null;
  const repeatedHeaderHeight = headerLines ? rowHeight(headerLines) : 0;
  const pageBottom = () => pdf.page.height - 96;
  const availableHeight = () => pageBottom() - pdf.y;
  const addTablePage = (repeatHeader, continuationLabel = "") => {
    addPageWithOrientation(pdf, orientation);
    if (continuationLabel) {
      pdf.font("TNR-Bold").fontSize(9).fillColor(GOLD)
        .text(continuationLabel, PAGE_MARGIN, pdf.y, {
          width: pdf.page.width - PAGE_MARGIN * 2,
          lineBreak: false,
        });
      pdf.moveDown(0.3);
    }
    if (repeatHeader && headerRow && headerLines) {
      drawRow(headerRow, headerLines, repeatedHeaderHeight);
      pdf.moveDown(0.2);
    }
  };
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const cellLines = rowIndex === 0 && headerLines ? headerLines : layoutRow(row);
    const height = rowHeight(cellLines);
    const repeatHeader = Boolean(headerRow && rowIndex > 0);
    const freshPageCapacity = pdf.page.height - PAGE_MARGIN - 96 - (repeatHeader ? repeatedHeaderHeight + 4 : 0);
    if (height <= freshPageCapacity) {
      if (height > availableHeight()) addTablePage(repeatHeader);
      drawRow(row, cellLines, height);
      continue;
    }

    const offsets = cellLines.map(() => 0);
    while (offsets.some((offset, index) => offset < cellLines[index].length)) {
      const continuation = offsets.some((offset) => offset > 0);
      let room = availableHeight();
      if (room < (continuation ? 180 : 48)) {
        addTablePage(repeatHeader, continuation ? context.continuationLabel : "");
        room = availableHeight();
      }
      const maxLines = Math.max(...cellLines.map((lines, index) => lines.length - offsets[index]));
      let lineCount = 0;
      for (let candidate = 1; candidate <= maxLines; candidate += 1) {
        const heightForCandidate = Math.max(0, ...cellLines.map((lines, index) =>
          lines.slice(offsets[index], offsets[index] + candidate).reduce((sum, line) => sum + line.height, 0),
        )) + padding * 2 + (continuation ? 12 : 0);
        if (heightForCandidate > room) break;
        lineCount = candidate;
      }
      if (!lineCount) {
        addTablePage(repeatHeader, continuation ? context.continuationLabel : "");
        continue;
      }
      const segment = cellLines.map((lines, index) => lines.slice(offsets[index], offsets[index] + lineCount));
      if (continuation) {
        for (const index of [0, 1]) {
          const label = textForRuns(row[index]?.runs).trim();
          if (label && !segment[index]?.length) {
            segment[index] = wrapPdfCellRuns(pdf, { runs: [{ text: `${label} (cont.)` }] }, Math.max(24, widths[index] - padding * 2), 8);
          }
        }
      }
      const segmentHeight = Math.max(22, ...segment.map((lines) => lines.reduce((sum, line) => sum + line.height, 0) + padding * 2));
      drawRow(row, segment, segmentHeight);
      offsets.forEach((offset, index) => { offsets[index] += segment[index].length; });
      if (offsets.some((offset, index) => offset < cellLines[index].length)) {
        addTablePage(repeatHeader, context.continuationLabel || "");
      }
    }
  }
  pdf.moveDown(0.55);
};

const drawBlock = (pdf, block, drawRunningHeader, context = {}) => {
  if (block.type === "image") {
    const pageWidth = pdf.page.width - PAGE_MARGIN * 2;
    const maxHeight = pdf.page.height - PAGE_MARGIN - 96;
    const ratio = Number(block.width) / Math.max(1, Number(block.height));
    let width = Math.min(pageWidth, Number(block.width) || pageWidth);
    let height = width / (Number.isFinite(ratio) && ratio > 0 ? ratio : 1);
    if (height > maxHeight) {
      height = maxHeight;
      width = height * (Number.isFinite(ratio) && ratio > 0 ? ratio : 1);
    }
    ensureRoom(pdf, height + 12);
    const x = PAGE_MARGIN + (pageWidth - width) / 2;
    const y = pdf.y;
    pdf.image(Buffer.from(block.data, "base64"), x, y, { fit: [width, height] });
    pdf.y = y + height + 8;
    pdf.x = PAGE_MARGIN;
    return;
  }
  if (block.type === "rule") {
    ensureRoom(pdf, 14);
    pdf.strokeColor(DIVIDER).lineWidth(0.8).moveTo(PAGE_MARGIN, pdf.y)
      .lineTo(pdf.page.width - PAGE_MARGIN, pdf.y).stroke();
    pdf.moveDown(0.5);
    return;
  }
  if (block.type === "table") {
    drawTable(pdf, block, drawRunningHeader, context);
    return;
  }
  if (block.type === "pageBreak") {
    ensureOrientation(pdf, "portrait", { forceNewPage: true });
    return;
  }
  if (block.type === "paragraph") {
    if (block.heading) ensureRoom(pdf, 34);
    drawRichParagraph(pdf, block, { heading: Boolean(block.heading) });
  }
};

// Generate PSC-branded, Unicode-safe PDFs from immutable approved report sections.
// HTML formatting is preserved as rich paragraphs, lists, tables, links and inline emphasis.
export const buildPscTaskFinalPdf = async (title, metadata = {}, sections = [], { layout = "portrait", governmentIdentity = false } = {}) => {
  const logo = await readFile(new URL("../../public/psc-logo.png", import.meta.url)).catch(() => null);
  const coatOfArms = governmentIdentity ? await readFile(new URL("../../public/kenya-coat-of-arms.png", import.meta.url)).catch(() => null) : null;
  const pdf = new PDFDocument({
    size: "A4",
    layout: layout === "landscape" ? "landscape" : "portrait",
    margin: PAGE_MARGIN,
    bufferPages: true,
    info: { Title: String(title || "Task Final Report"), Author: "Public Service Commission", Subject: "PSC controlled document version" },
  });
  await registerTimesFonts(pdf);
  const chunks = [];
  pdf.on("data", (chunk) => chunks.push(chunk));
  const completed = new Promise((resolve, reject) => {
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
  });
  let runningHeader = false;
  const drawRunningHeader = () => {
    pdf.save();
    pdf.font("TNR-Bold").fontSize(8).fillColor(GOLD)
      .text("PUBLIC SERVICE COMMISSION  |  CONTROLLED REPORT", PAGE_MARGIN, 26, {
        width: pdf.page.width - PAGE_MARGIN * 2,
        align: "center",
        lineBreak: false,
      });
    pdf.strokeColor(DIVIDER).lineWidth(0.7).moveTo(PAGE_MARGIN, 43)
      .lineTo(pdf.page.width - PAGE_MARGIN, 43).stroke();
    pdf.restore();
  };
  pdf.on("pageAdded", () => { if (runningHeader) drawRunningHeader(); });

  if (governmentIdentity) {
    try {
      if (coatOfArms) pdf.image(coatOfArms, PAGE_MARGIN + 3, 34, { fit: [58, 58] });
      if (logo) pdf.image(logo, pdf.page.width - PAGE_MARGIN - 69, 34, { fit: [66, 58] });
      pdf.y = 96;
    } catch {
      // The document falls back to its text identity if an asset cannot be decoded.
    }
  } else if (logo) {
    try {
      pdf.image(logo, (pdf.page.width - 104) / 2, 40, { fit: [104, 42] });
      pdf.y = 90;
    } catch {
      // The official logo remains optional only when the supplied asset cannot be read.
    }
  }
  pdf.font("TNR-Bold").fontSize(17).fillColor(GOLD)
    .text("PUBLIC SERVICE COMMISSION", { align: "center" });
  pdf.moveDown(0.25);
  pdf.font("TNR-Bold").fontSize(16).fillColor(INK)
    .text(String(title || "Task Final Report"), { align: "center" });
  pdf.moveDown(0.4);
  pdf.strokeColor(DIVIDER).lineWidth(2).moveTo(PAGE_MARGIN, pdf.y)
    .lineTo(pdf.page.width - PAGE_MARGIN, pdf.y).stroke();
  pdf.moveDown(0.65);

  drawDocumentControl(pdf, metadata);

  runningHeader = true;
  for (const section of sections) {
    const sectionTitle = String(section.title || "").trim();
    const isApprovalRecord = /^review and approval(?: record)?$/i.test(sectionTitle);
    const approvalText = isApprovalRecord ? taskReportHtmlToPlainText(section.content) : "";
    const blocks = isApprovalRecord ? [] : taskReportHtmlToPdfBlocks(section.content).filter((block) => {
      if (block.type === "paragraph") {
        return textForRuns(block.runs).replace(/[\s\u200b\ufeff]/g, "").length > 0;
      }
      if (block.type === "table") {
        return (block.rows || []).some((row) => row.some((cell) =>
          textForRuns(cell.runs).replace(/[\s\u200b\ufeff]/g, "").length > 0,
        ));
      }
      return true;
    });
    const hasContent = isApprovalRecord ? Boolean(approvalText) : blocks.some((block) =>
      block.type === "pageBreak" || block.type === "image" || block.type === "table" ||
      block.type === "rule" || (block.type === "paragraph" && block.runs?.some((run) => String(run.text || "").trim())),
    );
    if (!hasContent) continue;
    const firstContentBlock = blocks.find((block) => block.type !== "pageBreak");
    const continuationLabel = sectionTitle ? `${sectionTitle} — continued` : "Report content — continued";
    ensureOrientation(pdf, firstContentBlock?.type === "table" ? tableOrientation(firstContentBlock) : "portrait");
    if (section.heading !== false && String(section.title || "").trim()) {
      ensureRoom(pdf, 42);
      pdf.x = PAGE_MARGIN;
      pdf.font("TNR-Bold").fontSize(12).fillColor(GOLD).text(String(section.title));
      pdf.moveDown(0.2);
      pdf.strokeColor(DIVIDER).lineWidth(0.7).moveTo(PAGE_MARGIN, pdf.y)
        .lineTo(pdf.page.width - PAGE_MARGIN, pdf.y).stroke();
      pdf.moveDown(0.3);
    }
    if (isApprovalRecord) {
      drawApprovalRecord(pdf, approvalText);
    } else {
      for (const block of blocks) drawBlock(pdf, block, drawRunningHeader, { continuationLabel });
    }
    pdf.moveDown(0.4);
  }

  const pages = pdf.bufferedPageRange();
  for (let index = 0; index < pages.count; index += 1) {
    pdf.switchToPage(pages.start + index);
    const footerY = pdf.page.height - 80;
    pdf.strokeColor(DIVIDER).lineWidth(0.6).moveTo(PAGE_MARGIN, footerY - 7)
      .lineTo(pdf.page.width - PAGE_MARGIN, footerY - 7).stroke();
    pdf.font("TNR").fontSize(8).fillColor(MUTED)
      .text("Public Service Commission · REDESY controlled publication", PAGE_MARGIN, footerY, {
        width: 330,
        lineBreak: false,
      });
    pdf.text(`Page ${index + 1} of ${pages.count}`, pdf.page.width - PAGE_MARGIN - 100, footerY, {
      width: 100,
      align: "right",
      lineBreak: false,
    });
  }
  pdf.end();
  return completed;
};

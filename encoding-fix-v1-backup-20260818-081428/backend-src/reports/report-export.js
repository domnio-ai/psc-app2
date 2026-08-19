import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const text = (value) =>
  value === null || value === undefined ? "—" : String(value);
const heading = (model) =>
  `${model.title}${model.period?.from || model.period?.to ? ` (${model.period.from || "Start"} to ${model.period.to || "Today"})` : ""}`;
async function pdf(model) {
  const document = new PDFDocument({
      size: "A4",
      margin: 42,
      bufferPages: true,
    }),
    chunks = [];
  document.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });
  document
    .fontSize(18)
    .fillColor("#9a7417")
    .text(heading(model))
    .moveDown(0.35);
  document
    .fontSize(8)
    .fillColor("#555")
    .text(
      `Generated ${new Date().toLocaleString("en-KE")} · App2 controlled report`,
    )
    .moveDown();
  document
    .fontSize(11)
    .fillColor("#111")
    .text(
      model.kpis
        .map((item) => `${item.label}: ${text(item.value)}`)
        .join("   |   "),
    )
    .moveDown();
  if (model.columns.length) {
    document
      .fontSize(7)
      .text(model.columns.map(text).join(" | "))
      .moveDown(0.25);
    for (const row of model.rows) {
      if (document.y > 750) document.addPage();
      document
        .fillColor("#333")
        .text(model.columns.map((column) => text(row[column])).join(" | "), {
          width: 510,
        })
        .moveDown(0.2);
    }
  } else document.text("No detailed records matched the selected filters.");
  const pages = document.bufferedPageRange();
  for (let index = 0; index < pages.count; index++) {
    document.switchToPage(index);
    document
      .fontSize(8)
      .fillColor("#777")
      .text(`Page ${index + 1} of ${pages.count}`, 42, 790, {
        align: "right",
        width: 510,
      });
  }
  document.end();
  return done;
}
async function docx(model) {
  const cells = (values) =>
    new TableRow({
      children: values.map(
        (value) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: text(value), size: 18 })],
              }),
            ],
          }),
      ),
    });
  const children = [
    new Paragraph({ text: heading(model), heading: HeadingLevel.TITLE }),
    new Paragraph(
      `Generated ${new Date().toLocaleString("en-KE")} · App2 controlled report`,
    ),
    new Paragraph({
      children: model.kpis.map(
        (item) =>
          new TextRun({
            text: `${item.label}: ${text(item.value)}   `,
            bold: true,
          }),
      ),
    }),
  ];
  if (model.columns.length)
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          cells(model.columns),
          ...model.rows.map((row) =>
            cells(model.columns.map((column) => row[column])),
          ),
        ],
      }),
    );
  else
    children.push(
      new Paragraph("No detailed records matched the selected filters."),
    );
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}
async function xlsx(model) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "App2";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Report", {
    views: [{ state: "frozen", ySplit: 6 }],
  });
  sheet.addRow([heading(model)]);
  sheet.mergeCells(1, 1, 1, Math.max(1, model.columns.length));
  sheet.getCell("A1").font = {
    bold: true,
    size: 16,
    color: { argb: "FF9A7417" },
  };
  sheet.addRow([`Generated ${new Date().toLocaleString("en-KE")}`]);
  sheet.addRow([]);
  sheet.addRow(model.kpis.map((item) => item.label));
  sheet.addRow(model.kpis.map((item) => item.value));
  sheet.addRow([]);
  if (model.columns.length) {
    const header = sheet.addRow(model.columns.map(text));
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF30363B" },
    };
    for (const row of model.rows)
      sheet.addRow(model.columns.map((column) => row[column]));
  }
  sheet.columns.forEach((column) => {
    column.width = Math.min(
      45,
      Math.max(14, ...column.values.map((value) => text(value).length + 2)),
    );
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
export async function renderReportExport(format, model) {
  if (format === "pdf")
    return {
      buffer: await pdf(model),
      type: "application/pdf",
      extension: "pdf",
    };
  if (format === "docx")
    return {
      buffer: await docx(model),
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extension: "docx",
    };
  if (format === "xlsx")
    return {
      buffer: await xlsx(model),
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: "xlsx",
    };
  throw Object.assign(new Error("Unsupported report export format."), {
    status: 400,
  });
}

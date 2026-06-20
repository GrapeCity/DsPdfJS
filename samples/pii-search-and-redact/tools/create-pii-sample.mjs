// Generates public/pii-sample.pdf. All names, addresses, identifiers, and
// contact details are intentionally obvious demonstration values.
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  connectDsPdf,
  disconnectDsPdf,
  DsPdfConfig,
  Font,
  ObjectManager,
  PdfDocument,
  StandardPdfFont,
} from "@mescius/ds-pdf";

const here = dirname(fileURLToPath(import.meta.url));
DsPdfConfig.wasmUrl = resolve(here, "../node_modules/@mescius/ds-pdf/assets/DsPdf.wasm");

if (!(await connectDsPdf())) throw new Error("Failed to initialize DsPdfJS.");

const om = new ObjectManager();
try {
  const doc = new PdfDocument(om);
  doc.documentInfo = {
    title: "Fictional PII Redaction Sample",
    author: "ACME Studios LLC",
    subject: "Demonstration document containing obvious fictional PII",
  };

  const ctx = doc.newPageContext({ width: 612, height: 792 });
  const regular = Font.getPdfFont(om, StandardPdfFont.Helvetica);
  const bold = Font.getPdfFont(om, StandardPdfFont.HelveticaBold);

  ctx.drawRect(0, 0, 612, 108, { fillColor: "#241B35" });
  ctx.drawText({ text: "CONFIDENTIAL", font: bold, fontSize: 10, foreColor: "#D5C4FF" }, 48, 32);
  ctx.drawText({ text: "Demo personnel record", font: bold, fontSize: 27, foreColor: "White" }, 48, 53);
  ctx.drawText({ text: "Fictional data for PII search and redaction", font: regular, fontSize: 11, foreColor: "#D8D2E3" }, 48, 87);

  ctx.drawRect(48, 134, 516, 48, { radius: 8, fillColor: "#F3EFFB" });
  ctx.drawText({ text: "DEMONSTRATION ONLY", font: bold, fontSize: 9, foreColor: "#6742C7" }, 64, 147);
  ctx.drawText({ text: "Every person, address, account, and contact detail below is intentionally fictional.", font: regular, fontSize: 10, foreColor: "#4F5668" }, 64, 163);

  ctx.drawText({ text: "IDENTITY AND CONTACT", font: bold, fontSize: 10, foreColor: "#6742C7" }, 48, 216);

  const rows = [
    ["Name", "Alex Example"],
    ["Email", "alex@example.example"],
    ["Phone", "+1 (212) 555-0100"],
    ["Address", "456 Placeholder Road, Demo Town, MA 01234"],
    ["SSN", "000-12-3456"],
    ["Employee ID", "DEMO-EMP-0042"],
    ["Account", "DEMO-ACCT-000042"],
  ];

  let y = 241;
  for (const [label, value] of rows) {
    ctx.drawRect(48, y, 516, 48, { fillColor: y % 2 ? "#FFFFFF" : "#F8F9FC" });
    ctx.drawText({ text: label, font: bold, fontSize: 9, foreColor: "#747C8E" }, 64, y + 16);
    ctx.drawText({ text: value, font: regular, fontSize: 12, foreColor: "#171C2A" }, 184, y + 14);
    ctx.drawLine(48, y + 48, 564, y + 48, { color: "#E6E8EF", width: 0.7 });
    y += 48;
  }

  ctx.drawText({ text: "NON-SENSITIVE CONTEXT", font: bold, fontSize: 10, foreColor: "#6742C7" }, 48, 608);
  ctx.drawText({ text: "Department: Demo Operations", font: regular, fontSize: 11, foreColor: "#353B4A" }, 48, 630);
  ctx.drawText({ text: "Record status: Example only", font: regular, fontSize: 11, foreColor: "#353B4A" }, 48, 650);

  ctx.drawRect(48, 694, 516, 52, { radius: 8, fillColor: "#FFF4D6" });
  ctx.drawText({ text: "This PDF exists solely to demonstrate permanent redaction with DsPdfJS.", font: bold, fontSize: 10, foreColor: "#6B4E00" }, 64, 714);
  ctx.drawText({ text: "None of its contents identify a real person or account.", font: regular, fontSize: 9, foreColor: "#7D651F" }, 64, 730);

  writeFileSync(resolve(here, "../public/pii-sample.pdf"), doc.savePdf());
  console.log("Created public/pii-sample.pdf");
} finally {
  om.dispose();
  disconnectDsPdf();
}

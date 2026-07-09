// Generates public/text-replace-sample.pdf: a short, plain-text business
// quotation crafted so that find-and-replace behaves predictably. Every
// company name, product, and amount below is fictional demonstration data.
import { mkdirSync, writeFileSync } from "node:fs";
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

// await DsPdfConfig.setLicenseKey("YOUR_non-browser.local_LICENSE_KEY_HERE");

if (!(await connectDsPdf())) throw new Error("Failed to initialize DsPdfJS.");

const om = new ObjectManager();
try {
  const doc = new PdfDocument(om);
  doc.documentInfo = {
    title: "Fictional Quotation Sample",
    author: "Acme Corp",
    subject: "Demonstration document for find-and-replace with DsPdfJS",
  };

  const ctx = doc.newPageContext({ width: 612, height: 792 });
  const regular = Font.getPdfFont(om, StandardPdfFont.Helvetica);
  const bold = Font.getPdfFont(om, StandardPdfFont.HelveticaBold);

  ctx.drawRect(0, 0, 612, 104, { fillColor: "#123B63" });
  ctx.drawText({ text: "Acme Corp", font: bold, fontSize: 26, foreColor: "White" }, 48, 34);
  ctx.drawText({ text: "Price Quotation", font: regular, fontSize: 13, foreColor: "#BFD5EC" }, 48, 70);

  ctx.drawText({ text: "Prepared for: Jordan Sample", font: bold, fontSize: 12, foreColor: "#123B63" }, 48, 140);
  ctx.drawText({ text: "Quote number: Q-1001", font: regular, fontSize: 11, foreColor: "#353B4A" }, 48, 160);
  ctx.drawText({ text: "Valid until: 2026-08-31", font: regular, fontSize: 11, foreColor: "#353B4A" }, 48, 178);

  ctx.drawText(
    {
      text: "Thank you for considering Acme Corp. The pricing below is provided by Acme Corp",
      font: regular,
      fontSize: 11,
      foreColor: "#353B4A",
    },
    48,
    214,
  );
  ctx.drawText(
    { text: "and is subject to the standard Acme Corp terms of service.", font: regular, fontSize: 11, foreColor: "#353B4A" },
    48,
    230,
  );

  // Line-item table.
  const tableTop = 272;
  ctx.drawRect(48, tableTop, 516, 26, { fillColor: "#123B63" });
  ctx.drawText({ text: "Item", font: bold, fontSize: 10, foreColor: "White" }, 60, tableTop + 8);
  ctx.drawText({ text: "Qty", font: bold, fontSize: 10, foreColor: "White" }, 356, tableTop + 8);
  ctx.drawText({ text: "Unit price", font: bold, fontSize: 10, foreColor: "White" }, 424, tableTop + 8);
  ctx.drawText({ text: "Amount", font: bold, fontSize: 10, foreColor: "White" }, 508, tableTop + 8);

  const items = [
    ["Standard Plan license", "2", "$1,200.00", "$2,400.00"],
    ["Onboarding service", "1", "$800.00", "$800.00"],
    ["Priority support (annual)", "1", "$1,200.00", "$1,200.00"],
  ];

  let y = tableTop + 26;
  for (const [item, qty, unit, amount] of items) {
    ctx.drawRect(48, y, 516, 30, { fillColor: (y / 30) % 2 ? "#FFFFFF" : "#F4F7FB" });
    ctx.drawText({ text: item, font: regular, fontSize: 11, foreColor: "#171C2A" }, 60, y + 10);
    ctx.drawText({ text: qty, font: regular, fontSize: 11, foreColor: "#171C2A" }, 360, y + 10);
    ctx.drawText({ text: unit, font: regular, fontSize: 11, foreColor: "#171C2A" }, 424, y + 10);
    ctx.drawText({ text: amount, font: regular, fontSize: 11, foreColor: "#171C2A" }, 508, y + 10);
    ctx.drawLine(48, y + 30, 564, y + 30, { color: "#E0E5EE", width: 0.7 });
    y += 30;
  }

  ctx.drawText({ text: "Total", font: bold, fontSize: 12, foreColor: "#123B63" }, 424, y + 14);
  ctx.drawText({ text: "$4,400.00", font: bold, fontSize: 12, foreColor: "#123B63" }, 508, y + 14);

  ctx.drawRect(48, 700, 516, 46, { radius: 8, fillColor: "#EEF3F9" });
  ctx.drawText(
    { text: "This fictional quotation exists only to demonstrate find-and-replace with DsPdfJS.", font: bold, fontSize: 10, foreColor: "#123B63" },
    64,
    718,
  );
  ctx.drawText(
    { text: "Company names and amounts are not real. Contact: quotes@acme.example", font: regular, fontSize: 9, foreColor: "#4F5668" },
    64,
    733,
  );

  const outDir = resolve(here, "../public");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "text-replace-sample.pdf"), doc.savePdf());
  console.log("Created public/text-replace-sample.pdf");
} finally {
  om.dispose();
  disconnectDsPdf();
}

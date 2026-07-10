// Generates the three small PDFs in public/ used by the "Load sample files"
// button. Each document has a distinct color and clearly numbered pages so
// merge, reorder, extract, and split results are easy to see.
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

const DOCUMENTS = [
  { file: "sample-report.pdf", title: "Demo Report", accent: "#6742C7", soft: "#EEE9FC", pages: 3 },
  { file: "sample-appendix.pdf", title: "Demo Appendix", accent: "#0E7A5F", soft: "#E3F5EF", pages: 2 },
  { file: "sample-slides.pdf", title: "Demo Slides", accent: "#B4541B", soft: "#FBEEE3", pages: 4 },
];

const om = new ObjectManager();
try {
  const regular = Font.getPdfFont(om, StandardPdfFont.Helvetica);
  const bold = Font.getPdfFont(om, StandardPdfFont.HelveticaBold);

  for (const { file, title, accent, soft, pages } of DOCUMENTS) {
    const doc = new PdfDocument(om);
    doc.documentInfo = { title, author: "DsPdfJS sample", subject: "Merge and split demo document" };

    for (let page = 1; page <= pages; page++) {
      const ctx = doc.newPageContext({ width: 612, height: 792 });

      ctx.drawRect(0, 0, 612, 96, { fillColor: accent });
      ctx.drawText({ text: title.toUpperCase(), font: bold, fontSize: 11, foreColor: "#FFFFFF" }, 48, 34);
      ctx.drawText({ text: `Page ${page} of ${pages}`, font: regular, fontSize: 10, foreColor: "#FFFFFF" }, 48, 62);

      ctx.drawRect(48, 132, 516, 420, { radius: 10, fillColor: soft });
      ctx.drawText({ text: title, font: bold, fontSize: 30, foreColor: accent }, 84, 176);
      ctx.drawText({ text: String(page), font: bold, fontSize: 220, foreColor: accent }, 220, 250);

      ctx.drawText(
        { text: "Use this document to try merging, reordering, extracting, and splitting.", font: regular, fontSize: 11, foreColor: "#4F5668" },
        48, 600,
      );
      ctx.drawLine(48, 736, 564, 736, { color: "#D8DCE7", width: 0.7 });
      ctx.drawText({ text: `${file} - page ${page}`, font: regular, fontSize: 9, foreColor: "#7B8394" }, 48, 748);
    }

    writeFileSync(resolve(here, "../public", file), doc.savePdf());
    console.log(`Created public/${file} (${pages} pages)`);
  }
} finally {
  om.dispose();
  disconnectDsPdf();
}

// Generates the blank fillable AcroForm PDF used by this sample.
//
// This is a one-off authoring helper, not part of the running demo: it builds
// `public/registration-form.pdf` so the sample has a real AcroForm to fill.
// The committed PDF is the actual asset the app loads at runtime; re-run this
// script (`npm run make-form`) only if you want to regenerate or tweak it.
//
//   node tools/create-form-template.mjs
//
// It demonstrates the *creation* side of AcroForms in DsPdfJS: adding text,
// checkbox, combo box, and list box fields to a page. The sample app itself
// (src/Demos.ts) demonstrates the *fill + flatten* side.

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { writeFileSync } from "node:fs";
import {
  DsPdfConfig,
  connectDsPdf,
  disconnectDsPdf,
  ObjectManager,
  PdfDocument,
  Font,
  StandardPdfFont,
} from "@mescius/ds-pdf";

const here = dirname(fileURLToPath(import.meta.url));
const wasmUrl = resolve(here, "../node_modules/@mescius/ds-pdf/assets/DsPdf.wasm");
const outFile = resolve(here, "../public/registration-form.pdf");

// Field option lists, also referenced (by display text) in public/form-data.json.
const COUNTRIES = ["Canada", "United Kingdom", "United States", "Germany", "Japan", "Australia"];
const MEMBERSHIPS = ["Basic", "Pro", "Enterprise"];
const INTERESTS = ["JavaScript", "TypeScript", "PDF", "SVG", "WebAssembly", "Imaging"];

DsPdfConfig.wasmUrl = wasmUrl;

if (!(await connectDsPdf())) throw new Error("Failed to initialize DsPdfJS.");

const om = new ObjectManager();
try {
  const doc = new PdfDocument(om);
  const page = doc.pages.addNew(612, 792); // US Letter, points
  const ctx = page.context;
  const form = doc.acroForm;

  const labelFont = Font.getPdfFont(om, StandardPdfFont.HelveticaBold);
  const titleFont = Font.getPdfFont(om, StandardPdfFont.HelveticaBold);

  // Title
  ctx.drawText({ text: "Membership Registration", font: titleFont, fontSize: 20 }, 56, 56);
  ctx.drawText(
    { text: "All fields are interactive AcroForm fields.", fontSize: 10, foreColor: "DimGray" },
    56, 82,
  );

  const labelSize = 11;
  const boxBorder = { width: 1, color: "DimGray" };
  const boxBack = "WhiteSmoke";

  // Helper: draw a label above a field rect and return the field rect.
  let y = 120;
  const left = 56;
  const fieldWidth = 320;
  const rowGap = 16;

  function row(label, height) {
    ctx.drawText({ text: label, font: labelFont, fontSize: labelSize }, left, y);
    const rect = { x: left, y: y + 16, width: fieldWidth, height };
    y += 16 + height + rowGap;
    return rect;
  }

  // --- Text fields ---
  form.fields.add({
    type: "text", name: "fullName", page,
    rect: row("Full name", 22),
    widget: { border: boxBorder, backColor: boxBack },
  });
  form.fields.add({
    type: "text", name: "email", page,
    rect: row("Email", 22),
    widget: { border: boxBorder, backColor: boxBack },
  });
  form.fields.add({
    type: "text", name: "phone", page,
    rect: row("Phone", 22),
    widget: { border: boxBorder, backColor: boxBack },
  });

  // --- Combo box (drop-down list, not editable) ---
  form.fields.add({
    type: "combobox", name: "country", page,
    items: COUNTRIES, editable: false,
    rect: row("Country", 22),
    widget: { border: boxBorder, backColor: boxBack },
  });

  // --- Combo box (editable: accepts a typed value too) ---
  form.fields.add({
    type: "combobox", name: "membership", page,
    items: MEMBERSHIPS, editable: true,
    rect: row("Membership level", 22),
    widget: { border: boxBorder, backColor: boxBack },
  });

  // --- List box (multi-select) ---
  form.fields.add({
    type: "listbox", name: "interests", page,
    items: INTERESTS, multiSelect: true,
    rect: row("Interests (multi-select)", 92),
    widget: { border: boxBorder, backColor: boxBack },
  });

  // --- Check box ---
  {
    const cbY = y;
    form.fields.add({
      type: "checkbox", name: "newsletter", page,
      rect: { x: left, y: cbY, width: 16, height: 16 },
      widget: { border: boxBorder, backColor: boxBack },
    });
    ctx.drawText(
      { text: "Subscribe to the newsletter", fontSize: labelSize }, left + 24, cbY + 2,
    );
    y = cbY + 16 + rowGap;
  }

  // --- Multiline text field ---
  form.fields.add({
    type: "text", name: "comments", page, multiline: true,
    rect: row("Comments", 80),
    widget: { border: boxBorder, backColor: boxBack },
  });

  writeFileSync(outFile, doc.savePdf());
  console.log(`Wrote ${outFile} with ${form.fields.count} form fields.`);
} finally {
  om.dispose();
  disconnectDsPdf();
}

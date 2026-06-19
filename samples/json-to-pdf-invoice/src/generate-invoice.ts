import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  connectDsPdf,
  disconnectDsPdf,
  DsPdfConfig,
  Font,
  Format,
  ObjectManager,
  PdfDocument,
  StandardPdfFont,
  SvgDocument,
  type DrawingContext,
} from "@mescius/ds-pdf";

type Party = {
  name: string;
  attention?: string;
  address: string[];
  email: string;
  phone?: string;
  website?: string;
};

type InvoiceItem = {
  sku: string;
  description: string;
  details?: string;
  quantity: number;
  unitPrice: number;
};

type Invoice = {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  purchaseOrder?: string;
  currency: string;
  seller: Party;
  customer: Party;
  items: InvoiceItem[];
  discount?: number;
  taxRate?: number;
  paymentTerms?: string;
  notes?: string;
};

type Fonts = {
  regular: Font;
  bold: Font;
};

type Styles = {
  body: Format;
  bodyMuted: Format;
  small: Format;
  smallMuted: Format;
  smallBold: Format;
  label: Format;
  tableHeader: Format;
  itemTitle: Format;
  itemDetail: Format;
  title: Format;
  brand: Format;
  brandSub: Format;
  amount: Format;
  amountLabel: Format;
  total: Format;
  totalLabel: Format;
};

const PAGE = { width: 612, height: 792 };
const MARGIN = 42;
const CONTENT_RIGHT = PAGE.width - MARGIN;
const ROW_BOTTOM = 712;

const COLOR = {
  ink: "#17213A",
  muted: "#65708A",
  faint: "#EDF0F6",
  surface: "#F7F8FC",
  primary: "#682874",
  primaryDark: "#521D5B",
  primaryPale: "#F3EAF5",
  mint: "#D7A8DE",
  white: "#FFFFFF",
};

const compiledDir = path.dirname(fileURLToPath(import.meta.url));
const sampleRoot = path.resolve(compiledDir, "..");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertInvoice(value: unknown): asserts value is Invoice {
  if (!isRecord(value)) {
    throw new Error("Invoice JSON must contain an object at its root.");
  }

  const requiredStrings = ["invoiceNumber", "issueDate", "dueDate", "currency"];
  for (const key of requiredStrings) {
    if (typeof value[key] !== "string" || value[key].length === 0) {
      throw new Error(`Invoice property '${key}' must be a non-empty string.`);
    }
  }

  for (const partyKey of ["seller", "customer"] as const) {
    const party = value[partyKey];
    if (
      !isRecord(party)
      || typeof party.name !== "string"
      || typeof party.email !== "string"
      || !Array.isArray(party.address)
      || !party.address.every((line) => typeof line === "string")
    ) {
      throw new Error(
        `Invoice '${partyKey}' must include a name, email, and string-array address.`,
      );
    }
  }
  if (!Array.isArray(value.items) || value.items.length === 0) {
    throw new Error("Invoice JSON must include at least one line item.");
  }

  for (const [index, item] of value.items.entries()) {
    if (
      !isRecord(item)
      || typeof item.sku !== "string"
      || typeof item.description !== "string"
      || typeof item.quantity !== "number"
      || !Number.isFinite(item.quantity)
      || typeof item.unitPrice !== "number"
      || !Number.isFinite(item.unitPrice)
    ) {
      throw new Error(`Invoice item ${index + 1} is missing a required value.`);
    }
  }
}

async function loadInvoice(filePath: string): Promise<Invoice> {
  const raw = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  assertInvoice(raw);
  return raw;
}

function createStyles(om: ObjectManager): { fonts: Fonts; styles: Styles } {
  const fonts = {
    regular: Font.getPdfFont(om, StandardPdfFont.Helvetica),
    bold: Font.getPdfFont(om, StandardPdfFont.HelveticaBold),
  };

  const format = (font: Font, fontSize: number, foreColor: string) =>
    new Format(om, { font, fontSize, foreColor });

  return {
    fonts,
    styles: {
      body: format(fonts.regular, 9.5, COLOR.ink),
      bodyMuted: format(fonts.regular, 9.5, COLOR.muted),
      small: format(fonts.regular, 8, COLOR.ink),
      smallMuted: format(fonts.regular, 8, COLOR.muted),
      smallBold: format(fonts.bold, 8, COLOR.ink),
      label: format(fonts.bold, 8, COLOR.primary),
      tableHeader: format(fonts.bold, 8, COLOR.white),
      itemTitle: format(fonts.bold, 9.5, COLOR.ink),
      itemDetail: format(fonts.regular, 8, COLOR.muted),
      title: format(fonts.bold, 30, COLOR.ink),
      brand: format(fonts.bold, 15, COLOR.ink),
      brandSub: format(fonts.regular, 8, COLOR.muted),
      amount: format(fonts.bold, 19, COLOR.primaryDark),
      amountLabel: format(fonts.bold, 8, COLOR.primaryDark),
      total: format(fonts.bold, 16, COLOR.white),
      totalLabel: format(fonts.bold, 8, COLOR.white),
    },
  };
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function currencyFormatter(invoice: Invoice): Intl.NumberFormat {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: invoice.currency,
    minimumFractionDigits: 2,
  });
}

function drawRight(
  ctx: DrawingContext,
  text: string,
  style: Format,
  right: number,
  y: number,
): void {
  const width = ctx.measureText(text, style).width;
  ctx.drawText(text, style, right - width, y);
}

function drawLabelValue(
  ctx: DrawingContext,
  label: string,
  value: string,
  x: number,
  y: number,
  labelStyle: Format,
  valueStyle: Format,
): void {
  ctx.drawText(label.toUpperCase(), labelStyle, x, y);
  ctx.drawText(value, valueStyle, x, y + 13);
}

function drawParty(
  ctx: DrawingContext,
  party: Party,
  x: number,
  y: number,
  styles: Styles,
): void {
  ctx.drawText(party.name, styles.itemTitle, x, y);
  let lineY = y + 15;
  if (party.attention) {
    ctx.drawText(party.attention, styles.bodyMuted, x, lineY);
    lineY += 12;
  }
  for (const line of party.address) {
    ctx.drawText(line, styles.bodyMuted, x, lineY);
    lineY += 12;
  }
  ctx.drawText(party.email, styles.bodyMuted, x, lineY);
}

function drawBrand(
  ctx: DrawingContext,
  logo: SvgDocument,
  x: number,
  y: number,
  scale: number,
  styles: Styles,
): void {
  const logoHeight = 40 * scale;
  const logoWidth = logoHeight * (99 / 127);
  ctx.drawSvgToRect(logo, x, y, logoWidth, logoHeight);
  ctx.drawText("ACME", styles.brand, x + logoWidth + 10, y + 4 * scale);
  ctx.drawText("STUDIOS LLC", styles.brandSub, x + logoWidth + 10, y + 24 * scale);
}

function drawFirstPageHeader(
  ctx: DrawingContext,
  invoice: Invoice,
  logo: SvgDocument,
  styles: Styles,
  money: Intl.NumberFormat,
  total: number,
): number {
  drawBrand(ctx, logo, MARGIN, 34, 1, styles);
  drawRight(ctx, "INVOICE", styles.title, CONTENT_RIGHT, 32);
  drawRight(ctx, `# ${invoice.invoiceNumber}`, styles.bodyMuted, CONTENT_RIGHT, 69);

  ctx.drawLine(MARGIN, 91, CONTENT_RIGHT, 91, { color: COLOR.primary, width: 2 });

  ctx.drawText(invoice.seller.name, styles.smallBold, MARGIN, 104);
  const sellerLine = [invoice.seller.email, invoice.seller.phone, invoice.seller.website]
    .filter((value): value is string => Boolean(value))
    .join("  |  ");
  ctx.drawText(sellerLine, styles.smallMuted, MARGIN, 118);

  ctx.drawRect(MARGIN, 143, 274, 106, {
    radius: 8,
    fillColor: COLOR.surface,
    lineColor: COLOR.faint,
    lineWidth: 0.7,
  });
  ctx.drawText("BILL TO", styles.label, MARGIN + 14, 156);
  drawParty(ctx, invoice.customer, MARGIN + 14, 172, styles);

  ctx.drawRect(330, 143, 240, 106, {
    radius: 8,
    fillColor: COLOR.surface,
    lineColor: COLOR.faint,
    lineWidth: 0.7,
  });
  drawLabelValue(ctx, "Issued", formatDate(invoice.issueDate), 344, 156, styles.label, styles.body);
  drawLabelValue(ctx, "Due", formatDate(invoice.dueDate), 447, 156, styles.label, styles.body);
  drawLabelValue(
    ctx,
    "Purchase order",
    invoice.purchaseOrder ?? "-",
    344,
    194,
    styles.label,
    styles.body,
  );
  drawLabelValue(ctx, "Currency", invoice.currency, 447, 194, styles.label, styles.body);

  ctx.drawRect(MARGIN, 261, CONTENT_RIGHT - MARGIN, 45, {
    radius: 8,
    fillColor: COLOR.primaryPale,
  });
  ctx.drawText("AMOUNT DUE", styles.amountLabel, MARGIN + 14, 271);
  ctx.drawText(`Due ${formatDate(invoice.dueDate)}`, styles.smallMuted, MARGIN + 14, 287);
  drawRight(ctx, money.format(total), styles.amount, CONTENT_RIGHT - 14, 271);

  return drawTableHeader(ctx, 324, styles);
}

function drawContinuationHeader(
  ctx: DrawingContext,
  invoice: Invoice,
  logo: SvgDocument,
  styles: Styles,
): number {
  drawBrand(ctx, logo, MARGIN, 32, 0.8, styles);
  drawRight(ctx, `Invoice # ${invoice.invoiceNumber}`, styles.itemTitle, CONTENT_RIGHT, 38);
  drawRight(ctx, "Line items continued", styles.smallMuted, CONTENT_RIGHT, 54);
  ctx.drawLine(MARGIN, 78, CONTENT_RIGHT, 78, { color: COLOR.primary, width: 1.5 });
  return drawTableHeader(ctx, 96, styles);
}

function drawTableHeader(ctx: DrawingContext, y: number, styles: Styles): number {
  ctx.drawRect(MARGIN, y, CONTENT_RIGHT - MARGIN, 26, {
    radius: 5,
    fillColor: COLOR.primary,
  });
  ctx.drawText("ITEM", styles.tableHeader, MARGIN + 10, y + 9);
  ctx.drawText("QTY", styles.tableHeader, 384, y + 9);
  drawRight(ctx, "RATE", styles.tableHeader, 492, y + 9);
  drawRight(ctx, "AMOUNT", styles.tableHeader, CONTENT_RIGHT - 10, y + 9);
  return y + 26;
}

function measureItemHeight(ctx: DrawingContext, item: InvoiceItem, styles: Styles): number {
  const detailHeight = item.details
    ? ctx.measureText(item.details, styles.itemDetail, 278).height
    : 0;
  return Math.max(46, 35 + detailHeight);
}

function drawItemRow(
  ctx: DrawingContext,
  item: InvoiceItem,
  index: number,
  y: number,
  height: number,
  styles: Styles,
  money: Intl.NumberFormat,
): void {
  if (index % 2 === 1) {
    ctx.drawRect(MARGIN, y, CONTENT_RIGHT - MARGIN, height, { fillColor: COLOR.surface });
  }

  ctx.drawText(item.sku, styles.label, MARGIN + 10, y + 8);
  ctx.drawText(item.description, styles.itemTitle, MARGIN + 10, y + 20, 278);
  if (item.details) {
    ctx.drawText(item.details, styles.itemDetail, MARGIN + 10, y + 34, 278);
  }

  drawRight(ctx, String(item.quantity), styles.body, 405, y + 19);
  drawRight(ctx, money.format(item.unitPrice), styles.body, 492, y + 19);
  drawRight(
    ctx,
    money.format(item.quantity * item.unitPrice),
    styles.itemTitle,
    CONTENT_RIGHT - 10,
    y + 19,
  );

  ctx.drawLine(MARGIN, y + height, CONTENT_RIGHT, y + height, {
    color: COLOR.faint,
    width: 0.6,
  });
}

function drawSummary(
  ctx: DrawingContext,
  invoice: Invoice,
  y: number,
  styles: Styles,
  money: Intl.NumberFormat,
  subtotal: number,
  discount: number,
  tax: number,
  total: number,
): void {
  const summaryTop = y + 22;

  ctx.drawText("PAYMENT DETAILS", styles.label, MARGIN, summaryTop);
  const terms = invoice.paymentTerms ?? "Payment is due by the date shown on this invoice.";
  ctx.drawText(terms, styles.bodyMuted, MARGIN, summaryTop + 18, 244);

  ctx.drawRect(326, summaryTop - 6, 244, 104, {
    radius: 8,
    fillColor: COLOR.surface,
    lineColor: COLOR.faint,
    lineWidth: 0.7,
  });

  const rows: Array<[string, string]> = [
    ["Subtotal", money.format(subtotal)],
    ["Discount", discount ? `-${money.format(discount)}` : money.format(0)],
    [`Tax (${((invoice.taxRate ?? 0) * 100).toFixed(2)}%)`, money.format(tax)],
  ];
  let rowY = summaryTop + 8;
  for (const [label, value] of rows) {
    ctx.drawText(label, styles.bodyMuted, 342, rowY);
    drawRight(ctx, value, styles.body, 554, rowY);
    rowY += 21;
  }

  ctx.drawRect(326, summaryTop + 104, 244, 48, {
    radius: 8,
    fillColor: COLOR.primaryDark,
  });
  ctx.drawText("TOTAL DUE", styles.totalLabel, 342, summaryTop + 117);
  drawRight(ctx, money.format(total), styles.total, 554, summaryTop + 114);

  if (invoice.notes) {
    const noteY = summaryTop + 178;
    ctx.drawRect(MARGIN, noteY, CONTENT_RIGHT - MARGIN, 62, {
      radius: 8,
      fillColor: COLOR.primaryPale,
    });
    ctx.drawRect(MARGIN, noteY, 6, 62, {
      radius: 3,
      fillColor: COLOR.mint,
    });
    ctx.drawText("THANK YOU", styles.amountLabel, MARGIN + 18, noteY + 13);
    ctx.drawText(invoice.notes, styles.bodyMuted, MARGIN + 18, noteY + 31, 480);
  }
}

function drawFooters(doc: PdfDocument, invoice: Invoice, styles: Styles): void {
  const pageCount = doc.pages.count;
  for (let index = 0; index < pageCount; index++) {
    const ctx = doc.pages.getAt(index).context;
    ctx.drawLine(MARGIN, 750, CONTENT_RIGHT, 750, { color: COLOR.faint, width: 0.7 });
    ctx.drawText(`${invoice.seller.name}  |  ${invoice.invoiceNumber}`, styles.smallMuted, MARGIN, 760);
    drawRight(ctx, `Page ${index + 1} of ${pageCount}`, styles.smallMuted, CONTENT_RIGHT, 760);
  }
}

async function generateInvoice(invoice: Invoice, outputPath: string): Promise<void> {
  const wasmPath = path.resolve(sampleRoot, "node_modules/@mescius/ds-pdf/assets/DsPdf.wasm");
  DsPdfConfig.wasmUrl = wasmPath;

  const licenseKey = process.env.DSPDF_LICENSE_KEY;
  if (licenseKey) {
    await DsPdfConfig.setLicenseKey(licenseKey);
  }

  if (!(await connectDsPdf())) {
    throw new Error("Failed to initialize the DsPdfJS WebAssembly module.");
  }

  const om = new ObjectManager();
  try {
    const doc = new PdfDocument(om);
    doc.documentInfo = {
      title: `Invoice ${invoice.invoiceNumber}`,
      author: invoice.seller.name,
      subject: `Invoice for ${invoice.customer.name}`,
      creator: "DsPdfJS JSON-to-PDF invoice sample",
      createDate: new Date(),
    };

    const { styles } = createStyles(om);
    const logo = SvgDocument.load(
      om,
      new Uint8Array(await readFile(path.resolve(sampleRoot, "assets/acme-logo.svg"))),
    );
    const money = currencyFormatter(invoice);
    const subtotal = invoice.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const discount = invoice.discount ?? 0;
    const tax = Math.max(0, subtotal - discount) * (invoice.taxRate ?? 0);
    const total = subtotal - discount + tax;

    let ctx: DrawingContext = doc.newPageContext(PAGE);
    let y = drawFirstPageHeader(ctx, invoice, logo, styles, money, total);

    for (const [index, item] of invoice.items.entries()) {
      const height = measureItemHeight(ctx, item, styles);
      if (y + height > ROW_BOTTOM) {
        ctx = doc.newPageContext(PAGE);
        y = drawContinuationHeader(ctx, invoice, logo, styles);
      }
      drawItemRow(ctx, item, index, y, height, styles, money);
      y += height;
    }

    if (y > 485) {
      ctx = doc.newPageContext(PAGE);
      y = drawContinuationHeader(ctx, invoice, logo, styles);
    }

    drawSummary(ctx, invoice, y, styles, money, subtotal, discount, tax, total);
    drawFooters(doc, invoice, styles);

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, doc.savePdf());
    console.log(`Created ${outputPath}`);
    console.log(`Pages: ${doc.pages.count}; total: ${money.format(total)}`);
  } finally {
    om.dispose();
    disconnectDsPdf();
  }
}

async function main(): Promise<void> {
  const inputPath = path.resolve(process.argv[2] ?? path.resolve(sampleRoot, "data/invoice.json"));
  const outputPath = path.resolve(process.argv[3] ?? path.resolve(sampleRoot, "output/invoice.pdf"));
  const invoice = await loadInvoice(inputPath);
  await generateInvoice(invoice, outputPath);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

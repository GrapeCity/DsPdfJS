import {
  connectDsPdf,
  disconnectDsPdf,
  DsPdf,
  DsPdfConfig,
  FlowDirection,
  Font,
  FontCollection,
  Format,
  GlyphWidths,
  Layout,
  ObjectManager,
  PdfContext,
  PdfDocument,
  TextAlignment,
  withObjectManager,
} from "@mescius/ds-pdf";

export type ShowcaseResult = { pageCount: number; previewSvgs: string[] };

/** The Noto fonts downloaded into public/fonts by tools/download-fonts.mjs. */
const FONT_FILES = {
  latin: "NotoSans-Regular.ttf",
  arabic: "NotoSansArabic-Regular.ttf",
  hebrew: "NotoSansHebrew-Regular.ttf",
  thai: "NotoSansThai-Regular.ttf",
  devanagari: "NotoSansDevanagari-Regular.ttf",
  japanese: "NotoSansJP-Regular.otf",
} as const;

// Demonstration texts. Each one exercises a specific text-layout feature.
const TEXT = {
  // English/Arabic/Hebrew in ONE paragraph: the engine applies the Unicode
  // bidirectional algorithm to order the runs correctly.
  bidiEnglish1: "DsPdfJS lays out mixed scripts in a single paragraph: Arabic ",
  bidiArabic: "العربية تُكتب من اليمين إلى اليسار",
  bidiEnglish2: ", Hebrew ",
  bidiHebrew: "עברית נכתבת מימין לשמאל",
  bidiEnglish3: ", and Latin text flows left to right - with correct bidirectional ordering and Arabic letter shaping handled automatically.",

  // Arabic paragraph with an embedded Latin product name and digits,
  // laid out with a right-to-left base direction.
  rtlArabic: "تدعم مكتبة DsPdfJS الكتابة من اليمين إلى اليسار مع تشكيل الحروف العربية وربطها بصورة صحيحة.",
  rtlHebrew: "הספרייה מסדרת טקסט עברי מימין לשמאל, כולל מספרים כמו 123 ומילים באנגלית.",

  // One string, six scripts. The Format uses only the Latin font; every other
  // script is resolved through the font collection's fallback fonts.
  fallbackLine: "Hello · Привет · مرحبا · שלום · こんにちは · สวัสดี · नमस्ते",

  // Thai is written without spaces between words; line breaking has to follow
  // the Unicode line-breaking rules rather than just splitting on spaces.
  thai: "ภาษาไทยเขียนติดกันโดยไม่มีช่องว่างระหว่างคำ การตัดบรรทัดจึงต้องอาศัยกฎของยูนิโค้ด",

  // Vertical Japanese: an introduction and Basho's famous haiku
  // (public domain). Lines are stacked from right to left.
  verticalIntro: "日本語の縦書きは行を右から左へ進めます。",
  verticalUpright1: "DsPdfJS",
  verticalIntro2: "は縦書きレイアウトに対応しています。",

  // A longer Latin phrase drawn sideways - the default for Latin text in a
  // vertical flow: the whole run rotates with the line.
  sideways1: "長い英語の語句（例：",
  sidewaysLatin: "Document Solutions",
  sideways2: "）は、既定では行の向きに合わせて回転します。",

  // Tate-chu-yoko: short runs of any characters (digits, Latin words like
  // "PDF") set horizontally inside the vertical flow.
  tcy1: "例えば「",
  tcyDigits1: "12",
  tcy2: "月",
  tcyDigits2: "31",
  tcy3: "日」や「",
  tcyLatin: "PDF",
  tcy4: "」のような短い英数字は、縦中横として横向きに組みます。",
  haiku: "古池や　蛙飛び込む　水の音",
  haikuAuthor: "― 松尾芭蕉",
} as const;

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const ACCENT = "#6742C7";
const INK = "#171C2A";
const NOTE = "#626B7D";

export class Demos {
  // Fonts and the font collection are loaded once and kept alive in their own
  // ObjectManager, since they are reused by every render.
  private static fontsOm: ObjectManager | null = null;
  private static fonts: Record<keyof typeof FONT_FILES, Font> | null = null;
  private static collection: FontCollection | null = null;

  static get apiVersion(): string {
    return DsPdf.instance?.version ?? "Unknown";
  }

  static async connect(): Promise<boolean> {
    if (!DsPdf.instance?.isConnected) {
      DsPdfConfig.wasmUrl = "/DsPdf.wasm";
      return await connectDsPdf();
    }
    return true;
  }

  static disconnect(): void {
    this.fontsOm?.dispose();
    this.fontsOm = null;
    this.fonts = null;
    this.collection = null;
    if (DsPdf.instance?.isConnected) {
      disconnectDsPdf();
    }
  }

  /** Loads the Noto fonts and builds a FontCollection with fallbacks. */
  static async loadFonts(): Promise<void> {
    if (this.fonts) return;
    const om = new ObjectManager();
    try {
      const loaded = {} as Record<keyof typeof FONT_FILES, Font>;
      for (const key of Object.keys(FONT_FILES) as Array<keyof typeof FONT_FILES>) {
        const response = await fetch(`fonts/${FONT_FILES[key]}`, { cache: "no-cache" });
        if (!response.ok) {
          throw new Error(
            `Unable to load fonts/${FONT_FILES[key]} (${response.statusText}). ` +
              "Run 'npm run prepare-assets' to download the fonts.",
          );
        }
        loaded[key] = Font.load(om, new Uint8Array(await response.arrayBuffer()));
      }
      const collection = new FontCollection(om);
      // The Latin font is the default; all other fonts are registered as
      // fallbacks, so any Format based on the Latin font can still render
      // Arabic, Hebrew, Japanese, Thai, and Devanagari text.
      collection.addFont(loaded.latin, false, true);
      for (const key of ["arabic", "hebrew", "japanese", "thai", "devanagari"] as const) {
        collection.addFont(loaded[key], true);
      }
      this.fontsOm = om;
      this.fonts = loaded;
      this.collection = collection;
    } catch (caught) {
      om.dispose();
      throw caught;
    }
  }

  /**
   * Renders the showcase pages as SVG previews (no PDF bytes are produced).
   *
   * With textAsPath true, all text is converted to vector paths: the result
   * displays identically everywhere and stays crisp at any zoom. Otherwise
   * text is saved as SVG text elements with the fonts embedded, so it can be
   * selected, copied, and searched in the browser. (Vertical text is always
   * saved as paths.)
   **/
  @withObjectManager
  static async renderShowcase(textAsPath: boolean): Promise<ShowcaseResult> {
    const options = textAsPath
      ? { drawSvgTextAsPath: true }
      : { drawSvgTextAsPath: false, embedSvgFonts: true, preciseCharPositions: true };
    const doc = this.buildShowcase(false);
    const decoder = new TextDecoder();
    const previewSvgs: string[] = [];
    for (let pageIndex = 0; pageIndex < doc.pages.count; pageIndex++) {
      previewSvgs.push(decoder.decode(doc.pages.getAt(pageIndex).saveAsSvg(options)));
    }
    return { pageCount: doc.pages.count, previewSvgs };
  }

  /**
   * Builds a fresh document and returns it as PDF bytes. A new document is
   * built for each download so that previews are never rendered from a
   * document that savePdf() has already been called on.
   *
   * With textAsPath true, DrawingContext.drawTextAsPath outlines all text as
   * vector paths right in the PDF content, so the document has no text layer:
   * nothing can be selected, copied, or found by search. Use it deliberately -
   * it also means no accessibility and larger files.
   **/
  @withObjectManager
  static async createPdf(textAsPath: boolean): Promise<Uint8Array> {
    return this.buildShowcase(textAsPath).savePdf();
  }

  //#region document content

  private static buildShowcase(textAsPath: boolean): PdfDocument {
    if (!this.fonts || !this.collection) {
      throw new Error("Fonts are not loaded yet.");
    }
    const doc = new PdfDocument();
    doc.documentInfo = {
      title: "Multilingual typesetting with DsPdfJS",
      author: "DsPdfJS sample",
    };
    this.buildBidiPage(doc, textAsPath);
    this.buildVerticalPage(doc, textAsPath);
    return doc;
  }

  /** Creates a Layout preconfigured with the fallback-enabled font collection. */
  private static newLayout(properties: object): Layout {
    return new Layout({
      fontCollection: this.collection,
      maxWidth: CONTENT_W,
      ...properties,
    });
  }

  private static drawHeading(ctx: PdfContext, title: string, note: string, y: number): number {
    const tl = this.newLayout({
      defaultFormat: new Format({ font: this.fonts!.latin, fontSize: 19, foreColor: INK }),
    });
    tl.append(title);
    ctx.drawLayout(tl, MARGIN, y);
    y += tl.contentHeight + 6;

    const sub = this.newLayout({
      defaultFormat: new Format({ font: this.fonts!.latin, fontSize: 9.5, foreColor: NOTE }),
      lineSpacingScaleFactor: 1.15,
    });
    sub.append(note);
    ctx.drawLayout(sub, MARGIN, y);
    return y + sub.contentHeight + 18;
  }

  private static drawSectionTitle(ctx: PdfContext, text: string, y: number): number {
    const tl = this.newLayout({
      defaultFormat: new Format({ font: this.fonts!.latin, fontSize: 10.5, foreColor: ACCENT }),
    });
    tl.append(text.toUpperCase());
    ctx.drawLayout(tl, MARGIN, y);
    ctx.drawLine(MARGIN, y + tl.contentHeight + 4, PAGE_W - MARGIN, y + tl.contentHeight + 4, {
      color: "#E6E8EF",
      width: 0.7,
    });
    return y + tl.contentHeight + 12;
  }

  private static buildBidiPage(doc: PdfDocument, textAsPath: boolean): void {
    const fonts = this.fonts!;
    const ctx = doc.newPageContext({ width: PAGE_W, height: PAGE_H });
    ctx.drawTextAsPath = textAsPath;
    let y = MARGIN;

    y = this.drawHeading(
      ctx,
      "Multilingual typesetting with DsPdfJS",
      "Every paragraph on this page is laid out by the DsPdfJS text engine: Unicode bidirectional " +
        "ordering, Arabic shaping, font fallbacks, and language-aware line breaking.",
      y,
    );

    // 1: bidirectional text in a single justified paragraph
    y = this.drawSectionTitle(ctx, "Bidirectional text in one paragraph", y);
    const bidi = this.newLayout({
      defaultFormat: new Format({ font: fonts.latin, fontSize: 11, foreColor: INK }),
      textAlignment: TextAlignment.Justified,
      lineSpacingScaleFactor: 1.2,
    });
    bidi.append(TEXT.bidiEnglish1);
    bidi.append({ text: TEXT.bidiArabic, font: fonts.arabic, foreColor: "#0E7A5F" });
    bidi.append(TEXT.bidiEnglish2);
    bidi.append({ text: TEXT.bidiHebrew, font: fonts.hebrew, foreColor: "#B4541B" });
    bidi.append(TEXT.bidiEnglish3);
    ctx.drawLayout(bidi, MARGIN, y);
    y += bidi.contentHeight + 22;

    // 2: right-to-left base direction with embedded Latin text and digits
    y = this.drawSectionTitle(ctx, "Right-to-left base direction", y);
    const rtl = this.newLayout({
      defaultFormat: new Format({ font: fonts.arabic, fontSize: 12, foreColor: INK }),
      rightToLeft: true,
      lineSpacingScaleFactor: 1.25,
      paragraphSpacing: 6,
    });
    rtl.appendLine(TEXT.rtlArabic);
    rtl.append({ text: TEXT.rtlHebrew, font: fonts.hebrew });
    ctx.drawLayout(rtl, MARGIN, y);
    y += rtl.contentHeight + 22;

    // 3: font fallbacks - one Latin Format, six scripts
    y = this.drawSectionTitle(ctx, "Automatic font fallback (one format, six scripts)", y);
    const fallback = this.newLayout({
      defaultFormat: new Format({ font: fonts.latin, fontSize: 13, foreColor: INK }),
    });
    fallback.append(TEXT.fallbackLine);
    ctx.drawLayout(fallback, MARGIN, y);
    y += fallback.contentHeight + 22;

    // 4: Thai line breaking in a narrow justified column (no spaces in text)
    y = this.drawSectionTitle(ctx, "Line breaking without spaces (Thai)", y);
    const columnWidth = 250;
    const thai = this.newLayout({
      defaultFormat: new Format({ font: fonts.thai, fontSize: 11.5, foreColor: INK }),
      maxWidth: columnWidth,
      textAlignment: TextAlignment.Justified,
      lineSpacingScaleFactor: 1.3,
    });
    thai.append(TEXT.thai);
    ctx.drawLayout(thai, MARGIN, y);
    ctx.drawRect(MARGIN - 8, y - 6, columnWidth + 16, thai.contentHeight + 12, {
      lineColor: "#D8DCE7",
      lineWidth: 0.7,
      radius: 6,
    });

    const note = this.newLayout({
      defaultFormat: new Format({ font: fonts.latin, fontSize: 9.5, foreColor: NOTE }),
      maxWidth: CONTENT_W - columnWidth - 40,
      lineSpacingScaleFactor: 1.2,
    });
    note.append(
      "Thai has no spaces between words, so lines cannot be broken on whitespace. " +
        "The engine finds the allowed break positions and can still justify the column.",
    );
    ctx.drawLayout(note, MARGIN + columnWidth + 32, y);
  }

  private static buildVerticalPage(doc: PdfDocument, textAsPath: boolean): void {
    const fonts = this.fonts!;
    const ctx = doc.newPageContext({ width: PAGE_W, height: PAGE_H });
    ctx.drawTextAsPath = textAsPath;
    let y = MARGIN;

    y = this.drawHeading(
      ctx,
      "Vertical Japanese text",
      "Lines of vertical (tategaki) text are stacked from right to left. Latin words can " +
        "either rotate with the flow or stay upright, character by character, and short runs " +
        "of numbers or Latin text can be set horizontally within the vertical line (tate-chu-yoko).",
      y,
    );

    y = this.drawSectionTitle(ctx, "FlowDirection.VerticalRightToLeft", y);

    const frameTop = y;
    const frameHeight = Math.min(470, PAGE_H - MARGIN - frameTop);
    const vertical = this.newLayout({
      defaultFormat: new Format({
        font: fonts.japanese,
        fontSize: 14,
        foreColor: INK,
        // keep vertical spacing even around sideways (rotated Latin) runs
        useVerticalLineGapForSideways: true,
      }),
      flowDirection: FlowDirection.VerticalRightToLeft,
      maxWidth: CONTENT_W,
      maxHeight: frameHeight - 32,
      lineSpacingScaleFactor: 1.6,
      paragraphSpacing: 10,
    });
    vertical.append(TEXT.verticalIntro);
    // upright Latin: uprightInVerticalText draws each character upright
    // instead of the default sideways rotation
    vertical.append({ text: TEXT.verticalUpright1, uprightInVerticalText: true, foreColor: ACCENT });
    vertical.appendLine(TEXT.verticalIntro2);
    // sideways Latin (the default): the whole run rotates with the flow
    vertical.append(TEXT.sideways1);
    vertical.append({ text: TEXT.sidewaysLatin, foreColor: "#0E7A5F" });
    vertical.appendLine(TEXT.sideways2);
    // tate-chu-yoko (縦中横): a short run of any characters (digits or Latin
    // letters) is treated as one upright cluster and packed horizontally
    // using the font's quarter-width ('qwid') glyphs - same recipe as the
    // official Tate Chu Yoko demo
    const tateChuYoko = {
      textRunAsCluster: true,
      uprightInVerticalText: true,
      glyphWidths: GlyphWidths.QuarterWidths,
      foreColor: ACCENT,
    };
    vertical.append(TEXT.tcy1);
    vertical.append({ text: TEXT.tcyDigits1, ...tateChuYoko });
    vertical.append(TEXT.tcy2);
    vertical.append({ text: TEXT.tcyDigits2, ...tateChuYoko });
    vertical.append(TEXT.tcy3);
    vertical.append({ text: TEXT.tcyLatin, ...tateChuYoko });
    vertical.appendLine(TEXT.tcy4);
    vertical.appendLine("");
    vertical.appendLine({ text: TEXT.haiku, fontSize: 17 });
    vertical.append({ text: TEXT.haikuAuthor, fontSize: 11, foreColor: NOTE });
    ctx.drawLayout(vertical, MARGIN, frameTop + 16);

    ctx.drawRect(MARGIN - 8, frameTop, CONTENT_W + 16, frameHeight, {
      lineColor: "#D8DCE7",
      lineWidth: 0.7,
      radius: 6,
    });
  }

  //#endregion
}

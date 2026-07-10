import {
  connectDsPdf,
  disconnectDsPdf,
  DsPdf,
  DsPdfConfig,
  ObjectManager,
  PdfDocument,
  withObjectManager,
} from "@mescius/ds-pdf";

/** A 1-based page range, as used by PdfDocument.mergeWithDocument(). */
export type PageRange = { fromPage: number; toPage: number };

/** One source document for a merge: its bytes and optional page ranges. */
export type MergeSource = { bytes: Uint8Array; ranges?: PageRange[] };

/** A produced PDF together with its page count and PNG page previews. */
export type PdfResult = { pdf: Uint8Array; pageCount: number; previewPngs: Uint8Array[] };

/** One part produced by splitting a PDF. */
export type SplitPart = { pdf: Uint8Array; fromPage: number; toPage: number };

const PREVIEW_ZOOM = 0.5;

export class Demos {
  // The merged document is kept alive in its own ObjectManager between
  // operations. Reloading it from bytes for every operation would be slower
  // and, in trial mode, would truncate it to the trial page-loading limit.
  private static resultOm: ObjectManager | null = null;
  private static resultDoc: PdfDocument | null = null;

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
    this.closeResult();
    if (DsPdf.instance?.isConnected) {
      disconnectDsPdf();
    }
  }

  /** Releases the current merged document, if any. */
  static closeResult(): void {
    this.resultOm?.dispose();
    this.resultOm = null;
    this.resultDoc = null;
  }

  private static get doc(): PdfDocument {
    if (!this.resultDoc) {
      throw new Error("There is no merged document yet. Merge files first.");
    }
    return this.resultDoc;
  }

  /**
   * Parses a page selection such as "1, 3, 5-7" into 1-based page ranges.
   * @param text The page selection entered by the user.
   * @param pageCount The number of pages in the document the selection applies to.
   * @throws An error describing the first invalid entry.
   **/
  static parseRanges(text: string, pageCount: number): PageRange[] {
    const ranges: PageRange[] = [];
    for (const part of text.split(",").map((value) => value.trim()).filter(Boolean)) {
      const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
      if (!match) {
        throw new Error(`"${part}" is not a page number or range like 5-7.`);
      }
      const fromPage = Number(match[1]);
      const toPage = match[2] ? Number(match[2]) : fromPage;
      if (fromPage < 1 || toPage > pageCount || fromPage > toPage) {
        throw new Error(`"${part}" is out of bounds for a ${pageCount}-page document.`);
      }
      ranges.push({ fromPage, toPage });
    }
    if (ranges.length === 0) {
      throw new Error("Enter at least one page number or range, e.g. 1, 3, 5-7.");
    }
    return ranges;
  }

  private static renderPages(doc: PdfDocument): Uint8Array[] {
    const previews: Uint8Array[] = [];
    for (let pageIndex = 0; pageIndex < doc.pages.count; pageIndex++) {
      previews.push(doc.pages.getAt(pageIndex).saveAsPng({ zoom: PREVIEW_ZOOM }));
    }
    return previews;
  }

  private static toResult(doc: PdfDocument): PdfResult {
    return {
      pdf: doc.savePdf(),
      pageCount: doc.pages.count,
      previewPngs: this.renderPages(doc),
    };
  }

  /** Returns the number of pages in a PDF without keeping it loaded. */
  @withObjectManager
  static async getPageCount(pdfBytes: Uint8Array): Promise<number> {
    return PdfDocument.load(pdfBytes).pages.count;
  }

  /**
   * Merges the given documents (whole, or the selected page ranges) in order
   * into a single new PDF, and keeps the result in memory for the page
   * operations below.
   **/
  @withObjectManager
  static async merge(sources: MergeSource[]): Promise<PdfResult> {
    // The merged document lives in its own ObjectManager; the loaded source
    // documents belong to the decorator's manager and are released on return.
    const om = new ObjectManager();
    try {
      const doc = new PdfDocument(om);
      for (const source of sources) {
        const sourceDoc = PdfDocument.load(source.bytes);
        if (source.ranges && source.ranges.length > 0) {
          for (const range of source.ranges) {
            doc.mergeWithDocument(sourceDoc, { range });
          }
        } else {
          doc.mergeWithDocument(sourceDoc);
        }
      }
      this.closeResult();
      this.resultOm = om;
      this.resultDoc = doc;
      return this.toResult(doc);
    } catch (caught) {
      if (om !== this.resultOm) om.dispose();
      throw caught;
    }
  }

  /** Moves a page of the merged document (0-based indexes). */
  @withObjectManager
  static async movePage(fromIndex: number, toIndex: number): Promise<PdfResult> {
    this.doc.pages.move(fromIndex, toIndex);
    return this.toResult(this.doc);
  }

  /** Removes a page of the merged document (0-based index). */
  @withObjectManager
  static async removePage(pageIndex: number): Promise<PdfResult> {
    this.doc.pages.removeAt(pageIndex);
    return this.toResult(this.doc);
  }

  /** Copies the selected page ranges of the merged document into a new PDF. */
  @withObjectManager
  static async extractPages(ranges: PageRange[]): Promise<PdfResult> {
    const extracted = new PdfDocument();
    for (const range of ranges) {
      extracted.mergeWithDocument(this.doc, { range });
    }
    return this.toResult(extracted);
  }

  /** Splits the merged document into parts of at most pagesPerPart pages each. */
  @withObjectManager
  static async split(pagesPerPart: number): Promise<SplitPart[]> {
    if (pagesPerPart < 1) {
      throw new Error("Pages per part must be at least 1.");
    }
    const parts: SplitPart[] = [];
    for (let fromPage = 1; fromPage <= this.doc.pages.count; fromPage += pagesPerPart) {
      const toPage = Math.min(fromPage + pagesPerPart - 1, this.doc.pages.count);
      const part = new PdfDocument();
      part.mergeWithDocument(this.doc, { range: { fromPage, toPage } });
      parts.push({ pdf: part.savePdf(), fromPage, toPage });
    }
    return parts;
  }
}

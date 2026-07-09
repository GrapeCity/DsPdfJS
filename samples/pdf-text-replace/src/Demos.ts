import {
  connectDsPdf,
  disconnectDsPdf,
  DsPdf,
  DsPdfConfig,
  PdfDocument,
  withObjectManager,
} from "@mescius/ds-pdf";

export type AnalysisResult = {
  occurrences: number;
  previewPngs: Uint8Array[];
  pageCount: number;
};

export type ReplaceResult = {
  pdf: Uint8Array;
  previewPngs: Uint8Array[];
  replacedCount: number; // occurrences of the search term before replacing
  remainingOldCount: number; // occurrences of the search term still found afterwards (expected: 0)
  newCount: number; // occurrences of the replacement text found afterwards
  pageCount: number;
};

const PREVIEW_ZOOM = 1.35;

export class Demos {
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
    if (DsPdf.instance?.isConnected) {
      disconnectDsPdf();
    }
  }

  static async loadSample(): Promise<Uint8Array> {
    const response = await fetch("text-replace-sample.pdf", { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Unable to load the sample PDF: ${response.statusText}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  private static countMatches(doc: PdfDocument, text: string, matchCase: boolean): number {
    if (!text) return 0;
    return doc.findText({ text, matchCase })?.length ?? 0;
  }

  private static renderPages(doc: PdfDocument): Uint8Array[] {
    const previews: Uint8Array[] = [];
    for (let pageIndex = 0; pageIndex < doc.pages.count; pageIndex++) {
      previews.push(doc.pages.getAt(pageIndex).saveAsPng({ zoom: PREVIEW_ZOOM }));
    }
    return previews;
  }

  @withObjectManager
  static async analyze(pdfBytes: Uint8Array, searchTerm: string, matchCase: boolean): Promise<AnalysisResult> {
    const doc = PdfDocument.load(pdfBytes);
    return {
      occurrences: this.countMatches(doc, searchTerm, matchCase),
      previewPngs: this.renderPages(doc),
      pageCount: doc.pages.count,
    };
  }

  @withObjectManager
  static async count(pdfBytes: Uint8Array, searchTerm: string, matchCase: boolean): Promise<number> {
    const doc = PdfDocument.load(pdfBytes);
    return this.countMatches(doc, searchTerm, matchCase);
  }

  @withObjectManager
  static async replace(
    pdfBytes: Uint8Array,
    searchTerm: string,
    newText: string,
    matchCase: boolean,
    fontSize: number | null,
  ): Promise<ReplaceResult> {
    const doc = PdfDocument.load(pdfBytes);
    const replacedCount = this.countMatches(doc, searchTerm, matchCase);

    // Edit the actual content stream. `font: null` keeps the current font;
    // `fontSize: null` keeps the current size.
    //
    // replaceText() locates text using the document's current recognition
    // algorithm (PdfDocument.recognitionAlgorithm). On complex PDFs the result
    // can depend on how the text is stored in the content stream, so a run that
    // reads naturally to a human is not always a single replaceable unit. The
    // bundled sample PDF uses simple, plain text so this behaves predictably;
    // when replacing text in arbitrary PDFs, review the output.
    doc.replaceText({ text: searchTerm, matchCase }, newText, undefined, null, fontSize);

    return {
      pdf: doc.savePdf(),
      previewPngs: this.renderPages(doc),
      replacedCount,
      remainingOldCount: this.countMatches(doc, searchTerm, matchCase),
      newCount: this.countMatches(doc, newText, matchCase),
      pageCount: doc.pages.count,
    };
  }
}

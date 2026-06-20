import {
  connectDsPdf,
  disconnectDsPdf,
  DsPdf,
  DsPdfConfig,
  PdfDocument,
  RedactAnnotation,
  withObjectManager,
} from "@mescius/ds-pdf";

export type PiiMatch = {
  id: string;
  kind: string;
  value: string;
  occurrences: number;
};

export type AnalysisResult = {
  matches: PiiMatch[];
  previewPngs: Uint8Array[];
  pageCount: number;
};

export type RedactionResult = {
  pdf: Uint8Array;
  previewPngs: Uint8Array[];
  redactionCount: number;
  verifiedValues: number;
};

const DETECTORS: Array<{ kind: string; pattern: RegExp }> = [
  { kind: "Email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { kind: "Phone", pattern: /(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}/g },
  { kind: "SSN", pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  { kind: "Identifier", pattern: /\bDEMO-(?:EMP|ACCT)-[A-Z0-9-]+\b/gi },
];

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
    const response = await fetch("pii-sample.pdf", { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Unable to load the sample PDF: ${response.statusText}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  private static detectValues(text: string, exactTerms: string[]): Array<{ kind: string; value: string }> {
    const values = new Map<string, { kind: string; value: string }>();

    for (const detector of DETECTORS) {
      detector.pattern.lastIndex = 0;
      for (const match of text.matchAll(detector.pattern)) {
        const value = match[0].trim();
        // Trial PDFs include this address in the DsPdfJS evaluation notice.
        if (value.toLocaleLowerCase() === "us.sales@mescius.com") continue;
        values.set(value.toLocaleLowerCase(), { kind: detector.kind, value });
      }
    }

    for (const term of exactTerms.map((value) => value.trim()).filter(Boolean)) {
      if (text.toLocaleLowerCase().includes(term.toLocaleLowerCase())) {
        const key = term.toLocaleLowerCase();
        if (!values.has(key)) {
          values.set(key, { kind: "Exact text", value: term });
        }
      }
    }

    return [...values.values()];
  }

  private static addRedactAnnotations(
    doc: PdfDocument,
    values: string[],
    previewOnly: boolean,
  ): RedactAnnotation[] {
    const annotations: RedactAnnotation[] = [];
    for (const value of values) {
      const positions = doc.findText({ text: value, matchCase: false }) ?? [];
      for (const position of positions) {
        const annotation = new RedactAnnotation();
        annotation.page = doc.pages.getAt(position.pageIndex);
        annotation.area = position.bounds;
        if (previewOnly) {
          annotation.markBorderColor = "DarkOrange";
        } else {
          annotation.overlayFillColor = "#171923";
        }
        annotations.push(annotation);
      }
    }
    return annotations;
  }

  private static renderPages(doc: PdfDocument, drawAnnotations = false): Uint8Array[] {
    const previews: Uint8Array[] = [];
    for (let pageIndex = 0; pageIndex < doc.pages.count; pageIndex++) {
      previews.push(
        doc.pages.getAt(pageIndex).saveAsPng({ zoom: 1.35, drawAnnotations }),
      );
    }
    return previews;
  }

  @withObjectManager
  static async analyze(pdfBytes: Uint8Array, exactTerms: string[]): Promise<AnalysisResult> {
    const doc = PdfDocument.load(pdfBytes);
    const detected = this.detectValues(doc.getText(), exactTerms);
    const matches = detected.map(({ kind, value }) => {
      const occurrences = doc.findText({ text: value, matchCase: false })?.length ?? 0;
      return {
        id: `${kind}:${value.toLocaleLowerCase()}`,
        kind,
        value,
        occurrences,
      };
    });

    this.addRedactAnnotations(doc, matches.map((match) => match.value), true);
    return {
      matches,
      previewPngs: this.renderPages(doc, true),
      pageCount: doc.pages.count,
    };
  }

  @withObjectManager
  static async redact(pdfBytes: Uint8Array, values: string[]): Promise<RedactionResult> {
    const doc = PdfDocument.load(pdfBytes);
    const annotations = this.addRedactAnnotations(doc, values, false);
    doc.redact(annotations);

    const remainingText = doc.getText().toLocaleLowerCase();
    const verifiedValues = values.filter(
      (value) => !remainingText.includes(value.toLocaleLowerCase()),
    ).length;

    return {
      pdf: doc.savePdf(),
      previewPngs: this.renderPages(doc),
      redactionCount: annotations.length,
      verifiedValues,
    };
  }
}

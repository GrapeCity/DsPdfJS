import { useEffect, useRef, useState } from "react";
import { Demos, type MergeSource, type PdfResult } from "./Demos";

type SourceFile = {
  id: string;
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  /** Optional page selection such as "1, 3, 5-7"; empty means all pages. */
  rangeText: string;
};

type OutputFile = {
  id: string;
  name: string;
  bytes: Uint8Array;
  description: string;
};

const SAMPLE_FILES = ["sample-report.pdf", "sample-appendix.pdf", "sample-slides.pdf"];

let nextId = 0;
function makeId(): string {
  return `item-${nextId++}`;
}

function bytesToUrl(bytes: Uint8Array, mimeType: string): string {
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeType }));
}

function downloadBytes(bytes: Uint8Array, fileName: string): void {
  const url = bytesToUrl(bytes, "application/pdf");
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Loading DsPdfJS...");
  const [sources, setSources] = useState<SourceFile[]>([]);
  const [result, setResult] = useState<PdfResult | null>(null);
  const [thumbUrls, setThumbUrls] = useState<string[]>([]);
  const [outputs, setOutputs] = useState<OutputFile[]>([]);
  const [extractText, setExtractText] = useState("");
  const [splitSize, setSplitSize] = useState(1);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        if (!(await Demos.connect())) throw new Error("Unable to initialize DsPdfJS.");
        if (!active) return;
        setReady(true);
        setStatus(`Loaded DsPdfJS ${Demos.apiVersion}. Add PDF files to begin.`);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (active) setBusy(false);
      }
    };
    void initialize();
    return () => {
      active = false;
      Demos.disconnect();
    };
    // Initialization intentionally runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const setNewResult = (next: PdfResult | null, message?: string) => {
    setResult(next);
    setThumbUrls((current) => {
      current.forEach((url) => URL.revokeObjectURL(url));
      return next ? next.previewPngs.map((png) => bytesToUrl(png, "image/png")) : [];
    });
    if (message) setStatus(message);
  };

  const addSourceBytes = async (files: Array<{ name: string; bytes: Uint8Array }>) => {
    const added: SourceFile[] = [];
    for (const file of files) {
      const pageCount = await Demos.getPageCount(file.bytes);
      added.push({ id: makeId(), name: file.name, bytes: file.bytes, pageCount, rangeText: "" });
    }
    setSources((current) => [...current, ...added]);
    setStatus(`${added.length} file${added.length === 1 ? "" : "s"} added.`);
  };

  const addFiles = (fileList: FileList | File[]) =>
    run(async () => {
      const pdfs = [...fileList].filter((file) => /\.pdf$/i.test(file.name));
      if (pdfs.length === 0) throw new Error("Please choose PDF files.");
      const files = [];
      for (const pdf of pdfs) {
        files.push({ name: pdf.name, bytes: new Uint8Array(await pdf.arrayBuffer()) });
      }
      await addSourceBytes(files);
    });

  const loadSamples = () =>
    run(async () => {
      const files = [];
      for (const name of SAMPLE_FILES) {
        const response = await fetch(name, { cache: "no-cache" });
        if (!response.ok) throw new Error(`Unable to load ${name}: ${response.statusText}`);
        files.push({ name, bytes: new Uint8Array(await response.arrayBuffer()) });
      }
      await addSourceBytes(files);
    });

  const moveSource = (index: number, delta: number) => {
    setSources((current) => {
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(index + delta, 0, moved);
      return next;
    });
  };

  const merge = () =>
    run(async () => {
      const mergeSources: MergeSource[] = sources.map((source) => ({
        bytes: source.bytes,
        ranges: source.rangeText.trim()
          ? Demos.parseRanges(source.rangeText, source.pageCount)
          : undefined,
      }));
      const merged = await Demos.merge(mergeSources);
      setNewResult(
        merged,
        `Merged ${sources.length} file${sources.length === 1 ? "" : "s"} into ${merged.pageCount} page${merged.pageCount === 1 ? "" : "s"}.`,
      );
    });

  const movePage = (pageIndex: number, delta: number) =>
    run(async () => {
      if (!result) return;
      setNewResult(await Demos.movePage(pageIndex, pageIndex + delta));
    });

  const removePage = (pageIndex: number) =>
    run(async () => {
      if (!result) return;
      const next = await Demos.removePage(pageIndex);
      setNewResult(next, `Removed page ${pageIndex + 1}; ${next.pageCount} page${next.pageCount === 1 ? "" : "s"} left.`);
    });

  const extract = () =>
    run(async () => {
      if (!result) return;
      const ranges = Demos.parseRanges(extractText, result.pageCount);
      const extracted = await Demos.extractPages(ranges);
      setOutputs((current) => [
        ...current,
        {
          id: makeId(),
          name: `extracted-${extractText.replace(/[^0-9-]+/g, "_")}.pdf`,
          bytes: extracted.pdf,
          description: `Pages ${extractText.trim()} (${extracted.pageCount} page${extracted.pageCount === 1 ? "" : "s"})`,
        },
      ]);
      setStatus(`Extracted ${extracted.pageCount} page${extracted.pageCount === 1 ? "" : "s"}.`);
    });

  const split = () =>
    run(async () => {
      if (!result) return;
      const parts = await Demos.split(splitSize);
      setOutputs((current) => [
        ...current,
        ...parts.map((part, index) => ({
          id: makeId(),
          name: `part-${index + 1}.pdf`,
          bytes: part.pdf,
          description:
            part.fromPage === part.toPage
              ? `Page ${part.fromPage}`
              : `Pages ${part.fromPage}-${part.toPage}`,
        })),
      ]);
      setStatus(`Split into ${parts.length} part${parts.length === 1 ? "" : "s"}.`);
    });

  const disabled = !ready || busy;

  return (
    <main>
      <header>
        <div className="eyebrow">DsPdfJS browser sample</div>
        <h1>Merge, split, and reorganize PDFs</h1>
        <p>
          Combine PDF files (whole documents or page ranges), reorder and delete pages with live
          previews, extract page ranges, and split into parts. Everything runs in your browser -
          the files never leave your computer.
        </p>
      </header>

      <section className="workspace">
        <div className="panel controls">
          <div className="panel-heading">
            <div>
              <span className="step">1</span>
              <h2>Add PDF files</h2>
            </div>
            <span className="status">{busy ? "Working..." : status}</span>
          </div>

          <div
            className={`dropzone ${dragOver ? "drag-over" : ""} ${disabled ? "disabled" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              if (!disabled) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              if (!disabled) void addFiles(event.dataTransfer.files);
            }}
            onClick={() => !disabled && fileInputRef.current?.click()}
          >
            Drop PDF files here, or click to choose
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              hidden
              onChange={(event) => {
                if (event.target.files?.length) void addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>

          <div className="toolbar">
            <button type="button" className="secondary" disabled={disabled} onClick={() => void loadSamples()}>
              Load sample files
            </button>
            <button
              type="button"
              className="secondary"
              disabled={disabled || sources.length === 0}
              onClick={() => setSources([])}
            >
              Clear list
            </button>
          </div>

          <div className="source-list" aria-label="Files to merge">
            {sources.map((source, index) => (
              <div className="source" key={source.id}>
                <div className="source-name" title={source.name}>
                  {source.name}
                  <small>{source.pageCount} page{source.pageCount === 1 ? "" : "s"}</small>
                </div>
                <input
                  className="range-input"
                  placeholder="all pages"
                  title='Pages to include, e.g. "1, 3, 5-7"; empty means all pages'
                  value={source.rangeText}
                  disabled={busy}
                  onChange={(event) =>
                    setSources((current) =>
                      current.map((item) =>
                        item.id === source.id ? { ...item, rangeText: event.target.value } : item,
                      ),
                    )
                  }
                />
                <div className="row-actions">
                  <button type="button" className="compact" title="Move up" disabled={busy || index === 0} onClick={() => moveSource(index, -1)}>▲</button>
                  <button type="button" className="compact" title="Move down" disabled={busy || index === sources.length - 1} onClick={() => moveSource(index, 1)}>▼</button>
                  <button type="button" className="compact" title="Remove" disabled={busy} onClick={() => setSources((current) => current.filter((item) => item.id !== source.id))}>✕</button>
                </div>
              </div>
            ))}
            {sources.length === 0 && <div className="empty-hint">No files yet.</div>}
          </div>

          <div className="merge-actions">
            <div>
              <span className="step">2</span>
              <strong>Merge in the listed order</strong>
            </div>
            <button type="button" className="primary" disabled={disabled || sources.length === 0} onClick={() => void merge()}>
              Merge {sources.length > 0 ? `${sources.length} file${sources.length === 1 ? "" : "s"}` : ""}
            </button>
          </div>

          {result && (
            <>
              <div className="tool-section">
                <div>
                  <span className="step">3</span>
                  <strong>Extract or split the result</strong>
                </div>
                <div className="field-row">
                  <input
                    placeholder='Pages to extract, e.g. "1, 3, 5-7"'
                    value={extractText}
                    disabled={busy}
                    onChange={(event) => setExtractText(event.target.value)}
                  />
                  <button type="button" className="secondary" disabled={busy || !extractText.trim()} onClick={() => void extract()}>
                    Extract
                  </button>
                </div>
                <div className="field-row">
                  <label className="split-label">
                    Split into parts of
                    <input
                      type="number"
                      min={1}
                      max={result.pageCount}
                      value={splitSize}
                      disabled={busy}
                      onChange={(event) => setSplitSize(Math.max(1, Number(event.target.value) || 1))}
                    />
                    page{splitSize === 1 ? "" : "s"}
                  </label>
                  <button type="button" className="secondary" disabled={busy} onClick={() => void split()}>
                    Split
                  </button>
                </div>
              </div>

              {outputs.length > 0 && (
                <div className="output-list" aria-label="Extracted and split files">
                  {outputs.map((output) => (
                    <div className="output" key={output.id}>
                      <div className="source-name" title={output.name}>
                        {output.name}
                        <small>{output.description}</small>
                      </div>
                      <button type="button" className="compact secondary" onClick={() => downloadBytes(output.bytes, output.name)}>
                        Download
                      </button>
                    </div>
                  ))}
                  <button type="button" className="compact" onClick={() => setOutputs([])}>
                    Clear outputs
                  </button>
                </div>
              )}
            </>
          )}

          {error && <div className="error">{error}</div>}
        </div>

        <article className="panel preview-card">
          <div className="preview-heading">
            <div>
              <span>Result</span>
              <h2>{result ? `${result.pageCount} page${result.pageCount === 1 ? "" : "s"} - use the buttons on a page to reorder or delete` : "Merged document"}</h2>
            </div>
            <button
              type="button"
              className="secondary compact"
              disabled={!result || busy}
              onClick={() => result && downloadBytes(result.pdf, "merged.pdf")}
            >
              Download PDF
            </button>
          </div>
          {result ? (
            <div className="thumb-grid">
              {thumbUrls.map((url, pageIndex) => (
                <figure className="thumb" key={url}>
                  <img src={url} alt={`Page ${pageIndex + 1} of the merged document`} />
                  <figcaption>
                    <span>Page {pageIndex + 1}</span>
                    <span className="row-actions">
                      <button type="button" className="compact" title="Move left" disabled={busy || pageIndex === 0} onClick={() => void movePage(pageIndex, -1)}>◀</button>
                      <button type="button" className="compact" title="Move right" disabled={busy || pageIndex === thumbUrls.length - 1} onClick={() => void movePage(pageIndex, 1)}>▶</button>
                      <button type="button" className="compact" title="Delete page" disabled={busy || thumbUrls.length === 1} onClick={() => void removePage(pageIndex)}>✕</button>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="placeholder"><span>Merge files to see page previews here</span></div>
          )}
        </article>
      </section>
    </main>
  );
}

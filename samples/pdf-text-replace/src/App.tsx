import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Demos, STANDARD_FONTS } from "./Demos";

const DEFAULT_SEARCH = "Acme Corp";
const DEFAULT_REPLACEMENT = "Globex Inc";
const SAMPLE_NAME = "text-replace-sample.pdf";

function bytesToUrl(bytes: Uint8Array, mimeType: string): string {
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeType }));
}

function PagePreviews({ urls, description }: { urls: string[]; description: string }) {
  return (
    <div className="preview-pages">
      {urls.map((url, pageIndex) => (
        <figure className="preview-page" key={url}>
          <figcaption>Page {pageIndex + 1}</figcaption>
          <img src={url} alt={`${description}, page ${pageIndex + 1}`} />
        </figure>
      ))}
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Loading DsPdfJS...");
  const [sourceName, setSourceName] = useState(SAMPLE_NAME);

  // The working document. Each replacement mutates this in place (by producing
  // new bytes) so multiple replacements accumulate before the PDF is saved. The
  // preview always shows this working copy, i.e. exactly what the next
  // replacement will operate on.
  const [workingBytes, setWorkingBytes] = useState<Uint8Array | null>(null);
  const [edited, setEdited] = useState(false);

  const [searchTerm, setSearchTerm] = useState(DEFAULT_SEARCH);
  const [replacement, setReplacement] = useState(DEFAULT_REPLACEMENT);
  const [matchCase, setMatchCase] = useState(false);
  const [fontSize, setFontSize] = useState("");
  const [fontChoice, setFontChoice] = useState(""); // "" = keep the current font
  const [occurrences, setOccurrences] = useState<number | null>(null);
  const [searchedTerm, setSearchedTerm] = useState("");
  // The inline count is only meaningful right after an explicit Find. Replacing
  // (or opening a new document) invalidates it, so it is hidden until the next Find.
  const [showCount, setShowCount] = useState(false);

  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [resultPdf, setResultPdf] = useState<Uint8Array | null>(null);
  const [verification, setVerification] = useState("");

  const replacePreviews = (next: string[], setter: Dispatch<SetStateAction<string[]>>) => {
    setter((current) => {
      current.forEach((url) => URL.revokeObjectURL(url));
      return next;
    });
  };

  // Loads a fresh document: resets the working copy and any accumulated edits,
  // renders the preview, and reports the initial occurrence count.
  const openDocument = async (bytes: Uint8Array, name: string) => {
    const term = searchTerm.trim();
    setBusy(true);
    setError("");
    setVerification("");
    setResultPdf(null);
    setEdited(false);
    setShowCount(false);
    try {
      const result = await Demos.analyze(bytes, term, matchCase);
      setWorkingBytes(bytes);
      setSourceName(name);
      setOccurrences(result.occurrences);
      setSearchedTerm(term);
      replacePreviews(
        result.previewPngs.map((png) => bytesToUrl(png, "image/png")),
        setPreviewUrls,
      );
      setStatus(
        `Found ${result.occurrences} occurrence${result.occurrences === 1 ? "" : "s"} across ${result.pageCount} page${result.pageCount === 1 ? "" : "s"}.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  // Non-destructive: counts occurrences in the current working copy without
  // touching the accumulated result.
  const find = async () => {
    if (!workingBytes) return;
    const term = searchTerm.trim();
    if (!term) return;

    setBusy(true);
    setError("");
    try {
      const found = await Demos.count(workingBytes, term, matchCase);
      setOccurrences(found);
      setSearchedTerm(term);
      setShowCount(true);
      setStatus(`Found ${found} occurrence${found === 1 ? "" : "s"} of "${term}".`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const loadSample = async () => {
    const bytes = await Demos.loadSample();
    await openDocument(bytes, SAMPLE_NAME);
  };

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        if (!(await Demos.connect())) throw new Error("Unable to initialize DsPdfJS.");
        if (!active) return;
        setReady(true);
        setStatus(`Loaded DsPdfJS ${Demos.apiVersion}.`);
        await loadSample();
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : String(caught));
        setBusy(false);
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

  const uploadPdf = async (file: File) => {
    await openDocument(new Uint8Array(await file.arrayBuffer()), file.name);
  };

  const replaceAll = async () => {
    if (!workingBytes) return;
    const term = searchTerm.trim();
    if (!term) return;

    const size = fontSize.trim() ? Number(fontSize.trim()) : null;
    if (size !== null && (!Number.isFinite(size) || size <= 0)) {
      setError("Font size must be a positive number, or left blank to keep the original size.");
      return;
    }
    const fontId = fontChoice === "" ? null : Number(fontChoice);

    setBusy(true);
    setError("");
    try {
      const result = await Demos.replace(workingBytes, term, replacement, matchCase, size, fontId);
      // Feed the edited bytes back so the next replacement builds on this one,
      // and update the preview to show the new working document.
      setWorkingBytes(result.pdf);
      setResultPdf(result.pdf);
      setEdited(true);
      setOccurrences(result.remainingOldCount);
      setSearchedTerm(term);
      setShowCount(false);
      replacePreviews(
        result.previewPngs.map((png) => bytesToUrl(png, "image/png")),
        setPreviewUrls,
      );
      setVerification(
        `Replaced ${result.replacedCount} occurrence${result.replacedCount === 1 ? "" : "s"}. ` +
          `"${term}" now appears ${result.remainingOldCount} time${result.remainingOldCount === 1 ? "" : "s"}, ` +
          `and "${replacement}" appears ${result.newCount} time${result.newCount === 1 ? "" : "s"} in the extracted text.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!resultPdf) return;
    const url = bytesToUrl(resultPdf, "application/pdf");
    const link = document.createElement("a");
    link.href = url;
    link.download = sourceName.replace(/\.pdf$/i, "") + "-replaced.pdf";
    link.click();
    URL.revokeObjectURL(url);
  };

  const canReplace = ready && !busy && !!workingBytes && !!searchTerm.trim();

  return (
    <main>
      <header>
        <div className="eyebrow">DsPdfJS browser sample</div>
        <h1>Find and replace text in a PDF</h1>
        <p>
          Search a PDF for a term and rewrite it with <code>PdfDocument.replaceText()</code>. The
          replacement edits the real content stream, so the change is visible in the page and in the
          extracted text - not just painted on top.
        </p>
      </header>

      <section className="workspace">
        <div className="panel controls">
          <div className="toolbar">
            <button type="button" onClick={() => void loadSample()} disabled={!ready || busy}>
              Reload sample
            </button>
            <label className={`button secondary ${!ready || busy ? "disabled" : ""}`}>
              Open PDF
              <input
                type="file"
                accept="application/pdf,.pdf"
                disabled={!ready || busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadPdf(file);
                  event.target.value = "";
                }}
              />
            </label>
            <span className="status">{busy ? "Working..." : status}</span>
          </div>

          <div className="edit-grid">
            <div className="field">
              <label htmlFor="search-term">Find</label>
              <div className="field-row">
                <input
                  id="search-term"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
                <button
                  type="button"
                  className="secondary"
                  disabled={!workingBytes || busy || !searchTerm.trim()}
                  onClick={() => void find()}
                >
                  Find
                </button>
              </div>
              {showCount && occurrences !== null && searchTerm.trim() === searchedTerm && (
                <p className="hint">
                  {occurrences} occurrence{occurrences === 1 ? "" : "s"} of{" "}
                  <code>{searchedTerm || "(empty)"}</code> in the {edited ? "edited" : "current"} document.
                </p>
              )}
            </div>

            <div className="field">
              <label htmlFor="replacement">Replace with</label>
              <div className="field-row">
                <input
                  id="replacement"
                  value={replacement}
                  onChange={(event) => setReplacement(event.target.value)}
                />
                <button
                  type="button"
                  className="primary"
                  disabled={!canReplace}
                  onClick={() => void replaceAll()}
                >
                  Replace all
                </button>
              </div>
            </div>
          </div>

          <div className="options">
            <label className="check">
              <input
                type="checkbox"
                checked={matchCase}
                onChange={(event) => setMatchCase(event.target.checked)}
              />
              Match case
            </label>
            <label className="check">
              Font
              <select
                className="font-select"
                value={fontChoice}
                onChange={(event) => setFontChoice(event.target.value)}
              >
                <option value="">keep original</option>
                {STANDARD_FONTS.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="check">
              Font size
              <input
                className="size-input"
                type="number"
                min="1"
                step="0.5"
                placeholder="keep"
                value={fontSize}
                onChange={(event) => setFontSize(event.target.value)}
              />
              <small>blank = keep original</small>
            </label>
          </div>

          {verification && <div className="success">{verification}</div>}
          {error && <div className="error">{error}</div>}
        </div>

        <div className="previews">
          <article className="panel preview-card">
            <div className="preview-heading">
              <div>
                <span>{edited ? "Edited" : "Original"}</span>
                <h2>{edited ? "Current document" : "Loaded document"}</h2>
              </div>
              <div className="preview-actions">
                <code>{sourceName}</code>
                <button type="button" className="secondary compact" disabled={!resultPdf} onClick={download}>
                  Save PDF
                </button>
              </div>
            </div>
            {previewUrls.length > 0 ? (
              <PagePreviews urls={previewUrls} description="Working PDF" />
            ) : (
              <div className="placeholder" />
            )}
          </article>
        </div>
      </section>
    </main>
  );
}

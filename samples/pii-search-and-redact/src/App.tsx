import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Demos, type PiiMatch } from "./Demos";

const DEFAULT_EXACT_TERMS = "Alex Example; 456 Placeholder Road, Demo Town, MA 01234";

function bytesToUrl(bytes: Uint8Array, mimeType: string): string {
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeType }));
}

function parseTerms(value: string): string[] {
  return value.split(";").map((term) => term.trim()).filter(Boolean);
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
  const [sourceName, setSourceName] = useState("pii-sample.pdf");
  const [sourceBytes, setSourceBytes] = useState<Uint8Array | null>(null);
  const [matches, setMatches] = useState<PiiMatch[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exactTerms, setExactTerms] = useState(DEFAULT_EXACT_TERMS);
  const [beforeUrls, setBeforeUrls] = useState<string[]>([]);
  const [afterUrls, setAfterUrls] = useState<string[]>([]);
  const [redactedPdf, setRedactedPdf] = useState<Uint8Array | null>(null);
  const [verification, setVerification] = useState("");

  const replacePreviews = (next: string[], setter: Dispatch<SetStateAction<string[]>>) => {
    setter((current) => {
      current.forEach((url) => URL.revokeObjectURL(url));
      return next;
    });
  };

  const analyze = async (
    bytes: Uint8Array,
    name: string,
    terms = exactTerms,
    preserveSelection = false,
  ) => {
    const previousMatchIds = new Set(matches.map((match) => match.id));
    setBusy(true);
    setError("");
    setVerification("");
    setRedactedPdf(null);
    replacePreviews([], setAfterUrls);
    try {
      const result = await Demos.analyze(bytes, parseTerms(terms));
      setSourceBytes(bytes);
      setSourceName(name);
      setMatches(result.matches);
      setSelectedIds((current) => {
        if (!preserveSelection) return result.matches.map((match) => match.id);
        const selected = new Set(current);
        return result.matches
          .filter((match) => !previousMatchIds.has(match.id) || selected.has(match.id))
          .map((match) => match.id);
      });
      replacePreviews(
        result.previewPngs.map((png) => bytesToUrl(png, "image/png")),
        setBeforeUrls,
      );
      setStatus(
        `Found ${result.matches.length} unique values on ${result.pageCount} page${result.pageCount === 1 ? "" : "s"}.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const loadSample = async () => {
    const bytes = await Demos.loadSample();
    await analyze(bytes, "pii-sample.pdf", DEFAULT_EXACT_TERMS);
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
    await analyze(new Uint8Array(await file.arrayBuffer()), file.name);
  };

  const redactSelected = async () => {
    if (!sourceBytes) return;
    const selected = matches.filter((match) => selectedIds.includes(match.id));
    if (selected.length === 0) return;

    setBusy(true);
    setError("");
    try {
      const result = await Demos.redact(sourceBytes, selected.map((match) => match.value));
      setRedactedPdf(result.pdf);
      replacePreviews(
        result.previewPngs.map((png) => bytesToUrl(png, "image/png")),
        setAfterUrls,
      );
      setVerification(
        `Verified ${result.verifiedValues}/${selected.length} selected values removed from extracted text (${result.redactionCount} redacted areas).`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!redactedPdf) return;
    const url = bytesToUrl(redactedPdf, "application/pdf");
    const link = document.createElement("a");
    link.href = url;
    link.download = sourceName.replace(/\.pdf$/i, "") + "-redacted.pdf";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main>
      <header>
        <div className="eyebrow">DsPdfJS browser sample</div>
        <h1>PII search and permanent redaction</h1>
        <p>
          Detect common PII, add exact names or addresses, then remove the selected content from
          the PDF - not merely cover it with rectangles.
        </p>
      </header>

      <section className="workspace">
        <div className="panel controls">
          <div className="panel-heading">
            <div>
              <span className="step">1</span>
              <h2>Find sensitive text</h2>
            </div>
            <span className="status">{busy ? "Working..." : status}</span>
          </div>

          <div className="toolbar">
            <button type="button" onClick={() => void loadSample()} disabled={!ready || busy}>
              Reload sample
            </button>
            <label className={`button secondary ${!ready || busy ? "disabled" : ""}`}>
              Upload PDF
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
          </div>

          <div className="field">
            <label htmlFor="exact-terms">
              Additional exact text <small>(semicolon-separated names or addresses)</small>
            </label>
            <div className="field-row">
              <input
                id="exact-terms"
                value={exactTerms}
                onChange={(event) => setExactTerms(event.target.value)}
              />
              <button
                type="button"
                className="secondary"
                disabled={!sourceBytes || busy}
                onClick={() => sourceBytes && void analyze(sourceBytes, sourceName, exactTerms, true)}
              >
                Scan
              </button>
            </div>
          </div>

          <div className="match-list" aria-label="Detected PII">
            {matches.map((match) => (
              <label className="match" key={match.id}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(match.id)}
                  onChange={(event) => setSelectedIds((current) =>
                    event.target.checked
                      ? [...current, match.id]
                      : current.filter((id) => id !== match.id)
                  )}
                />
                <span className="match-kind">{match.kind}</span>
                <span className="match-value">{match.value}</span>
                <span className="count">{match.occurrences}x</span>
              </label>
            ))}
          </div>

          <div className="redact-actions">
            <div>
              <span className="step">2</span>
              <strong>Apply permanent redactions</strong>
            </div>
            <button
              type="button"
              className="primary"
              disabled={busy || selectedIds.length === 0}
              onClick={() => void redactSelected()}
            >
              Redact selected
            </button>
          </div>

          {verification && <div className="success">{verification}</div>}
          {error && <div className="error">{error}</div>}
          <p className="caution">
            Pattern matching is intentionally simple for this sample. Production PII detection
            should use rules appropriate to your documents and compliance requirements.
          </p>
        </div>

        <div className="previews">
          <article className="panel preview-card">
            <div className="preview-heading">
              <div>
                <span>Before</span>
                <h2>Matches highlighted</h2>
              </div>
              <code>{sourceName}</code>
            </div>
            {beforeUrls.length > 0 ? (
              <PagePreviews
                urls={beforeUrls}
                description="Source PDF with detected PII highlighted"
              />
            ) : <div className="placeholder" />}
          </article>

          <article className="panel preview-card">
            <div className="preview-heading">
              <div>
                <span>After</span>
                <h2>Content removed</h2>
              </div>
              <button type="button" className="secondary compact" disabled={!redactedPdf} onClick={download}>
                Download PDF
              </button>
            </div>
            {afterUrls.length > 0 ? (
              <PagePreviews urls={afterUrls} description="PDF after permanent redaction" />
            ) : (
              <div className="placeholder"><span>Redacted preview appears here</span></div>
            )}
          </article>
        </div>
      </section>
    </main>
  );
}

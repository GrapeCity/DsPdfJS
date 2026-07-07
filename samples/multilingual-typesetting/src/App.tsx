import { useEffect, useRef, useState } from "react";
import { Demos } from "./Demos";

function bytesToUrl(bytes: Uint8Array, mimeType: string): string {
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeType }));
}

/**
 * Replaces the fixed width/height of the generated SVG with a viewBox,
 * so the page previews scale to the width of their container.
 **/
function toResponsiveSvg(svg: string): string {
  return svg.replace(
    /<svg width="([0-9.]+)" height="([0-9.]+)"/,
    '<svg viewBox="0 0 $1 $2"',
  );
}

export default function App() {
  const [busy, setBusy] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Loading DsPdfJS...");
  const [pageSvgs, setPageSvgs] = useState<string[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    // Initialize exactly once. The wasm module and fonts are kept for the
    // lifetime of the page, so React StrictMode's simulated remount in dev
    // must not disconnect them or re-run the initialization.
    if (initialized.current) return;
    initialized.current = true;
    const initialize = async () => {
      try {
        if (!(await Demos.connect())) throw new Error("Unable to initialize DsPdfJS.");
        setStatus("Loading fonts...");
        await Demos.loadFonts();
        setStatus("Typesetting...");
        const result = await Demos.renderShowcase();
        setPageSvgs(result.previewSvgs.map(toResponsiveSvg));
        setStatus(`Rendered ${result.pageCount} pages with DsPdfJS ${Demos.apiVersion}.`);
        setReady(true);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        setBusy(false);
      }
    };
    void initialize();
  }, []);

  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const pdf = await Demos.createPdf();
      const url = bytesToUrl(pdf, "application/pdf");
      const link = document.createElement("a");
      link.href = url;
      link.download = "multilingual-typesetting.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main>
      <header>
        <div className="eyebrow">DsPdfJS browser sample</div>
        <h1>Multilingual typesetting</h1>
        <p>
          Bidirectional Arabic and Hebrew, vertical Japanese, automatic font fallback across six
          scripts, and Unicode line breaking - typeset to PDF entirely in your browser by the
          DsPdfJS text engine. Previews are vector SVG generated from the same pages; the
          downloaded PDF contains real, searchable text.
        </p>
        <div className="toolbar">
          <button type="button" className="primary" disabled={busy || !ready} onClick={() => void download()}>
            Download PDF
          </button>
          <span className="status">{busy ? status : error ? "" : status}</span>
        </div>
        {error && <div className="error">{error}</div>}
      </header>

      <section className={`pages ${busy ? "busy" : ""}`}>
        {pageSvgs.map((svg, pageIndex) => (
          <figure
            className="page"
            key={pageIndex}
            aria-label={`Typeset page ${pageIndex + 1}`}
            // The SVG is generated locally by DsPdfJS from this sample's own content.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ))}
        {pageSvgs.length === 0 && !error && <div className="placeholder"><span>{status}</span></div>}
      </section>
    </main>
  );
}

import { useEffect, useState } from "react";
import { Demos } from "./Demos";

function bytesToUrl(bytes: Uint8Array, mimeType: string): string {
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeType }));
}

export default function App() {
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Loading DsPdfJS...");
  const [pageUrls, setPageUrls] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        if (!(await Demos.connect())) throw new Error("Unable to initialize DsPdfJS.");
        if (!active) return;
        setStatus("Loading fonts...");
        await Demos.loadFonts();
        if (!active) return;
        setStatus("Typesetting...");
        const result = await Demos.renderShowcase();
        if (!active) return;
        setPageUrls((current) => {
          current.forEach((url) => URL.revokeObjectURL(url));
          return result.previewPngs.map((png) => bytesToUrl(png, "image/png"));
        });
        setStatus(`Rendered ${result.pageCount} pages with DsPdfJS ${Demos.apiVersion}.`);
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
          DsPdfJS text engine.
        </p>
        <div className="toolbar">
          <button type="button" className="primary" disabled={busy || pageUrls.length === 0} onClick={() => void download()}>
            Download PDF
          </button>
          <span className="status">{busy ? status : error ? "" : status}</span>
        </div>
        {error && <div className="error">{error}</div>}
      </header>

      <section className="pages">
        {pageUrls.map((url, pageIndex) => (
          <figure className="page" key={url}>
            <img src={url} alt={`Typeset page ${pageIndex + 1}`} />
          </figure>
        ))}
        {pageUrls.length === 0 && !error && <div className="placeholder"><span>{status}</span></div>}
      </section>
    </main>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

type Props = { fileUrl: string; fileName?: string; compact?: boolean };

export default function PdfDocumentViewer({ fileUrl, fileName = "PDF document", compact = false }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<number[]>([]);
  const [matchIndex, setMatchIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [containerWidth, setContainerWidth] = useState(720);
  const frameRef = useRef<HTMLDivElement>(null);

  const onLoadSuccess = useCallback((loaded: PDFDocumentProxy) => {
    setPdf(loaded);
    setNumPages(loaded.numPages);
    setPageNumber(1);
    setError("");
  }, []);

  useEffect(() => {
    setNumPages(0);
    setPageNumber(1);
    setPdf(null);
    setError("");
    setMatches([]);
    setMatchIndex(0);
    setSearch("");
    setZoom(1);
  }, [fileUrl]);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(Math.max(280, Math.min(width - 32, 1100)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const term = search.trim().toLocaleLowerCase();
    if (!pdf || !term) {
      setMatches([]);
      setMatchIndex(0);
      setSearching(false);
      return;
    }
    setSearching(true);
    void (async () => {
      const found: number[] = [];
      try {
        for (let page = 1; page <= pdf.numPages; page += 1) {
          if (cancelled) return;
          try {
            const content = await (await pdf.getPage(page)).getTextContent();
            const text = content.items.map((item) => "str" in item ? item.str : "").join(" ").toLocaleLowerCase();
            if (text.includes(term)) found.push(page);
          } catch { /* Skip a page whose text layer cannot be read. */ }
        }
        if (!cancelled) {
          setMatches(found);
          setMatchIndex(0);
          if (found.length) setPageNumber(found[0]);
        }
      } catch (cause) {
        if (!cancelled) setError("PDF text search failed. You can still browse pages or download the file.");
        console.error("PDF text search failed:", cause);
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pdf, search]);

  const stepMatch = (direction: number) => {
    if (!matches.length) return;
    const next = (matchIndex + direction + matches.length) % matches.length;
    setMatchIndex(next);
    setPageNumber(matches[next]);
  };

  return <section className={"pdf-document-viewer pdf-library-viewer" + (compact ? " pdf-viewer-compact" : "")} aria-label={fileName}>
    <div className="pdf-library-toolbar">
      <div className="pdf-library-title" title={fileName}>▤ <span>{fileName}</span></div>
      <div className="pdf-page-controls">
        <button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber((n) => Math.max(1, n - 1))} aria-label="Previous PDF page">‹</button>
        <label><input aria-label="PDF page number" type="number" min={1} max={numPages || 1} value={pageNumber} disabled={!numPages} onChange={(event) => {
          const raw = event.target.value;
          if (!raw) return;
          const parsed = Number(raw);
          if (Number.isInteger(parsed)) setPageNumber(Math.max(1, Math.min(numPages || 1, parsed)));
        }} onBlur={(event) => {
          const parsed = Number(event.target.value);
          setPageNumber(Number.isInteger(parsed) ? Math.max(1, Math.min(numPages || 1, parsed)) : 1);
        }} /> <span>/ {numPages || "—"}</span></label>
        <button type="button" disabled={!numPages || pageNumber >= numPages} onClick={() => setPageNumber((n) => Math.min(numPages, n + 1))} aria-label="Next PDF page">›</button>
      </div>
      <div className="pdf-zoom-controls">
        <button type="button" onClick={() => setZoom((z) => Math.max(.5, Math.round((z - .1) * 10) / 10))} aria-label="Zoom out">−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((z) => Math.min(2, Math.round((z + .1) * 10) / 10))} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => setZoom(1)} title="Reset zoom">Fit</button>
      </div>
      <div className="pdf-search-controls">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find in PDF…" aria-label="Search PDF text" onKeyDown={(event) => { if (event.key === "Enter") stepMatch(event.shiftKey ? -1 : 1); }} />
        {search.trim() && <span>{searching ? "Searching…" : matches.length ? (matchIndex + 1) + "/" + matches.length + " pages" : "0 matches"}</span>}
        <button type="button" disabled={!matches.length} onClick={() => stepMatch(-1)} aria-label="Previous search result">↑</button>
        <button type="button" disabled={!matches.length} onClick={() => stepMatch(1)} aria-label="Next search result">↓</button>
      </div>
      <div className="pdf-file-actions"><a href={fileUrl} download={fileName}>Download</a><button type="button" onClick={() => window.open(fileUrl, "_blank", "noopener,noreferrer")}>Print / open</button><a href={fileUrl} target="_blank" rel="noreferrer">Open ↗</a></div>
    </div>
    {error && <div className="pdf-load-error" role="alert">{error}</div>}
    <div className="pdf-library-page" ref={frameRef}>
      <Document file={fileUrl} onLoadSuccess={onLoadSuccess} onLoadError={(cause) => {
        setPdf(null);
        setNumPages(0);
        setError("Unable to load this PDF. The file may be missing, damaged, or too large for this browser session.");
        console.error("PDF load failed:", cause);
      }} loading={<p className="pdf-load-status">Loading PDF document…</p>} error={<p className="pdf-load-error">This PDF could not be opened. Try downloading it or opening it in a new tab.</p>}>
        {numPages > 0 && <Page pageNumber={pageNumber} width={containerWidth * zoom} renderTextLayer renderAnnotationLayer />}
      </Document>
    </div>
    <div className="pdf-bottom-status">Page {numPages ? pageNumber : "—"} of {numPages || "—"} · Original PDF pagination preserved</div>
  </section>;
}

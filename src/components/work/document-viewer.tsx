import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Loader2, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
  destroy: () => void;
};
type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void>; cancel: () => void };
};

/**
 * A reading experience for document Work — plays, screenplays, research
 * papers, zines, scores. One page at a time, never the whole file at once.
 *
 * This module is only ever loaded for Works that actually carry a document, so
 * image and video Works never pay for the PDF engine.
 */
export function DocumentViewer({
  url,
  title,
  downloadEnabled,
  className,
}: {
  url: string;
  title: string;
  downloadEnabled: boolean;
  className?: string;
}) {
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [broken, setBroken] = useState(false);
  const [full, setFull] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cache = useRef(new Map<number, PdfPage>());

  // Load the document once.
  useEffect(() => {
    let cancelled = false;
    let loaded: PdfDoc | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const task = pdfjs.getDocument({ url });
        const d = (await task.promise) as unknown as PdfDoc;
        if (cancelled) {
          d.destroy();
          return;
        }
        loaded = d;
        setDoc(d);
        setPageCount(d.numPages);
      } catch {
        if (!cancelled) setBroken(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      loaded?.destroy();
    };
  }, [url]);

  const getPage = useCallback(
    async (n: number) => {
      if (!doc || n < 1 || n > doc.numPages) return null;
      const hit = cache.current.get(n);
      if (hit) return hit;
      const p = await doc.getPage(n);
      cache.current.set(n, p);
      // Keep memory bounded — a play can be 100+ pages.
      if (cache.current.size > 6) {
        const oldest = cache.current.keys().next().value as number | undefined;
        if (oldest !== undefined && Math.abs(oldest - n) > 2) cache.current.delete(oldest);
      }
      return p;
    },
    [doc],
  );

  // Render the current page, then warm the next one.
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    (async () => {
      try {
        const p = await getPage(page);
        const canvas = canvasRef.current;
        if (!p || !canvas || cancelled) return;
        const containerWidth = wrapRef.current?.clientWidth ?? 800;
        const base = p.getViewport({ scale: 1 });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const scale = (containerWidth / base.width) * dpr;
        const viewport = p.getViewport({ scale });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = "100%";
        canvas.style.height = "auto";
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const render = p.render({ canvasContext: ctx, viewport });
        task = render;
        await render.promise;
        if (!cancelled) void getPage(page + 1);
      } catch {
        /* a cancelled render is normal when paging fast */
      }
    })();
    return () => {
      cancelled = true;
      try {
        task?.cancel();
      } catch {
        /* noop */
      }
    };
  }, [doc, page, getPage, full]);

  const prev = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const next = useCallback(() => setPage((p) => Math.min(pageCount || 1, p + 1)), [pageCount]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" || e.key === "PageUp") prev();
      if (e.key === "ArrowRight" || e.key === "PageDown") next();
      if (e.key === "Escape") setFull(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  // Horizontal swipe only — vertical scrolling must stay untouched.
  const touch = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) next();
    else prev();
  }

  if (broken) return <DocumentFallback url={url} downloadEnabled={downloadEnabled} />;

  const body = (
    <div className={cn("space-y-3", full && "flex h-full flex-col")}>
      <div
        ref={wrapRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={cn(
          "relative overflow-hidden rounded-xl border border-border bg-surface-2",
          full && "min-h-0 flex-1 overflow-auto",
        )}
      >
        {loading && (
          <div className="flex aspect-[8.5/11] items-center justify-center text-ink-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          aria-label={`${title} — page ${page} of ${pageCount || "?"}`}
          className={cn("mx-auto block bg-background", loading && "hidden")}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prev} disabled={page <= 1} className="rounded-md">
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          <Button variant="outline" size="sm" onClick={next} disabled={pageCount > 0 && page >= pageCount} className="rounded-md">
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
          <span className="ml-1 text-sm tabular-nums text-ink-muted" aria-live="polite">
            {page} / {pageCount || "…"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setFull((f) => !f)} className="rounded-md">
            {full ? <X className="mr-1 h-4 w-4" /> : <Maximize2 className="mr-1 h-4 w-4" />}
            {full ? "Close" : "Full screen"}
          </Button>
          {downloadEnabled && (
            <a href={url} download target="_blank" rel="noreferrer noopener">
              <Button variant="ghost" size="sm" className="rounded-md">
                <Download className="mr-1 h-4 w-4" /> Download
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );

  if (full) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-background p-4" role="dialog" aria-modal="true" aria-label={title}>
        {body}
      </div>
    );
  }
  return <div className={className}>{body}</div>;
}

/** The boring fallback. A document problem must never break the Work page. */
export function DocumentFallback({ url, downloadEnabled }: { url: string; downloadEnabled: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-6 text-center">
      <p className="text-sm text-ink-muted">This document can't be previewed here.</p>
      <div className="mt-3 flex justify-center gap-2">
        <a href={url} target="_blank" rel="noreferrer noopener">
          <Button variant="outline" size="sm" className="rounded-md">
            Open document <ExternalLink className="ml-1 h-4 w-4" />
          </Button>
        </a>
        {downloadEnabled && (
          <a href={url} download target="_blank" rel="noreferrer noopener">
            <Button variant="ghost" size="sm" className="rounded-md">
              <Download className="mr-1 h-4 w-4" /> Download
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}

export default DocumentViewer;

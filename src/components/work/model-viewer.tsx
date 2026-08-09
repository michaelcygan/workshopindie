import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Loaded only when a Work actually carries a 3D asset — the model-viewer
 * runtime is heavy and irrelevant to every other kind of Work.
 */
export function ModelViewer({ url, title, className }: { url: string; title: string; className?: string }) {
  const [ready, setReady] = useState(false);
  const [broken, setBroken] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    import("@google/model-viewer")
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setBroken(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The custom element isn't a React component, so mount it imperatively.
  useEffect(() => {
    const host = hostRef.current;
    if (!ready || !host) return;
    host.replaceChildren();
    const el = document.createElement("model-viewer");
    el.setAttribute("src", url);
    el.setAttribute("alt", title);
    el.setAttribute("camera-controls", "");
    el.setAttribute("touch-action", "pan-y");
    el.setAttribute("shadow-intensity", "1");
    el.setAttribute("loading", "lazy");
    el.style.width = "100%";
    el.style.height = "100%";
    el.addEventListener("error", () => setBroken(true));
    host.appendChild(el);
    return () => host.replaceChildren();
  }, [ready, url, title]);

  if (broken) {
    return (
      <div className={cn("rounded-xl border border-border bg-surface-2 p-6 text-center", className)}>
        <p className="text-sm text-ink-muted">This 3D model can't be previewed here.</p>
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 inline-block text-sm text-ink underline underline-offset-2"
        >
          Open the file
        </a>
      </div>
    );
  }

  return (
    <div className={cn("relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-surface-2", className)}>
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-ink-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );
}

export default ModelViewer;

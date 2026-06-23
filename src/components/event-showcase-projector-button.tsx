import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Maximize2, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listEventShowcase, type ShowcaseEntry } from "@/lib/event-showcase.functions";

type Props = {
  eventId: string;
};

/**
 * Projector mode — fullscreen, auto-advancing carousel of the event's
 * showcase items. Native Fullscreen API with a CSS-fixed overlay fallback.
 * Polls every 30s for new drops while open.
 */
export function EventShowcaseProjectorButton({ eventId }: Props) {
  const [open, setOpen] = useState(false);
  const listFn = useServerFn(listEventShowcase);
  const { data } = useQuery({
    queryKey: ["event-showcase", eventId],
    queryFn: () => listFn({ data: { event_id: eventId } }),
    refetchInterval: open ? 30_000 : false,
    staleTime: 15_000,
    enabled: open,
  });

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="rounded-full gap-1.5"
        onClick={() => setOpen(true)}
        title="Project the showcase fullscreen"
      >
        <Maximize2 className="h-3.5 w-3.5" /> Projector
      </Button>
    );
  }

  return (
    <ProjectorOverlay
      entries={data ?? []}
      onClose={() => setOpen(false)}
    />
  );
}

function ProjectorOverlay({
  entries,
  onClose,
}: {
  entries: ShowcaseEntry[];
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);

  // Request native fullscreen on mount; ignore failures (CSS overlay still covers).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const req = (el as HTMLElement & { requestFullscreen?: () => Promise<void> }).requestFullscreen;
    if (req) {
      req.call(el).catch(() => {});
    }
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Auto-advance every 8s.
  useEffect(() => {
    if (entries.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % entries.length);
    }, 8000);
    return () => window.clearInterval(id);
  }, [entries.length]);

  // Escape to close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % Math.max(1, entries.length));
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + Math.max(1, entries.length)) % Math.max(1, entries.length));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entries.length, onClose]);

  const current = entries[index];

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black text-white"
    >
      <button
        onClick={onClose}
        className="absolute right-6 top-6 rounded-full bg-white/10 p-2 hover:bg-white/20"
        aria-label="Exit projector"
      >
        <X className="h-5 w-5" />
      </button>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 text-white/60">
          <Sparkles className="h-8 w-8" />
          <p className="text-lg">Nothing in the showcase yet.</p>
        </div>
      ) : (
        <div className="flex w-full max-w-5xl flex-col items-center gap-6 px-6">
          <div className="aspect-video w-full overflow-hidden rounded-2xl bg-white/5">
            {current?.cover_url ? (
              <img
                src={current.cover_url}
                alt={current.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Sparkles className="h-16 w-16 text-white/40" />
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="text-xs uppercase tracking-wide text-white/50">
              {current?.kind === "work" ? "Work" : "Open Collab"}
            </div>
            <h2 className="mt-1 font-display text-4xl">{current?.title}</h2>
            {current?.owner && (
              <p className="mt-2 text-sm text-white/60">
                by {current.owner.display_name ?? current.owner.username ?? "Someone"}
              </p>
            )}
          </div>
          <div className="flex gap-1.5">
            {entries.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-white" : "w-1.5 bg-white/30"
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

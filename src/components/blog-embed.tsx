import { ExternalLink } from "lucide-react";

type Parsed =
  | { kind: "youtube"; id: string; url: string }
  | { kind: "vimeo"; id: string; url: string }
  | { kind: "video"; url: string }
  | { kind: "link"; url: string; host: string; path: string }
  | { kind: "invalid" };

function parse(raw: string): Parsed {
  const trimmed = (raw || "").trim();
  if (!trimmed) return { kind: "invalid" };
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return { kind: "invalid" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { kind: "invalid" };
  const host = u.hostname.replace(/^www\./, "");

  // YouTube
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    if (id) return { kind: "youtube", id, url: trimmed };
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const v = u.searchParams.get("v");
    if (v) return { kind: "youtube", id: v, url: trimmed };
    const m = u.pathname.match(/^\/(?:shorts|embed|v)\/([^/?#]+)/);
    if (m) return { kind: "youtube", id: m[1], url: trimmed };
  }

  // Vimeo
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/(?:\/video)?\/(\d+)/);
    if (m) return { kind: "vimeo", id: m[1], url: trimmed };
  }

  // Direct video
  if (/\.(mp4|webm)(\?|#|$)/i.test(u.pathname)) {
    return { kind: "video", url: trimmed };
  }

  return { kind: "link", url: trimmed, host, path: (u.pathname + u.search).replace(/\/$/, "") || "/" };
}

export function BlogEmbed({ url }: { url: string }) {
  const p = parse(url);

  if (p.kind === "invalid") {
    return (
      <p className="my-6 rounded-2xl border border-dashed border-border bg-muted/50 px-4 py-3 text-sm text-ink-muted">
        Unsupported embed
      </p>
    );
  }

  if (p.kind === "youtube") {
    return (
      <div className="my-6 overflow-hidden rounded-2xl border border-border">
        <div className="relative aspect-video w-full bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(p.id)}`}
            title="YouTube video"
            loading="lazy"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; encrypted-media; picture-in-picture; fullscreen"
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    );
  }

  if (p.kind === "vimeo") {
    return (
      <div className="my-6 overflow-hidden rounded-2xl border border-border">
        <div className="relative aspect-video w-full bg-black">
          <iframe
            src={`https://player.vimeo.com/video/${encodeURIComponent(p.id)}`}
            title="Vimeo video"
            loading="lazy"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            allow="autoplay; fullscreen; picture-in-picture"
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    );
  }

  if (p.kind === "video") {
    return (
      <div className="my-6 overflow-hidden rounded-2xl border border-border bg-black">
        <video controls preload="metadata" className="aspect-video w-full">
          <source src={p.url} />
        </video>
      </div>
    );
  }

  return (
    <a
      href={p.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="my-6 flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 no-underline transition hover:bg-muted"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-ink-soft">
        <ExternalLink className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{p.host}</div>
        <div className="truncate text-xs text-ink-muted">{p.path}</div>
      </div>
      <span className="hidden shrink-0 text-xs text-primary sm:inline">Open link</span>
    </a>
  );
}

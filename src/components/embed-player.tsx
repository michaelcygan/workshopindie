import { useEffect, useRef } from "react";
import type { Provider } from "@/lib/works-import.functions";
import { ALLOWED_EMBED_HOSTS } from "@/lib/media-providers";
import { cn } from "@/lib/utils";

function isAllowed(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return ALLOWED_EMBED_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

function isHls(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    // Match Cloudflare Stream and generic .m3u8 manifests
    const isStreamHost =
      u.hostname.endsWith("videodelivery.net") ||
      u.hostname.endsWith("cloudflarestream.com");
    return isStreamHost || u.pathname.toLowerCase().endsWith(".m3u8");
  } catch {
    return false;
  }
}

// Audio embeds get a fixed short height; video gets 16:9.
const AUDIO_PROVIDERS = new Set<Provider>(["soundcloud", "spotify", "bandcamp"]);

function HlsVideo({
  url,
  title,
  poster,
  className,
}: {
  url: string;
  title?: string;
  poster?: string | null;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    // Safari (and iOS) play HLS natively.
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      return;
    }

    let destroyed = false;
    let hls: { destroy: () => void } | null = null;

    (async () => {
      const mod = await import("hls.js");
      const Hls = mod.default;
      if (destroyed) return;
      if (Hls.isSupported()) {
        const instance = new Hls();
        instance.loadSource(url);
        instance.attachMedia(video);
        hls = instance;
      } else {
        // Last-resort fallback — most browsers will fail but try anyway.
        video.src = url;
      }
    })().catch(() => {
      video.src = url;
    });

    return () => {
      destroyed = true;
      hls?.destroy();
    };
  }, [url]);

  return (
    <video
      ref={ref}
      controls
      playsInline
      poster={poster ?? undefined}
      title={title}
      className={cn("w-full bg-black aspect-video", className)}
    />
  );
}

export function EmbedPlayer({
  url,
  provider,
  title,
  poster,
  className,
}: {
  url: string | null | undefined;
  provider?: Provider | string | null;
  title?: string;
  poster?: string | null;
  className?: string;
}) {
  if (!url) return null;

  // HLS / hosted video path
  if (isHls(url)) {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-3xl border border-border bg-surface-2",
          className,
        )}
      >
        <HlsVideo url={url} title={title} poster={poster} />
      </div>
    );
  }

  if (!isAllowed(url)) return null;
  const isAudio = provider ? AUDIO_PROVIDERS.has(provider as Provider) : false;
  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl border border-border bg-surface-2",
        className,
      )}
    >
      <iframe
        src={url}
        title={title ?? "Embedded media"}
        loading="lazy"
        allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className={cn(
          "w-full border-0 bg-background",
          isAudio ? "h-[160px]" : "aspect-video h-auto",
        )}
      />
    </div>
  );
}

export function providerFromUrl(url: string | null | undefined): Provider | null {
  if (!url) return null;
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    if (h.endsWith("youtube.com") || h === "youtu.be" || h.endsWith("youtube-nocookie.com")) return "youtube";
    if (h.endsWith("vimeo.com")) return "vimeo";
    if (h.endsWith("soundcloud.com")) return "soundcloud";
    if (h.endsWith("spotify.com")) return "spotify";
    if (h.endsWith("bandcamp.com")) return "bandcamp";
    if (h.endsWith("tiktok.com")) return "tiktok";
    if (h.endsWith("instagram.com")) return "instagram";
    if (h === "twitter.com" || h === "x.com") return "twitter";
    if (h.endsWith("github.com")) return "github";
    if (h.endsWith("behance.net")) return "behance";
    if (h.endsWith("dribbble.com")) return "dribbble";
    if (h.endsWith("are.na")) return "arena";
    if (h.endsWith("substack.com")) return "substack";
    if (h.endsWith("medium.com")) return "medium";
    return "generic";
  } catch {
    return null;
  }
}

export function providerLabel(p?: Provider | string | null): string | null {
  switch (p) {
    case "youtube": return "YouTube";
    case "vimeo": return "Vimeo";
    case "soundcloud": return "SoundCloud";
    case "spotify": return "Spotify";
    case "bandcamp": return "Bandcamp";
    case "tiktok": return "TikTok";
    case "instagram": return "Instagram";
    case "github": return "GitHub";
    case "behance": return "Behance";
    case "dribbble": return "Dribbble";
    case "arena": return "Are.na";
    case "substack": return "Substack";
    case "medium": return "Medium";
    default: return null;
  }
}

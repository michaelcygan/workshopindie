import type { Provider } from "@/lib/works-import.functions";
import { cn } from "@/lib/utils";

const ALLOWED_HOSTS = new Set([
  "www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "youtube-nocookie.com",
  "player.vimeo.com",
  "w.soundcloud.com",
  "open.spotify.com",
  "bandcamp.com", "embed.bandcamp.com",
  "www.tiktok.com",
]);

function isAllowed(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return ALLOWED_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

// Audio embeds get a fixed short height; video gets 16:9.
const AUDIO_PROVIDERS = new Set<Provider>(["soundcloud", "spotify", "bandcamp"]);

export function EmbedPlayer({
  url,
  provider,
  title,
  className,
}: {
  url: string | null | undefined;
  provider?: Provider | string | null;
  title?: string;
  className?: string;
}) {
  if (!url || !isAllowed(url)) return null;
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

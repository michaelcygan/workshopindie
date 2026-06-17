// Media provider allowlist and embed-URL conversion for the Workshop "Player" tool.
// Centralized so EmbedPlayer's iframe sandbox and the Player tool stay in sync.

export type MediaProvider =
  | "youtube" | "vimeo" | "tiktok" | "dailymotion" | "twitch" | "loom" | "wistia"
  | "bilibili" | "niconico" | "facebook" | "instagram" | "threads" | "twitter"
  | "soundcloud" | "spotify" | "bandcamp" | "applemusic" | "deezer" | "mixcloud"
  | "audius" | "tidal" | "ted";

/** Strict hostname allowlist used by EmbedPlayer to decide whether to iframe a URL. */
export const ALLOWED_EMBED_HOSTS: ReadonlySet<string> = new Set([
  // Video
  "www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "youtube-nocookie.com",
  "player.vimeo.com",
  "www.tiktok.com",
  "www.dailymotion.com", "geo.dailymotion.com",
  "player.twitch.tv", "clips.twitch.tv",
  "www.loom.com",
  "fast.wistia.net", "fast.wistia.com",
  "player.bilibili.com",
  "embed.nicovideo.jp",
  "www.facebook.com",
  "www.instagram.com",
  "www.threads.net",
  "platform.twitter.com", "twitframe.com",
  // Audio / music
  "w.soundcloud.com",
  "open.spotify.com",
  "bandcamp.com", "embed.bandcamp.com",
  "embed.music.apple.com",
  "widget.deezer.com",
  "www.mixcloud.com",
  "audius.co", "embed.audius.co",
  "embed.tidal.com",
  // Talks
  "embed.ted.com",
]);

const PROVIDER_LABEL: Record<MediaProvider, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  tiktok: "TikTok",
  dailymotion: "Dailymotion",
  twitch: "Twitch",
  loom: "Loom",
  wistia: "Wistia",
  bilibili: "Bilibili",
  niconico: "Niconico",
  facebook: "Facebook",
  instagram: "Instagram",
  threads: "Threads",
  twitter: "X",
  soundcloud: "SoundCloud",
  spotify: "Spotify",
  bandcamp: "Bandcamp",
  applemusic: "Apple Music",
  deezer: "Deezer",
  mixcloud: "Mixcloud",
  audius: "Audius",
  tidal: "Tidal",
  ted: "TED",
};

export function providerNiceLabel(p: string | null | undefined): string | null {
  if (!p) return null;
  return (PROVIDER_LABEL as Record<string, string>)[p] ?? null;
}

export function providerOf(rawUrl: string): MediaProvider | null {
  try {
    const u = new URL(rawUrl);
    const h = u.hostname.replace(/^www\./, "");
    if (h.endsWith("youtube.com") || h === "youtu.be" || h.endsWith("youtube-nocookie.com")) return "youtube";
    if (h.endsWith("vimeo.com")) return "vimeo";
    if (h.endsWith("tiktok.com")) return "tiktok";
    if (h.endsWith("dailymotion.com") || h === "dai.ly") return "dailymotion";
    if (h.endsWith("twitch.tv")) return "twitch";
    if (h.endsWith("loom.com")) return "loom";
    if (h.endsWith("wistia.com") || h.endsWith("wistia.net")) return "wistia";
    if (h.endsWith("bilibili.com") || h === "b23.tv") return "bilibili";
    if (h.endsWith("nicovideo.jp")) return "niconico";
    if (h.endsWith("facebook.com") || h === "fb.watch") return "facebook";
    if (h.endsWith("instagram.com")) return "instagram";
    if (h.endsWith("threads.net")) return "threads";
    if (h === "twitter.com" || h === "x.com") return "twitter";
    if (h.endsWith("soundcloud.com")) return "soundcloud";
    if (h.endsWith("spotify.com")) return "spotify";
    if (h.endsWith("bandcamp.com")) return "bandcamp";
    if (h.endsWith("music.apple.com")) return "applemusic";
    if (h.endsWith("deezer.com")) return "deezer";
    if (h.endsWith("mixcloud.com")) return "mixcloud";
    if (h.endsWith("audius.co")) return "audius";
    if (h.endsWith("tidal.com")) return "tidal";
    if (h.endsWith("ted.com")) return "ted";
    return null;
  } catch {
    return null;
  }
}

/**
 * Convert a canonical share URL into an embeddable iframe URL on an allowed host.
 * Returns null if the URL isn't from a supported provider or can't be embedded.
 */
export function toEmbedUrl(rawUrl: string): string | null {
  let u: URL;
  try { u = new URL(rawUrl); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const h = u.hostname.replace(/^www\./, "");
  const provider = providerOf(rawUrl);
  if (!provider) return null;

  switch (provider) {
    case "youtube": {
      if (h === "youtu.be") {
        const id = u.pathname.slice(1);
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (u.pathname.startsWith("/watch")) {
        const id = u.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      const m = u.pathname.match(/^\/(embed|shorts|live)\/([^/]+)/);
      if (m) return `https://www.youtube.com/embed/${m[2]}`;
      return null;
    }
    case "vimeo": {
      if (h === "player.vimeo.com") return u.toString();
      const m = u.pathname.match(/\/(\d+)/);
      return m ? `https://player.vimeo.com/video/${m[1]}` : null;
    }
    case "tiktok": {
      // tiktok.com/@user/video/ID
      const m = u.pathname.match(/\/video\/(\d+)/);
      return m ? `https://www.tiktok.com/embed/v2/${m[1]}` : null;
    }
    case "dailymotion": {
      if (h === "dai.ly") {
        const id = u.pathname.slice(1);
        return id ? `https://geo.dailymotion.com/player.html?video=${id}` : null;
      }
      const m = u.pathname.match(/\/video\/([^/?]+)/);
      return m ? `https://geo.dailymotion.com/player.html?video=${m[1]}` : null;
    }
    case "twitch": {
      const parent = "workshopindie.com";
      if (h === "clips.twitch.tv") {
        const slug = u.pathname.split("/").filter(Boolean)[0];
        return slug ? `https://clips.twitch.tv/embed?clip=${slug}&parent=${parent}` : null;
      }
      const vidMatch = u.pathname.match(/\/videos\/(\d+)/);
      if (vidMatch) return `https://player.twitch.tv/?video=${vidMatch[1]}&parent=${parent}`;
      const seg = u.pathname.split("/").filter(Boolean);
      if (seg.length === 1) return `https://player.twitch.tv/?channel=${seg[0]}&parent=${parent}`;
      return null;
    }
    case "loom": {
      const m = u.pathname.match(/\/(share|embed)\/([^/?]+)/);
      return m ? `https://www.loom.com/embed/${m[2]}` : null;
    }
    case "wistia": {
      const m = u.pathname.match(/\/medias\/([^/?]+)/) || u.pathname.match(/\/embed\/iframe\/([^/?]+)/);
      return m ? `https://fast.wistia.net/embed/iframe/${m[1]}` : null;
    }
    case "bilibili": {
      const bvid = u.pathname.match(/\/(BV[\w]+)/)?.[1];
      return bvid ? `https://player.bilibili.com/player.html?bvid=${bvid}&high_quality=1` : null;
    }
    case "niconico": {
      const m = u.pathname.match(/\/watch\/(sm\d+|nm\d+|so\d+)/);
      return m ? `https://embed.nicovideo.jp/watch/${m[1]}` : null;
    }
    case "facebook": {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u.toString())}&show_text=false`;
    }
    case "instagram": {
      const m = u.pathname.match(/^\/(p|reel|tv)\/([^/]+)/);
      return m ? `https://www.instagram.com/${m[1]}/${m[2]}/embed` : null;
    }
    case "threads": {
      // https://www.threads.net/@user/post/CODE
      const m = u.pathname.match(/\/post\/([^/?]+)/);
      return m ? `https://www.threads.net/p/${m[1]}/embed` : null;
    }
    case "twitter": {
      // Use twitframe to embed a single tweet
      const m = u.pathname.match(/\/status\/(\d+)/);
      return m ? `https://twitframe.com/show?url=${encodeURIComponent(u.toString())}` : null;
    }
    case "soundcloud": {
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.toString())}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`;
    }
    case "spotify": {
      const m = u.pathname.match(/^\/(track|album|playlist|episode|show|artist)\/([^/]+)/);
      return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
    }
    case "bandcamp": {
      // Bandcamp embeds need oEmbed-derived params; allow direct EmbeddedPlayer URLs as-is.
      if (h === "bandcamp.com" && u.pathname.startsWith("/EmbeddedPlayer")) return u.toString();
      // Otherwise, can't synthesize without an API call — reject for now.
      return null;
    }
    case "applemusic": {
      // music.apple.com/<region>/<...> -> embed.music.apple.com/<region>/<...>
      return `https://embed.music.apple.com${u.pathname}${u.search}`;
    }
    case "deezer": {
      const m = u.pathname.match(/^\/(?:[a-z]{2}\/)?(track|album|playlist|artist|episode|show)\/(\d+)/);
      return m ? `https://widget.deezer.com/widget/auto/${m[1]}/${m[2]}` : null;
    }
    case "mixcloud": {
      // mixcloud.com/<user>/<show>/ → /widget/iframe/?feed=/<user>/<show>/
      return `https://www.mixcloud.com/widget/iframe/?feed=${encodeURIComponent(u.pathname)}`;
    }
    case "audius": {
      // audius.co/<artist>/<track-slug> → embed.audius.co/<artist>/<track-slug>?... (best effort)
      return `https://audius.co${u.pathname}/embed`;
    }
    case "tidal": {
      const m = u.pathname.match(/\/(track|album|video|playlist)\/([^/?]+)/);
      return m ? `https://embed.tidal.com/${m[1]}s/${m[2]}` : null;
    }
    case "ted": {
      const m = u.pathname.match(/\/talks\/([^/?]+)/);
      return m ? `https://embed.ted.com/talks/${m[1]}` : null;
    }
  }
}

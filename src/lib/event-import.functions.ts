import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Draft = {
  title: string;
  tagline: string | null;
  description: string | null;
  kind: "open_mic" | "listening_party" | "networking" | "screening" | "workshop_irl" | "online" | "other";
  format: "in_person" | "online" | "hybrid";
  cover_url: string | null;
  starts_at: string | null; // ISO
  ends_at: string | null;
  timezone: string;
  venue_name: string | null;
  venue_address: string | null;
  online_url: string | null;
  capacity: number | null;
};

const inputSchema = z.object({
  url: z
    .string()
    .url()
    .max(500)
    .refine((u) => {
      try {
        const parsed = new URL(u);
        if (!/^https?:$/.test(parsed.protocol)) return false;
        const host = parsed.hostname.toLowerCase();
        if (
          host === "localhost" ||
          host.endsWith(".local") ||
          host === "0.0.0.0" ||
          /^127\./.test(host) ||
          /^10\./.test(host) ||
          /^192\.168\./.test(host) ||
          /^169\.254\./.test(host) ||
          /^172\.(1[6-9]|2\d|3[01])\./.test(host)
        ) return false;
        return true;
      } catch {
        return false;
      }
    }, "URL must be a public http(s) page"),
});

function stripHtml(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function metaTag(html: string, prop: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
    "i",
  );
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  const content = tag.match(/content=["']([^"']*)["']/i)?.[1];
  return content ?? null;
}

function extractJsonLd(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1].trim();
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) for (const it of parsed) if (it && typeof it === "object") out.push(it);
      else if (parsed && typeof parsed === "object") out.push(parsed);
    } catch {
      /* ignore bad json */
    }
  }
  return out;
}

function findEventNode(nodes: Record<string, unknown>[]): Record<string, unknown> | null {
  for (const n of nodes) {
    const t = n["@type"];
    const types = Array.isArray(t) ? t : [t];
    if (types.some((x) => typeof x === "string" && /Event$/i.test(x))) return n;
    const graph = n["@graph"];
    if (Array.isArray(graph)) {
      const found = findEventNode(graph as Record<string, unknown>[]);
      if (found) return found;
    }
  }
  return null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function pickImage(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v.length > 0) return pickImage(v[0]);
  if (v && typeof v === "object") {
    const u = (v as Record<string, unknown>).url;
    if (typeof u === "string") return u;
  }
  return null;
}

function tzFromIso(iso: string | null): string | null {
  if (!iso) return null;
  const m = iso.match(/([+-]\d{2}:?\d{2}|Z)$/);
  return m ? (m[1] === "Z" ? "UTC" : `UTC${m[1]}`) : null;
}

function guessKind(title: string, desc: string): Draft["kind"] {
  const s = `${title} ${desc}`.toLowerCase();
  if (/(workshop|bootcamp|class|masterclass)/.test(s)) return "workshop_irl";
  if (/(listening\s*party)/.test(s)) return "listening_party";
  if (/(open\s*mic)/.test(s)) return "open_mic";
  if (/(screening|film|movie)/.test(s)) return "screening";
  if (/(network|mixer|meetup)/.test(s)) return "networking";
  return "other";
}

async function fetchHtml(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new Error(`Source returned ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) return await res.text();
    const chunks: Uint8Array[] = [];
    let total = 0;
    const MAX = 2 * 1024 * 1024;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX) { await reader.cancel(); break; }
      chunks.push(value);
    }
    const buf = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { buf.set(c, off); off += c.byteLength; }
    return new TextDecoder("utf-8", { fatal: false }).decode(buf);
  } finally {
    clearTimeout(timer);
  }
}

export const importEventFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => inputSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admin only");

    const url = data.url;
    const host = new URL(url).hostname.replace(/^www\./, "");
    const html = await fetchHtml(url);

    const warnings: string[] = [];
    let parser: "json-ld" | "og" | "fallback" = "fallback";

    const ld = extractJsonLd(html);
    const ev = findEventNode(ld);

    let title: string | null = null;
    let description: string | null = null;
    let coverUrl: string | null = null;
    let startsAt: string | null = null;
    let endsAt: string | null = null;
    let venueName: string | null = null;
    let venueAddress: string | null = null;
    let onlineUrl: string | null = null;
    let attendanceMode: string | null = null;

    if (ev) {
      parser = "json-ld";
      title = asString(ev.name);
      description = asString(ev.description);
      coverUrl = pickImage(ev.image);
      startsAt = asString(ev.startDate);
      endsAt = asString(ev.endDate);
      attendanceMode = asString(ev.eventAttendanceMode);
      const loc = ev.location;
      const locs = Array.isArray(loc) ? loc : loc ? [loc] : [];
      for (const l of locs as Record<string, unknown>[]) {
        const t = l["@type"];
        if (typeof t === "string" && /VirtualLocation/i.test(t)) {
          onlineUrl = onlineUrl ?? asString(l.url);
        } else {
          venueName = venueName ?? asString(l.name);
          const addr = l.address;
          if (typeof addr === "string") venueAddress = venueAddress ?? addr;
          else if (addr && typeof addr === "object") {
            const a = addr as Record<string, unknown>;
            const parts = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, a.addressCountry]
              .map(asString)
              .filter(Boolean);
            if (parts.length) venueAddress = venueAddress ?? parts.join(", ");
          }
        }
      }
    }

    // OG / meta fallback for any missing field
    title = title ?? metaTag(html, "og:title") ?? metaTag(html, "twitter:title") ?? (html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() ?? null);
    description = description ?? metaTag(html, "og:description") ?? metaTag(html, "description");
    coverUrl = coverUrl ?? metaTag(html, "og:image") ?? metaTag(html, "twitter:image");
    startsAt = startsAt ?? metaTag(html, "event:start_time");
    endsAt = endsAt ?? metaTag(html, "event:end_time");
    if (!ev && (title || description)) parser = "og";

    if (description) description = stripHtml(description).slice(0, 6000);
    if (title) title = stripHtml(title).slice(0, 120);

    if (!title) warnings.push("Couldn't read a title — fill it in manually.");
    if (!startsAt) warnings.push("No start time found — set one before publishing.");
    if (!endsAt && startsAt) {
      // Default to +2 hours when end is missing
      try { endsAt = new Date(new Date(startsAt).getTime() + 2 * 60 * 60 * 1000).toISOString(); }
      catch { /* leave null */ }
    }

    const format: Draft["format"] =
      attendanceMode && /Online/i.test(attendanceMode)
        ? "online"
        : attendanceMode && /Mixed/i.test(attendanceMode)
          ? "hybrid"
          : venueAddress || venueName
            ? "in_person"
            : onlineUrl
              ? "online"
              : "in_person";

    const draft: Draft = {
      title: title ?? "",
      tagline: null,
      description,
      kind: guessKind(title ?? "", description ?? ""),
      format,
      cover_url: coverUrl,
      starts_at: startsAt,
      ends_at: endsAt,
      timezone: tzFromIso(startsAt) ?? "UTC",
      venue_name: venueName,
      venue_address: venueAddress,
      online_url: onlineUrl,
      capacity: null,
    };

    return { draft, source: { url, host, parser }, warnings };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Recurrence = {
  rule: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  weekday: number | null; // 0=Sun..6=Sat
  hint: string;
} | null;

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
  recurrence: Recurrence;
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
      if (Array.isArray(parsed)) {
        for (const it of parsed) if (it && typeof it === "object") out.push(it as Record<string, unknown>);
      } else if (parsed && typeof parsed === "object") {
        out.push(parsed as Record<string, unknown>);
      }
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

const WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function detectRecurrence(title: string, desc: string, startsAt: string | null): Recurrence {
  const s = `${title}\n${desc}`.toLowerCase();
  let weekday: number | null = null;
  if (startsAt) {
    try { weekday = new Date(startsAt).getDay(); } catch { /* ignore */ }
  }
  for (let i = 0; i < WEEKDAY_NAMES.length; i++) {
    const n = WEEKDAY_NAMES[i];
    if (new RegExp(`every\\s+${n}`, "i").test(s) || new RegExp(`${n}s\\b`, "i").test(s)) {
      weekday = i;
      return { rule: "WEEKLY", weekday, hint: `every ${n.charAt(0).toUpperCase() + n.slice(1)}` };
    }
  }
  if (/\b(bi[- ]?weekly|every other week)\b/i.test(s)) return { rule: "BIWEEKLY", weekday, hint: "every 2 weeks" };
  if (/\b(weekly|each week)\b/i.test(s)) return { rule: "WEEKLY", weekday, hint: "weekly" };
  if (/\b(monthly|each month|first \w+ of the month|last \w+ of the month)\b/i.test(s)) {
    return { rule: "MONTHLY", weekday: null, hint: "monthly" };
  }
  return null;
}

type ParserSource = "json-ld" | "eventbrite" | "partiful" | "luma" | "og" | "fallback";

function extractInlineScriptJson(html: string, idAttr: string): unknown | null {
  // Matches <script id="..." type="application/json|application/ld+json|text/javascript">...</script>
  const re = new RegExp(`<script[^>]+id=["']${idAttr}["'][^>]*>([\\s\\S]*?)<\\/script>`, "i");
  const m = html.match(re);
  if (!m) return null;
  try { return JSON.parse(m[1].trim()); } catch { return null; }
}

function extractAssignedJson(html: string, varName: string): unknown | null {
  // e.g. window.__SERVER_DATA__ = { ... };
  const re = new RegExp(`${varName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\s*=\\s*(\\{[\\s\\S]*?\\})\\s*;`);
  const m = html.match(re);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function digPath(obj: unknown, path: (string | number)[]): unknown {
  let cur: unknown = obj;
  for (const k of path) {
    if (cur && typeof cur === "object") cur = (cur as Record<string | number, unknown>)[k as never];
    else return undefined;
  }
  return cur;
}

function findFirstEventbriteEvent(html: string): {
  title: string | null; description: string | null; startsAt: string | null; endsAt: string | null;
  coverUrl: string | null; venueName: string | null; venueAddress: string | null; onlineUrl: string | null;
} | null {
  const data = extractAssignedJson(html, "window.__SERVER_DATA__");
  if (!data) return null;
  // Eventbrite's payload puts the event under `view_data.event` or `event`.
  const ev = (digPath(data, ["view_data", "event"]) ?? digPath(data, ["event"])) as Record<string, unknown> | undefined;
  if (!ev || typeof ev !== "object") return null;
  const name = asString((ev.name as Record<string, unknown> | undefined)?.text) ?? asString(ev.name);
  const desc = asString((ev.description as Record<string, unknown> | undefined)?.text) ?? asString(ev.summary);
  const start = asString((ev.start as Record<string, unknown> | undefined)?.utc) ?? asString(ev.start_date);
  const end = asString((ev.end as Record<string, unknown> | undefined)?.utc) ?? asString(ev.end_date);
  const logo = ev.logo as Record<string, unknown> | undefined;
  const cover = asString((logo?.original as Record<string, unknown> | undefined)?.url) ?? asString(logo?.url);
  const venue = ev.venue as Record<string, unknown> | undefined;
  const venueName = venue ? asString(venue.name) : null;
  const addr = venue?.address as Record<string, unknown> | undefined;
  const venueAddress = addr
    ? [addr.address_1, addr.address_2, addr.city, addr.region, addr.postal_code, addr.country].map(asString).filter(Boolean).join(", ") || null
    : null;
  const onlineUrl = asString(ev.online_event_url) ?? null;
  return { title: name, description: desc, startsAt: start, endsAt: end, coverUrl: cover, venueName, venueAddress, onlineUrl };
}

function findFirstPartifulEvent(html: string): {
  title: string | null; description: string | null; startsAt: string | null; endsAt: string | null;
  coverUrl: string | null; venueName: string | null; venueAddress: string | null;
} | null {
  const data = extractInlineScriptJson(html, "__NEXT_DATA__");
  if (!data) return null;
  const ev =
    (digPath(data, ["props", "pageProps", "event"]) ??
      digPath(data, ["props", "pageProps", "initialState", "event"])) as Record<string, unknown> | undefined;
  if (!ev || typeof ev !== "object") return null;
  const title = asString(ev.title) ?? asString(ev.name);
  const desc = asString(ev.description) ?? asString(ev.summary);
  const start = asString(ev.startDate) ?? asString(ev.start) ?? asString(ev.startTime);
  const end = asString(ev.endDate) ?? asString(ev.end) ?? asString(ev.endTime);
  const cover = asString(ev.coverImage) ?? asString(ev.image) ?? asString((ev.cover as Record<string, unknown> | undefined)?.url);
  const venueName = asString(ev.location) ?? asString((ev.venue as Record<string, unknown> | undefined)?.name);
  const venueAddress = asString(ev.address) ?? asString((ev.venue as Record<string, unknown> | undefined)?.address);
  return { title, description: desc, startsAt: start, endsAt: end, coverUrl: cover, venueName, venueAddress };
}

async function parseEventFromHtml(url: string, html: string): Promise<{ draft: Draft; warnings: string[]; parser: ParserSource }> {
  const warnings: string[] = [];
  let parser: ParserSource = "fallback";

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

  // Platform-specific inline JSON fallbacks (server-rendered, no headless browser needed).
  const host = (() => { try { return new URL(url).hostname.toLowerCase(); } catch { return ""; } })();
  if (!startsAt || !title) {
    if (host.includes("eventbrite.")) {
      const eb = findFirstEventbriteEvent(html);
      if (eb) {
        if (!ev) parser = "eventbrite";
        title = title ?? eb.title;
        description = description ?? eb.description;
        startsAt = startsAt ?? eb.startsAt;
        endsAt = endsAt ?? eb.endsAt;
        coverUrl = coverUrl ?? eb.coverUrl;
        venueName = venueName ?? eb.venueName;
        venueAddress = venueAddress ?? eb.venueAddress;
        onlineUrl = onlineUrl ?? eb.onlineUrl;
      }
    } else if (host.includes("partiful.com")) {
      const pf = findFirstPartifulEvent(html);
      if (pf) {
        if (!ev) parser = "partiful";
        title = title ?? pf.title;
        description = description ?? pf.description;
        startsAt = startsAt ?? pf.startsAt;
        endsAt = endsAt ?? pf.endsAt;
        coverUrl = coverUrl ?? pf.coverUrl;
        venueName = venueName ?? pf.venueName;
        venueAddress = venueAddress ?? pf.venueAddress;
      }
    }
  }

  title = title ?? metaTag(html, "og:title") ?? metaTag(html, "twitter:title") ?? (html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() ?? null);
  description = description ?? metaTag(html, "og:description") ?? metaTag(html, "description");
  coverUrl = coverUrl ?? metaTag(html, "og:image") ?? metaTag(html, "twitter:image");
  startsAt = startsAt ?? metaTag(html, "event:start_time");
  endsAt = endsAt ?? metaTag(html, "event:end_time");
  if (parser === "fallback" && !ev && (title || description)) parser = "og";

  if (description) description = stripHtml(description).slice(0, 6000);
  if (title) title = stripHtml(title).slice(0, 120);

  if (!title) warnings.push("Couldn't read a title — fill it in manually.");
  if (!startsAt) warnings.push("No start time found — set one before publishing.");
  if (!endsAt && startsAt) {
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

  const recurrence = detectRecurrence(title ?? "", description ?? "", startsAt);
  if (recurrence) warnings.push(`Looks like a recurring event (${recurrence.hint}).`);

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
    recurrence,
  };
  return { draft, warnings, parser };
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
    const { draft, warnings, parser } = await parseEventFromHtml(url, html);
    return { draft, source: { url, host, parser }, warnings };
  });

const bulkSchema = z.object({
  urls: z.array(inputSchema.shape.url).min(1).max(25),
});

export type BulkImportRow =
  | { ok: true; url: string; host: string; draft: Draft; warnings: string[]; parser: ParserSource }
  | { ok: false; url: string; host: string; error: string };

export const importEventsFromUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => bulkSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admin only");

    // Trim, dedupe, preserve order
    const seen = new Set<string>();
    const urls = data.urls.map((u) => u.trim()).filter((u) => {
      if (!u || seen.has(u)) return false;
      seen.add(u);
      return true;
    });

    const results: BulkImportRow[] = new Array(urls.length);
    const CONCURRENCY = 3;
    let cursor = 0;
    async function worker() {
      while (true) {
        const i = cursor++;
        if (i >= urls.length) return;
        const u = urls[i];
        const host = (() => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } })();
        try {
          const html = await fetchHtml(u);
          const { draft, warnings, parser } = await parseEventFromHtml(u, html);
          results[i] = { ok: true, url: u, host, draft, warnings, parser };
        } catch (ex) {
          results[i] = { ok: false, url: u, host, error: (ex as Error).message || "Couldn't read that page." };
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));
    return { results };
  });

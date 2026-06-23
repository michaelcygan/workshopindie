import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Hammer, Megaphone, Users, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Pulse =
  | { kind: "event"; id: string; title: string; group_slug: string; event_slug: string; starts_at: string; cover_url: string | null }
  | { kind: "work"; id: string; title: string; slug: string; cover_url: string | null; from_collab: boolean; from_workshop: boolean }
  | { kind: "collab"; id: string; title: string; slug: string; user_name: string | null }
  | { kind: "group"; id: string; name: string; slug: string; avatar_url: string | null };

/**
 * Ambient pulse rail — a single horizontal mixer of the platform's most
 * recent signs of life. Each source query runs independently and falls
 * back to [] on failure, so a broken table never blanks the rail.
 * Uses only existing data — no new tables, no new server fns.
 */
export function HomePulseRail() {
  const { data } = useQuery({
    queryKey: ["home-pulse"],
    staleTime: 60_000,
    refetchInterval: 90_000,
    queryFn: fetchPulse,
  });

  const items = data ?? [];

  return (
    <section className="border-y border-border bg-surface-2/30">
      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <h2 className="font-display text-sm uppercase tracking-wide text-ink-muted">Pulse</h2>
          </div>
          <p className="text-xs text-ink-muted">Live across the network</p>
        </div>
        {items.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border bg-surface/60 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="font-display text-sm text-ink">Quiet across the network right now.</p>
                <p className="mt-0.5 text-xs text-ink-muted">Be the spark — follow a few makers, or post a Collab.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:shrink-0">
              <Link
                to="/gallery"
                className="inline-flex h-8 items-center rounded-full border border-border bg-surface px-3 text-xs text-ink hover:bg-muted"
              >
                Browse Work
              </Link>
              <Link
                to="/collab/new"
                className="inline-flex h-8 items-center rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                Post a Collab
              </Link>
            </div>
          </div>
        ) : (
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {items.map((p) => (
              <PulseCard key={`${p.kind}-${"id" in p ? p.id : ""}`} pulse={p} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PulseCard({ pulse }: { pulse: Pulse }) {
  const base =
    "group relative flex w-64 shrink-0 flex-col gap-2 rounded-2xl border border-border bg-surface p-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift";

  if (pulse.kind === "event") {
    const dt = new Date(pulse.starts_at);
    return (
      <Link
        to="/g/$slug/e/$eventSlug"
        params={{ slug: pulse.group_slug, eventSlug: pulse.event_slug }}
        className={cn(base)}
      >
        <PulseChip icon={<Calendar className="h-3 w-3" />} label="Event" />
        <div
          className={cn(
            "aspect-video w-full overflow-hidden rounded-xl bg-muted",
            !pulse.cover_url && "gradient-soft",
          )}
          style={pulse.cover_url ? { backgroundImage: `url(${pulse.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        />
        <div>
          <div className="line-clamp-1 font-display text-sm text-ink">{pulse.title}</div>
          <div className="text-[11px] text-ink-muted">
            {dt.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ·{" "}
            {dt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </div>
        </div>
      </Link>
    );
  }

  if (pulse.kind === "work") {
    return (
      <Link to="/works/$slug" params={{ slug: pulse.slug }} className={cn(base)}>
        <div className="flex items-center gap-1.5">
          <PulseChip icon={<Hammer className="h-3 w-3" />} label="Work" />
          {(pulse.from_collab || pulse.from_workshop) && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              {pulse.from_workshop ? "from Workshop" : "from Collab"}
            </span>
          )}
        </div>
        <div
          className={cn(
            "aspect-video w-full overflow-hidden rounded-xl bg-muted",
            !pulse.cover_url && "gradient-soft",
          )}
          style={pulse.cover_url ? { backgroundImage: `url(${pulse.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        />
        <div className="line-clamp-2 font-display text-sm text-ink">{pulse.title}</div>
      </Link>
    );
  }

  if (pulse.kind === "collab") {
    return (
      <Link to="/collab/$slug" params={{ slug: pulse.slug }} className={cn(base)}>
        <PulseChip icon={<Megaphone className="h-3 w-3" />} label="Open Collab" />
        <div className="line-clamp-2 font-display text-base text-ink">{pulse.title}</div>
        {pulse.user_name && <div className="text-[11px] text-ink-muted">by {pulse.user_name}</div>}
      </Link>
    );
  }

  // group
  return (
    <Link to="/g/$slug" params={{ slug: pulse.slug }} className={cn(base)}>
      <PulseChip icon={<Users className="h-3 w-3" />} label="Group" />
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "h-10 w-10 shrink-0 rounded-full bg-muted",
            !pulse.avatar_url && "gradient-soft",
          )}
          style={pulse.avatar_url ? { backgroundImage: `url(${pulse.avatar_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        />
        <div className="line-clamp-2 font-display text-sm text-ink">{pulse.name}</div>
      </div>
    </Link>
  );
}

function PulseChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft">
      {icon} {label}
    </span>
  );
}

async function fetchPulse(): Promise<Pulse[]> {
  const today = new Date().toISOString();

  const [eventsRes, worksRes, collabsRes, groupsRes] = await Promise.allSettled([
    supabase
      .from("group_events")
      .select("id, slug, title, starts_at, cover_url, group:groups!group_events_group_id_fkey(slug)")
      .eq("status", "scheduled")
      .eq("visibility", "public")
      .gte("starts_at", today)
      .order("starts_at", { ascending: true })
      .limit(4),
    supabase
      .from("works")
      .select("id, title, slug, cover_url, source_collab_post_id, source_workshop_id, published_at")
      .eq("status", "published")
      .eq("visibility", "public")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(4),
    supabase
      .from("collab_posts")
      .select("id, title, slug, created_at, user:profiles!collab_posts_user_id_fkey(display_name,username)")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("groups")
      .select("id, name, slug, avatar_url, created_at")
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const items: Pulse[] = [];

  if (eventsRes.status === "fulfilled" && eventsRes.value.data) {
    for (const r of eventsRes.value.data as Array<{
      id: string; slug: string; title: string; starts_at: string; cover_url: string | null;
      group: { slug: string } | null;
    }>) {
      if (!r.group?.slug) continue;
      items.push({
        kind: "event",
        id: r.id,
        title: r.title,
        group_slug: r.group.slug,
        event_slug: r.slug,
        starts_at: r.starts_at,
        cover_url: r.cover_url,
      });
    }
  }

  if (worksRes.status === "fulfilled" && worksRes.value.data) {
    for (const r of worksRes.value.data as Array<{
      id: string; title: string; slug: string; cover_url: string | null;
      source_collab_post_id: string | null; source_workshop_id: string | null;
    }>) {
      items.push({
        kind: "work",
        id: r.id,
        title: r.title,
        slug: r.slug,
        cover_url: r.cover_url,
        from_collab: !!r.source_collab_post_id,
        from_workshop: !!r.source_workshop_id,
      });
    }
  }

  if (collabsRes.status === "fulfilled" && collabsRes.value.data) {
    for (const r of collabsRes.value.data as Array<{
      id: string; title: string; slug: string;
      user: { display_name: string | null; username: string | null } | null;
    }>) {
      items.push({
        kind: "collab",
        id: r.id,
        title: r.title,
        slug: r.slug,
        user_name: r.user?.display_name ?? r.user?.username ?? null,
      });
    }
  }

  if (groupsRes.status === "fulfilled" && groupsRes.value.data) {
    for (const r of groupsRes.value.data as Array<{
      id: string; name: string; slug: string; avatar_url: string | null;
    }>) {
      items.push({
        kind: "group",
        id: r.id,
        name: r.name,
        slug: r.slug,
        avatar_url: r.avatar_url,
      });
    }
  }

  // Light interleave so kinds aren't clumped: round-robin by kind.
  const byKind: Record<Pulse["kind"], Pulse[]> = { event: [], work: [], collab: [], group: [] };
  for (const it of items) byKind[it.kind].push(it);
  const order: Pulse["kind"][] = ["event", "work", "collab", "group"];
  const interleaved: Pulse[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const k of order) {
      const next = byKind[k].shift();
      if (next) {
        interleaved.push(next);
        added = true;
      }
    }
  }
  return interleaved.slice(0, 14);
}

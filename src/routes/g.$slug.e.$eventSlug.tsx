import { createFileRoute, Link, useRouter, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Calendar, Users, ArrowLeft, Tag, Repeat, Info, ListMusic, Sparkles, MessageSquare } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { usePlus } from "@/hooks/use-plus";
import { useUserRoles } from "@/hooks/use-user-role";
import { supabase } from "@/integrations/supabase/client";
import { getEventBySlug, getMyRsvp, listAttendees, listEventUpdates } from "@/lib/group-events.functions";
import { updateEventSeriesFuture, cancelEventSeriesFuture } from "@/lib/group-events-admin.functions";
import { EventLocationCard } from "@/components/event-location-card";
import { EventRsvpBlock, type MyRsvp } from "@/components/event-rsvp-block";
import { EventPromoPassBanner } from "@/components/event-promo-pass-banner";
import { EventWall } from "@/components/event-wall";
import { EventAttendeeWork } from "@/components/event-attendee-work";
import { EventShareSheet } from "@/components/event-share-sheet";
import { EventShowcaseStrip } from "@/components/event-showcase-strip";
import { ReportDialog } from "@/components/report-dialog";
import { LineupPanel } from "@/components/lineup-panel";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/g/$slug/e/$eventSlug")({
  loader: async ({ params }) => {
    try {
      return await getEventBySlug({ data: { groupSlug: params.slug, eventSlug: params.eventSlug } });
    } catch {
      throw notFound();
    }
  },
  component: EventPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl text-ink">Couldn't load this event.</h1>
        <p className="mt-2 text-sm text-ink-muted">{error.message}</p>
        <Button onClick={() => { reset(); router.invalidate(); }} className="mt-6 rounded-full">Try again</Button>
      </main>
    );
  },
  notFoundComponent: () => (
    <main className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-ink">Event not found.</h1>
      <Link to="/groups" className="mt-4 inline-block text-sm text-primary underline">Browse groups</Link>
    </main>
  ),
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [] };
    const ev = loaderData as { title: string; tagline: string | null; cover_url: string | null };
    return {
      meta: [
        { title: `${ev.title} — Workshop` },
        { name: "description", content: ev.tagline ?? "An event on Workshop." },
        { property: "og:title", content: ev.title },
        { property: "og:description", content: ev.tagline ?? "RSVP on Workshop." },
        ...(ev.cover_url ? [{ property: "og:image", content: ev.cover_url }] : []),
      ],
    };
  },
});

type EventRow = {
  id: string;
  slug: string;
  group_id: string;
  title: string;
  tagline: string | null;
  description: string | null;
  kind: string;
  format: "in_person" | "online" | "hybrid";
  cover_url: string | null;
  accent_color: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  venue_name: string | null;
  venue_address: string | null;
  venue_city_id: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  online_url: string | null;
  capacity: number | null;
  waitlist_enabled: boolean;
  visibility: "public" | "group_only" | "unlisted";
  rsvp_mode: string;
  status: "draft" | "scheduled" | "live" | "completed" | "canceled";
  is_official: boolean;
  promo_pass_months: number;
  featured_at: string | null;
  going_count: number;
  maybe_count: number;
  waitlist_count: number;
  series_key: string | null;
  short_code: string | null;
  created_by: string | null;
  group: { id: string; slug: string; name: string; avatar_url: string | null };
};

function EventPage() {
  const ev = Route.useLoaderData() as unknown as EventRow;
  const { user } = useAuth();
  const { isPlus } = usePlus();
  const qc = useQueryClient();
  const getMyRsvpFn = useServerFn(getMyRsvp);
  const listAttendeesFn = useServerFn(listAttendees);
  const listUpdatesFn = useServerFn(listEventUpdates);

  const { data: myRsvp } = useQuery({
    queryKey: ["event-rsvp", ev.id, user?.id ?? null],
    enabled: !!user,
    queryFn: () => getMyRsvpFn({ data: { event_id: ev.id } }),
  });

  const { data: attendees } = useQuery({
    queryKey: ["event-attendees", ev.id],
    queryFn: () => listAttendeesFn({ data: { event_id: ev.id } }),
    staleTime: 30_000,
  });

  const { data: updates } = useQuery({
    queryKey: ["event-updates", ev.id],
    queryFn: () => listUpdatesFn({ data: { event_id: ev.id } }),
    staleTime: 30_000,
  });

  // realtime: refresh on rsvp changes
  useEffect(() => {
    const ch = supabase
      .channel(`event-${ev.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_event_rsvps", filter: `event_id=eq.${ev.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["event-attendees", ev.id] });
        qc.invalidateQueries({ queryKey: ["event-rsvp", ev.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ev.id, qc]);

  const starts = new Date(ev.starts_at);
  const ends = new Date(ev.ends_at);
  const past = ends < new Date();
  const isFull = ev.capacity !== null && ev.going_count >= ev.capacity;

  const statusLabel =
    ev.status === "canceled" ? "Canceled" :
    past ? "Past" :
    isFull ? "Almost full" :
    starts < new Date() ? "Happening now" : "Upcoming";

  const going = (attendees ?? []).filter((a) => a.status === "going");

  const canonicalUrl = typeof window !== "undefined"
    ? `${window.location.origin}/g/${ev.group.slug}/e/${ev.slug}`
    : `/g/${ev.group.slug}/e/${ev.slug}`;
  const canBring = myRsvp?.status === "going" || myRsvp?.status === "maybe";

  return (
    <main className="pb-20">
      {/* Cover */}
      <div
        className={cn("relative h-56 w-full md:h-80", ev.cover_url ? "bg-cover bg-center" : "gradient-motion")}
        style={ev.cover_url ? { backgroundImage: `url(${ev.cover_url})` } : undefined}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-background" />
        <div className="absolute left-4 top-4">
          <Link
            to="/g/$slug"
            params={{ slug: ev.group.slug }}
            className="inline-flex items-center gap-1 rounded-full bg-background/80 px-3 py-1.5 text-xs font-medium text-ink shadow-soft backdrop-blur hover:bg-background"
          >
            <ArrowLeft className="h-3 w-3" /> {ev.group.name}
          </Link>
        </div>
        <div className="absolute right-4 top-4">
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium shadow-soft backdrop-blur",
              ev.status === "canceled" ? "bg-destructive/90 text-destructive-foreground" :
              past ? "bg-muted text-ink-muted" :
              isFull ? "bg-amber-500/90 text-white" :
              "bg-background/90 text-ink",
            )}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="mx-auto -mt-10 max-w-2xl px-4 md:px-6">
        <div className="rounded-3xl border border-border bg-surface p-6 shadow-lift">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft">
              <Tag className="h-3 w-3" /> {ev.kind.replace(/_/g, " ")}
            </span>
            {ev.is_official && (
              <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-medium text-ink-soft">Official</span>
            )}
          </div>
          <h1 className="mt-2 font-display text-3xl text-ink md:text-4xl">{ev.title}</h1>
          {ev.tagline && <p className="mt-1 text-base text-ink-soft">{ev.tagline}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-soft">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-ink-muted" />
              {starts.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              {" · "}
              {starts.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            </span>
            <a
              href={`/api/public/events/${ev.id}/ics`}
              className="text-xs text-primary hover:underline"
            >
              Add to calendar
            </a>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <Link to="/g/$slug" params={{ slug: ev.group.slug }} className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink">
              <Avatar className="h-7 w-7">
                <AvatarImage src={ev.group.avatar_url ?? undefined} />
                <AvatarFallback>{ev.group.name.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <span>Hosted by <span className="font-medium text-ink">{ev.group.name}</span></span>
            </Link>
            <div className="flex items-center gap-1">
              <ReportDialog entityType="group_event" entityId={ev.id} />
              <EventShareSheet
                shortCode={ev.short_code}
                eventTitle={ev.title}
                startsAt={ev.starts_at}
                canonicalUrl={canonicalUrl}
              />
            </div>
          </div>
        </div>
        {/* Series admin strip */}
        {ev.series_key && <SeriesAdminStrip eventId={ev.id} seriesKey={ev.series_key} />}


        {/* Location */}
        <div className="mt-5">
          <EventLocationCard
            format={ev.format}
            venueName={ev.venue_name}
            venueAddress={ev.venue_address}
            onlineUrl={ev.online_url}
            city={ev.venue_name ?? null}
          />
        </div>

        {/* Lineup (for lineup events) */}
        {ev.kind === "lineup" && (
          <LineupPanel eventId={ev.id} isHostOrAdmin={!!user && (user.id === ev.created_by)} />
        )}

        {/* RSVP */}
        <div className="mt-5">
          <EventRsvpBlock
            eventId={ev.id}
            groupSlug={ev.group.slug}
            eventSlug={ev.slug}
            myRsvp={(myRsvp as MyRsvp) ?? null}
            capacity={ev.capacity}
            goingCount={ev.going_count}
            waitlistEnabled={ev.waitlist_enabled}
          />
        </div>

        {/* Promo banner */}
        {ev.promo_pass_months > 0 && (
          <div className="mt-5">
            <EventPromoPassBanner months={ev.promo_pass_months} alreadyPlus={!!isPlus} />
          </div>
        )}

        {/* Who's going */}
        <div className="mt-6 rounded-3xl border border-border bg-surface p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg text-ink">Who's going</h3>
            <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
              <Users className="h-3.5 w-3.5" /> {ev.going_count}{ev.capacity ? ` / ${ev.capacity}` : ""} going
              {ev.maybe_count > 0 && ` · ${ev.maybe_count} maybe`}
              {ev.waitlist_count > 0 && ` · ${ev.waitlist_count} waitlist`}
            </span>
          </div>
          {going.length === 0 ? (
            <p className="text-sm text-ink-muted">No one's RSVP'd yet. Be first.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {going.slice(0, 24).map((a) => {
                type R = { user_id: string; profile: { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null };
                const p = (a as unknown as R).profile;
                if (!p) return null;
                return p.username ? (
                  <Link key={a.user_id} to="/u/$username" params={{ username: p.username }} className="flex flex-col items-center gap-1">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={p.avatar_url ?? undefined} />
                      <AvatarFallback>{(p.display_name ?? "?").slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <span className="max-w-[60px] truncate text-[10px] text-ink-muted">{p.display_name ?? p.username}</span>
                  </Link>
                ) : (
                  <div key={a.user_id} className="flex flex-col items-center gap-1">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>?</AvatarFallback>
                    </Avatar>
                  </div>
                );
              })}
              {going.length > 24 && (
                <div className="flex h-10 items-center justify-center rounded-full bg-muted px-3 text-xs text-ink-muted">
                  +{going.length - 24}
                </div>
              )}
            </div>
          )}
        </div>

        {/* About */}
        {ev.description && (
          <div className="mt-6 rounded-3xl border border-border bg-surface p-5 shadow-soft">
            <h3 className="mb-2 font-display text-lg text-ink">About</h3>
            <p className="whitespace-pre-wrap text-sm text-ink-soft">{ev.description}</p>
          </div>
        )}

        {/* Updates */}
        {updates && updates.length > 0 && (
          <div className="mt-6 rounded-3xl border border-border bg-surface p-5 shadow-soft">
            <h3 className="mb-3 font-display text-lg text-ink">Host updates</h3>
            <ul className="space-y-3">
              {updates.map((u) => (
                <li key={u.id}>
                  <div className="text-[11px] text-ink-muted">
                    {new Date(u.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-ink">{u.body}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Bringing tonight */}
        <EventShowcaseStrip eventId={ev.id} eventTitle={ev.title} canBring={canBring} />

        {/* What attendees are working on */}
        <EventAttendeeWork eventId={ev.id} />

        {/* Wall */}
        <div className="mt-6 rounded-3xl border border-border bg-surface p-5 shadow-soft">
          <EventWall eventId={ev.id} canPost={myRsvp?.status === "going" || myRsvp?.status === "maybe"} />
        </div>
      </div>
    </main>
  );
}

function SeriesAdminStrip({ eventId, seriesKey }: { eventId: string; seriesKey: string }) {
  const { isAdmin } = useUserRoles();
  const router = useRouter();
  const cancelFn = useServerFn(cancelEventSeriesFuture);
  const updateFn = useServerFn(updateEventSeriesFuture);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  if (!isAdmin) return null;

  async function cancelFuture() {
    if (!confirm("Cancel this and ALL future occurrences in the series? RSVPs will be notified.")) return;
    setBusy(true);
    try {
      const res = await cancelFn({ data: { series_key: seriesKey, from_event_id: eventId, reason: "Series canceled by host." } });
      toast.success(`Canceled ${res.canceled} occurrence${res.canceled === 1 ? "" : "s"}`);
      router.invalidate();
    } catch (ex) {
      toast.error((ex as Error).message);
    } finally { setBusy(false); }
  }

  async function applyEdit() {
    const patch: { title?: string; description?: string } = {};
    if (title.trim()) patch.title = title.trim();
    if (description.trim()) patch.description = description.trim();
    if (Object.keys(patch).length === 0) { setEditing(false); return; }
    setBusy(true);
    try {
      const res = await updateFn({ data: { series_key: seriesKey, from_event_id: eventId, patch } });
      toast.success(`Updated ${res.updated} occurrence${res.updated === 1 ? "" : "s"}`);
      setEditing(false);
      router.invalidate();
    } catch (ex) {
      toast.error((ex as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Repeat className="h-4 w-4 text-primary" />
        <span className="font-medium text-ink">Part of a recurring series</span>
        <span className="text-xs text-ink-muted">Admin actions affect this and all future occurrences.</span>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 rounded-full" disabled={busy} onClick={() => setEditing((e) => !e)}>
            {editing ? "Close" : "Edit all future"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 rounded-full text-destructive" disabled={busy} onClick={cancelFuture}>
            Cancel all future
          </Button>
        </div>
      </div>
      {editing && (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            placeholder="New title (leave blank to keep)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
          <textarea
            placeholder="New description (leave blank to keep)"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
          <p className="text-[11px] text-ink-muted">
            Time, date, and cadence stay unchanged. Edit individual occurrences for time shifts.
          </p>
          <Button size="sm" className="rounded-full" disabled={busy} onClick={applyEdit}>Apply to all future</Button>
        </div>
      )}
    </div>
  );
}

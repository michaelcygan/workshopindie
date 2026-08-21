import { createFileRoute, Link, useRouter, notFound } from "@tanstack/react-router";
import { shareImageMeta } from "@/lib/og-image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Calendar, Users, ArrowLeft, Tag, Repeat, Info, MessageSquare, ExternalLink, Globe, Image as ImageIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-role";
import { supabase } from "@/integrations/supabase/client";
import { getEventBySlug, getMyRsvp, listEventUpdates, listEventGroups, getEventJoinLink } from "@/lib/group-events.functions";
import { getMyEventAccess } from "@/lib/events/access.functions";
import { getEventCounts } from "@/lib/events/participation.functions";
import { eventStatusLabel, getEventLifecycle, getEventMoment } from "@/lib/events/lifecycle";
import { resolveEventHost } from "@/lib/events/host-label";

import { EventWallFeed } from "@/components/events/event-wall-feed";
import { EventWhosHere } from "@/components/events/event-whos-here";
import { updateEventSeriesFuture, cancelEventSeriesFuture } from "@/lib/group-events-admin.functions";
import { EventLocationCard } from "@/components/event-location-card";
import { EventRsvpBlock, type MyRsvp } from "@/components/event-rsvp-block";
import { HackathonPanel } from "@/components/event/hackathon-panel";
import { CoworkingBlock } from "@/components/events/coworking-block";
import {
  COWORKING_NOTE_PLACEHOLDER,
  COWORKING_NOTE_PROMPT,
  WRITING_NOTE_PLACEHOLDER,
  WRITING_NOTE_PROMPT,
  WRITING_WALL_SUGGESTION,
  isWritingSession,
  daypartLabel,
} from "@/lib/events/coworking";
import { eventKindLabel } from "@/lib/events/kinds";

import { EventShareSheet } from "@/components/event-share-sheet";

import { ReportDialog } from "@/components/report-dialog";
import { LineupPanel } from "@/components/lineup-panel";

import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EntityBlogPosts } from "@/components/entity-blog-posts";
import { EntityConnections } from "@/components/entity/entity-connections";
import { workshopEntityUrl } from "@/lib/entities/kinds";


export const Route = createFileRoute("/g/$slug/e/$eventSlug")({
  // ?story=<slug> makes an open story peek shareable and back-button friendly.
  validateSearch: (search: Record<string, unknown>): { story?: string } => ({
    story: typeof search.story === "string" && search.story ? search.story : undefined,
  }),

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
        <Button onClick={() => { reset(); router.invalidate(); }} className="mt-6 rounded-md">Try again</Button>
      </main>
    );
  },
  notFoundComponent: () => (
    <main className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-ink">Event not found.</h1>
      <Link to="/groups" className="mt-4 inline-block text-sm text-primary underline">Browse groups</Link>
    </main>
  ),
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [] };
    const ev = loaderData as {
      title: string;
      tagline: string | null;
      cover_url?: string | null;
      group: { slug: string };
    };
    const url = `https://workshopindie.com${workshopEntityUrl({ kind: "event", groupSlug: params.slug, slug: params.eventSlug })}`;
    return {
      meta: [
        { title: `${ev.title} — Workshop` },
        { name: "description", content: ev.tagline ?? "An event on Workshop." },
        { property: "og:title", content: ev.title },
        { property: "og:description", content: ev.tagline ?? "RSVP on Workshop." },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
        // The event's own flyer/cover — crawlers reject SVG cards.
        ...shareImageMeta(ev.cover_url, ev.title),
        { name: "twitter:title", content: ev.title },
        { name: "twitter:description", content: ev.tagline ?? "RSVP on Workshop." },
      ],
      links: [{ rel: "canonical", href: url }],
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
  photo_credit_name: string | null;
  photo_credit_url: string | null;
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
  has_online_url: boolean;
  published_at: string | null;
  archived_at: string | null;
  deleted_at?: string | null;
  capacity: number | null;
  overflow: number | null;
  workshop_venue_key: string | null;
  waitlist_enabled: boolean;
  visibility: "public" | "group_only" | "unlisted";
  rsvp_mode: string;
  status: "draft" | "scheduled" | "live" | "completed" | "canceled";
  is_official: boolean;
  
  featured_at: string | null;
  going_count: number;
  maybe_count: number;
  waitlist_count: number;
  series_key: string | null;
  short_code: string | null;
  created_by: string | null;
  lineup_capacity: number | null;
  source?: string | null;
  daypart: string | null;
  min_age: number | null;
  facilitation: string | null;
  drop_in_allowed: boolean | null;
  allowed_activities: string[] | null;
  arrival_note_public: string | null;
  external_organizer: string | null;
  external_url: string | null;
  group: { id: string; slug: string; name: string; avatar_url: string | null; kind?: string | null };
};


function EventPage() {
  const ev = Route.useLoaderData() as unknown as EventRow;
  const { story: storySlug } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { user } = useAuth();

  const qc = useQueryClient();
  const getMyRsvpFn = useServerFn(getMyRsvp);
  const getAccessFn = useServerFn(getMyEventAccess);
  const listUpdatesFn = useServerFn(listEventUpdates);
  const listEventGroupsFn = useServerFn(listEventGroups);
  const joinLinkFn = useServerFn(getEventJoinLink);
  const countsFn = useServerFn(getEventCounts);

  const { data: myRsvp } = useQuery({
    queryKey: ["event-rsvp", ev.id, user?.id ?? null],
    enabled: !!user,
    queryFn: () => getMyRsvpFn({ data: { event_id: ev.id } }),
  });

  const { data: access } = useQuery({
    queryKey: ["event-access", ev.id, user?.id ?? null],
    enabled: !!user,
    queryFn: () => getAccessFn({ data: { event_id: ev.id } }),
    staleTime: 30_000,
  });

  const { data: counts } = useQuery({
    queryKey: ["event-counts", ev.id],
    queryFn: () => countsFn({ data: { event_id: ev.id } }),
    staleTime: 30_000,
  });

  const { data: joinLink } = useQuery({
    queryKey: ["event-join-link", ev.id, user?.id ?? null],
    enabled: !!user && !!access?.canSeeOnlineUrl && ev.has_online_url,
    queryFn: () => joinLinkFn({ data: { event_id: ev.id } }),
    staleTime: 60_000,
  });

  const { data: updates } = useQuery({
    queryKey: ["event-updates", ev.id],
    queryFn: () => listUpdatesFn({ data: { event_id: ev.id } }),
    staleTime: 30_000,
  });

  const { data: listedGroups } = useQuery({
    queryKey: ["event-groups", ev.id],
    queryFn: () => listEventGroupsFn({ data: { event_id: ev.id } }),
    staleTime: 60_000,
  });

  const { data: features } = useQuery({
    queryKey: ["event-features", ev.id],
    queryFn: () => listEventFeatures({ data: { eventId: ev.id } }),
    staleTime: 60_000,
  });

  // realtime: refresh on rsvp / check-in changes
  useEffect(() => {
    const ch = supabase
      .channel(`event-${ev.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_event_rsvps", filter: `event_id=eq.${ev.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["event-counts", ev.id] });
        qc.invalidateQueries({ queryKey: ["event-roster", ev.id] });
        qc.invalidateQueries({ queryKey: ["event-rsvp", ev.id] });
        qc.invalidateQueries({ queryKey: ["event-access", ev.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ev.id, qc]);

  const starts = new Date(ev.starts_at);
  const lifecycle = getEventLifecycle(ev);
  const moment = getEventMoment(ev);
  const isDraft = lifecycle === "draft";
  const statusLabel = eventStatusLabel(ev);
  const isFull =
    ev.capacity !== null && ev.going_count >= ev.capacity + Math.max(0, ev.overflow ?? 0);
  const host = resolveEventHost(ev);
  const isCoworking = ev.kind === "coworking";
  const isWriting = isCoworking && isWritingSession(ev.allowed_activities);


  const canonicalUrl = typeof window !== "undefined"
    ? `${window.location.origin}${workshopEntityUrl({ kind: "event", groupSlug: ev.group.slug, slug: ev.slug })}`
    : workshopEntityUrl({ kind: "event", groupSlug: ev.group.slug, slug: ev.slug });

  const refreshAccess = () => {
    qc.invalidateQueries({ queryKey: ["event-access", ev.id] });
    qc.invalidateQueries({ queryKey: ["event-counts", ev.id] });
  };

  return (
    <main className="pb-28 md:pb-20">
      {/* Cover */}
      <div
        className={cn("relative h-56 w-full md:h-80", ev.cover_url ? "bg-cover bg-center" : "bg-secondary")}
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
              lifecycle === "canceled" ? "bg-destructive/90 text-destructive-foreground" :
              lifecycle === "archived" ? "bg-muted text-ink-muted" :
              moment === "live" ? "bg-primary text-primary-foreground" :
              isFull ? "bg-amber-500/90 text-white" :
              "bg-background/90 text-ink",
            )}
          >
            {statusLabel}
          </span>
        </div>
        {ev.cover_url && ev.photo_credit_name && (
          <div className="absolute bottom-2 right-3">
            {ev.photo_credit_url ? (
              <a
                href={ev.photo_credit_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-background/70 px-2 py-0.5 text-[10px] text-ink-muted backdrop-blur hover:text-ink"
              >
                Photo: {ev.photo_credit_name}
              </a>
            ) : (
              <span className="rounded-full bg-background/70 px-2 py-0.5 text-[10px] text-ink-muted backdrop-blur">
                Photo: {ev.photo_credit_name}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mx-auto mt-6 max-w-2xl px-4 md:px-6">
        {isDraft && (
          <div className="mb-4 rounded-xl border border-dashed border-primary/50 bg-primary/5 p-3 text-sm text-ink">
            <span className="font-medium">Draft.</span> Only you and admins can see this flyer. Publish it to open RSVPs.
          </div>
        )}

        <div className="rounded-xl border border-border bg-surface p-6 shadow-lift">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft">
              <Tag className="h-3 w-3" /> {eventKindLabel(ev.kind)}
              {isCoworking && ev.daypart ? ` · ${daypartLabel(ev.daypart)}` : ""}
            </span>
            {ev.source === "external" ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-ink-muted">
                External event
              </span>
            ) : ev.is_official ? (
              <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-medium text-ink-soft">Official</span>
            ) : null}
          </div>
          <h1 className="mt-2 font-display text-3xl text-ink md:text-4xl">{ev.title}</h1>
          {ev.tagline && <p className="mt-1 text-base text-ink-soft">{ev.tagline}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-soft">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-ink-muted" />
              {starts.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                timeZone: ev.timezone || undefined,
              })}
              {" · "}
              {starts.toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
                timeZone: ev.timezone || undefined,
                timeZoneName: "short",
              })}
            </span>

            <a
              href={`/api/public/events/${ev.id}/ics`}
              className="-my-1 inline-flex min-h-8 items-center py-1 text-xs text-primary hover:underline"
            >
              Add to calendar
            </a>

          </div>

          <div className="mt-4 flex items-center justify-between">
            {host.kind === "group" ? (
              <Link to="/g/$slug" params={{ slug: ev.group.slug }} className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={ev.group.avatar_url ?? undefined} />
                  <AvatarFallback>{ev.group.name.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <span>Hosted by <span className="font-medium text-ink">{host.label}</span></span>
              </Link>
            ) : host.href ? (
              <a
                href={host.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                  <Globe className="h-3.5 w-3.5 text-ink-muted" />
                </span>
                <span>
                  Hosted by <span className="font-medium text-ink">{host.label}</span>
                </span>
                <ExternalLink className="h-3 w-3 text-ink-muted" />
              </a>
            ) : (
              <span className="inline-flex items-center gap-2 text-sm text-ink-soft">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                  <Globe className="h-3.5 w-3.5 text-ink-muted" />
                </span>
                <span>
                  Hosted by <span className="font-medium text-ink">{host.label}</span>
                </span>
              </span>
            )}


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

          {listedGroups && listedGroups.length > 0 && (
            <div className="mt-3 -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 text-xs text-ink-muted [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <span className="shrink-0">Listed in</span>
              {listedGroups.map((g) => (
                <Link
                  key={g.id}
                  to="/g/$slug"
                  params={{ slug: g.slug }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-ink-soft hover:border-ink/40 hover:text-ink"
                >
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={g.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[8px]">{g.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <span className="whitespace-nowrap">{g.name}</span>
                </Link>
              ))}
            </div>
          )}

          <div className="mt-5 border-t border-border pt-4">
            <EventLocationCard
              format={ev.format}
              venueName={ev.venue_name}
              venueAddress={ev.venue_address}
              publicAddress={ev.source === "external"}
              venueLat={ev.venue_lat}
              venueLng={ev.venue_lng}
              workshopVenueKey={ev.workshop_venue_key}
              hostless={ev.facilitation === "hostless"}
              onlineUrl={joinLink?.online_url ?? null}
              city={ev.venue_name ?? null}
              variant="embedded"
            />
            {ev.has_online_url && !joinLink?.online_url && (
              <p className="mt-2 text-xs text-ink-muted">RSVP to get the join link.</p>
            )}
          </div>
        </div>

        {/* Featuring — who this night is built around (optional) */}
        <EventFeaturing features={features ?? []} />

        {/* Series admin strip */}
        {ev.series_key && <SeriesAdminStrip eventId={ev.id} seriesKey={ev.series_key} />}

        {/* RSVP — the one door into participation */}
        <div className="mt-5">
          <EventRsvpBlock
            eventId={ev.id}
            groupSlug={ev.group.slug}
            eventSlug={ev.slug}
            myRsvp={(myRsvp as MyRsvp) ?? null}
            capacity={ev.capacity}
            overflow={ev.overflow}
            goingCount={counts?.going ?? ev.going_count}
            waitlistEnabled={ev.waitlist_enabled}
            startsAt={ev.starts_at}
            timezone={ev.timezone}
            isRecurring={Boolean(ev.series_key)}
            notePrompt={isCoworking ? (isWriting ? WRITING_NOTE_PROMPT : COWORKING_NOTE_PROMPT) : null}
            notePlaceholder={
              isCoworking ? (isWriting ? WRITING_NOTE_PLACEHOLDER : COWORKING_NOTE_PLACEHOLDER) : null
            }
            footerSlot={
              !user ? (
                <p className="text-sm text-ink-muted">
                  <Link to="/login" className="text-primary underline">Sign in</Link> to RSVP and see who's here.
                </p>
              ) : (
                <p className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                  <Users className="h-3.5 w-3.5" />
                  {counts?.going ?? ev.going_count} going
                  {counts?.here ? ` · ${counts.here} here` : ""}
                </p>
              )
            }
          />
          {ev.source === "external" && (
            <div className="mt-3 rounded-xl border border-border bg-surface p-4">
              {ev.external_url && (
                <a
                  href={ev.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  Official event page
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <p className="mt-1 text-xs text-ink-muted">
                {ev.external_organizer ? `${ev.external_organizer} runs this event.` : "An outside organizer runs this event."}{" "}
                RSVPing on Workshop tells other members you're going — it doesn't hold a ticket, sign you
                up to perform, or cover door, age, or venue requirements.
              </p>
            </div>
          )}
        </div>


        {/* Four tabs. Nothing else. */}
        <div className="mt-6">
          <Tabs
            defaultValue={
              moment === "live" && isCoworking ? "here" : moment === "upcoming" ? "about" : "wall"
            }
          >
            <TabsList className="sticky top-2 z-10 grid w-full grid-cols-4 rounded-full bg-muted p-1 backdrop-blur">
              <TabsTrigger value="about" className="rounded-full text-xs"><Info className="mr-1 h-3.5 w-3.5" /> About</TabsTrigger>
              <TabsTrigger value="here" className="rounded-full text-xs"><Users className="mr-1 h-3.5 w-3.5" /> Who's here</TabsTrigger>
              <TabsTrigger value="wall" className="rounded-full text-xs"><MessageSquare className="mr-1 h-3.5 w-3.5" /> Wall</TabsTrigger>
              <TabsTrigger value="gallery" className="rounded-full text-xs"><ImageIcon className="mr-1 h-3.5 w-3.5" /> Gallery</TabsTrigger>
            </TabsList>

            <TabsContent value="about" className="mt-5 space-y-6">
              {isCoworking && (
                <CoworkingBlock
                  daypart={ev.daypart}
                  facilitation={ev.facilitation}
                  dropInAllowed={ev.drop_in_allowed}
                  allowedActivities={ev.allowed_activities}
                  arrivalNote={ev.arrival_note_public}
                  minAge={ev.min_age}
                  capacity={ev.capacity}
                  overflow={ev.overflow}
                  workshopVenueKey={ev.workshop_venue_key}
                  startsAt={ev.starts_at}
                  endsAt={ev.ends_at}
                  timezone={ev.timezone}
                />
              )}
              {ev.kind === "hackathon" && (
                <HackathonPanel
                  eventId={ev.id}
                  startsAt={ev.starts_at}
                  timezone={ev.timezone}
                  signedIn={Boolean(user)}
                  fullGroupUrl={joinLink?.online_url ?? null}
                />
              )}
              {ev.description ? (
                <div className="rounded-xl border border-border bg-surface p-5 shadow-soft">
                  <p className="whitespace-pre-wrap text-sm text-ink-soft">{ev.description}</p>
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-border bg-background p-6 text-center text-sm text-ink-muted">
                  No description yet.
                </p>
              )}
              {updates && updates.length > 0 && (
                <div className="rounded-xl border border-border bg-surface p-5 shadow-soft">
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
              {ev.lineup_capacity != null && (
                <LineupPanel
                  eventId={ev.id}
                  groupSlug={ev.group.slug}
                  eventSlug={ev.slug}
                  isHostOrAdmin={Boolean(access?.canEdit)}
                />
              )}
            </TabsContent>

            <TabsContent value="here" className="mt-5">
              <EventWhosHere eventId={ev.id} access={access ?? null} onChanged={refreshAccess} />
            </TabsContent>

            <TabsContent value="wall" className="mt-5">
              <EventWallFeed
                eventId={ev.id}
                view="wall"
                suggestions={
                  isCoworking
                    ? [
                        "I'm here — sitting",
                        isWriting ? WRITING_WALL_SUGGESTION : "Working on",
                        "Heading out — good session",
                      ]
                    : ev.workshop_venue_key
                      ? ["I'm here — sitting", "Where is everyone sitting?", "I'm on my way — arriving around"]
                      : undefined
                }
              />
            </TabsContent>

            <TabsContent value="gallery" className="mt-5">
              <EventWallFeed eventId={ev.id} view="gallery" />
            </TabsContent>
          </Tabs>
        </div>

        <EntityBlogPosts
          kind="event"
          entityId={ev.id}
          heading="Stories from this Event"
          trustedOnly
          canWrite={Boolean(access?.canEdit)}
          writeLabel="Write about this Event"
          emptyLabel="No stories yet. Write the first one from this Event."
          className="mt-10"
          openSlug={storySlug}
          onOpenSlugChange={(s) =>
            navigate({
              to: "/g/$slug/e/$eventSlug",
              params: { slug: ev.group.slug, eventSlug: ev.slug },
              search: { story: s ?? undefined },
              replace: true,
            })
          }
        />

        <EntityConnections kind="event" entityId={ev.id} className="mt-10" />


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
          <Button size="sm" variant="ghost" className="h-7 rounded-md" disabled={busy} onClick={() => setEditing((e) => !e)}>
            {editing ? "Close" : "Edit all future"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 rounded-md text-destructive" disabled={busy} onClick={cancelFuture}>
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
          <Button size="sm" className="rounded-md" disabled={busy} onClick={applyEdit}>Apply to all future</Button>
        </div>
      )}
    </div>
  );
}

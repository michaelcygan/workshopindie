import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, MapPin, Users, Check, X, Sparkles, ExternalLink, Clock, Rocket, Ban, Loader2 } from "lucide-react";
import { WorkshopToolsPanel } from "@/components/workshop-tools-panel";
import { VenueMap } from "@/components/venue-map";
import { ChannelView } from "@/components/channel-view";
import { ensureWorkshopRoom } from "@/lib/workshop-room.functions";
import { useDocumentMeta, useJsonLd } from "@/lib/seo";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CategoryChip } from "@/components/category-chip";
import { ImageUpload } from "@/components/image-upload";
import { ReportDialog } from "@/components/report-dialog";
import { ShareSheet } from "@/components/share-sheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/workshops/$slug")({
  component: WorkshopDetail,
  loader: async ({ params }) => {
    const { getWorkshopSeo } = await import("@/lib/seo-loaders.functions");
    const data = await getWorkshopSeo({ data: { slug: params.slug } });
    return { seo: data };
  },
  head: ({ params, loaderData }) => {
    const w = loaderData?.seo;
    const url = `https://workshopindie.com/workshops/${params.slug}`;
    const title = w?.title ? `${w.title} — Workshop` : "Workshop";
    const description = w?.prompt?.slice(0, 160) ?? `A ${w?.category ?? "creative"} Workshop on Workshop.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});

type Workshop = {
  id: string; title: string; slug: string; category: "film" | "music" | "writing" | "build" | "visual";
  prompt: string | null; starts_at: string | null; ends_at: string | null;
  location_type: "online" | "in_person" | "hybrid"; location_text: string | null; external_call_url: string | null;
  venue_name: string | null; venue_address: string | null; venue_lat: number | null; venue_lng: number | null;
  participant_cap: number | null; confirmed_count: number; application_count: number;
  status: string; host_user_id: string; visibility: string;
  min_age: number | null; max_age: number | null;
  check_in_opens_at: string | null; check_in_closes_at: string | null;
  host: { id: string; display_name: string | null; username: string | null; avatar_url: string | null } | null;
};

async function fetchWorkshop(slug: string): Promise<Workshop | null> {
  const { data, error } = await supabase
    .from("workshops")
    .select("*, host:profiles!workshops_host_user_id_fkey(id,display_name,username,avatar_url)")
    .eq("slug", slug).maybeSingle();
  if (error) throw error;
  return (data as unknown as Workshop) ?? null;
}

function whenText(starts: string | null, ends: string | null) {
  if (!starts) return "Time TBD";
  const s = new Date(starts); const e = ends ? new Date(ends) : null;
  const date = s.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  const t1 = s.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const t2 = e ? e.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
  return `${date} · ${t1}${t2 ? ` – ${t2}` : ""}`;
}

function WorkshopDetail() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: ws, isLoading } = useQuery({ queryKey: ["workshop", slug], queryFn: () => fetchWorkshop(slug) });

  useDocumentMeta({
    title: ws?.title,
    description: ws?.prompt ?? `A ${ws?.category ?? ""} Workshop on Workshop.`,
    type: "article",
  });
  useJsonLd(ws ? {
    "@context": "https://schema.org",
    "@type": "Event",
    name: ws.title,
    description: ws.prompt ?? undefined,
    startDate: ws.starts_at ?? undefined,
    endDate: ws.ends_at ?? undefined,
    eventAttendanceMode: ws.location_type === "online"
      ? "https://schema.org/OnlineEventAttendanceMode"
      : ws.location_type === "hybrid" ? "https://schema.org/MixedEventAttendanceMode"
      : "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: ws.status === "canceled" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    location: ws.location_type === "online"
      ? { "@type": "VirtualLocation", url: ws.external_call_url ?? undefined }
      : { "@type": "Place", name: ws.location_text ?? "TBD" },
    organizer: ws.host ? { "@type": "Person", name: ws.host.display_name ?? ws.host.username ?? "Host" } : undefined,
  } : null);

  if (isLoading) return <main className="mx-auto max-w-4xl px-4 py-14"><div className="h-8 w-48 animate-pulse rounded bg-surface-2" /></main>;
  if (!ws) return <main className="mx-auto max-w-4xl px-4 py-14 text-center"><h1 className="font-display text-3xl">Workshop not found</h1><Link to="/workshops" className="mt-4 inline-block text-gradient-motion underline">Back to Workshops</Link></main>;

  const isHost = user?.id === ws.host_user_id;
  const now = Date.now();
  const startMs = ws.starts_at ? new Date(ws.starts_at).getTime() : null;
  const endMs = ws.ends_at ? new Date(ws.ends_at).getTime() : null;
  const isLive = startMs && endMs && now >= startMs - 30 * 60_000 && now <= endMs + 60 * 60_000;
  const isOver = endMs && now > endMs;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:py-12">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2">
          <CategoryChip category={ws.category} />
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize text-ink-soft">{ws.status}</span>
          {isHost && <span className="rounded-full bg-violet/10 px-2.5 py-0.5 text-xs font-medium text-violet">You're hosting</span>}
          {(ws.min_age != null || ws.max_age != null) && (
            <span className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-ink-soft">
              {ws.min_age != null && ws.max_age != null ? `Ages ${ws.min_age}–${ws.max_age}` : ws.min_age != null ? `${ws.min_age}+` : `Up to ${ws.max_age}`}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <ShareSheet
              entity={{
                type: "workshop",
                id: ws.id,
                url: `https://workshopindie.com/workshops/${ws.slug}`,
                title: ws.title,
                subtitle: ws.prompt ?? undefined,
              }}
            />
            {!isHost && user && <ReportDialog entityType="workshop" entityId={ws.id} />}
          </div>
        </div>
        <h1 className="mt-3 font-display text-4xl text-ink md:text-5xl">{ws.title}</h1>
        {ws.prompt && <p className="mt-3 max-w-2xl text-ink-soft">{ws.prompt}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4 text-primary" /> {whenText(ws.starts_at, ws.ends_at)}</span>
          <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" /> {ws.location_type === "online" ? "Online" : ws.location_text || ws.location_type}</span>
          <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-primary" /> {ws.confirmed_count}{ws.participant_cap ? `/${ws.participant_cap}` : ""} confirmed</span>
        </div>

        {ws.host && (
          <Link to="/u/$username" params={{ username: ws.host.username ?? "" }}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm hover:shadow-soft">
            <Avatar className="h-6 w-6"><AvatarImage src={ws.host.avatar_url ?? undefined} /><AvatarFallback className="text-[10px]">{(ws.host.display_name || ws.host.username || "·")[0]}</AvatarFallback></Avatar>
            <span className="text-ink-soft">Hosted by</span>
            <span className="text-ink">{ws.host.display_name || ws.host.username}</span>
          </Link>
        )}
      </motion.div>

      {ws.venue_lat != null && ws.venue_lng != null && (
        <section className="mt-8 max-w-md">
          <h2 className="font-display text-lg text-ink">Where</h2>
          {ws.venue_name && <div className="mt-2 text-sm font-medium text-ink">{ws.venue_name}</div>}
          {ws.venue_address && <div className="text-xs text-ink-muted">{ws.venue_address}</div>}
          <div className="mt-3">
            <VenueMap lat={ws.venue_lat} lng={ws.venue_lng} label={ws.venue_name ?? undefined} />
          </div>
        </section>
      )}

      {isHost && <HostStatusBar ws={ws} onChanged={() => qc.invalidateQueries({ queryKey: ["workshop", slug] })} />}

      <CheckInPanel ws={ws} />

      <RolesAndApply ws={ws} />

      {isHost && <HostApplications ws={ws} />}

      {(isLive || isHost) && <Room ws={ws} />}

      {isHost && isOver && ws.status !== "shipped" && <FinalizePanel ws={ws} onShipped={() => qc.invalidateQueries({ queryKey: ["workshop", slug] })} />}

      {ws.status === "shipped" && <ShippedBanner workshopId={ws.id} />}
    </main>
  );
}

/* ---------- Roles & Apply ---------- */

function RolesAndApply({ ws }: { ws: Workshop }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: roles = [] } = useQuery({
    queryKey: ["ws-roles", ws.id],
    queryFn: async () => {
      const { data } = await supabase.from("workshop_roles").select("*").eq("workshop_id", ws.id).order("sort_order");
      return data ?? [];
    },
  });
  const { data: myApp } = useQuery({
    queryKey: ["ws-my-app", ws.id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("workshop_applications").select("*").eq("workshop_id", ws.id).eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const [openRoleId, setOpenRoleId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function apply(roleId: string | null) {
    if (!user) return navigate({ to: "/login" });
    setSubmitting(true);
    const { error } = await supabase.from("workshop_applications").insert({
      workshop_id: ws.id, user_id: user.id, role_id: roleId, note: note || null, status: "applied",
    });
    setSubmitting(false);
    if (error) {
      const msg = error.message || "";
      if (/ages? \d+/i.test(msg) || /date of birth/i.test(msg)) {
        return toast.error(msg.replace(/^.*?:\s*/, ""), {
          description: "Update your date of birth in Settings if this is incorrect.",
        });
      }
      return toast.error(msg);
    }
    toast.success("Application sent");
    setOpenRoleId(null); setNote("");
    qc.invalidateQueries({ queryKey: ["ws-my-app", ws.id, user.id] });
  }

  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl text-ink">Roles</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {roles.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-medium text-ink">{r.role_name}</h3>
              <span className="text-xs text-ink-muted">{r.quantity} seat{r.quantity > 1 ? "s" : ""}</span>
            </div>
            <Button
              size="sm"
              variant={openRoleId === r.id ? "secondary" : "outline"}
              className="mt-3 rounded-full"
              disabled={!!myApp || ws.host_user_id === user?.id}
              onClick={() => setOpenRoleId(openRoleId === r.id ? null : r.id)}
            >
              {ws.host_user_id === user?.id ? "You're hosting" : myApp ? `Already applied (${myApp.status})` : "Apply for this role"}
            </Button>
            <AnimatePresence>
              {openRoleId === r.id && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <Textarea className="mt-3" rows={3} placeholder="Optional note to the host (links, vibe, why you)" value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setOpenRoleId(null)}>Cancel</Button>
                    <Button size="sm" className="rounded-full" disabled={submitting} onClick={() => apply(r.id)}>{submitting ? "Sending…" : "Send application"}</Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Host Applications ---------- */

function HostApplications({ ws }: { ws: Workshop }) {
  const qc = useQueryClient();
  const { data: apps = [] } = useQuery({
    queryKey: ["ws-apps", ws.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("workshop_applications")
        .select("*, applicant:profiles!workshop_applications_user_id_fkey(id,display_name,username,avatar_url,headline), role:workshop_roles(role_name)")
        .eq("workshop_id", ws.id)
        .order("submitted_at", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase.channel(`ws-apps-${ws.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workshop_applications", filter: `workshop_id=eq.${ws.id}` },
        () => qc.invalidateQueries({ queryKey: ["ws-apps", ws.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ws.id, qc]);

  async function decide(appId: string, accept: boolean, app: typeof apps[number]) {
    const newStatus = accept ? "confirmed" : "declined";
    const { error } = await supabase.from("workshop_applications").update({
      status: newStatus, confirmed_at: accept ? new Date().toISOString() : null,
    }).eq("id", appId);
    if (error) return toast.error(error.message);

    if (accept) {
      // Add to participants
      await supabase.from("workshop_participants").insert({
        workshop_id: ws.id, user_id: app.user_id, role_id: app.role_id, participant_status: "confirmed",
      });
    }
    qc.invalidateQueries({ queryKey: ["ws-apps", ws.id] });
    qc.invalidateQueries({ queryKey: ["workshop", ws.slug] });
    toast.success(accept ? "Confirmed" : "Declined");
  }

  if (apps.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl text-ink">Applications <span className="ml-1 text-base text-ink-muted">({apps.length})</span></h2>
      <div className="mt-4 space-y-2">
        {apps.map((a: any) => (
          <div key={a.id} className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-3">
            <Avatar className="h-9 w-9"><AvatarImage src={a.applicant?.avatar_url ?? undefined} /><AvatarFallback className="text-xs">{(a.applicant?.display_name || a.applicant?.username || "·")[0]}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <Link to="/u/$username" params={{ username: a.applicant?.username ?? "" }} className="font-medium text-ink hover:underline">
                  {a.applicant?.display_name || a.applicant?.username || "Someone"}
                </Link>
                {a.role?.role_name && <span className="text-xs text-ink-muted">for {a.role.role_name}</span>}
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-ink-soft">{a.status}</span>
              </div>
              {a.applicant?.headline && <p className="text-xs text-ink-muted">{a.applicant.headline}</p>}
              {a.note && <p className="mt-1 text-sm text-ink-soft">{a.note}</p>}
              {a.status === "applied" && (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" className="rounded-full gap-1" onClick={() => decide(a.id, true, a)}><Check className="h-3.5 w-3.5" /> Confirm</Button>
                  <Button size="sm" variant="ghost" className="rounded-full gap-1" onClick={() => decide(a.id, false, a)}><X className="h-3.5 w-3.5" /> Decline</Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Active Room ---------- */

function Room({ ws }: { ws: Workshop }) {
  const { user } = useAuth();
  const ensureRoom = useServerFn(ensureWorkshopRoom);

  // Gate: only host or a confirmed participant can mount the live room.
  const { data: myPart } = useQuery({
    queryKey: ["ws-room-membership", ws.id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("workshop_participants")
        .select("id,participant_status")
        .eq("workshop_id", ws.id).eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const isHost = user?.id === ws.host_user_id;
  const memberStatus = myPart?.participant_status ?? null;
  const isMember =
    isHost || (memberStatus !== null && ["confirmed", "checked_in", "completed"].includes(memberStatus));

  const { data: roomData, isLoading: roomLoading, error: roomError } = useQuery({
    queryKey: ["ws-paired-room", ws.id],
    enabled: !!user && isMember,
    staleTime: Infinity,
    queryFn: () => ensureRoom({ data: { workshopId: ws.id } }),
  });

  if (!user) return null;

  if (!isMember) {
    return (
      <section className="mt-10 rounded-2xl border border-dashed border-border bg-surface p-6 text-center">
        <span className="gradient-motion mx-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground"><Sparkles className="h-5 w-5" /></span>
        <p className="mt-2 text-sm text-ink-muted">The live Workshop opens for confirmed participants.</p>
      </section>
    );
  }

  if (roomLoading || !roomData) {
    return (
      <section className="mt-10 flex items-center justify-center rounded-2xl border border-border bg-surface p-10">
        <Loader2 className="h-4 w-4 animate-spin text-ink-muted" />
      </section>
    );
  }

  if (roomError) {
    return (
      <section className="mt-10 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-ink-soft">
        Couldn't open the live Workshop: {(roomError as Error).message}
      </section>
    );
  }

  const pinned = (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="gradient-motion inline-flex h-7 w-7 items-center justify-center rounded-full text-primary-foreground"><Sparkles className="h-4 w-4" /></span>
      <span className="font-medium text-ink">{ws.title}</span>
      {ws.external_call_url && (
        <a
          href={ws.external_call_url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1.5 text-gradient-motion hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Join external call
        </a>
      )}
    </div>
  );

  return (
    <section className="mt-10">
      <ChannelView
        key={roomData.roomId}
        roomId={roomData.roomId}
        title={ws.title}
        initialMode="voice"
        pinned={pinned}
        workshopId={ws.id}
      />
      <WorkshopToolsPanel workshopId={ws.id} hostUserId={ws.host_user_id} category={ws.category} />
    </section>
  );
}

/* ---------- Finalize ---------- */

function FinalizePanel({ ws, onShipped }: { ws: Workshop; onShipped: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState(ws.title);
  const [excerpt, setExcerpt] = useState(ws.prompt?.slice(0, 180) ?? "");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [primaryUrl, setPrimaryUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function ship() {
    if (!user) return;
    if (!title.trim()) return toast.error("Give the Work a title");
    setSubmitting(true);

    const { data: work, error } = await supabase.from("works").insert({
      title: title.trim(), slug: "",
      category: ws.category,
      excerpt: excerpt || null,
      description: description || null,
      cover_url: coverUrl,
      primary_url: primaryUrl || null,
      source_type: "workshop",
      source_workshop_id: ws.id,
      license_type: "cc_by",
      status: "published",
      visibility: "public",
      created_by: user.id,
    }).select("id,slug").single();

    if (error || !work) { setSubmitting(false); return toast.error(error?.message ?? "Couldn't publish"); }

    // Pull confirmed participants and credit them
    const { data: parts } = await supabase
      .from("workshop_participants")
      .select("user_id, role:workshop_roles(role_name)")
      .eq("workshop_id", ws.id)
      .in("participant_status", ["confirmed", "checked_in", "completed"]);

    const credits = (parts ?? []).map((p: any, i: number) => ({
      work_id: work.id, user_id: p.user_id,
      role_label: p.user_id === ws.host_user_id ? "Host" : (p.role?.role_name || "Collaborator"),
      sort_order: p.user_id === ws.host_user_id ? 0 : i + 1,
    }));
    if (!credits.find((c) => c.user_id === user.id)) {
      credits.unshift({ work_id: work.id, user_id: user.id, role_label: "Host", sort_order: 0 });
    }
    if (credits.length > 0) await supabase.from("work_credits").insert(credits);

    await supabase.from("workshops").update({ status: "shipped" }).eq("id", ws.id);

    setSubmitting(false);
    toast.success("Shipped to the Gallery");
    onShipped();
    navigate({ to: "/works/$slug", params: { slug: work.slug } });
  }

  return (
    <section className="mt-10 rounded-3xl border border-border bg-surface p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="gradient-motion inline-flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground"><Sparkles className="h-5 w-5" /></span>
        <h2 className="font-display text-2xl text-ink">Finalize the Work</h2>
      </div>
      <p className="mt-1 text-sm text-ink-muted">Publish what you made. Every confirmed participant will be credited.</p>

      <div className="mt-5 space-y-4">
        <ImageUpload value={coverUrl} onChange={setCoverUrl} bucket="work-covers" aspect="portrait" label="Upload a cover (4:5)" />
        <Input maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <Input maxLength={180} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="One-line excerpt" />
        <Textarea rows={5} maxLength={3000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What did you make? How did it go?" />
        <Input type="url" value={primaryUrl} onChange={(e) => setPrimaryUrl(e.target.value)} placeholder="Primary URL (Vimeo, Bandcamp, GitHub, your site) — optional" />
        <div className="flex justify-end">
          <Button onClick={ship} disabled={submitting} className="rounded-full">{submitting ? "Publishing…" : "Publish Work"}</Button>
        </div>
      </div>
    </section>
  );
}

function ShippedBanner({ workshopId }: { workshopId: string }) {
  const { data: work } = useQuery({
    queryKey: ["ws-shipped-work", workshopId],
    queryFn: async () => {
      const { data } = await supabase.from("works").select("slug,title").eq("source_workshop_id", workshopId).maybeSingle();
      return data;
    },
  });
  if (!work) return null;
  return (
    <section className="mt-10 rounded-3xl border border-primary/30 bg-primary/5 p-6 text-center">
      <span className="gradient-motion mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full text-primary-foreground"><Sparkles className="h-6 w-6" /></span>
      <h2 className="mt-2 font-display text-2xl text-ink">Shipped: {work.title}</h2>
      <Link to="/works/$slug" params={{ slug: work.slug }} className="mt-3 inline-block">
        <Button className="rounded-full">View the Work</Button>
      </Link>
    </section>
  );
}

/* ---------- Host Status Bar ---------- */

function HostStatusBar({ ws, onChanged }: { ws: Workshop; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  async function setStatus(status: "draft" | "open" | "check_in" | "active" | "finalizing" | "shipped" | "archived" | "canceled", extra: Record<string, any> = {}) {
    setBusy(true);
    const { error } = await supabase.from("workshops").update({ status, ...extra }).eq("id", ws.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    onChanged();
  }

  const isDraft = ws.status === "draft";
  const isOpen = ws.status === "open";
  const canCancel = ["draft", "open", "check_in", "active"].includes(ws.status);
  if (!isDraft && !isOpen && !canCancel) return null;

  return (
    <section className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3">
      <span className="text-sm text-ink-muted">Status:</span>
      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize text-ink-soft">{ws.status.replace("_", " ")}</span>
      <div className="ml-auto flex flex-wrap gap-2">
        {isDraft && (
          <Button size="sm" disabled={busy} className="rounded-full gap-1.5" onClick={() => setStatus("open")}>
            <Rocket className="h-3.5 w-3.5" /> Publish
          </Button>
        )}
        {isOpen && (
          <Button size="sm" disabled={busy} variant="outline" className="rounded-full gap-1.5"
            onClick={() => {
              const opens = new Date().toISOString();
              const closes = new Date(Date.now() + 30 * 60_000).toISOString();
              setStatus("check_in", { check_in_opens_at: opens, check_in_closes_at: closes });
            }}>
            <Clock className="h-3.5 w-3.5" /> Open check-in (30 min)
          </Button>
        )}
        {canCancel && (
          <Button size="sm" disabled={busy} variant="ghost" className="rounded-full gap-1.5 text-ink-muted hover:text-ink"
            onClick={() => { if (confirm("Cancel this Workshop?")) setStatus("canceled"); }}>
            <Ban className="h-3.5 w-3.5" /> Cancel
          </Button>
        )}
      </div>
    </section>
  );
}

/* ---------- Check-in Panel ---------- */

function CheckInPanel({ ws }: { ws: Workshop }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: myPart } = useQuery({
    queryKey: ["ws-mypart", ws.id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("workshop_participants")
        .select("id,checked_in_at,participant_status")
        .eq("workshop_id", ws.id).eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  if (!user || !myPart) return null;

  const now = Date.now();
  const opensAt = ws.check_in_opens_at ? new Date(ws.check_in_opens_at).getTime() : null;
  const closesAt = ws.check_in_closes_at ? new Date(ws.check_in_closes_at).getTime() : null;
  const inWindow = opensAt && closesAt && now >= opensAt && now <= closesAt;
  if (!inWindow || myPart.checked_in_at) return null;

  async function checkIn() {
    const { error } = await supabase.from("workshop_participants")
      .update({ checked_in_at: new Date().toISOString(), participant_status: "checked_in" })
      .eq("id", myPart!.id);
    if (error) return toast.error(error.message);
    toast.success("Checked in. See you in the Workshop.");
    qc.invalidateQueries({ queryKey: ["ws-mypart", ws.id, user!.id] });
  }

  return (
    <section className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <span className="gradient-motion inline-flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground"><Sparkles className="h-5 w-5" /></span>
      <p className="text-sm text-ink"><span className="font-medium">Check-in is open.</span> Confirm you're here so the host can start.</p>
      <Button size="sm" className="ml-auto rounded-full" onClick={checkIn}>Check in</Button>
    </section>
  );
}

